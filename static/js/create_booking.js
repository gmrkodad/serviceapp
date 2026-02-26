const token = localStorage.getItem("access");
if (!token) window.location.href = "/login/";

const errorEl = document.getElementById("error");
const successEl = document.getElementById("success");
const form = document.getElementById("booking-form");
const dateInput = document.getElementById("date");
const addressInput = document.getElementById("address");
const customerLocationInput = document.getElementById("customer-location");
const useCurrentLocationBtn = document.getElementById("use-current-location");
const timeSlotInput = document.getElementById("time-slot");
const landmarkInput = document.getElementById("landmark");
const notesInput = document.getElementById("notes");
const submitBtn = document.getElementById("submit-booking");

const selectedServiceNameEl = document.getElementById("selected-service-name");
const selectedProviderNameEl = document.getElementById("selected-provider-name");
const selectedProviderRatingEl = document.getElementById("selected-provider-rating");
const selectedProviderPriceEl = document.getElementById("selected-provider-price");
const selectedProviderLocationEl = document.getElementById("selected-provider-location");

const serviceId = Number(localStorage.getItem("selectedService"));
const providerId = Number(localStorage.getItem("selectedProvider"));

if (!serviceId || !providerId) {
  errorEl.textContent = "Service or provider not selected. Please choose again.";
  errorEl.classList.remove("hidden");
  setTimeout(() => {
    window.location.href = "/";
  }, 1200);
}

const today = new Date().toISOString().split("T")[0];
dateInput.min = today;
if (!dateInput.value) dateInput.value = today;

async function getBestBrowserPosition() {
  if (!navigator.geolocation) return null;

  const tryOnce = () =>
    new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position),
        () => resolve(null),
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });

  let best = null;
  for (let i = 0; i < 2; i += 1) {
    const pos = await tryOnce();
    if (!pos) continue;
    if (!best || pos.coords.accuracy < best.coords.accuracy) {
      best = pos;
    }
    if (best.coords.accuracy <= 120) break;
  }

  return best;
}

async function reverseGeocodeAddress(lat, lng) {
  const res = await fetch(
    `/api/accounts/geo/reverse/?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) return null;
  return res.json();
}

const savedCity = localStorage.getItem("location_city");
if (savedCity && customerLocationInput) {
  customerLocationInput.value = savedCity;
}

if (useCurrentLocationBtn && customerLocationInput) {
  useCurrentLocationBtn.addEventListener("click", async () => {
    if (!navigator.geolocation) {
      errorEl.textContent = "Geolocation is not supported in this browser.";
      errorEl.classList.remove("hidden");
      return;
    }

    errorEl.classList.add("hidden");
    useCurrentLocationBtn.disabled = true;
    useCurrentLocationBtn.textContent = "Detecting...";

    const pos = await getBestBrowserPosition();
    if (!pos) {
      useCurrentLocationBtn.disabled = false;
      useCurrentLocationBtn.textContent = "Use Current Location";
      errorEl.textContent = "Unable to fetch current location. Please allow location permission.";
      errorEl.classList.remove("hidden");
      return;
    }

    const lat = pos.coords.latitude.toFixed(6);
    const lng = pos.coords.longitude.toFixed(6);
    const accuracy = Math.round(pos.coords.accuracy || 0);

    if (accuracy > 150) {
      useCurrentLocationBtn.disabled = false;
      useCurrentLocationBtn.textContent = "Use Current Location";
      errorEl.textContent = `Location accuracy is too low (${accuracy}m). Please retry.`;
      errorEl.classList.remove("hidden");
      return;
    }

    const geocoded = await reverseGeocodeAddress(lat, lng);
    const resolvedAddress = geocoded?.display_name || `${lat}, ${lng}`;
    customerLocationInput.value = resolvedAddress;

    if (!addressInput.value.trim() && geocoded?.display_name) {
      addressInput.value = geocoded.display_name;
    }

    if (geocoded?.city) {
      localStorage.setItem("location_city", geocoded.city);
    }

    useCurrentLocationBtn.disabled = false;
    useCurrentLocationBtn.textContent = "Use Current Location";
  });
}

async function loadBookingSummary() {
  if (!serviceId || !providerId) return;

  try {
    const categoriesRes = await fetch("/api/services/categories/", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!categoriesRes.ok) return;

    const categories = await categoriesRes.json();
    let service = null;

    for (const category of categories || []) {
      const found = (category.services || []).find((s) => s.id === serviceId);
      if (found) {
        service = found;
        break;
      }
    }

    selectedServiceNameEl.textContent = service ? service.name : `Service #${serviceId}`;

    const providersRes = await fetch(`/api/services/${serviceId}/providers/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!providersRes.ok) return;

    const providers = await providersRes.json();
    const provider = (providers || []).find((p) => Number(p.user_id) === providerId);

    if (!provider) {
      selectedProviderNameEl.textContent = `Provider #${providerId}`;
      return;
    }

    selectedProviderNameEl.textContent = provider.full_name || provider.username || `Provider #${providerId}`;
    selectedProviderRatingEl.textContent = provider.rating ? `${provider.rating} / 5` : "New";
    selectedProviderPriceEl.textContent =
      provider.price !== null && provider.price !== undefined ? `Rs.${provider.price}` : "N/A";
    selectedProviderLocationEl.textContent = provider.city || "Not specified";
  } catch (_) {
    selectedServiceNameEl.textContent = `Service #${serviceId}`;
    selectedProviderNameEl.textContent = `Provider #${providerId}`;
    selectedProviderLocationEl.textContent = "-";
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!serviceId || !providerId) return;

  errorEl.classList.add("hidden");
  successEl.classList.add("hidden");

  const lines = [addressInput.value.trim()];
  if (customerLocationInput.value.trim()) lines.push(`Customer location: ${customerLocationInput.value.trim()}`);
  if (landmarkInput.value.trim()) lines.push(`Landmark: ${landmarkInput.value.trim()}`);
  if (notesInput.value.trim()) lines.push(`Notes: ${notesInput.value.trim()}`);

  const payload = {
    service: serviceId,
    provider: providerId,
    scheduled_date: dateInput.value,
    time_slot: timeSlotInput.value,
    address: lines.join("\n"),
  };

  submitBtn.disabled = true;
  submitBtn.textContent = "Booking...";

  try {
    const res = await fetch("/api/bookings/create/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const contentType = res.headers.get("content-type");
    let data = {};
    if (contentType && contentType.includes("application/json")) {
      data = await res.json();
    }

    if (!res.ok) {
      throw new Error(
        data.provider?.[0] ||
          data.service?.[0] ||
        data.scheduled_date?.[0] ||
          data.time_slot?.[0] ||
          data.address?.[0] ||
          "Booking failed"
      );
    }

    successEl.textContent = `Booking created successfully. Booking ID: #${data.booking_id}`;
    successEl.classList.remove("hidden");

    localStorage.removeItem("selectedService");
    localStorage.removeItem("selectedProvider");

    setTimeout(() => {
      window.location.href = "/dashboard/customer/";
    }, 1000);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove("hidden");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Confirm Booking";
  }
});

loadBookingSummary();

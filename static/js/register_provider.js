const username = document.getElementById("username");
const fullName = document.getElementById("full_name");
const email = document.getElementById("email");
const password = document.getElementById("password");
const phone = document.getElementById("phone");
const otp = document.getElementById("otp");
const city = document.getElementById("city");
const serviceSelect = document.getElementById("services");
const addServiceBtn = document.getElementById("add-service");
const selectedServicesWrap = document.getElementById("selected-services");
const servicesError = document.getElementById("services-error");
const sendOtpBtn = document.getElementById("send-otp-btn");
const otpInfoEl = document.getElementById("otp-info");
const otpErrorEl = document.getElementById("otp-error");
const useCurrentCityBtn = document.getElementById("use-current-city");
const cityInfoEl = document.getElementById("city-info");

const errorEl = document.getElementById("error");
const successEl = document.getElementById("success");

const selectedServices = new Map();
let resendTimer = null;
let resendSecondsLeft = 0;

function startResendTimer(seconds = 30) {
  resendSecondsLeft = seconds;
  sendOtpBtn.disabled = true;
  sendOtpBtn.textContent = `Resend in ${resendSecondsLeft}s`;
  if (resendTimer) clearInterval(resendTimer);
  resendTimer = setInterval(() => {
    resendSecondsLeft -= 1;
    if (resendSecondsLeft <= 0) {
      clearInterval(resendTimer);
      resendTimer = null;
      sendOtpBtn.disabled = false;
      sendOtpBtn.textContent = "Send OTP";
      return;
    }
    sendOtpBtn.textContent = `Resend in ${resendSecondsLeft}s`;
  }, 1000);
}

async function reverseGeocodeCity(lat, lon) {
  try {
    const res = await fetch(`/api/accounts/geo/reverse/?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
    if (!res.ok) return "";
    const data = await res.json();
    return data.city || "";
  } catch {
    return "";
  }
}

async function getBestBrowserPosition() {
  if (!("geolocation" in navigator)) {
    return null;
  }

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

async function detectCityByBrowser() {
  const pos = await getBestBrowserPosition();
  if (!pos) return "";

  const accuracy = Math.round(pos.coords.accuracy || 0);
  if (accuracy > 150) {
    if (cityInfoEl) {
      cityInfoEl.textContent = `Low accuracy (${accuracy}m). Move near window and retry.`;
      cityInfoEl.classList.remove("hidden");
    }
    return "";
  }

  const { latitude, longitude } = pos.coords;
  const cityName = await reverseGeocodeCity(latitude, longitude);
  if (cityInfoEl) {
    cityInfoEl.textContent = cityName
      ? `Detected city: ${cityName}`
      : "Could not detect city. Enter manually.";
    cityInfoEl.classList.remove("hidden");
  }
  return cityName || "";
}

if (useCurrentCityBtn) {
  useCurrentCityBtn.addEventListener("click", async () => {
    useCurrentCityBtn.disabled = true;
    useCurrentCityBtn.textContent = "Detecting...";
    const browserCity = await detectCityByBrowser();
    if (browserCity) {
      city.value = browserCity;
    }
    useCurrentCityBtn.disabled = false;
    useCurrentCityBtn.textContent = "Use Current Location";
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const cityInput = document.getElementById("city");
  if (!cityInput) return;

  const browserCity = await detectCityByBrowser();
  if (browserCity && !cityInput.value) {
    cityInput.value = browserCity;
  }
});

/* -------------------------------
   LOAD SERVICES
-------------------------------- */

fetch("/api/services/categories/public/")
  .then((res) => {
    if (!res.ok) {
      throw new Error("Service API failed");
    }
    return res.json();
  })
  .then((categories) => {
    serviceSelect.innerHTML = "";

    if (!categories.length) {
      errorEl.textContent = "No services available";
      errorEl.classList.remove("hidden");
      return;
    }

    categories.forEach((category) => {
      category.services.forEach((service) => {
        const option = document.createElement("option");
        option.value = service.id;
        option.textContent = `${category.name} - ${service.name}`;
        serviceSelect.appendChild(option);
      });
    });
  })
  .catch((err) => {
    console.error(err);
    errorEl.textContent =
      "Failed to load services. Is the server running?";
    errorEl.classList.remove("hidden");
  });

function renderSelectedServices() {
  selectedServicesWrap.innerHTML = "";

  if (selectedServices.size === 0) {
    servicesError.classList.add("hidden");
    return;
  }

  selectedServices.forEach((name, id) => {
    const chip = document.createElement("div");
    chip.className = "px-2 py-1 bg-slate-100 rounded text-sm flex items-center gap-2";
    chip.innerHTML = `
      <span>${name}</span>
      <button type="button" class="text-red-600" data-remove-service="${id}">x</button>
    `;
    selectedServicesWrap.appendChild(chip);
  });

  document.querySelectorAll("[data-remove-service]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-remove-service");
      selectedServices.delete(Number(id));
      renderSelectedServices();
    });
  });
}

if (addServiceBtn) {
  addServiceBtn.addEventListener("click", () => {
    const selectedId = Number(serviceSelect.value);
    const selectedName = serviceSelect.options[serviceSelect.selectedIndex]?.textContent;

    if (!selectedId || !selectedName) return;

    if (!selectedServices.has(selectedId)) {
      selectedServices.set(selectedId, selectedName);
      renderSelectedServices();
    }
  });
}

if (sendOtpBtn) {
  sendOtpBtn.addEventListener("click", async () => {
    otpInfoEl.classList.add("hidden");
    otpErrorEl.classList.add("hidden");

    const phoneValue = phone.value.trim();
    if (!phoneValue) {
      otpErrorEl.textContent = "Enter mobile number";
      otpErrorEl.classList.remove("hidden");
      return;
    }

    sendOtpBtn.disabled = true;
    sendOtpBtn.textContent = "Sending...";
    try {
      const res = await fetch("/api/accounts/auth/otp/send-signup/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneValue }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.phone?.[0] || "Failed to send OTP");
      }
      otpInfoEl.textContent = data.dev_otp
        ? `OTP sent (debug): ${data.dev_otp}`
        : "OTP sent to your mobile number";
      otpInfoEl.classList.remove("hidden");
      startResendTimer(30);
    } catch (err) {
      otpErrorEl.textContent = err.message;
      otpErrorEl.classList.remove("hidden");
      sendOtpBtn.disabled = false;
      sendOtpBtn.textContent = "Send OTP";
    }
  });
}

/* -------------------------------
   SUBMIT PROVIDER REGISTRATION
-------------------------------- */

document
  .getElementById("register-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    errorEl.classList.add("hidden");
    successEl.classList.add("hidden");
    servicesError.classList.add("hidden");

    const selectedServiceIds = Array.from(selectedServices.keys());
    const cityValue = city.value.trim();

    if (!selectedServiceIds.length) {
      servicesError.textContent = "Please add at least one service";
      servicesError.classList.remove("hidden");
      return;
    }

    if (!cityValue) {
      errorEl.textContent = "City is required";
      errorEl.classList.remove("hidden");
      return;
    }

    try {
      const res = await fetch("/api/accounts/signup/provider/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.value,
          full_name: fullName.value.trim(),
          email: email.value,
          password: password.value,
          phone: phone.value,
          otp: otp.value.trim(),
          city: cityValue,
          services: selectedServiceIds,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.detail ||
          data.username?.[0] ||
          data.email?.[0] ||
          data.phone?.[0] ||
          data.otp?.[0] ||
          data.city?.[0] ||
          data.services?.[0] ||
          "Registration failed"
        );
      }

      successEl.textContent =
        "Provider registered successfully! Redirecting...";
      successEl.classList.remove("hidden");

      setTimeout(() => {
        window.location.href = "/login/";
      }, 2000);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove("hidden");
    }
  });

const token = localStorage.getItem("access");
if (!token) window.location.href = "/login/";

const errorEl = document.getElementById("error");
const successEl = document.getElementById("success");
const form = document.getElementById("booking-form");

// ✅ GET SELECTION FROM PREVIOUS PAGE
const serviceId = localStorage.getItem("selectedService");
const providerId = localStorage.getItem("selectedProvider");

if (!serviceId || !providerId) {
  errorEl.textContent = "Service or provider not selected";
  errorEl.classList.remove("hidden");
  throw new Error("Missing booking context");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  errorEl.classList.add("hidden");
  successEl.classList.add("hidden");

  const payload = {
    service: serviceId,
    provider: providerId,
    scheduled_date: date.value,
    address: address.value,
  };

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
        data.address?.[0] ||
        "Booking failed"
      );
    }

    successEl.textContent = "Booking created successfully!";
    successEl.classList.remove("hidden");

    localStorage.removeItem("selectedService");
    localStorage.removeItem("selectedProvider");

  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove("hidden");
  }
});

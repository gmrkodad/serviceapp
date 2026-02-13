const username = document.getElementById("username");
const email = document.getElementById("email");
const password = document.getElementById("password");
const city = document.getElementById("city");
const serviceSelect = document.getElementById("services");
const addServiceBtn = document.getElementById("add-service");
const selectedServicesWrap = document.getElementById("selected-services");
const servicesError = document.getElementById("services-error");

const errorEl = document.getElementById("error");
const successEl = document.getElementById("success");

const selectedServices = new Map();

async function detectCity() {
  try {
    const stored = localStorage.getItem("location_city");
    if (stored) return stored;
    const res = await fetch("/api/accounts/ip-location/");
    if (!res.ok) return "";
    const data = await res.json();
    if (data.city) {
      localStorage.setItem("location_city", data.city);
    }
    return data.city || "";
  } catch {
    return "";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const cityInput = document.getElementById("city");
  if (!cityInput) return;
  const city = await detectCity();
  if (city && !cityInput.value) {
    cityInput.value = city;
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

    if (!selectedServiceIds.length) {
      servicesError.textContent = "Please add at least one service";
      servicesError.classList.remove("hidden");
      return;
    }

    try {
      const res = await fetch("/api/accounts/signup/provider/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.value,
          email: email.value,
          password: password.value,
          city: city.value,
          services: selectedServiceIds,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.detail ||
          data.username?.[0] ||
          data.email?.[0] ||
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

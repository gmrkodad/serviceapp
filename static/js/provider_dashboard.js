const token = localStorage.getItem("access");
if (!token) window.location.href = "/login/";

const list = document.getElementById("booking-list");
const empty = document.getElementById("empty");
const servicesSelect = document.getElementById("provider-services");
const servicesSaveBtn = document.getElementById("provider-services-save");
const servicesMsg = document.getElementById("provider-services-msg");
const servicesList = document.getElementById("provider-services-list");
const totalEl = document.getElementById("provider-total-bookings");
const pendingEl = document.getElementById("provider-pending-bookings");

async function refreshAccessToken() {
  const refresh = localStorage.getItem("refresh");
  if (!refresh) return null;

  const res = await fetch("/api/token/refresh/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (!data.access) return null;

  localStorage.setItem("access", data.access);
  return data.access;
}

async function authFetch(url, options = {}) {
  const currentToken = localStorage.getItem("access");
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${currentToken}`,
  };

  let res = await fetch(url, { ...options, headers });

  if (res.status !== 401) return res;

  const newAccess = await refreshAccessToken();
  if (!newAccess) return res;

  const retryHeaders = {
    ...(options.headers || {}),
    Authorization: `Bearer ${newAccess}`,
  };

  return fetch(url, { ...options, headers: retryHeaders });
}

function handleUnauthorized() {
  localStorage.clear();
  window.location.href = "/login/";
}

function loadBookings() {
  authFetch("/api/bookings/provider/dashboard/")
    .then((res) => {
      if (res.status === 401) {
        handleUnauthorized();
        return [];
      }
      return res.json();
    })
    .then((bookings) => {
      list.innerHTML = "";
      empty.classList.add("hidden");

      if (totalEl) totalEl.innerText = bookings.length;
      if (pendingEl) {
        const pending = bookings.filter((b) => b.status === "PENDING").length;
        pendingEl.innerText = pending;
      }

      if (!bookings.length) {
        empty.classList.remove("hidden");
        return;
      }

      bookings.forEach((b) => {
        let actions = "";

        if (b.status === "PENDING") {
          actions = `
            <button onclick="providerAction(${b.id}, 'accept')"
              class="bg-green-600 text-white px-3 py-1 rounded">Accept</button>
            <button onclick="providerAction(${b.id}, 'reject')"
              class="bg-red-600 text-white px-3 py-1 rounded">Reject</button>
          `;
        }

        if (b.status === "CONFIRMED") {
          actions = `
            <button onclick="updateStatus(${b.id}, 'IN_PROGRESS')"
              class="bg-blue-600 text-white px-3 py-1 rounded">
              Start Job
            </button>
          `;
        }

        if (b.status === "IN_PROGRESS") {
          actions = `
            <button onclick="updateStatus(${b.id}, 'COMPLETED')"
              class="bg-purple-600 text-white px-3 py-1 rounded">
              Complete Job
            </button>
          `;
        }

        if (b.status === "COMPLETED") {
          actions = `<span class="text-green-700 font-semibold">Completed ?</span>`;
        }

        const card = document.createElement("div");
        card.className = "border p-4 rounded shadow";

        card.innerHTML = `
          <p><strong>Service:</strong> ${b.service_name}</p>
          <p><strong>Customer:</strong> ${b.customer_username}</p>
          <p><strong>Address:</strong> ${b.address}</p>
          <p><strong>Date:</strong> ${b.scheduled_date}</p>
          <p><strong>Status:</strong> ${b.status}</p>

          <div class="mt-3 space-x-2">${actions}</div>
        `;

        list.appendChild(card);
      });
    });
}

async function loadProviderServices() {
  if (!servicesSelect) return;

  const [categoriesRes, myRes] = await Promise.all([
    authFetch("/api/services/categories/"),
    authFetch("/api/accounts/providers/me/services/"),
  ]);

  if (categoriesRes.status === 401 || myRes.status === 401) {
    handleUnauthorized();
    return;
  }

  const categories = await categoriesRes.json();
  const myServices = await myRes.json();
  const myIds = new Set((myServices.services || []).map((s) => s.id));
  const myNames = new Map((myServices.services || []).map((s) => [s.id, s.name]));

  servicesSelect.innerHTML = "";
  if (servicesList) {
    servicesList.innerHTML = "";
    if (myNames.size === 0) {
      servicesList.innerHTML = '<span class="text-sm text-slate-500">No services selected yet.</span>';
    } else {
      myNames.forEach((name) => {
        const chip = document.createElement("span");
        chip.className = "px-2 py-1 text-xs rounded bg-slate-100";
        chip.textContent = name;
        servicesList.appendChild(chip);
      });
    }
  }

  categories.forEach((cat) => {
    cat.services.forEach((service) => {
      const option = document.createElement("option");
      option.value = service.id;
      option.textContent = `${cat.name} - ${service.name}`;
      if (myIds.has(service.id)) option.selected = true;
      servicesSelect.appendChild(option);
    });
  });
}

if (servicesSaveBtn) {
  servicesSaveBtn.addEventListener("click", async () => {
    if (!servicesSelect) return;
    servicesMsg.textContent = "";

    const services = Array.from(servicesSelect.selectedOptions).map((o) => Number(o.value));

    const res = await authFetch("/api/accounts/providers/me/services/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ services }),
    });

    if (res.status === 401) {
      handleUnauthorized();
      return;
    }

    if (res.ok) {
      servicesMsg.textContent = "Services updated";
      loadProviderServices();
    } else {
      servicesMsg.textContent = "Update failed";
    }
  });
}

loadBookings();
loadProviderServices();

/* Accept / Reject */
function providerAction(id, action) {
  authFetch(`/api/bookings/provider/action/${id}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action }),
  })
    .then(() => loadBookings());
}

/* Start / Complete */
function updateStatus(id, status) {
  authFetch(`/api/bookings/provider/update-status/${id}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  })
    .then(() => loadBookings());
}

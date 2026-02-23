const token = localStorage.getItem("access");
if (!token) window.location.href = "/login/";

const list = document.getElementById("booking-list");
const empty = document.getElementById("empty");
const recentList = document.getElementById("provider-recent-bookings");
const overviewEmpty = document.getElementById("provider-overview-empty");

const servicesSelect = document.getElementById("provider-services");
const servicesSaveBtn = document.getElementById("provider-services-save");
const servicesMsg = document.getElementById("provider-services-msg");
const servicesList = document.getElementById("provider-services-list");

const totalEl = document.getElementById("provider-total-bookings");
const pendingEl = document.getElementById("provider-pending-bookings");
const confirmedEl = document.getElementById("provider-confirmed-bookings");
const inProgressEl = document.getElementById("provider-inprogress-bookings");
const completedEl = document.getElementById("provider-completed-bookings");

let bookingsCache = [];

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

function statusPill(status) {
  const map = {
    PENDING: "bg-amber-100 text-amber-700",
    CONFIRMED: "bg-blue-100 text-blue-700",
    IN_PROGRESS: "bg-indigo-100 text-indigo-700",
    COMPLETED: "bg-emerald-100 text-emerald-700",
  };
  return `<span class="px-2 py-1 rounded text-xs ${map[status] || "bg-slate-100 text-slate-700"}">${status}</span>`;
}

function getActionButtons(b) {
  if (b.status === "PENDING") {
    return `
      <button onclick="providerAction(${b.id}, 'accept')"
        class="bg-green-600 text-white px-3 py-1 rounded">Accept</button>
      <button onclick="providerAction(${b.id}, 'reject')"
        class="bg-red-600 text-white px-3 py-1 rounded">Reject</button>
    `;
  }

  if (b.status === "CONFIRMED") {
    return `
      <button onclick="updateStatus(${b.id}, 'IN_PROGRESS')"
        class="bg-blue-600 text-white px-3 py-1 rounded">
        Start Job
      </button>
    `;
  }

  if (b.status === "IN_PROGRESS") {
    return `
      <button onclick="updateStatus(${b.id}, 'COMPLETED')"
        class="bg-purple-600 text-white px-3 py-1 rounded">
        Complete Job
      </button>
    `;
  }

  if (b.status === "COMPLETED") {
    return `<span class="text-green-700 font-semibold">Completed</span>`;
  }

  return "";
}

function renderBookingCard(b) {
  return `
    <div class="border border-slate-200 p-4 rounded-xl bg-white shadow-sm">
      <div class="flex items-center justify-between mb-2">
        <p class="font-semibold text-slate-900">${b.service_name}</p>
        ${statusPill(b.status)}
      </div>
      <p class="text-sm"><strong>Customer:</strong> ${b.customer_username}</p>
      <p class="text-sm"><strong>Address:</strong> ${b.address}</p>
      <p class="text-sm"><strong>Date:</strong> ${b.scheduled_date}</p>
      <div class="mt-3 flex flex-wrap gap-2">${getActionButtons(b)}</div>
    </div>
  `;
}

function renderBookingsSection() {
  list.innerHTML = "";
  empty.classList.add("hidden");

  if (!bookingsCache.length) {
    empty.classList.remove("hidden");
    return;
  }

  bookingsCache.forEach((b) => {
    const card = document.createElement("div");
    card.innerHTML = renderBookingCard(b);
    list.appendChild(card.firstElementChild);
  });
}

function renderOverviewSection() {
  if (!recentList) return;
  recentList.innerHTML = "";
  if (overviewEmpty) overviewEmpty.classList.add("hidden");

  const recent = bookingsCache.slice(0, 4);
  if (!recent.length) {
    if (overviewEmpty) overviewEmpty.classList.remove("hidden");
    return;
  }

  recent.forEach((b) => {
    const row = document.createElement("div");
    row.className = "rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-start justify-between gap-3";
    row.innerHTML = `
      <div>
        <p class="font-medium text-slate-900">${b.service_name}</p>
        <p class="text-sm text-slate-600">${b.customer_username} • ${b.scheduled_date}</p>
      </div>
      ${statusPill(b.status)}
    `;
    recentList.appendChild(row);
  });
}

function renderStats() {
  const total = bookingsCache.length;
  const pending = bookingsCache.filter((b) => b.status === "PENDING").length;
  const confirmed = bookingsCache.filter((b) => b.status === "CONFIRMED").length;
  const inProgress = bookingsCache.filter((b) => b.status === "IN_PROGRESS").length;
  const completed = bookingsCache.filter((b) => b.status === "COMPLETED").length;

  if (totalEl) totalEl.innerText = total;
  if (pendingEl) pendingEl.innerText = pending;
  if (confirmedEl) confirmedEl.innerText = confirmed;
  if (inProgressEl) inProgressEl.innerText = inProgress;
  if (completedEl) completedEl.innerText = completed;
}

async function loadBookings() {
  const res = await authFetch("/api/bookings/provider/dashboard/");
  if (res.status === 401) {
    handleUnauthorized();
    return;
  }
  if (!res.ok) return;

  bookingsCache = await res.json();
  renderStats();
  renderOverviewSection();
  renderBookingsSection();
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

function setupTabs() {
  const sections = {
    overview: document.getElementById("provider-tab-overview"),
    bookings: document.getElementById("provider-tab-bookings"),
    services: document.getElementById("provider-tab-services"),
  };
  const buttons = document.querySelectorAll("[data-provider-tab]");
  if (!buttons.length) return;

  function setActive(tab) {
    Object.entries(sections).forEach(([name, section]) => {
      if (!section) return;
      section.classList.toggle("hidden", name !== tab);
    });
    buttons.forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-provider-tab") === tab);
    });
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => setActive(btn.getAttribute("data-provider-tab")));
  });
  setActive("overview");
}

loadBookings();
loadProviderServices();
setupTabs();

function providerAction(id, action) {
  authFetch(`/api/bookings/provider/action/${id}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  }).then(() => loadBookings());
}

function updateStatus(id, status) {
  authFetch(`/api/bookings/provider/update-status/${id}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  }).then(() => loadBookings());
}

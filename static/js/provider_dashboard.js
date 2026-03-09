const token = localStorage.getItem("access");
if (!token) window.location.href = "/login/";

const list = document.getElementById("booking-list");
const empty = document.getElementById("empty");
const recentList = document.getElementById("provider-recent-bookings");
const overviewEmpty = document.getElementById("provider-overview-empty");
const servicesMsg = document.getElementById("provider-services-msg");
const currentServicesWrap = document.getElementById("provider-current-services");
const servicePicker = document.getElementById("provider-service-picker");
const serviceAddBtn = document.getElementById("provider-service-add");
const serviceSearchInput = document.getElementById("provider-service-search");
const serviceSearchBtn = document.getElementById("provider-service-search-btn");
const pricesSaveBtn = document.getElementById("provider-prices-save");
const pricesMsg = document.getElementById("provider-prices-msg");

const totalEl = document.getElementById("provider-total-bookings");
const pendingEl = document.getElementById("provider-pending-bookings");
const confirmedEl = document.getElementById("provider-confirmed-bookings");
const inProgressEl = document.getElementById("provider-inprogress-bookings");
const completedEl = document.getElementById("provider-completed-bookings");

let bookingsCache = [];
let allServicesById = new Map();
let availableServices = [];
let myServices = [];

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
    PENDING: "bg-amber-50 text-amber-800 border-amber-200",
    CONFIRMED: "bg-sky-50 text-sky-800 border-sky-200",
    IN_PROGRESS: "bg-indigo-50 text-indigo-800 border-indigo-200",
    COMPLETED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  };
  return `<span class="inline-flex rounded-full border px-3 py-1 text-xs font-bold ${map[status] || "bg-slate-100 text-slate-700 border-slate-200"}">${status.replace("_", " ")}</span>`;
}

function formatTimeSlot(slot) {
  const map = {
    MORNING: "Morning (8 AM - 12 PM)",
    AFTERNOON: "Afternoon (12 PM - 4 PM)",
    EVENING: "Evening (4 PM - 8 PM)",
  };
  return map[slot] || slot || "-";
}

function getActionButtons(b) {
  if (b.status === "PENDING") {
    return `
      <button data-booking-action="accept" data-booking-id="${b.id}" class="btn-primary px-4 py-2 text-sm">Accept</button>
      <button data-booking-action="reject" data-booking-id="${b.id}" class="btn-danger px-4 py-2 text-sm">Reject</button>
    `;
  }

  if (b.status === "CONFIRMED") {
    return `<button data-status-action="IN_PROGRESS" data-booking-id="${b.id}" class="btn-primary px-4 py-2 text-sm">Start Job</button>`;
  }

  if (b.status === "IN_PROGRESS") {
    return `<button data-status-action="COMPLETED" data-booking-id="${b.id}" class="btn-primary px-4 py-2 text-sm">Complete Job</button>`;
  }

  if (b.status === "COMPLETED") {
    return `<span class="soft-chip bg-emerald-50 text-emerald-800">Completed</span>`;
  }

  return "";
}

function renderBookingCard(b) {
  const bookingServiceLabel = Array.isArray(b.service_names) && b.service_names.length
    ? b.service_names.join(", ")
    : b.service_name;
  return `
    <div class="page-shell content-inset">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div class="flex flex-wrap items-center gap-3">
            <p class="section-title text-xl font-bold text-slate-900">#${b.id} ${bookingServiceLabel}</p>
            ${statusPill(b.status)}
          </div>
          <div class="mt-3 grid grid-cols-1 gap-3 text-sm text-slate-600 sm:grid-cols-2">
            <p><span class="muted-label">Customer</span><br><span class="font-semibold text-slate-900">${b.customer_username}</span></p>
            <p><span class="muted-label">Address</span><br><span class="font-semibold text-slate-900">${b.address}</span></p>
            <p><span class="muted-label">Date</span><br><span class="font-semibold text-slate-900">${b.scheduled_date}</span></p>
            <p><span class="muted-label">Time Slot</span><br><span class="font-semibold text-slate-900">${formatTimeSlot(b.time_slot)}</span></p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">${getActionButtons(b)}</div>
      </div>
    </div>
  `;
}

function bindBookingButtons() {
  document.querySelectorAll("[data-booking-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-booking-id");
      const action = btn.getAttribute("data-booking-action");
      await authFetch(`/api/bookings/provider/action/${id}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      loadBookings();
    });
  });

  document.querySelectorAll("[data-status-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-booking-id");
      const status = btn.getAttribute("data-status-action");
      await authFetch(`/api/bookings/provider/update-status/${id}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      loadBookings();
    });
  });
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
  bindBookingButtons();
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
    const bookingServiceLabel = Array.isArray(b.service_names) && b.service_names.length
      ? b.service_names.join(", ")
      : b.service_name;
    const row = document.createElement("div");
    row.className = "glass-row p-4";
    row.innerHTML = `
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p class="text-lg font-bold text-slate-900">#${b.id} ${bookingServiceLabel}</p>
          <p class="mt-1 text-sm text-slate-600">${b.customer_username} | ${b.scheduled_date} | ${formatTimeSlot(b.time_slot)}</p>
        </div>
        ${statusPill(b.status)}
      </div>
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

function renderServicePicker() {
  if (!servicePicker) return;
  servicePicker.innerHTML = "";

  const chosenIds = new Set(myServices.map((s) => s.id));
  const searchTerm = (serviceSearchInput?.value || "").trim().toLowerCase();
  const options = availableServices.filter((s) => {
    if (chosenIds.has(s.id)) return false;
    if (!searchTerm) return true;
    return s.label.toLowerCase().includes(searchTerm) || s.name.toLowerCase().includes(searchTerm);
  });

  if (!options.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "All services already added";
    servicePicker.appendChild(option);
    servicePicker.disabled = true;
    if (serviceAddBtn) serviceAddBtn.disabled = true;
    return;
  }

  options.sort((a, b) => a.label.localeCompare(b.label));
  options.forEach((s) => {
    const option = document.createElement("option");
    option.value = String(s.id);
    option.textContent = s.label;
    servicePicker.appendChild(option);
  });
  servicePicker.disabled = false;
  if (serviceAddBtn) serviceAddBtn.disabled = false;
}

if (serviceSearchBtn) {
  serviceSearchBtn.addEventListener("click", () => {
    renderServicePicker();
  });
}

if (serviceSearchInput) {
  serviceSearchInput.addEventListener("input", () => {
    renderServicePicker();
  });
}

function renderMyServices() {
  if (!currentServicesWrap) return;
  currentServicesWrap.innerHTML = "";

  if (!myServices.length) {
    currentServicesWrap.innerHTML = "<p class='empty-panel'>No services added yet.</p>";
    return;
  }

  myServices
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((service) => {
      const row = document.createElement("div");
      row.className = "page-shell content-inset";
      row.innerHTML = `
        <div class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_180px_120px] md:items-center">
          <div>
            <p class="text-lg font-bold text-slate-900">${service.name}</p>
          </div>
          <div>
            <input
              type="number"
              min="1"
              step="1"
              value="${service.price ?? ""}"
              data-price-service-id="${service.id}"
              class="input-modern"
              placeholder="Set your price"
            />
          </div>
          <div>
            <button
              data-remove-service-id="${service.id}"
              class="btn-danger w-full px-4 py-3"
            >
              Remove
            </button>
          </div>
        </div>
      `;
      currentServicesWrap.appendChild(row);
    });

  currentServicesWrap.querySelectorAll("[data-remove-service-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const removeId = Number(btn.getAttribute("data-remove-service-id"));
      const nextServices = myServices.filter((s) => s.id !== removeId).map((s) => s.id);
      await saveProviderServices(nextServices, "Service removed");
    });
  });
}

async function saveProviderServices(serviceIds, successText) {
  servicesMsg.textContent = "";
  const res = await authFetch("/api/accounts/providers/me/services/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ services: serviceIds }),
  });

  if (res.status === 401) {
    handleUnauthorized();
    return;
  }

  if (!res.ok) {
    servicesMsg.textContent = "Failed to update services.";
    return;
  }

  servicesMsg.textContent = successText || "Services updated";
  await loadProviderServices();
}

async function loadProviderServices() {
  const [categoriesRes, myRes] = await Promise.all([
    authFetch("/api/services/categories/"),
    authFetch("/api/accounts/providers/me/services/"),
  ]);

  if (categoriesRes.status === 401 || myRes.status === 401) {
    handleUnauthorized();
    return;
  }
  if (!categoriesRes.ok || !myRes.ok) {
    if (servicesMsg) servicesMsg.textContent = "Unable to load services now.";
    return;
  }

  const categories = await categoriesRes.json();
  const myData = await myRes.json();

  allServicesById = new Map();
  availableServices = [];
  (categories || []).forEach((cat) => {
    (cat.services || []).forEach((svc) => {
      const label = `${cat.name} - ${svc.name}`;
      const item = { id: svc.id, name: svc.name, label };
      availableServices.push(item);
      allServicesById.set(svc.id, item);
    });
  });

  myServices = (myData.services || []).map((svc) => ({
    id: svc.id,
    name: svc.name,
    price: svc.price,
  }));

  renderServicePicker();
  renderMyServices();
}

if (serviceAddBtn) {
  serviceAddBtn.addEventListener("click", async () => {
    servicesMsg.textContent = "";
    if (!servicePicker || !servicePicker.value) {
      servicesMsg.textContent = "Select a service to add.";
      return;
    }

    const addId = Number(servicePicker.value);
    const nextIds = new Set(myServices.map((s) => s.id));
    nextIds.add(addId);
    await saveProviderServices(Array.from(nextIds), "Service added");
  });
}

if (pricesSaveBtn) {
  pricesSaveBtn.addEventListener("click", async () => {
    pricesMsg.textContent = "";
    if (!currentServicesWrap) return;

    const inputs = currentServicesWrap.querySelectorAll("[data-price-service-id]");
    const prices = Array.from(inputs).map((input) => ({
      service_id: Number(input.getAttribute("data-price-service-id")),
      price: Number(input.value),
    }));

    if (!prices.length) {
      pricesMsg.textContent = "Add at least one service first.";
      return;
    }

    const invalid = prices.find((p) => !p.price || p.price <= 0);
    if (invalid) {
      pricesMsg.textContent = "Enter valid prices greater than 0.";
      return;
    }

    const res = await authFetch("/api/accounts/providers/me/service-prices/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prices }),
    });

    if (res.status === 401) {
      handleUnauthorized();
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      pricesMsg.textContent = data.error || "Price update failed.";
      return;
    }

    pricesMsg.textContent = "Prices updated.";
    await loadProviderServices();
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

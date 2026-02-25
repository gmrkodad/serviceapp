(function () {
  const token = localStorage.getItem("access");
  if (!token) {
    window.location.href = "/login/";
    return;
  }

  const list = document.getElementById("admin-bookings-list");
  const empty = document.getElementById("admin-bookings-empty");
  const filterSearch = document.getElementById("filter-booking-search");
  const filterStatus = document.getElementById("filter-booking-status");
  const filterProvider = document.getElementById("filter-booking-provider");
  let bookingsCache = [];
  let providersCache = [];

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

  function statusBadge(status) {
    const colors = {
      PENDING: "bg-yellow-100 text-yellow-800",
      ASSIGNED: "bg-blue-100 text-blue-800",
      CONFIRMED: "bg-green-100 text-green-800",
      IN_PROGRESS: "bg-purple-100 text-purple-800",
      COMPLETED: "bg-emerald-100 text-emerald-800",
      CANCELLED: "bg-red-100 text-red-800",
    };

    return `<span class="px-2 py-1 rounded text-xs ${colors[status] || "bg-gray-100"}">${status.replace("_", " ")}</span>`;
  }

  async function loadData() {
    try {
      const [bookingsRes, providersRes] = await Promise.all([
        authFetch("/api/bookings/admin/all/"),
        authFetch("/api/accounts/providers/"),
      ]);

      if (bookingsRes.status === 401 || providersRes.status === 401) {
        handleUnauthorized();
        return;
      }

      const bookings = await bookingsRes.json();
      const providers = await providersRes.json();
      bookingsCache = bookings || [];
      providersCache = providers || [];
      renderBookings();
    } catch {
      // ignore
    }
  }

  function renderBookings() {
    const q = (filterSearch?.value || "").toLowerCase();
    const status = filterStatus?.value || "";
    const providerQ = (filterProvider?.value || "").toLowerCase();

    const filtered = bookingsCache.filter((b) => {
      const matchSearch =
        !q ||
        String(b.id || "").toLowerCase().includes(q) ||
        (b.service_name || "").toLowerCase().includes(q) ||
        (b.customer_username || "").toLowerCase().includes(q) ||
        (b.provider_username || "").toLowerCase().includes(q);
      const matchStatus = !status || b.status === status;
      const matchProvider =
        !providerQ || (b.provider_username || "").toLowerCase().includes(providerQ);
      return matchSearch && matchStatus && matchProvider;
    });

    list.innerHTML = "";
    empty.classList.add("hidden");

    if (!filtered.length) {
      empty.classList.remove("hidden");
      return;
    }

    filtered.forEach((b) => {
      const tr = document.createElement("tr");
      tr.className = "border-b";

      const providerOptions = providersCache
          .map((p) => `<option value="${p.id}">${p.username}</option>`)
          .join("");

        const providerCell = b.provider_username
          ? `<span>${b.provider_username}</span>`
          : `<select class="border rounded p-1 text-sm" data-provider-select="${b.id}">
              <option value="">Select</option>
              ${providerOptions}
            </select>`;

        const actionCell = b.provider_username
          ? "-"
          : `<button class="bg-slate-900 text-white px-3 py-1 rounded text-xs" data-assign-btn="${b.id}">Assign</button>`;

        tr.innerHTML = `
          <td class="py-3 px-4 font-semibold text-slate-700">#${b.id}</td>
          <td class="py-3 px-4">${b.service_name}</td>
          <td class="py-3 px-4">${b.customer_username || "-"}</td>
          <td class="py-3 px-4">${providerCell}</td>
          <td class="py-3 px-4">${statusBadge(b.status)}</td>
          <td class="py-3 px-4">${actionCell}</td>
        `;

      list.appendChild(tr);
    });

    bindAssignButtons();
  }

  function bindAssignButtons() {
    const buttons = document.querySelectorAll("[data-assign-btn]");
    buttons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const bookingId = btn.getAttribute("data-assign-btn");
        const select = document.querySelector(`[data-provider-select="${bookingId}"]`);
        const providerId = select ? select.value : "";

        if (!providerId) return;

        const res = await authFetch(`/api/bookings/assign/${bookingId}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider_id: providerId }),
        });

        if (res.status === 401) {
          handleUnauthorized();
          return;
        }

        loadData();
      });
    });
  }

  loadData();

  [filterSearch, filterStatus, filterProvider].forEach((el) => {
    if (el) {
      el.addEventListener("input", renderBookings);
      el.addEventListener("change", renderBookings);
    }
  });
})();

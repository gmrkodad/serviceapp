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
      PENDING: "bg-amber-50 text-amber-800 border-amber-200",
      ASSIGNED: "bg-sky-50 text-sky-800 border-sky-200",
      CONFIRMED: "bg-emerald-50 text-emerald-800 border-emerald-200",
      IN_PROGRESS: "bg-indigo-50 text-indigo-800 border-indigo-200",
      COMPLETED: "bg-slate-100 text-slate-700 border-slate-200",
      CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
    };

    return `<span class="inline-flex rounded-full border px-3 py-1 text-xs font-bold ${colors[status] || "bg-slate-100 text-slate-700 border-slate-200"}">${status.replace("_", " ")}</span>`;
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

      bookingsCache = (await bookingsRes.json()) || [];
      providersCache = (await providersRes.json()) || [];
      renderBookings();
    } catch (_) {
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
      const matchProvider = !providerQ || (b.provider_username || "").toLowerCase().includes(providerQ);
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
      const providerOptions = providersCache
        .map((p) => `<option value="${p.id}">${p.username}</option>`)
        .join("");

      const providerCell = b.provider_username
        ? `<span class="font-semibold text-slate-900">${b.provider_username}</span>`
        : `<select class="select-modern text-sm" data-provider-select="${b.id}">
            <option value="">Select provider</option>
            ${providerOptions}
          </select>`;

      const actionCell = b.provider_username
        ? `<span class="text-sm text-slate-500">Assigned</span>`
        : `<button class="btn-primary px-4 py-2 text-xs" data-assign-btn="${b.id}">Assign</button>`;

      tr.innerHTML = `
        <td class="font-semibold text-slate-900">#${b.id}</td>
        <td>${b.service_name}</td>
        <td>${b.customer_username || "-"}</td>
        <td>${providerCell}</td>
        <td>${statusBadge(b.status)}</td>
        <td>${actionCell}</td>
      `;
      list.appendChild(tr);
    });

    bindAssignButtons();
  }

  function bindAssignButtons() {
    document.querySelectorAll("[data-assign-btn]").forEach((btn) => {
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

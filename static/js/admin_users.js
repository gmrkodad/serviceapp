(function () {
  const token = localStorage.getItem("access");
  if (!token) {
    window.location.href = "/login/";
    return;
  }

  const list = document.getElementById("admin-users-list");
  let servicesCache = [];
  let usersCache = [];
  const filterSearch = document.getElementById("filter-user-search");
  const filterRole = document.getElementById("filter-user-role");
  const filterActive = document.getElementById("filter-user-active");
  const filterCity = document.getElementById("filter-user-city");

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

  async function loadServices() {
    const res = await authFetch("/api/services/admin/services/");
    if (res.status === 401) {
      handleUnauthorized();
      return [];
    }
    return res.json();
  }

  async function loadUsers() {
    try {
      const [usersRes, services] = await Promise.all([
        authFetch("/api/accounts/admin/users/"),
        loadServices(),
      ]);

      if (usersRes.status === 401) {
        handleUnauthorized();
        return;
      }

      servicesCache = services || [];

      const users = await usersRes.json();
      usersCache = users || [];
      renderUsers();
    } catch {
      // ignore
    }
  }

  function renderUsers() {
    const q = (filterSearch?.value || "").toLowerCase();
    const role = filterRole?.value || "";
    const active = filterActive?.value;
    const city = (filterCity?.value || "").toLowerCase();

    const filtered = usersCache.filter((u) => {
      const matchesSearch =
        !q ||
        (u.username || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q);
      const matchesRole = !role || u.role === role;
      const matchesActive =
        active === "" ? true : String(u.is_active) === active;
      const matchesCity =
        !city || (u.city || "").toLowerCase().includes(city);
      return matchesSearch && matchesRole && matchesActive && matchesCity;
    });

    list.innerHTML = "";
    filtered.forEach((u) => {
      const tr = document.createElement("tr");
      tr.className = "border-b";

        const serviceChips = (u.provider_services || [])
          .map((s) => `<span class="px-2 py-1 text-xs rounded bg-slate-100">${s.name}</span>`)
          .join(" ");

        const serviceOptions = servicesCache
          .map((s) => {
            const selected = (u.provider_services || []).some((ps) => ps.id === s.id)
              ? "selected"
              : "";
            return `<option value="${s.id}" ${selected}>${s.name}</option>`;
          })
          .join("");

        const servicesCell = u.role === "PROVIDER"
          ? `
            <div class="flex flex-wrap gap-1">${serviceChips || "-"}</div>
            <div class="mt-2 hidden" data-services-editor="${u.id}">
              <select multiple class="w-full border rounded p-2 text-sm" data-services-select="${u.id}">
                ${serviceOptions}
              </select>
              <div class="mt-2 flex gap-2">
                <button class="px-2 py-1 text-xs rounded bg-slate-900 text-white" data-services-save="${u.id}">Save</button>
                <button class="px-2 py-1 text-xs rounded bg-slate-100" data-services-cancel="${u.id}">Cancel</button>
              </div>
            </div>
            <div class="mt-2 hidden" data-prices-editor="${u.id}">
              <div class="space-y-2" data-prices-list="${u.id}"></div>
              <div class="mt-2 flex gap-2">
                <button class="px-2 py-1 text-xs rounded bg-slate-900 text-white" data-prices-save="${u.id}">Save Prices</button>
                <button class="px-2 py-1 text-xs rounded bg-slate-100" data-prices-cancel="${u.id}">Cancel</button>
              </div>
              <p class="text-xs text-slate-500 mt-1" data-prices-msg="${u.id}"></p>
            </div>
          `
          : "-";

        const actionButtons = `
          <div class="flex flex-col gap-2">
            <button class="px-3 py-1 rounded text-xs ${
              u.is_active ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
            }" data-toggle-user="${u.id}">
              ${u.is_active ? "Deactivate" : "Activate"}
            </button>
            ${u.role === "PROVIDER" ? `<button class="px-3 py-1 rounded text-xs bg-blue-100 text-blue-700" data-services-edit="${u.id}">Edit Services</button>` : ""}
            ${u.role === "PROVIDER" ? `<button class="px-3 py-1 rounded text-xs bg-violet-100 text-violet-700" data-prices-edit="${u.id}">Edit Prices</button>` : ""}
            <button class="px-3 py-1 rounded text-xs bg-rose-100 text-rose-700" data-delete-user="${u.id}" data-username="${u.username}">
              Delete
            </button>
          </div>
        `;

        tr.innerHTML = `
          <td class="py-3 px-4 truncate">${u.username}</td>
          <td class="py-3 px-4 truncate">${u.email || "-"}</td>
          <td class="py-3 px-4">${u.role}</td>
          <td class="py-3 px-4 truncate">${u.city || "-"}</td>
          <td class="py-3 px-4 align-top">${servicesCell}</td>
          <td class="py-3 px-4 text-center">${u.is_active ? "Yes" : "No"}</td>
          <td class="py-3 px-4 text-center">${actionButtons}</td>
        `;
      list.appendChild(tr);
    });

    bindToggleButtons();
    bindDeleteButtons();
    bindServiceEditors();
    bindPriceEditors();
  }

  function bindToggleButtons() {
    const buttons = document.querySelectorAll("[data-toggle-user]");
    buttons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const userId = btn.getAttribute("data-toggle-user");
        const res = await authFetch(`/api/accounts/admin/users/${userId}/toggle/`, {
          method: "POST",
        });
        if (res.status === 401) {
          handleUnauthorized();
          return;
        }
        loadUsers();
      });
    });
  }

  function bindDeleteButtons() {
    const buttons = document.querySelectorAll("[data-delete-user]");
    buttons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const userId = btn.getAttribute("data-delete-user");
        const username = btn.getAttribute("data-username") || "this user";
        const ok = window.confirm(`Delete ${username}? This action cannot be undone.`);
        if (!ok) return;

        const res = await authFetch(`/api/accounts/admin/users/${userId}/`, {
          method: "DELETE",
        });

        if (res.status === 401) {
          handleUnauthorized();
          return;
        }

        loadUsers();
      });
    });
  }

  function bindServiceEditors() {
    document.querySelectorAll("[data-services-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const userId = btn.getAttribute("data-services-edit");
        const editor = document.querySelector(`[data-services-editor="${userId}"]`);
        if (editor) editor.classList.toggle("hidden");
      });
    });

    document.querySelectorAll("[data-services-cancel]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const userId = btn.getAttribute("data-services-cancel");
        const editor = document.querySelector(`[data-services-editor="${userId}"]`);
        if (editor) editor.classList.add("hidden");
      });
    });

    document.querySelectorAll("[data-services-save]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const userId = btn.getAttribute("data-services-save");
        const select = document.querySelector(`[data-services-select="${userId}"]`);
        const services = Array.from(select.selectedOptions).map((o) => Number(o.value));

        const res = await authFetch(`/api/accounts/admin/providers/${userId}/services/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ services }),
        });

        if (res.status === 401) {
          handleUnauthorized();
          return;
        }

        loadUsers();
      });
    });
  }

  function bindPriceEditors() {
    document.querySelectorAll("[data-prices-edit]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const userId = btn.getAttribute("data-prices-edit");
        const editor = document.querySelector(`[data-prices-editor="${userId}"]`);
        const listEl = document.querySelector(`[data-prices-list="${userId}"]`);
        const msgEl = document.querySelector(`[data-prices-msg="${userId}"]`);
        if (!editor || !listEl) return;

        editor.classList.toggle("hidden");
        if (editor.classList.contains("hidden")) return;
        listEl.innerHTML = "<div class='text-xs text-slate-500'>Loading prices...</div>";
        if (msgEl) msgEl.textContent = "";

        const res = await authFetch(`/api/accounts/admin/providers/${userId}/service-prices/`);
        if (res.status === 401) {
          handleUnauthorized();
          return;
        }
        if (!res.ok) {
          listEl.innerHTML = "<div class='text-xs text-red-600'>Failed to load prices.</div>";
          return;
        }

        const data = await res.json();
        const prices = data.prices || [];
        if (!prices.length) {
          listEl.innerHTML = "<div class='text-xs text-slate-500'>No services to price.</div>";
          return;
        }

        listEl.innerHTML = prices.map((p) => `
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center border rounded p-2">
            <div class="sm:col-span-2">
              <p class="text-xs font-medium text-slate-800">${p.service_name}</p>
              <p class="text-[11px] text-slate-500">Base: Rs.${p.base_price}</p>
            </div>
            <input type="number" min="1" step="1" class="border rounded p-1 text-xs" data-admin-price-input="${userId}" data-service-id="${p.service_id}" value="${p.price}">
          </div>
        `).join("");
      });
    });

    document.querySelectorAll("[data-prices-cancel]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const userId = btn.getAttribute("data-prices-cancel");
        const editor = document.querySelector(`[data-prices-editor="${userId}"]`);
        if (editor) editor.classList.add("hidden");
      });
    });

    document.querySelectorAll("[data-prices-save]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const userId = btn.getAttribute("data-prices-save");
        const msgEl = document.querySelector(`[data-prices-msg="${userId}"]`);
        const inputs = document.querySelectorAll(`[data-admin-price-input="${userId}"]`);
        const prices = Array.from(inputs).map((input) => ({
          service_id: Number(input.getAttribute("data-service-id")),
          price: Number(input.value),
        }));

        const invalid = prices.find((p) => !p.price || p.price <= 0);
        if (invalid) {
          if (msgEl) msgEl.textContent = "Enter valid prices greater than 0.";
          return;
        }

        const res = await authFetch(`/api/accounts/admin/providers/${userId}/service-prices/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prices }),
        });

        if (res.status === 401) {
          handleUnauthorized();
          return;
        }

        if (res.ok) {
          if (msgEl) msgEl.textContent = "Prices updated";
          loadUsers();
        } else {
          const data = await res.json().catch(() => ({}));
          if (msgEl) msgEl.textContent = data.error || "Price update failed";
        }
      });
    });
  }

  loadUsers();

  [filterSearch, filterRole, filterActive, filterCity].forEach((el) => {
    if (el) {
      el.addEventListener("input", renderUsers);
      el.addEventListener("change", renderUsers);
    }
  });
})();

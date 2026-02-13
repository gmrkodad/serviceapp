(function () {
  const token = localStorage.getItem("access");
  if (!token) {
    window.location.href = "/login/";
    return;
  }

  const categoriesList = document.getElementById("admin-categories-list");
  const servicesList = document.getElementById("admin-services-list");
  const categoryForm = document.getElementById("admin-category-form");
  const serviceForm = document.getElementById("admin-service-form");
  const categorySelect = document.getElementById("service-category");
  const filterSearch = document.getElementById("filter-service-search");
  const filterCategory = document.getElementById("filter-service-category");
  const filterActive = document.getElementById("filter-service-active");
  const categoryError = document.getElementById("category-error");
  const serviceError = document.getElementById("service-error");
  let categoriesCache = [];
  let servicesCache = [];

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

  async function loadCategories() {
    const res = await authFetch("/api/services/admin/categories/");
    if (res.status === 401) {
      handleUnauthorized();
      return [];
    }
    return res.json();
  }

  async function loadServices() {
    const res = await authFetch("/api/services/admin/services/");
    if (res.status === 401) {
      handleUnauthorized();
      return [];
    }
    return res.json();
  }

  function renderCategories(categories) {
    categoriesCache = categories || [];
    categoriesList.innerHTML = "";
    categorySelect.innerHTML = "";
    if (filterCategory) {
      filterCategory.innerHTML = '<option value="">All categories</option>';
    }

    categoriesCache.forEach((c) => {
      const li = document.createElement("li");
      li.className = "p-3 border rounded bg-white";
      li.innerHTML = `
        <div class="flex items-center justify-between">
          <div>
            <p class="font-semibold">${c.name}</p>
            <p class="text-xs text-slate-500">${c.description || "No description"}</p>
          </div>
          <div class="flex items-center gap-2">
            <button class="text-xs px-2 py-1 rounded ${
              c.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
            }" data-toggle-category="${c.id}" data-active="${c.is_active}">
              ${c.is_active ? "Active" : "Inactive"}
            </button>
            <button class="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700" data-edit-category="${c.id}">
              Edit
            </button>
            <button class="text-xs px-2 py-1 rounded bg-red-100 text-red-700" data-delete-category="${c.id}">
              Delete
            </button>
          </div>
        </div>
      `;
      categoriesList.appendChild(li);

      const option = document.createElement("option");
      option.value = c.id;
      option.textContent = c.name;
      categorySelect.appendChild(option);

      if (filterCategory) {
        const opt = document.createElement("option");
        opt.value = String(c.id);
        opt.textContent = c.name;
        filterCategory.appendChild(opt);
      }
    });

    bindCategoryToggles();
    bindCategoryEdits();
    bindCategoryDeletes();
  }

  function renderServices(services) {
    servicesCache = services || [];
    servicesList.innerHTML = "";

    const q = (filterSearch?.value || "").toLowerCase();
    const catId = filterCategory?.value || "";
    const active = filterActive?.value;

    const filtered = servicesCache.filter((s) => {
      const matchSearch =
        !q ||
        (s.name || "").toLowerCase().includes(q) ||
        (s.category_name || "").toLowerCase().includes(q);
      const matchCat = !catId || String(s.category) === catId;
      const matchActive =
        active === "" ? true : String(s.is_active) === active;
      return matchSearch && matchCat && matchActive;
    });

    filtered.forEach((s) => {
      const li = document.createElement("li");
      li.className = "p-3 border rounded bg-white";
      li.innerHTML = `
        <div class="flex items-center justify-between">
          <div>
            <p class="font-semibold">${s.name} <span class="text-xs text-slate-500">(${s.category_name})</span></p>
            <p class="text-xs text-slate-500">INR ${s.base_price}</p>
          </div>
          <div class="flex items-center gap-2">
            <button class="text-xs px-2 py-1 rounded ${
              s.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
            }" data-toggle-service="${s.id}" data-active="${s.is_active}">
              ${s.is_active ? "Active" : "Inactive"}
            </button>
            <button class="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700" data-edit-service="${s.id}">
              Edit
            </button>
            <button class="text-xs px-2 py-1 rounded bg-red-100 text-red-700" data-delete-service="${s.id}">
              Delete
            </button>
          </div>
        </div>
      `;
      servicesList.appendChild(li);
    });

    bindServiceToggles();
    bindServiceEdits();
    bindServiceDeletes();
  }

  async function refreshLists() {
    const [categories, services] = await Promise.all([
      loadCategories(),
      loadServices(),
    ]);
    renderCategories(categories);
    renderServices(services);
  }

  function bindCategoryToggles() {
    document.querySelectorAll("[data-toggle-category]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-toggle-category");
        const active = btn.getAttribute("data-active") === "true";
        await authFetch(`/api/services/admin/categories/${id}/`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: !active }),
        });
        refreshLists();
      });
    });
  }

  function bindCategoryEdits() {
    document.querySelectorAll("[data-edit-category]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-edit-category");
        const name = prompt("Category name:");
        if (name === null) return;
        const description = prompt("Description:", "");
        if (description === null) return;

        await authFetch(`/api/services/admin/categories/${id}/`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description }),
        });
        refreshLists();
      });
    });
  }

  function bindCategoryDeletes() {
    document.querySelectorAll("[data-delete-category]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-delete-category");
        const ok = confirm("Delete this category? This will also remove its services.");
        if (!ok) return;
        await authFetch(`/api/services/admin/categories/${id}/`, {
          method: "DELETE",
        });
        refreshLists();
      });
    });
  }

  function bindServiceToggles() {
    document.querySelectorAll("[data-toggle-service]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-toggle-service");
        const active = btn.getAttribute("data-active") === "true";
        await authFetch(`/api/services/admin/services/${id}/`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: !active }),
        });
        refreshLists();
      });
    });
  }

  function bindServiceEdits() {
    document.querySelectorAll("[data-edit-service]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-edit-service");
        const name = prompt("Service name:");
        if (name === null) return;
        const description = prompt("Description:", "");
        if (description === null) return;
        const base_price = prompt("Base price:", "");
        if (base_price === null) return;

        await authFetch(`/api/services/admin/services/${id}/`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, base_price }),
        });
        refreshLists();
      });
    });
  }

  function bindServiceDeletes() {
    document.querySelectorAll("[data-delete-service]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-delete-service");
        const ok = confirm("Delete this service?");
        if (!ok) return;
        await authFetch(`/api/services/admin/services/${id}/`, {
          method: "DELETE",
        });
        refreshLists();
      });
    });
  }

  if (categoryForm) {
    categoryForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      categoryError.classList.add("hidden");

      const name = document.getElementById("category-name").value;
      const description = document.getElementById("category-description").value;
      const is_active = document.getElementById("category-active").checked;

      const res = await authFetch("/api/services/admin/categories/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, is_active }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        categoryError.textContent = data.name?.[0] || "Category creation failed";
        categoryError.classList.remove("hidden");
        return;
      }

      categoryForm.reset();
      document.getElementById("category-active").checked = true;
      refreshLists();
    });
  }

  if (serviceForm) {
    serviceForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      serviceError.classList.add("hidden");

      const name = document.getElementById("service-name").value;
      const description = document.getElementById("service-description").value;
      const base_price = document.getElementById("service-price").value;
      const category = document.getElementById("service-category").value;
      const is_active = document.getElementById("service-active").checked;

      const res = await authFetch("/api/services/admin/services/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, base_price, category, is_active }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        serviceError.textContent = data.name?.[0] || "Service creation failed";
        serviceError.classList.remove("hidden");
        return;
      }

      serviceForm.reset();
      document.getElementById("service-active").checked = true;
      refreshLists();
    });
  }

  refreshLists();

  [filterSearch, filterCategory, filterActive].forEach((el) => {
    if (el) {
      el.addEventListener("input", () => renderServices(servicesCache));
      el.addEventListener("change", () => renderServices(servicesCache));
    }
  });
})();

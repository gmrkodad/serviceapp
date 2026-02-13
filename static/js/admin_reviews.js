(function () {
  const token = localStorage.getItem("access");
  if (!token) {
    window.location.href = "/login/";
    return;
  }

  const list = document.getElementById("admin-reviews-list");
  const empty = document.getElementById("admin-reviews-empty");
  const filterSearch = document.getElementById("filter-review-search");
  const filterRating = document.getElementById("filter-review-rating");
  const filterProvider = document.getElementById("filter-review-provider");
  let reviewsCache = [];

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

  async function loadReviews() {
    const res = await authFetch("/api/bookings/admin/reviews/");
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }

    const reviews = await res.json();
    reviewsCache = reviews || [];
    renderReviews();
  }

  function renderReviews() {
    const q = (filterSearch?.value || "").toLowerCase();
    const ratingFilter = filterRating?.value || "";
    const providerQ = (filterProvider?.value || "").toLowerCase();

    const filtered = reviewsCache.filter((r) => {
      const matchSearch =
        !q ||
        (r.service_name || "").toLowerCase().includes(q) ||
        (r.author_username || "").toLowerCase().includes(q);
      const matchRating = !ratingFilter || String(r.rating) === ratingFilter;
      const matchProvider =
        !providerQ || (r.provider_username || "").toLowerCase().includes(providerQ);
      return matchSearch && matchRating && matchProvider;
    });

    if (!filtered.length) {
      list.innerHTML = "";
      empty.classList.remove("hidden");
      return;
    }

    empty.classList.add("hidden");
    list.innerHTML = "";

    const renderStars = (rating) => {
      const starSvg = (filled) => `
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style="display:inline-block;margin-right:2px;fill:${filled ? "#f59e0b" : "#e2e8f0"};">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path>
        </svg>
      `;
      let out = "";
      for (let i = 1; i <= 5; i++) {
        out += starSvg(i <= rating);
      }
      return out;
    };

    filtered.forEach((r) => {
      const card = document.createElement("div");
      card.className = "bg-white/80 rounded-2xl border border-slate-100 p-4 shadow-sm";

      const stars = renderStars(r.rating);

      card.innerHTML = `
        <div class="flex items-center justify-between">
          <div>
            <p class="font-semibold">${r.service_name}</p>
            <p class="text-xs text-slate-500">Booking #${r.booking_id}</p>
          </div>
          <div class="leading-none">${stars}</div>
        </div>
        <p class="text-sm text-slate-600 mt-2">${r.comment || "No comment"}</p>
        <div class="text-xs text-slate-500 mt-3">
          Author: ${r.author_username} | Provider: ${r.provider_username || "-"}
        </div>
      `;

      list.appendChild(card);
    });
  }

  loadReviews();

  [filterSearch, filterRating, filterProvider].forEach((el) => {
    if (el) {
      el.addEventListener("input", renderReviews);
      el.addEventListener("change", renderReviews);
    }
  });
})();

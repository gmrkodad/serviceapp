(function () {
  const token = localStorage.getItem("access");
  if (!token) {
    window.location.href = "/login/";
    return;
  }

  const bookingsEl = document.getElementById("admin-total-bookings");
  const usersEl = document.getElementById("admin-total-users");
  const servicesEl = document.getElementById("admin-total-services");
  const reviewsEl = document.getElementById("admin-total-reviews");

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

  async function loadCounts() {
    try {
      const [bookingsRes, usersRes, servicesRes, reviewsRes] = await Promise.all([
        authFetch("/api/bookings/admin/all/"),
        authFetch("/api/accounts/admin/users/"),
        authFetch("/api/services/admin/services/"),
        authFetch("/api/bookings/admin/reviews/"),
      ]);

      if ([bookingsRes, usersRes, servicesRes, reviewsRes].some((r) => r.status === 401)) {
        handleUnauthorized();
        return;
      }

      const bookings = await bookingsRes.json();
      const users = await usersRes.json();
      const services = await servicesRes.json();
      const reviews = await reviewsRes.json();

      if (bookingsEl) bookingsEl.innerText = bookings.length || 0;
      if (usersEl) usersEl.innerText = users.length || 0;
      if (servicesEl) servicesEl.innerText = services.length || 0;
      if (reviewsEl) reviewsEl.innerText = reviews.length || 0;
    } catch {
      // ignore
    }
  }

  loadCounts();
})();

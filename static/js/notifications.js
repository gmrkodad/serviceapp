function initNotifications() {
  const bell = document.getElementById("notif-bell");
  const dropdown = document.getElementById("notif-dropdown");
  const list = document.getElementById("notif-list");
  const countSpan = document.getElementById("notif-count");
  const markAllBtn = document.getElementById("mark-all");

  if (!bell || !dropdown || !list || !countSpan) return;

  const POLL_INTERVAL_MS = 10000;
  let isDropdownOpen = false;
  let pollingTimer = null;
  let inFlight = false;

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
    const token = localStorage.getItem("access");
    if (!token) return fetch(url, options);

    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
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

  function renderNotifications(data) {
    list.innerHTML = "";
    let unread = 0;

    data.forEach((n) => {
      const li = document.createElement("li");
      li.className = `p-3 border-b cursor-pointer ${
        n.is_read ? "text-gray-600" : "font-semibold bg-blue-50/40"
      }`;
      li.innerText = n.message;

      if (!n.is_read) unread++;

      li.onclick = () => markRead(n.id);
      list.appendChild(li);
    });

    if (!data.length && isDropdownOpen) {
      const li = document.createElement("li");
      li.className = "p-3 text-sm text-gray-500";
      li.innerText = "No notifications";
      list.appendChild(li);
    }

    if (unread > 0) {
      countSpan.innerText = unread;
      countSpan.classList.remove("hidden");
    } else {
      countSpan.classList.add("hidden");
    }
  }

  async function loadNotifications({ showLoading = false } = {}) {
    if (inFlight) return;
    const token = localStorage.getItem("access");
    if (!token) return;

    inFlight = true;
    if (showLoading && isDropdownOpen) {
      list.innerHTML = "<li class='p-3 text-sm text-gray-500'>Loading...</li>";
    }

    try {
      const res = await authFetch("/api/accounts/notifications/");
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) return;

      const data = await res.json();
      renderNotifications(data || []);
    } finally {
      inFlight = false;
    }
  }

  async function markRead(id) {
    const res = await authFetch(`/api/accounts/notifications/read/${id}/`, {
      method: "POST",
    });
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    loadNotifications();
  }

  function startPolling() {
    if (pollingTimer) return;
    pollingTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadNotifications();
      }
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (!pollingTimer) return;
    clearInterval(pollingTimer);
    pollingTimer = null;
  }

  bell.addEventListener("click", () => {
    isDropdownOpen = !dropdown.classList.contains("hidden");
    dropdown.classList.toggle("hidden");
    isDropdownOpen = !dropdown.classList.contains("hidden");
    if (isDropdownOpen) {
      loadNotifications({ showLoading: true });
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      loadNotifications();
    }
  });

  if (markAllBtn) {
    markAllBtn.addEventListener("click", async () => {
      const res = await authFetch("/api/accounts/notifications/read-all/", {
        method: "POST",
      });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      loadNotifications();
    });
  }

  // Initial unread count refresh and background updates.
  loadNotifications();
  startPolling();

  window.addEventListener("beforeunload", stopPolling);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNotifications);
} else {
  initNotifications();
}

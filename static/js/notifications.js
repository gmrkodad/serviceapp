function initNotifications() {
  const bell = document.getElementById("notif-bell");
  const dropdown = document.getElementById("notif-dropdown");
  const list = document.getElementById("notif-list");
  const countSpan = document.getElementById("notif-count");
  const markAllBtn = document.getElementById("mark-all");

  if (!bell || !dropdown || !list || !countSpan) {
    return;
  }

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

  bell.addEventListener("click", () => {
    dropdown.classList.toggle("hidden");
    loadNotifications();
  });

  function loadNotifications() {
    const token = localStorage.getItem("access");
    if (!token) return;

    authFetch("/api/accounts/notifications/")
      .then((res) => {
        if (res.status === 401) {
          handleUnauthorized();
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;

        list.innerHTML = "";
        let unread = 0;

        data.forEach((n) => {
          const li = document.createElement("li");
          li.className = `p-3 border-b cursor-pointer ${
            n.is_read ? "text-gray-600" : "font-semibold"
          }`;
          li.innerText = n.message;

          if (!n.is_read) unread++;

          li.onclick = () => markRead(n.id);
          list.appendChild(li);
        });

        if (unread > 0) {
          countSpan.innerText = unread;
          countSpan.classList.remove("hidden");
        } else {
          countSpan.classList.add("hidden");
        }
      });
  }

  function markRead(id) {
    authFetch(`/api/accounts/notifications/read/${id}/`, {
      method: "POST",
    }).then(loadNotifications);
  }

  if (markAllBtn) {
    markAllBtn.addEventListener("click", () => {
      authFetch("/api/accounts/notifications/read-all/", {
        method: "POST",
      }).then(loadNotifications);
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNotifications);
} else {
  initNotifications();
}

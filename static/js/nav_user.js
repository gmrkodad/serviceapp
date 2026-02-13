(async function () {
  const usernameEl = document.getElementById("nav-username");
  if (!usernameEl) return;

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

  async function fetchMe(token) {
    return fetch("/api/accounts/me/", {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  let token = localStorage.getItem("access");
  if (!token) return;

  let res = await fetchMe(token);
  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) return;
    res = await fetchMe(newToken);
  }

  if (!res.ok) return;
  const user = await res.json();
  usernameEl.textContent = `Hi, ${user.username}`;
})();

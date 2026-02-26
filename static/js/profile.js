const token = localStorage.getItem("access");
if (!token) window.location.href = "/login/";

const fullNameEl = document.getElementById("profile-full-name");
const usernameEl = document.getElementById("profile-username");
const emailEl = document.getElementById("profile-email");
const phoneEl = document.getElementById("profile-phone");

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

(async () => {
  const res = await authFetch("/api/accounts/me/");
  if (res.status === 401) {
    localStorage.clear();
    window.location.href = "/login/";
    return;
  }
  if (!res.ok) return;

  const user = await res.json();
  fullNameEl.textContent = user.full_name || "-";
  usernameEl.textContent = user.username || "-";
  emailEl.textContent = user.email || "-";
  phoneEl.textContent = user.phone || "-";
})();

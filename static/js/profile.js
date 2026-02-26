const token = localStorage.getItem("access");
if (!token) window.location.href = "/login/";

const form = document.getElementById("profile-form");
const fullNameInput = document.getElementById("profile-full-name-input");
const emailInput = document.getElementById("profile-email-input");
const usernameEl = document.getElementById("profile-username");
const phoneEl = document.getElementById("profile-phone");
const successEl = document.getElementById("profile-success");
const errorEl = document.getElementById("profile-error");

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

async function loadProfile() {
  const res = await authFetch("/api/accounts/me/");
  if (res.status === 401) {
    localStorage.clear();
    window.location.href = "/login/";
    return;
  }
  if (!res.ok) return;

  const user = await res.json();
  fullNameInput.value = user.full_name || "";
  emailInput.value = user.email || "";
  usernameEl.textContent = user.username || "-";
  phoneEl.textContent = user.phone || "-";
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    successEl.classList.add("hidden");
    errorEl.classList.add("hidden");

    const full_name = fullNameInput.value.trim();
    const email = emailInput.value.trim();

    if (!full_name || !email) {
      errorEl.textContent = "Full name and email are required.";
      errorEl.classList.remove("hidden");
      return;
    }

    const res = await authFetch("/api/accounts/me/update/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name, email }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      errorEl.textContent = data.error || "Failed to update profile.";
      errorEl.classList.remove("hidden");
      return;
    }

    successEl.textContent = "Profile updated successfully.";
    successEl.classList.remove("hidden");
    await loadProfile();
  });
}

loadProfile();

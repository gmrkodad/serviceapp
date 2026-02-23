(function () {
  const form = document.getElementById("change-password-form");
  const successEl = document.getElementById("change-password-success");
  const errorEl = document.getElementById("change-password-error");

  if (!form) return;

  function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
    successEl.classList.add("hidden");
  }

  function showSuccess(message) {
    successEl.textContent = message;
    successEl.classList.remove("hidden");
    errorEl.classList.add("hidden");
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

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.add("hidden");
    successEl.classList.add("hidden");

    const current_password = document.getElementById("current-password").value;
    const new_password = document.getElementById("new-password").value;
    const confirm_password = document.getElementById("confirm-password").value;

    if (!current_password || !new_password || !confirm_password) {
      showError("All fields are required");
      return;
    }

    if (new_password !== confirm_password) {
      showError("New password and confirm password do not match");
      return;
    }

    try {
      const res = await authFetch("/api/accounts/me/change-password/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password,
          new_password,
          confirm_password,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        localStorage.clear();
        window.location.href = "/login/";
        return;
      }

      if (!res.ok) {
        showError(data.error || "Failed to change password");
        return;
      }

      showSuccess("Password changed successfully. Please login again.");
      localStorage.clear();
      setTimeout(() => {
        window.location.href = "/login/";
      }, 1200);
    } catch {
      showError("Unable to update password. Please try again.");
    }
  });
})();

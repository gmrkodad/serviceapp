(async function () {
  const usernameEl = document.getElementById("nav-username");
  const navAvatarEl = document.getElementById("nav-avatar");
  const profileNameEl = document.getElementById("profile-name");
  const profileRoleEl = document.getElementById("profile-role");
  const homeLinkEl = document.getElementById("nav-home-link");
  const accountLinkEl = document.getElementById("account-link");
  const profileMenuBtn = document.getElementById("profile-menu-btn");
  const profileMenu = document.getElementById("profile-menu");
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
  usernameEl.textContent = user.username;
  if (profileNameEl) profileNameEl.textContent = user.username;
  if (navAvatarEl) {
    const initial = (user.username || "A").trim().charAt(0).toUpperCase();
    navAvatarEl.textContent = initial || "A";
  }

  if (homeLinkEl) {
    if (user.role === "ADMIN") {
      homeLinkEl.href = "/admin-panel/";
      if (accountLinkEl) {
        accountLinkEl.href = "/admin-panel/";
        accountLinkEl.textContent = "Admin Panel";
      }
      if (profileRoleEl) profileRoleEl.textContent = "Administrator";
    } else if (user.role === "PROVIDER") {
      homeLinkEl.href = "/dashboard/provider/";
      if (accountLinkEl) {
        accountLinkEl.href = "/account/profile/";
        accountLinkEl.textContent = "My Profile";
      }
      if (profileRoleEl) profileRoleEl.textContent = "Provider account";
    } else {
      homeLinkEl.href = "/";
      if (accountLinkEl) {
        accountLinkEl.href = "/account/profile/";
        accountLinkEl.textContent = "My Profile";
      }
      if (profileRoleEl) profileRoleEl.textContent = "Customer account";
    }
  }

  if (profileMenuBtn && profileMenu) {
    profileMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      profileMenu.classList.toggle("hidden");
      profileMenuBtn.setAttribute(
        "aria-expanded",
        profileMenu.classList.contains("hidden") ? "false" : "true"
      );
    });

    document.addEventListener("click", () => {
      profileMenu.classList.add("hidden");
      profileMenuBtn.setAttribute("aria-expanded", "false");
    });

    profileMenu.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        profileMenu.classList.add("hidden");
        profileMenuBtn.setAttribute("aria-expanded", "false");
      }
    });
  }
})();

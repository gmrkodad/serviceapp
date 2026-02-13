// ===============================
// AUTH.JS — FINAL VERSION
// ===============================

// 🔁 AUTO REDIRECT IF ALREADY LOGGED IN
document.addEventListener("DOMContentLoaded", async () => {
  console.log("AUTH JS LOADED");

  const access = localStorage.getItem("access");
  if (!access) return;

  try {
    const res = await fetch("/api/accounts/me/", {
      headers: {
        Authorization: `Bearer ${access}`,
      },
    });

    if (!res.ok) throw new Error("Invalid token");

    const user = await res.json();

    if (user.role === "CUSTOMER") {
      window.location.replace("/"); // CUSTOMER HOME
    } else if (user.role === "PROVIDER") {
      window.location.replace("/dashboard/provider/");
    } else if (user.role === "ADMIN") {
      window.location.replace("/admin-panel/");
    }
  } catch {
    // Token invalid or expired → clear storage
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
  }
});

// ===============================
// LOGIN FORM HANDLER
// ===============================
const form = document.getElementById("login-form");
const usernameEl = document.getElementById("username");
const passwordEl = document.getElementById("password");
const errorEl = document.getElementById("error");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    errorEl.textContent = "";
    errorEl.classList.add("hidden");

    const username = usernameEl.value.trim();
    const password = passwordEl.value;

    if (!username || !password) {
      errorEl.textContent = "Please enter both username and password";
      errorEl.classList.remove("hidden");
      return;
    }

    try {
      // 🔐 LOGIN
      const res = await fetch("/api/token/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.access || !data.refresh) {
        throw new Error(data.detail || "Invalid credentials");
      }

      // 💾 STORE TOKENS
      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);

      // 👤 FETCH USER PROFILE
      const meRes = await fetch("/api/accounts/me/", {
        headers: {
          Authorization: `Bearer ${data.access}`,
        },
      });

      if (!meRes.ok) {
        throw new Error("Login succeeded but profile fetch failed");
      }

      const user = await meRes.json();

      // 🚀 ROLE-BASED REDIRECT
      if (user.role === "CUSTOMER") {
        window.location.replace("/");
      } else if (user.role === "PROVIDER") {
        window.location.replace("/dashboard/provider/");
      } else if (user.role === "ADMIN") {
        window.location.replace("/admin-panel/");
      }

    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove("hidden");
    }
  });
}

function redirectByRole(user) {
  if (user.role === "CUSTOMER") {
    window.location.replace("/");
  } else if (user.role === "PROVIDER") {
    window.location.replace("/dashboard/provider/");
  } else if (user.role === "ADMIN") {
    window.location.replace("/admin-panel/");
  }
}

async function fetchMe(access) {
  const res = await fetch("/api/accounts/me/", {
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch user profile");
  }
  return res.json();
}

document.addEventListener("DOMContentLoaded", async () => {
  const access = localStorage.getItem("access");
  if (!access) return;

  try {
    const user = await fetchMe(access);
    redirectByRole(user);
  } catch {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
  }
});

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
      const res = await fetch("/api/token/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.access || !data.refresh) {
        throw new Error(data.detail || "Invalid credentials");
      }

      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);
      const user = await fetchMe(data.access);
      redirectByRole(user);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove("hidden");
    }
  });
}

const otpForm = document.getElementById("otp-login-form");
const otpPhoneEl = document.getElementById("otp-phone");
const otpCodeEl = document.getElementById("otp-code");
const otpInfoEl = document.getElementById("otp-info");
const otpErrorEl = document.getElementById("otp-error");
const sendOtpBtn = document.getElementById("send-otp-btn");

if (sendOtpBtn) {
  sendOtpBtn.addEventListener("click", async () => {
    const phone = otpPhoneEl.value.trim();
    otpInfoEl.classList.add("hidden");
    otpErrorEl.classList.add("hidden");

    if (!phone) {
      otpErrorEl.textContent = "Enter mobile number";
      otpErrorEl.classList.remove("hidden");
      return;
    }

    sendOtpBtn.disabled = true;
    sendOtpBtn.textContent = "Sending...";
    try {
      const res = await fetch("/api/accounts/auth/otp/send/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.phone?.[0] || "Failed to send OTP");
      }

      otpInfoEl.textContent = data.dev_otp
        ? `OTP sent (debug): ${data.dev_otp}`
        : "OTP sent to your mobile number";
      otpInfoEl.classList.remove("hidden");
    } catch (err) {
      otpErrorEl.textContent = err.message;
      otpErrorEl.classList.remove("hidden");
    } finally {
      sendOtpBtn.disabled = false;
      sendOtpBtn.textContent = "Send OTP";
    }
  });
}

if (otpForm) {
  otpForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    otpInfoEl.classList.add("hidden");
    otpErrorEl.classList.add("hidden");

    const phone = otpPhoneEl.value.trim();
    const otp = otpCodeEl.value.trim();
    if (!phone || !otp) {
      otpErrorEl.textContent = "Enter mobile number and OTP";
      otpErrorEl.classList.remove("hidden");
      return;
    }

    try {
      const res = await fetch("/api/accounts/auth/otp/verify/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });
      const data = await res.json();
      if (!res.ok || !data.access || !data.refresh) {
        throw new Error(data.error || "OTP verification failed");
      }

      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);
      redirectByRole(data);
    } catch (err) {
      otpErrorEl.textContent = err.message;
      otpErrorEl.classList.remove("hidden");
    }
  });
}

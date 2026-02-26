const form = document.getElementById("register-form");
const fullNameEl = document.getElementById("full_name");
const usernameEl = document.getElementById("username");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const phoneEl = document.getElementById("phone");
const otpEl = document.getElementById("otp");
const sendOtpBtn = document.getElementById("send-otp-btn");
const otpInfoEl = document.getElementById("otp-info");
const otpErrorEl = document.getElementById("otp-error");
const errorEl = document.getElementById("error");
const successEl = document.getElementById("success");

let resendTimer = null;
let resendSecondsLeft = 0;

function startResendTimer(seconds = 30) {
  resendSecondsLeft = seconds;
  sendOtpBtn.disabled = true;
  sendOtpBtn.textContent = `Resend in ${resendSecondsLeft}s`;
  if (resendTimer) clearInterval(resendTimer);
  resendTimer = setInterval(() => {
    resendSecondsLeft -= 1;
    if (resendSecondsLeft <= 0) {
      clearInterval(resendTimer);
      resendTimer = null;
      sendOtpBtn.disabled = false;
      sendOtpBtn.textContent = "Send OTP";
      return;
    }
    sendOtpBtn.textContent = `Resend in ${resendSecondsLeft}s`;
  }, 1000);
}

if (sendOtpBtn) {
  sendOtpBtn.addEventListener("click", async () => {
    otpInfoEl.classList.add("hidden");
    otpErrorEl.classList.add("hidden");

    const phone = phoneEl.value.trim();
    if (!phone) {
      otpErrorEl.textContent = "Enter mobile number";
      otpErrorEl.classList.remove("hidden");
      return;
    }

    sendOtpBtn.disabled = true;
    sendOtpBtn.textContent = "Sending...";
    try {
      const res = await fetch("/api/accounts/auth/otp/send-signup/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.phone?.[0] || "Failed to send OTP");
      }
      otpInfoEl.textContent = data.dev_otp
        ? `OTP sent (debug): ${data.dev_otp}`
        : "OTP sent to your mobile number";
      otpInfoEl.classList.remove("hidden");
      startResendTimer(30);
    } catch (err) {
      otpErrorEl.textContent = err.message;
      otpErrorEl.classList.remove("hidden");
      sendOtpBtn.disabled = false;
      sendOtpBtn.textContent = "Send OTP";
    }
  });
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    errorEl.classList.add("hidden");
    successEl.classList.add("hidden");

    try {
      const res = await fetch("/api/accounts/signup/customer/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullNameEl.value.trim(),
          username: usernameEl.value.trim(),
          email: emailEl.value.trim(),
          password: passwordEl.value,
          phone: phoneEl.value.trim(),
          otp: otpEl.value.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.error ||
          data.detail ||
          data.username?.[0] ||
          data.email?.[0] ||
          data.phone?.[0] ||
          data.otp?.[0] ||
          "Registration failed"
        );
      }

      successEl.textContent = "Registration successful! Redirecting to login...";
      successEl.classList.remove("hidden");
      setTimeout(() => {
        window.location.href = "/login/";
      }, 1500);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove("hidden");
    }
  });
}

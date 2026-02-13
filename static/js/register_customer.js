async function detectCity() {
  try {
    const stored = localStorage.getItem("location_city");
    if (stored) return stored;
    const res = await fetch("/api/accounts/ip-location/");
    if (!res.ok) return "";
    const data = await res.json();
    if (data.city) {
      localStorage.setItem("location_city", data.city);
    }
    return data.city || "";
  } catch {
    return "";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const cityInput = document.getElementById("city");
  if (!cityInput) return;
  const city = await detectCity();
  if (city && !cityInput.value) {
    cityInput.value = city;
  }
});

document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  // ✅ GET INPUTS (THIS WAS MISSING)
  const username = document.getElementById("username").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const city = document.getElementById("city").value;

  const errorEl = document.getElementById("error");
  const successEl = document.getElementById("success");

  errorEl.classList.add("hidden");
  successEl.classList.add("hidden");

  try {
    // ✅ CORRECT API URL
    const res = await fetch("/api/accounts/signup/customer/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        email,
        password,
        city,
      }),
    });

    let data = {};
    try {
      data = await res.json();
    } catch {}

    if (!res.ok) {
      throw new Error(
        data.detail ||
        data.username?.[0] ||
        data.email?.[0] ||
        "Registration failed"
      );
    }

    // ✅ SUCCESS
    successEl.textContent =
      "Registration successful! Redirecting to login...";
    successEl.classList.remove("hidden");

    setTimeout(() => {
      window.location.href = "/login/";
    }, 1500);

  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove("hidden");
  }
});

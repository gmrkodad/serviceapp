document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  // ✅ GET INPUTS (THIS WAS MISSING)
  const username = document.getElementById("username").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const phone = document.getElementById("phone").value;

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
        phone,
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
        data.phone?.[0] ||
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

document.addEventListener("DOMContentLoaded", () => {
  initDashboard();
});

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

async function ensureAccessTokenOrRedirect() {
  let token = localStorage.getItem("access");
  if (!token) token = await refreshAccessToken();
  if (!token) {
    window.location.href = "/login/";
    return false;
  }
  return true;
}

function statusClass(status) {
  switch (status) {
    case "PENDING":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "ASSIGNED":
      return "bg-sky-50 text-sky-800 border-sky-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

async function initDashboard() {
  const ok = await ensureAccessTokenOrRedirect();
  if (!ok) return;

  authFetch("/api/bookings/provider/dashboard/")
    .then((res) => {
      if (res.status === 401) {
        localStorage.clear();
        window.location.href = "/login/";
        return null;
      }
      return res.json();
    })
    .then((data) => {
      if (!data) return;

      document.getElementById("total-bookings").innerText = data.length;
      document.getElementById("pending-bookings").innerText = data.filter((b) => b.status === "PENDING").length;
      document.getElementById("completed-bookings").innerText = data.filter((b) => b.status === "COMPLETED").length;

      const tbody = document.getElementById("booking-list");
      tbody.innerHTML = "";

      data.slice(0, 5).forEach((b) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${b.service_name}</td>
          <td><span class="inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClass(b.status)}">${b.status}</span></td>
          <td>${b.scheduled_date}</td>
        `;
        tbody.appendChild(tr);
      });
    })
    .catch((err) => {
      console.error("Dashboard error:", err);
    });
}

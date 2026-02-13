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
  if (!token) {
    token = await refreshAccessToken();
  }
  if (!token) {
    window.location.href = "/login/";
    return false;
  }
  return true;
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

      // Stats
      document.getElementById("total-bookings").innerText = data.length;

      const pending = data.filter((b) => b.status === "PENDING").length;
      const completed = data.filter((b) => b.status === "COMPLETED").length;

      document.getElementById("pending-bookings").innerText = pending;
      document.getElementById("completed-bookings").innerText = completed;

      // Recent bookings table
      const tbody = document.getElementById("booking-list");
      tbody.innerHTML = "";

      data.slice(0, 5).forEach((b) => {
        const tr = document.createElement("tr");
        tr.classList.add("border-b");

        tr.innerHTML = `
          <td class="py-2">${b.service_name}</td>
          <td class="py-2">
            <span class="px-2 py-1 rounded text-sm ${statusClass(b.status)}">
              ${b.status}
            </span>
          </td>
          <td class="py-2">${b.scheduled_date}</td>
        `;

        tbody.appendChild(tr);
      });
    })
    .catch((err) => {
      console.error("Dashboard error:", err);
    });
}

function statusClass(status) {
  switch (status) {
    case "PENDING":
      return "bg-yellow-100 text-yellow-700";
    case "COMPLETED":
      return "bg-green-100 text-green-700";
    case "ASSIGNED":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function renderBookings(data) {
  const tbody = document.getElementById("booking-list");
  tbody.innerHTML = "";

  data.slice(0, 5).forEach((b) => {
    const tr = document.createElement("tr");
    tr.classList.add("border-b");

    tr.innerHTML = `
      <td class="py-2">${b.service_name}</td>
      <td>${statusBadge(b.status)}</td>
      <td>${b.scheduled_date}</td>
      <td>${actionButton(b)}</td>
    `;

    tbody.appendChild(tr);
  });
}

function statusBadge(status) {
  const map = {
    PENDING: "bg-yellow-100 text-yellow-700",
    ASSIGNED: "bg-blue-100 text-blue-700",
    IN_PROGRESS: "bg-purple-100 text-purple-700",
    COMPLETED: "bg-green-100 text-green-700",
  };
  return `<span class="px-2 py-1 rounded text-sm ${map[status]}">${status}</span>`;
}

function actionButton(b) {
  if (b.status === "PENDING") {
    return `<button onclick="bookingAction(${b.id}, 'accept')"
      class="px-3 py-1 bg-blue-600 text-white rounded">Accept</button>`;
  }
  if (b.status === "ASSIGNED") {
    return `<button onclick="bookingAction(${b.id}, 'start')"
      class="px-3 py-1 bg-purple-600 text-white rounded">Start</button>`;
  }
  if (b.status === "IN_PROGRESS") {
    return `<button onclick="bookingAction(${b.id}, 'complete')"
      class="px-3 py-1 bg-green-600 text-white rounded">Complete</button>`;
  }
  return "-";
}

function bookingAction(id, action) {
  authFetch(`/api/bookings/${id}/${action}/`, {
    method: "POST",
  })
    .then((res) => {
      if (res.status === 401) {
        localStorage.clear();
        window.location.href = "/login/";
        return null;
      }
      if (!res.ok) throw new Error("Action failed");
      return res.json();
    })
    .then(() => {
      location.reload();
    })
    .catch(() => {
      alert("Something went wrong");
    });
}

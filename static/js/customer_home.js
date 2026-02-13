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

async function saveCustomerCity(city) {
  if (!city) return;
  const res = await authFetch("/api/accounts/me/customer-city/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ city }),
  });
  if (res.status === 401) {
    window.location.href = "/login/";
  }
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

const categoriesDiv = document.getElementById("categories");
const searchInput = document.getElementById("service-search");
const noResults = document.getElementById("no-results");
const locationCity = document.getElementById("location-city");
const locationApply = document.getElementById("location-apply");
let allCategories = [];

async function detectLocationByIp() {
  try {
    const res = await fetch("/api/accounts/ip-location/");
    if (!res.ok) return;
    const data = await res.json();
    const city = data.city || "";
    if (!localStorage.getItem("location_city") && city) {
      localStorage.setItem("location_city", city);
    }
  } catch {
    // ignore IP lookup errors
  }
}

async function reverseGeocodeCity(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=10&addressdetails=1`
    );
    if (!res.ok) return "";
    const data = await res.json();
    const addr = data.address || {};
    return (
      addr.city ||
      addr.town ||
      addr.village ||
      addr.county ||
      ""
    );
  } catch {
    return "";
  }
}

async function detectLocationByBrowser() {
  if (!("geolocation" in navigator)) return false;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const city = await reverseGeocodeCity(latitude, longitude);
        if (city) {
          localStorage.setItem("location_city", city);
          resolve(true);
          return;
        }
        resolve(false);
      },
      () => resolve(false),
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 300000,
      }
    );
  });
}

// Icon mapping (category name -> icon)
const categoryIcons = {
  "Home Cleaning": "&#129532;",
  Plumbing: "&#128703;",
  Electrician: "&#9889;",
  "AC Repair": "&#10052;",
  Beauty: "&#128132;",
  "Appliance Repair": "&#128295;",
  Painting: "&#127912;",
  "Pest Control": "&#128029;",
  Carpentry: "&#128296;",
  Default: "&#128736;",
};

(async () => {
  const ok = await ensureAccessTokenOrRedirect();
  if (!ok) return;

  const gotBrowserLocation = await detectLocationByBrowser();
  if (!gotBrowserLocation) {
    await detectLocationByIp();
  }

  if (locationCity) {
    locationCity.value = localStorage.getItem("location_city") || "";
    if (locationCity.value.trim()) {
      saveCustomerCity(locationCity.value.trim());
    }
  }

  // ==========================
  // LOAD ONLY CATEGORIES (NO SERVICES)
  // ==========================
  authFetch("/api/services/categories/")
    .then((res) => {
      if (res.status === 401) {
        window.location.href = "/login/";
        return [];
      }
      return res.json();
    })
    .then((categories) => {
      if (!categories.length) return;
      allCategories = categories;
      renderCategories("");
    });

  authFetch("/api/accounts/me/")
    .then((res) => (res.ok ? res.json() : null))
    .then((user) => {
      if (user && user.role === "ADMIN") {
        window.location.href = "/admin-panel/";
      }
    });
})();

if (locationApply) {
  locationApply.addEventListener("click", async () => {
    const city = locationCity.value.trim();
    localStorage.setItem("location_city", city);
    await saveCustomerCity(city);
  });
}

function normalize(text) {
  return (text || "").toLowerCase();
}

function renderCategories(query) {
  const q = normalize(query);
  categoriesDiv.innerHTML = "";

  const filtered = allCategories.filter((cat) => {
    if (normalize(cat.name).includes(q)) return true;
    return (cat.services || []).some((s) =>
      normalize(s.name).includes(q)
    );
  });

  if (!filtered.length) {
    if (noResults) noResults.classList.remove("hidden");
    return;
  }

  if (noResults) noResults.classList.add("hidden");

  filtered.forEach((cat) => {
    const icon = categoryIcons[cat.name] || categoryIcons.Default;

    const card = document.createElement("div");
    card.className = `
        bg-white rounded-2xl shadow
        hover:shadow-xl hover:-translate-y-1
        transition cursor-pointer
        p-6 flex flex-col items-center text-center
      `;

    card.innerHTML = `
        <div class="text-5xl mb-4">${icon}</div>
        <h3 class="text-lg font-semibold">${cat.name}</h3>
      `;

    card.onclick = () => {
      window.location.href = `/services/${cat.id}/`;
    };

    categoriesDiv.appendChild(card);
  });
}

if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    renderCategories(e.target.value);
  });
}

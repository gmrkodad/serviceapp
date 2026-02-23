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

const categoryIcons = {
  "Home Cleaning": {
    bg: "from-cyan-100 to-blue-100",
    icon: `<path d="M3 11l9-8 9 8M5 10v10h14V10" /><path d="M9 20v-6h6v6" />`,
  },
  Plumbing: {
    bg: "from-sky-100 to-teal-100",
    icon: `<path d="M7 4h10v4H7zM9 8v6m6-6v6M7 14h10v6H7z" />`,
  },
  Electrician: {
    bg: "from-yellow-100 to-amber-100",
    icon: `<path d="M13 2L6 13h5l-1 9 8-12h-5l0-8z" />`,
  },
  "AC Repair": {
    bg: "from-blue-100 to-indigo-100",
    icon: `<path d="M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1L19.1 4.9" />`,
  },
  Beauty: {
    bg: "from-pink-100 to-rose-100",
    icon: `<path d="M12 3l2.3 4.7L19 10l-4.7 2.3L12 17l-2.3-4.7L5 10l4.7-2.3z" />`,
  },
  "Appliance Repair": {
    bg: "from-slate-100 to-zinc-100",
    icon: `<path d="M4 6h16v14H4zM9 2v4m6-4v4M8 11h8" />`,
  },
  Painting: {
    bg: "from-violet-100 to-fuchsia-100",
    icon: `<path d="M3 14l7-7 4 4-7 7H3zM14 7l2-2 3 3-2 2z" />`,
  },
  "Pest Control": {
    bg: "from-lime-100 to-emerald-100",
    icon: `<path d="M12 8v8M8 10l-3-3M16 10l3-3M8 14l-3 3M16 14l3 3M9 8h6M8 18h8" />`,
  },
  Carpentry: {
    bg: "from-orange-100 to-amber-100",
    icon: `<path d="M3 21l9-9m0 0l2-2 5 5-2 2m-5-5L8 8l2-2 4 4" />`,
  },
  Default: {
    bg: "from-slate-100 to-gray-100",
    icon: `<path d="M14.7 6.3l3 3-8.4 8.4H6.3v-3zM13.3 4.9l1.4-1.4 3 3-1.4 1.4z" />`,
  },
};

function getCategoryIconMarkup(name) {
  const item = categoryIcons[name] || categoryIcons.Default;
  return `
    <div class="w-16 h-16 rounded-2xl bg-gradient-to-br ${item.bg} flex items-center justify-center shadow-inner mb-4">
      <svg viewBox="0 0 24 24" class="w-8 h-8 text-slate-700" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        ${item.icon}
      </svg>
    </div>
  `;
}

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
    const iconMarkup = getCategoryIconMarkup(cat.name);

    const card = document.createElement("div");
    card.className = `
        bg-white/90 rounded-2xl border border-slate-100 shadow
        hover:shadow-xl hover:-translate-y-1 hover:border-blue-200
        transition-all cursor-pointer
        p-6 flex flex-col items-center text-center
      `;

    card.innerHTML = `
        ${iconMarkup}
        <h3 class="text-lg font-semibold text-slate-900">${cat.name}</h3>
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

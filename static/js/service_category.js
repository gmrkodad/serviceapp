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

const servicesList = document.getElementById("services-list");
const providersList = document.getElementById("providers-list");
const empty = document.getElementById("empty");
const bannerTitle = document.getElementById("category-title");
const bannerIcon = document.getElementById("category-icon");
const providerSortEl = document.getElementById("provider-sort");
const providerMinRatingEl = document.getElementById("provider-min-rating");
const providerMaxPriceEl = document.getElementById("provider-max-price");

const parts = window.location.pathname.split("/").filter(Boolean);
const categoryId = Number(parts[1]);
const params = new URLSearchParams(window.location.search);
let selectedServiceId = Number(params.get("service")) || null;
let activeCategory = null;
let providersCache = [];

const ICONS = {
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
  const item = ICONS[name] || ICONS.Default;
  return `
    <div class="w-16 h-16 rounded-full bg-gradient-to-br ${item.bg} flex items-center justify-center shadow-inner">
      <svg viewBox="0 0 24 24" class="w-8 h-8 text-slate-700" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        ${item.icon}
      </svg>
    </div>
  `;
}

function renderServices() {
  servicesList.innerHTML = "";

  if (!activeCategory || !activeCategory.services?.length) {
    return;
  }

  activeCategory.services.forEach((s) => {
    const li = document.createElement("li");
    li.className = "p-4 cursor-pointer hover:bg-blue-50 transition rounded-lg";

    if (s.id === selectedServiceId) {
      li.classList.add("bg-blue-100", "font-semibold");
    }

    li.innerHTML = `
      <div class="flex justify-between items-center">
        <span>${s.name}</span>
        <span class="text-sm text-gray-500">Starts from &#8377;${s.starts_from ?? s.base_price}</span>
      </div>
    `;

    li.onclick = async () => {
      selectedServiceId = s.id;
      const url = new URL(window.location.href);
      url.searchParams.set("service", String(s.id));
      window.history.replaceState({}, "", url.toString());

      renderServices();
      await loadProviders();
    };

    servicesList.appendChild(li);
  });
}

async function loadCategory() {
  const res = await authFetch("/api/services/categories/");
  if (res.status === 401) {
    window.location.href = "/login/";
    return false;
  }
  if (!res.ok) {
    return false;
  }

  const categories = await res.json();
  activeCategory = (categories || []).find((c) => c.id === categoryId) || null;
  if (!activeCategory) {
    return false;
  }

  if (!selectedServiceId) {
    selectedServiceId = activeCategory.services?.[0]?.id || null;
  }

  bannerTitle.innerText = activeCategory.name;
  bannerIcon.innerHTML = getCategoryIconMarkup(activeCategory.name);

  renderServices();
  return true;
}

async function loadProviders() {
  providersList.innerHTML = "<p class='text-gray-500'>Loading providers...</p>";
  empty.classList.add("hidden");

  if (!selectedServiceId) {
    providersList.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }

  const city = localStorage.getItem("location_city") || "";
  const qs = new URLSearchParams();
  if (city) qs.set("city", city);

  const url = `/api/services/${selectedServiceId}/providers/${qs.toString() ? `?${qs.toString()}` : ""}`;
  const res = await authFetch(url);

  if (res.status === 401) {
    window.location.href = "/login/";
    return;
  }

  if (!res.ok) {
    providersList.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }

  const providers = await res.json();
  providersCache = providers || [];
  renderProviders();
}

function renderProviders() {
  const sortValue = providerSortEl?.value || "";
  const minRating = Number(providerMinRatingEl?.value || 0);
  const maxPrice = Number(providerMaxPriceEl?.value || 0);

  let providers = [...providersCache];

  if (minRating) {
    providers = providers.filter((p) => Number(p.rating || 0) >= minRating);
  }
  if (maxPrice) {
    providers = providers.filter((p) => Number(p.price || 0) <= maxPrice);
  }

  if (sortValue === "price_asc") {
    providers.sort((a, b) => Number(a.price || Infinity) - Number(b.price || Infinity));
  } else if (sortValue === "price_desc") {
    providers.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  } else if (sortValue === "rating_desc") {
    providers.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
  }

  if (!providers.length) {
    providersList.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }

  providersList.innerHTML = "";
  providers.forEach((p) => {
    const card = document.createElement("div");
    card.className = "bg-white rounded-xl shadow hover:shadow-lg transition p-6";
    card.innerHTML = `
      <div class="flex items-center space-x-4">
        <div class="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-xl">
          &#128100;
        </div>
        <div>
          <h3 class="font-semibold text-lg">${p.username}</h3>
          <p class="text-sm text-gray-600">&#11088; ${p.rating || "New"} rating</p>
          <p class="text-sm text-gray-600">Mobile: ${p.phone || "-"}</p>
          <p class="text-sm text-emerald-700 font-medium mt-1">
            Price: &#8377;${p.price ?? "N/A"}
          </p>
        </div>
      </div>
      <button
        class="mt-5 w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition"
        onclick="bookService(${p.user_id})"
      >
        Book Service
      </button>
    `;
    providersList.appendChild(card);
  });
}

(async () => {
  const ok = await ensureAccessTokenOrRedirect();
  if (!ok) return;

  const loaded = await loadCategory();
  if (!loaded) {
    providersList.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }

  await loadProviders();
})();

[providerSortEl, providerMinRatingEl, providerMaxPriceEl].forEach((el) => {
  if (!el) return;
  const eventName = el.tagName === "INPUT" ? "input" : "change";
  el.addEventListener(eventName, renderProviders);
});

function bookService(providerId) {
  localStorage.setItem("selectedService", selectedServiceId);
  localStorage.setItem("selectedProvider", providerId);
  window.location.href = "/book/";
}

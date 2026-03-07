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

  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${newAccess}`,
    },
  });
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

const servicesGrid = document.getElementById("services-grid");
const providersList = document.getElementById("providers-list");
const empty = document.getElementById("empty");
const bannerTitle = document.getElementById("category-title");
const bannerSubtitle = document.getElementById("category-subtitle");
const bannerIcon = document.getElementById("category-icon");
const heroImage = document.getElementById("category-hero-image");
const selectedServiceLabel = document.getElementById("selected-service-label");
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
    bg: "from-slate-100 to-zinc-100",
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
    bg: "from-slate-100 to-zinc-200",
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
  "Water Purifier": {
    bg: "from-slate-100 to-zinc-100",
    icon: `<path d="M12 2v20M7 7h10M7 17h10M5 12h14" />`,
  },
  Default: {
    bg: "from-slate-100 to-gray-100",
    icon: `<path d="M14.7 6.3l3 3-8.4 8.4H6.3v-3zM13.3 4.9l1.4-1.4 3 3-1.4 1.4z" />`,
  },
};

const IMAGE_BY_KEYWORD = {
  cleaning: "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=1200&q=85",
  plumbing: "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=1200&q=85",
  electric: "https://images.unsplash.com/photo-1555963966-b7ae5404b6ed?auto=format&fit=crop&w=1200&q=85",
  ac: "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=1200&q=85",
  beauty: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=85",
  appliance: "https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=1200&q=85",
  painting: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=1200&q=85",
  pest: "https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=1200&q=85",
  carpenter: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1200&q=85",
  lock: "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=1200&q=85",
  water: "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=1200&q=85",
  default: "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=85",
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

function resolveImage(service, category) {
  if (service?.image_url) return service.image_url;
  if (category?.image_url) return category.image_url;

  const text = `${service?.name || ""} ${category?.name || ""}`.toLowerCase();
  for (const key of Object.keys(IMAGE_BY_KEYWORD)) {
    if (key !== "default" && text.includes(key)) return IMAGE_BY_KEYWORD[key];
  }
  return IMAGE_BY_KEYWORD.default;
}

function getSelectedService() {
  if (!activeCategory?.services?.length) return null;
  return activeCategory.services.find((s) => s.id === selectedServiceId) || null;
}

function renderServices() {
  servicesGrid.innerHTML = "";
  if (!activeCategory?.services?.length) return;

  activeCategory.services.forEach((service) => {
    const selected = service.id === selectedServiceId;
    const card = document.createElement("article");
    card.className =
      "cursor-pointer rounded-2xl overflow-hidden border transition-all " +
      (selected
        ? "border-slate-700 shadow-md ring-2 ring-slate-200"
        : "border-slate-200 hover:border-slate-400 hover:shadow-sm");

    const image = resolveImage(service, activeCategory);
    card.innerHTML = `
      <div class="aspect-[4/3] relative bg-slate-100">
        <img src="${image}" alt="${service.name}" class="w-full h-full object-cover" loading="lazy" referrerpolicy="no-referrer" />
        ${selected ? '<span class="absolute top-2 right-2 text-xs font-semibold px-2 py-1 rounded-full bg-white text-slate-800">Selected</span>' : ""}
      </div>
      <div class="p-3">
        <p class="font-semibold text-slate-900">${service.name}</p>
        <p class="text-xs text-slate-500 mt-1">${service.description || "Professional service with verified experts."}</p>
        <p class="text-sm text-slate-700 mt-2">Starts from <span class="font-semibold text-emerald-700">&#8377;${service.starts_from ?? service.base_price}</span></p>
      </div>
    `;

    card.addEventListener("click", async () => {
      selectedServiceId = service.id;
      const url = new URL(window.location.href);
      url.searchParams.set("service", String(service.id));
      window.history.replaceState({}, "", url.toString());
      renderServices();
      await loadProviders();
    });

    servicesGrid.appendChild(card);
  });
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

  providersList.innerHTML = "";

  if (!providers.length) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  providers.forEach((provider) => {
    const providerName = provider.full_name || provider.username || "Provider";
    const initials = providerName
      .split(" ")
      .map((v) => v[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    const card = document.createElement("article");
    card.className = "bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition";
    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-800 to-black text-white flex items-center justify-center font-semibold">
            ${initials || "P"}
          </div>
          <div class="min-w-0">
            <p class="font-semibold text-slate-900 truncate">${providerName}</p>
            <p class="text-xs text-slate-500 truncate">${provider.city || "Local professional"}</p>
          </div>
        </div>
        <p class="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">&#11088; ${provider.rating || "New"}</p>
      </div>
      <div class="mt-3 text-sm text-slate-600">
        <p>Phone: ${provider.phone || "-"}</p>
        <p class="mt-1 text-emerald-700 font-semibold">Price: &#8377;${provider.price ?? "N/A"}</p>
      </div>
      <button class="book-btn mt-4 w-full rounded-xl bg-slate-900 text-white py-2.5 hover:bg-slate-800 transition" data-provider-id="${provider.user_id}">
        Book Service
      </button>
    `;

    const bookBtn = card.querySelector(".book-btn");
    if (bookBtn) {
      bookBtn.addEventListener("click", () => {
        localStorage.setItem("selectedService", selectedServiceId);
        localStorage.setItem("selectedProvider", provider.user_id);
        window.location.href = "/book/";
      });
    }

    providersList.appendChild(card);
  });
}

async function loadCategory() {
  const res = await authFetch("/api/services/categories/");
  if (res.status === 401) {
    window.location.href = "/login/";
    return false;
  }
  if (!res.ok) return false;

  const categories = await res.json();
  activeCategory = (categories || []).find((c) => c.id === categoryId) || null;
  if (!activeCategory) return false;

  if (!selectedServiceId) {
    selectedServiceId = activeCategory.services?.[0]?.id || null;
  }

  bannerTitle.textContent = activeCategory.name || "Services";
  bannerSubtitle.textContent = activeCategory.description || "Pick a service card to view the best professionals nearby";
  bannerIcon.innerHTML = getCategoryIconMarkup(activeCategory.name);
  if (heroImage) {
    heroImage.style.backgroundImage = `url('${resolveImage(null, activeCategory)}')`;
  }

  renderServices();
  return true;
}

async function loadProviders() {
  providersList.innerHTML = "<p class='text-slate-500'>Loading providers...</p>";
  empty.classList.add("hidden");

  const selectedService = getSelectedService();
  selectedServiceLabel.textContent = selectedService ? `Selected: ${selectedService.name}` : "Select a service";

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
    providersCache = [];
    renderProviders();
    return;
  }

  providersCache = (await res.json()) || [];
  renderProviders();
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

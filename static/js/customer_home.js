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
  if (res.status === 401) window.location.href = "/login/";
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

const categoriesDiv = document.getElementById("categories");
const searchInput = document.getElementById("service-search");
const noResults = document.getElementById("no-results");
const locationCity = document.getElementById("location-city");
const locationApply = document.getElementById("location-apply");
let allCategories = [];
let activeSlideTimers = [];

const imageByKeyword = {
  cleaning: "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=1200&q=85",
  kitchen: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1200&q=85",
  bathroom: "https://images.unsplash.com/photo-1584622781564-1d987f7333c1?auto=format&fit=crop&w=1200&q=85",
  bedroom: "https://images.unsplash.com/photo-1616594039964-3a8f4ebf5e8e?auto=format&fit=crop&w=1200&q=85",
  living: "https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=1200&q=85",
  sofa: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=85",
  plumbing: "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=1200&q=85",
  electrician: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=85",
  electric: "https://images.unsplash.com/photo-1555963966-b7ae5404b6ed?auto=format&fit=crop&w=1200&q=85",
  ac: "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=1200&q=85",
  appliance: "https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=1200&q=85",
  laptop: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1200&q=85",
  beauty: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=85",
  hair: "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=1200&q=85",
  spa: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=85",
  massage: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=1200&q=85",
  painting: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=1200&q=85",
  carpenter: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=1200&q=85",
  carpentry: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1200&q=85",
  pest: "https://images.unsplash.com/photo-1581578021606-4083bf498ad1?auto=format&fit=crop&w=1200&q=85",
  water: "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=1200&q=85",
  purifier: "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?auto=format&fit=crop&w=1200&q=85",
  lock: "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=1200&q=85",
  salon: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=85",
  default: "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=85",
};

const featuredCategoryNames = new Set([
  "Wall makeover by Revamp",
  "Native Water Purifier",
  "Living & Bedroom Cleaning",
  "Native Smart Locks",
]);

const globalSlidePool = [
  "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1616594039964-3a8f4ebf5e8e?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=1200&q=85",
];

function resolveCategoryImage(category) {
  if (category?.image_url) return category.image_url;
  const serviceImage = (category?.services || []).find((s) => s?.image_url)?.image_url;
  if (serviceImage) return serviceImage;

  const haystack = [
    category?.name || "",
    ...(category?.services || []).map((s) => s.name || ""),
  ]
    .join(" ")
    .toLowerCase();

  for (const key of Object.keys(imageByKeyword)) {
    if (key !== "default" && haystack.includes(key)) {
      return imageByKeyword[key];
    }
  }
  return imageByKeyword.default;
}

function uniqueUrls(urls) {
  const seen = new Set();
  const out = [];
  urls.forEach((url) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push(url);
  });
  return out;
}

function hashText(text) {
  let h = 0;
  const t = text || "";
  for (let i = 0; i < t.length; i += 1) {
    h = (h << 5) - h + t.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function getCategoryImageSet(category) {
  const categoryImage = category?.image_url || "";
  const serviceImages = (category?.services || [])
    .map((s) => s?.image_url || "")
    .filter(Boolean)
    .slice(0, 5);
  const resolved = resolveCategoryImage(category);

  const seed = hashText(category?.name || "");
  const slide1 = globalSlidePool[seed % globalSlidePool.length];
  const slide2 = globalSlidePool[(seed + 2) % globalSlidePool.length];

  const slides = uniqueUrls([categoryImage, ...serviceImages, resolved, slide1, slide2]);
  return slides.slice(0, 4);
}

async function reverseGeocodeCity(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=10&addressdetails=1`
    );
    if (!res.ok) return "";
    const data = await res.json();
    const addr = data.address || {};
    return addr.city || addr.town || addr.village || addr.county || "";
  } catch {
    return "";
  }
}

async function getBestBrowserPosition() {
  if (!("geolocation" in navigator)) return null;

  const tryOnce = () =>
    new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position),
        () => resolve(null),
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });

  let best = null;
  for (let i = 0; i < 2; i += 1) {
    const pos = await tryOnce();
    if (!pos) continue;
    if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos;
    if (best.coords.accuracy <= 120) break;
  }
  return best;
}

async function detectLocationByBrowser() {
  const position = await getBestBrowserPosition();
  if (!position) return false;

  const { latitude, longitude } = position.coords;
  const city = await reverseGeocodeCity(latitude, longitude);
  if (!city) return false;

  localStorage.setItem("location_city", city);
  localStorage.setItem("location_source", "browser");
  return true;
}

function normalize(text) {
  return (text || "").toLowerCase();
}

function createCategoryCard(cat, isFeatured, index) {
  const card = document.createElement("article");
  card.className =
    "group cursor-pointer rounded-3xl transition-all hover:-translate-y-1";
  card.addEventListener("click", () => {
    window.location.href = `/services/${cat.id}/`;
  });

  const mediaWrap = document.createElement("div");
  mediaWrap.className =
    "relative rounded-3xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm";

  const slides = getCategoryImageSet(cat);
  const slideImages = [];
  const dots = [];

  slides.forEach((url, slideIndex) => {
    const image = document.createElement("img");
    image.className = "uc-card-img uc-slide-image group-hover:scale-[1.03]";
    if (slideIndex === 0) image.classList.add("is-active");
    image.loading = index < 6 ? "eager" : "lazy";
    image.decoding = "async";
    image.src = url;
    image.alt = `${cat.name} service`;
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => {
      image.src = imageByKeyword.default;
    });
    mediaWrap.appendChild(image);
    slideImages.push(image);
  });

  if (slides.length > 1) {
    const dotsWrap = document.createElement("div");
    dotsWrap.className =
      "absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10";

    slides.forEach((_, dotIndex) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = dotIndex === 0 ? "w-2 h-2 rounded-full bg-white" : "w-2 h-2 rounded-full bg-white/50";
      dot.addEventListener("click", (evt) => {
        evt.stopPropagation();
        setSlide(dotIndex);
      });
      dotsWrap.appendChild(dot);
      dots.push(dot);
    });
    mediaWrap.appendChild(dotsWrap);
  }

  let currentSlide = 0;
  function setSlide(nextIndex) {
    currentSlide = nextIndex;
    slideImages.forEach((img, i) => {
      img.classList.toggle("is-active", i === currentSlide);
    });
    dots.forEach((dot, i) => {
      dot.className = i === currentSlide
        ? "w-2 h-2 rounded-full bg-white"
        : "w-2 h-2 rounded-full bg-white/50";
    });
  }

  if (slides.length > 1) {
    const timer = setInterval(() => {
      setSlide((currentSlide + 1) % slides.length);
    }, 2800 + (index % 3) * 400);
    activeSlideTimers.push(timer);
  }

  if (isFeatured) {
    const badge = document.createElement("span");
    badge.className =
      "absolute left-3 top-3 rounded-lg bg-fuchsia-700 text-white text-xs font-bold px-2 py-1 tracking-wide";
    badge.textContent = "NEW";
    mediaWrap.appendChild(badge);
  }

  const title = document.createElement("h3");
  title.className = "mt-3 text-[17px] md:text-[20px] font-semibold text-slate-900";
  title.textContent = cat.name;

  card.appendChild(mediaWrap);
  card.appendChild(title);
  return card;
}

function renderCategories(query) {
  const q = normalize(query);
  activeSlideTimers.forEach((timer) => clearInterval(timer));
  activeSlideTimers = [];
  categoriesDiv.innerHTML = "";

  const filtered = allCategories.filter((cat) => {
    if (normalize(cat.name).includes(q)) return true;
    return (cat.services || []).some((s) => normalize(s.name).includes(q));
  });

  if (!filtered.length) {
    if (noResults) noResults.classList.remove("hidden");
    return;
  }
  if (noResults) noResults.classList.add("hidden");

  filtered.forEach((cat, index) => {
    const isFeatured =
      featuredCategoryNames.has(cat.name) || index < 2;
    categoriesDiv.appendChild(createCategoryCard(cat, isFeatured, index));
  });
}

(async () => {
  const ok = await ensureAccessTokenOrRedirect();
  if (!ok) return;

  detectLocationByBrowser().then(() => {
    if (locationCity && !locationCity.value.trim()) {
      const detected = localStorage.getItem("location_city") || "";
      if (detected) {
        locationCity.value = detected;
        saveCustomerCity(detected);
      }
    }
  });

  if (locationCity) {
    locationCity.value = localStorage.getItem("location_city") || "";
    if (locationCity.value.trim()) {
      saveCustomerCity(locationCity.value.trim());
    }
  }

  authFetch("/api/services/categories/")
    .then((res) => {
      if (res.status === 401) {
        window.location.href = "/login/";
        return [];
      }
      return res.json();
    })
    .then((categories) => {
      if (!Array.isArray(categories) || !categories.length) return;
      allCategories = categories;
      renderCategories("");
    });

  authFetch("/api/accounts/me/")
    .then((res) => (res.ok ? res.json() : null))
    .then((user) => {
      if (user && user.role === "ADMIN") window.location.href = "/admin-panel/";
    });
})();

if (locationApply) {
  locationApply.addEventListener("click", async () => {
    const city = locationCity.value.trim();
    localStorage.setItem("location_city", city);
    localStorage.setItem("location_source", "manual");
    await saveCustomerCity(city);
  });
}

if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    renderCategories(e.target.value);
  });
}

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

const servicesList = document.getElementById("services-list");
const providersList = document.getElementById("providers-list");
const empty = document.getElementById("empty");

const bannerTitle = document.getElementById("category-title");
const bannerIcon = document.getElementById("category-icon");

// SAFER URL PARSE
const parts = window.location.pathname.split("/").filter(Boolean);
const categoryId = Number(parts[1]);
const params = new URLSearchParams(window.location.search);
let selectedServiceId = Number(params.get("service")) || null;

let activeCategory = null;

// ICON MAP
const ICONS = {
  "Home Cleaning": "&#129532;",
  Plumbing: "&#128703;",
  Electrician: "&#9889;",
  "AC Repair": "&#10052;",
  Beauty: "&#128132;",
  "Appliance Repair": "&#128295;",
  Painting: "&#127912;",
  "Pest Control": "&#128029;",
  Carpentry: "&#128296;",
};

(async () => {
  const ok = await ensureAccessTokenOrRedirect();
  if (!ok) return;

  // ============================
  // LOAD CATEGORY & SERVICES
  // ============================
  authFetch("/api/services/categories/")
    .then(res => {
      if (res.status === 401) {
        window.location.href = "/login/";
        return [];
      }
      return res.json();
    })
    .then(categories => {
      activeCategory = categories.find((c) => c.id === categoryId);

      if (!activeCategory) return;

      if (!selectedServiceId) {
        selectedServiceId = activeCategory.services[0]?.id || null;
      }

      // Banner
      bannerTitle.innerText = activeCategory.name;
      bannerIcon.innerHTML =
        ICONS[activeCategory.name] || "&#128736;";

      servicesList.innerHTML = "";

      activeCategory.services.forEach(s => {
        const li = document.createElement("li");

        li.className =
          "p-4 cursor-pointer hover:bg-blue-50 transition rounded-lg";

        if (s.id === selectedServiceId) {
          li.classList.add("bg-blue-100", "font-semibold");
        }

        li.innerHTML = `
          <div class="flex justify-between items-center">
            <span>${s.name}</span>
            <span class="text-sm text-gray-500">
              &#8377;${s.base_price}
            </span>
          </div>
        `;

        li.onclick = () => {
          window.location.href = `/services/${categoryId}/?service=${s.id}`;
        };

        servicesList.appendChild(li);
      });
    });

  // ============================
  // LOAD PROVIDERS
  // ============================
  providersList.innerHTML = "<p class='text-gray-500'>Loading providers...</p>";

  if (!selectedServiceId) return;

  const city = localStorage.getItem("location_city") || "";
  const qs = new URLSearchParams();
  if (city) qs.set("city", city);

  authFetch(`/api/services/${selectedServiceId}/providers/?${qs.toString()}`)
    .then(res => {
      if (res.status === 401) {
        window.location.href = "/login/";
        return [];
      }
      return res.json();
    })
    .then(providers => {
      if (!providers.length) {
        providersList.innerHTML = "";
        empty.classList.remove("hidden");
        return;
      }

      providersList.innerHTML = "";

      providers.forEach(p => {
        const card = document.createElement("div");

        card.className =
          "bg-white rounded-xl shadow hover:shadow-lg transition p-6";

        card.innerHTML = `
          <div class="flex items-center space-x-4">
            <div class="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-xl">
              &#128100;
            </div>

            <div>
              <h3 class="font-semibold text-lg">${p.username}</h3>
              <p class="text-sm text-gray-600">
                &#11088; ${p.rating || "New"} rating
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
    });
})();

// ============================
// BOOK SERVICE
// ============================
function bookService(providerId) {
  localStorage.setItem("selectedService", selectedServiceId);
  localStorage.setItem("selectedProvider", providerId);
  window.location.href = "/book/";
}

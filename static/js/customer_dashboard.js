const token = localStorage.getItem("access");
if (!token) {
  window.location.href = "/login/";
}

const list = document.getElementById("booking-list");
const empty = document.getElementById("empty");

function statusBadge(status) {
  const colors = {
    PENDING: "bg-amber-50 text-amber-800 border-amber-200",
    ASSIGNED: "bg-sky-50 text-sky-800 border-sky-200",
    CONFIRMED: "bg-emerald-50 text-emerald-800 border-emerald-200",
    IN_PROGRESS: "bg-indigo-50 text-indigo-800 border-indigo-200",
    COMPLETED: "bg-slate-100 text-slate-700 border-slate-200",
    CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
  };

  return `<span class="inline-flex rounded-full border px-3 py-1 text-xs font-bold ${colors[status] || "bg-slate-100 text-slate-700 border-slate-200"}">${status.replace("_", " ")}</span>`;
}

function renderStars(rating) {
  const starSvg = (value, filled) => `
    <svg data-value="${value}" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"
      style="display:inline-block;margin-right:3px;fill:${filled ? "#f59e0b" : "#e2e8f0"};">
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path>
    </svg>
  `;
  let out = "";
  for (let i = 1; i <= 5; i += 1) {
    out += starSvg(i, i <= rating);
  }
  return out;
}

function updateStars(starWrap, rating) {
  const svgs = starWrap.querySelectorAll("svg[data-value]");
  svgs.forEach((svg) => {
    const value = Number(svg.getAttribute("data-value"));
    svg.style.fill = value <= rating ? "#f59e0b" : "#e2e8f0";
  });
}

fetch("/api/bookings/my/", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
})
  .then((res) => res.json())
  .then((bookings) => {
    list.innerHTML = "";

    if (!bookings.length) {
      empty.classList.remove("hidden");
      return;
    }

    bookings.forEach((b) => {
      const bookingServiceLabel = Array.isArray(b.service_names) && b.service_names.length
        ? b.service_names.join(", ")
        : b.service_name;

      const card = document.createElement("div");
      card.className = "page-shell content-inset";

      const showReviewForm = b.status === "COMPLETED" && !b.has_review;
      const rating = b.review_rating || 0;
      const stars = renderStars(rating);

      const reviewMarkup = b.has_review
        ? `
          <div class="glass-row mt-4 p-4">
            <p class="muted-label">Your review</p>
            <div class="mt-2 leading-none">${stars}</div>
            <p class="mt-2 text-sm text-slate-600">${b.review_comment || ""}</p>
          </div>
        `
        : "";

      const reviewForm = showReviewForm
        ? `
          <form class="mt-4 space-y-3" data-review-form="true" data-booking-id="${b.id}">
            <div>
              <label class="mb-2 block text-sm font-semibold text-slate-700">Rating</label>
              <div class="flex items-center gap-1" data-stars>${renderStars(0)}</div>
              <input type="hidden" name="rating" value="" />
            </div>
            <div>
              <label class="mb-2 block text-sm font-semibold text-slate-700">Comment</label>
              <textarea name="comment" class="textarea-modern" rows="2"></textarea>
            </div>
            <button class="btn-primary px-5 py-3">Submit Review</button>
            <p class="hidden text-sm text-red-600" data-error></p>
          </form>
        `
        : "";

      card.innerHTML = `
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div class="flex flex-wrap items-center gap-3">
              <h3 class="section-title text-xl font-bold text-slate-900">#${b.id} ${bookingServiceLabel}</h3>
              ${statusBadge(b.status)}
            </div>
            <p class="mt-2 text-sm text-slate-600">${b.category || "Service booking"}</p>
          </div>
          <div class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><p class="muted-label">Date</p><p class="mt-1 font-semibold text-slate-900">${b.scheduled_date}</p></div>
            <div><p class="muted-label">Time</p><p class="mt-1 font-semibold text-slate-900">${(b.time_slot || "").replace("_", " ")}</p></div>
            <div><p class="muted-label">Provider</p><p class="mt-1 font-semibold text-slate-900">${b.provider_full_name || b.provider_username || "Assigned"}</p></div>
            <div><p class="muted-label">Address</p><p class="mt-1 font-semibold text-slate-900">${b.address}</p></div>
          </div>
        </div>
        ${reviewMarkup}
        ${reviewForm}
      `;

      list.appendChild(card);
    });

    bindReviewForms();
  });

function bindReviewForms() {
  const forms = document.querySelectorAll('form[data-review-form="true"]');
  forms.forEach((form) => {
    const starWrap = form.querySelector("[data-stars]");
    const ratingInput = form.querySelector('input[name="rating"]');

    if (starWrap && ratingInput) {
      starWrap.innerHTML = renderStars(0);
      updateStars(starWrap, 0);
      starWrap.addEventListener("click", (e) => {
        const svg = e.target.closest("svg[data-value]");
        if (!svg) return;
        const value = Number(svg.getAttribute("data-value"));
        ratingInput.value = String(value);
        updateStars(starWrap, value);
      });
      starWrap.style.cursor = "pointer";
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const bookingId = form.getAttribute("data-booking-id");
      const rating = form.querySelector('input[name="rating"]').value;
      const comment = form.querySelector('textarea[name="comment"]').value;
      const errorEl = form.querySelector("[data-error]");

      if (errorEl) {
        errorEl.classList.add("hidden");
        errorEl.textContent = "";
      }

      try {
        if (!rating) {
          throw new Error("Please select a star rating");
        }

        const res = await fetch(`/api/bookings/review/${bookingId}/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ rating, comment }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || data.detail || "Review failed");
        }

        window.location.reload();
      } catch (err) {
        if (errorEl) {
          errorEl.textContent = err.message;
          errorEl.classList.remove("hidden");
        }
      }
    });
  });
}

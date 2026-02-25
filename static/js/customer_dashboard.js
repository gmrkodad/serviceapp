const token = localStorage.getItem("access");

if (!token) {
  window.location.href = "/login/";
}

// Elements
const list = document.getElementById("booking-list");
const empty = document.getElementById("empty");

// Status badge helper
function statusBadge(status) {
  const colors = {
    PENDING: "bg-yellow-100 text-yellow-800",
    ASSIGNED: "bg-blue-100 text-blue-800",
    CONFIRMED: "bg-green-100 text-green-800",
    IN_PROGRESS: "bg-purple-100 text-purple-800",
    COMPLETED: "bg-gray-200 text-gray-700",
    CANCELLED: "bg-red-100 text-red-800",
  };

  return `
    <span class="px-2 py-1 rounded text-sm ${
      colors[status] || "bg-gray-100"
    }">
      ${status.replace("_", " ")}
    </span>
  `;
}

function renderStars(rating) {
  const starSvg = (value, filled) => `
    <svg data-value="${value}" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"
      style="display:inline-block;margin-right:2px;fill:${filled ? "#f59e0b" : "#e2e8f0"};">
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path>
    </svg>
  `;
  let out = "";
  for (let i = 1; i <= 5; i++) {
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

// Load customer bookings
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
      const card = document.createElement("div");
      card.className = "border p-4 rounded shadow bg-white";

      const showReviewForm = b.status === "COMPLETED" && !b.has_review;

      const rating = b.review_rating || 0;
      const stars = renderStars(rating);

      const reviewMarkup = b.has_review
        ? `
          <div class="mt-3 p-3 rounded bg-slate-50 border">
            <p class="text-sm text-slate-600">Your review</p>
            <div class="leading-none">${stars}</div>
            <p class="text-sm text-slate-600">${b.review_comment || ""}</p>
          </div>
        `
        : "";

      const reviewForm = showReviewForm
        ? `
          <form class="mt-3 space-y-2" data-review-form="true" data-booking-id="${b.id}">
            <label class="block text-sm font-medium">Rating</label>
            <div class="flex items-center gap-1" data-stars>
              ${renderStars(0)}
            </div>
            <input type="hidden" name="rating" value="" />
            <label class="block text-sm font-medium">Comment</label>
            <textarea name="comment" class="w-full border rounded p-2" rows="2"></textarea>
            <button class="bg-black text-white px-3 py-1 rounded">Submit Review</button>
            <p class="text-sm text-red-600 hidden" data-error></p>
          </form>
        `
        : "";

      card.innerHTML = `
        <div class="flex justify-between items-center mb-2">
          <h3 class="font-semibold">
            #${b.id} •
            ${b.category} - ${b.service_name}
          </h3>
          ${statusBadge(b.status)}
        </div>

        <p><strong>Address:</strong> ${b.address}</p>
        <p><strong>Date:</strong> ${b.scheduled_date}</p>
        <p><strong>Time Slot:</strong> ${(b.time_slot || "").replace("_", " ")}</p>
        <p><strong>Provider:</strong> ${b.provider_username || "Assigned"}</p>
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

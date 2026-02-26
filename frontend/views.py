from django.shortcuts import render, redirect

# =====================
# AUTH PAGES (NO NAV)
# =====================

def login_page(request):
    return render(request, "login.html", {
        "show_nav": False
    })

def register_page(request):
    return render(request, "register.html", {
        "show_nav": False
    })

def register_customer_page(request):
    return render(request, "register_customer.html", {
        "show_nav": False
    })

def register_provider_page(request):
    return render(request, "register_provider.html", {
        "show_nav": False
    })


# =====================
# APP PAGES (WITH NAV)
# =====================

def customer_home(request):
    if request.user.is_authenticated and (
        getattr(request.user, "role", None) == "ADMIN"
        or request.user.is_staff
        or request.user.is_superuser
    ):
        return redirect("/admin-panel/")
    return render(request, "customer_home.html", {
        "show_nav": True
    })

def service_category_page(request, category_id):
    return render(request, "service_category.html", {
        "show_nav": True,
        "category_id": category_id
    })

def create_booking_page(request):
    return render(request, "create_booking.html", {
        "show_nav": True
    })


def change_password_page(request):
    return render(request, "change_password.html", {
        "show_nav": True
    })


def profile_page(request):
    return render(request, "profile.html", {
        "show_nav": True
    })


# =====================
# DASHBOARDS (WITH NAV)
# =====================

def customer_dashboard(request):
    return render(request, "dashboard_customer.html", {
        "show_nav": True
    })

def provider_dashboard(request):
    return render(request, "dashboard_provider.html", {
        "show_nav": True
    })

def dashboard_page(request):
    return render(request, "dashboard.html", {
        "show_nav": True
    })


# =====================
# ADMIN PAGES (WITH NAV)
# =====================

def admin_dashboard(request):
    return render(request, "admin_dashboard.html", {
        "show_nav": True
    })

def admin_bookings(request):
    return render(request, "admin_bookings.html", {
        "show_nav": True
    })

def admin_users(request):
    return render(request, "admin_users.html", {
        "show_nav": True
    })

def admin_services(request):
    return render(request, "admin_services.html", {
        "show_nav": True
    })

def admin_reviews(request):
    return render(request, "admin_reviews.html", {
        "show_nav": True
    })

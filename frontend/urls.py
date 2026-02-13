from django.urls import path
from .views import login_page, dashboard_page, register_page, register_customer_page,register_provider_page
from .views import (
    provider_dashboard,
    customer_dashboard,
    create_booking_page,
    customer_home,
    service_category_page,
    admin_dashboard,
    admin_bookings,
    admin_users,
    admin_services,
    admin_reviews,
)
urlpatterns = [
    path("login/", login_page),
    path("", customer_home, name="customer_home"),
    path("dashboard/", dashboard_page),
    path("register/", register_page),
    path("register/customer/", register_customer_page),
    path("register/provider/", register_provider_page),
    path("dashboard/provider/", provider_dashboard),
    path("dashboard/customer/", customer_dashboard),
    path("book/", create_booking_page),
    path("services/<int:category_id>/", service_category_page),
    path("admin-panel/", admin_dashboard),
    path("admin-panel/bookings/", admin_bookings),
    path("admin-panel/users/", admin_users),
    path("admin-panel/services/", admin_services),
    path("admin-panel/reviews/", admin_reviews),

]

from django.urls import path
from .views import (
    CreateBookingAPIView,
    CustomerBookingsAPIView,
    AdminBookingsAPIView,
    AssignProviderAPIView,      
    ProviderActionAPIView,
    ProviderDashboardAPIView,
    UpdateBookingStatusAPIView,
    CreateReviewAPIView,
    AdminReviewListAPIView,
)

urlpatterns = [
    path("create/", CreateBookingAPIView.as_view()),
    path("my/", CustomerBookingsAPIView.as_view()),
    path("admin/all/", AdminBookingsAPIView.as_view()),
    path("assign/<int:booking_id>/", AssignProviderAPIView.as_view()),
    path("provider/action/<int:booking_id>/", ProviderActionAPIView.as_view()),
    path("provider/dashboard/", ProviderDashboardAPIView.as_view()),
    path("provider/update-status/<int:booking_id>/", UpdateBookingStatusAPIView.as_view()),
     path("review/<int:booking_id>/",CreateReviewAPIView.as_view(),),
    path("admin/reviews/", AdminReviewListAPIView.as_view()),
]

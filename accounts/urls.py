from django.urls import path
from .views import CustomerSignupAPIView, ProviderSignupAPIView
from .views import ProfileAPIView
from .views import ProviderListAPIView
from .views import (
    NotificationListAPIView,
    NotificationReadAPIView,
    NotificationReadAllAPIView,
    AdminUserListAPIView,
    AdminUserToggleAPIView,
    AdminUserDeleteAPIView,
    AdminProviderServicesAPIView,
    ProviderServicesMeAPIView,
    IpLocationAPIView,
    CustomerCityAPIView,
    SendLoginOTPAPIView,
    VerifyLoginOTPAPIView,
)


urlpatterns = [
    path('signup/customer/', CustomerSignupAPIView.as_view()),
    path('signup/provider/', ProviderSignupAPIView.as_view()),
    path('me/', ProfileAPIView.as_view()),
    path("providers/", ProviderListAPIView.as_view()),
    path("notifications/", NotificationListAPIView.as_view()),
    path("notifications/read/<int:notification_id>/", NotificationReadAPIView.as_view()),
    path("notifications/read-all/", NotificationReadAllAPIView.as_view()),
    path("admin/users/", AdminUserListAPIView.as_view()),
    path("admin/users/<int:user_id>/toggle/", AdminUserToggleAPIView.as_view()),
    path("admin/users/<int:user_id>/", AdminUserDeleteAPIView.as_view()),
    path("admin/providers/<int:user_id>/services/", AdminProviderServicesAPIView.as_view()),
    path("providers/me/services/", ProviderServicesMeAPIView.as_view()),
    path("ip-location/", IpLocationAPIView.as_view()),
    path("auth/otp/send/", SendLoginOTPAPIView.as_view()),
    path("auth/otp/verify/", VerifyLoginOTPAPIView.as_view()),
    path("me/customer-city/", CustomerCityAPIView.as_view()),
    path("register/customer/", CustomerSignupAPIView.as_view()),
    path("register/provider/", ProviderSignupAPIView.as_view()),
]


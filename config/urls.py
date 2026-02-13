from django.contrib import admin
from django.urls import path, include
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

# ✅ Public token view
class PublicTokenObtainPairView(TokenObtainPairView):
    permission_classes = [AllowAny]


urlpatterns = [
    path('admin/', admin.site.urls),

    # ✅ JWT Auth (PUBLIC)
    path('api/token/', PublicTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # App APIs
    path('api/accounts/', include('accounts.urls')),
    path('api/services/', include('services.urls')),
    path('api/bookings/', include('bookings.urls')),

    # Frontend
    path("", include("frontend.urls")),
]

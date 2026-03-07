from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from accounts.jwt import CaseInsensitiveTokenObtainPairSerializer

# ✅ Public token view
class PublicTokenObtainPairView(TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = CaseInsensitiveTokenObtainPairSerializer


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

# Temporary production media serving so uploaded category/service images render.
# For long-term reliability on Railway, migrate media to object storage (S3/Cloudinary).
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

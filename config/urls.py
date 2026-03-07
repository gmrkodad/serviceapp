from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
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

# Serve media in local debug mode.
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Railway runs with DEBUG=False; `static()` becomes a no-op there.
# This explicit route keeps uploaded media URLs working until object storage is added.
if not settings.DEBUG:
    urlpatterns += [
        re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
    ]

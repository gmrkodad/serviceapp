from django.urls import path
from .views import (
    ServiceCategoryListAPIView,
    PublicServiceCategoryListAPIView,
    ServiceProvidersAPIView,
    AdminCategoryListCreateAPIView,
    AdminCategoryDetailAPIView,
    AdminServiceListCreateAPIView,
    AdminServiceDetailAPIView,
)

urlpatterns = [
    path('categories/', ServiceCategoryListAPIView.as_view()),
    path('categories/public/', PublicServiceCategoryListAPIView.as_view()),
    # services/urls.py
    path("<int:service_id>/providers/",ServiceProvidersAPIView.as_view()),
    path("admin/categories/", AdminCategoryListCreateAPIView.as_view()),
    path("admin/categories/<int:category_id>/", AdminCategoryDetailAPIView.as_view()),
    path("admin/services/", AdminServiceListCreateAPIView.as_view()),
    path("admin/services/<int:service_id>/", AdminServiceDetailAPIView.as_view()),

]

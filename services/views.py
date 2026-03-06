from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from accounts.permissions import IsAdmin
from django.core.files.storage import default_storage
from django.utils.text import get_valid_filename
from pathlib import Path
from uuid import uuid4

from .models import ServiceCategory
from .serializers import ServiceCategorySerializer, ServiceCategoryAdminSerializer, ServiceAdminSerializer


class ServiceCategoryListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        categories = ServiceCategory.objects.filter(is_active=True)
        serializer = ServiceCategorySerializer(categories, many=True)
        return Response(serializer.data)


class PublicServiceCategoryListAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        categories = ServiceCategory.objects.filter(is_active=True)
        serializer = ServiceCategorySerializer(categories, many=True)
        return Response(serializer.data)


# services/views.py
from accounts.models import ProviderProfile
from .models import Service
from .serializers import ProviderListSerializer

class ServiceProvidersAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, service_id):
        providers = ProviderProfile.objects.filter(
            services__id=service_id,
            user__is_active=True
        )
        city = request.query_params.get("city")
        if city:
            providers = providers.filter(city__iexact=city)

        serializer = ProviderListSerializer(
            providers,
            many=True,
            context={"service_id": service_id},
        )
        return Response(serializer.data)


class AdminCategoryListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        categories = ServiceCategory.objects.all().order_by("name")
        serializer = ServiceCategoryAdminSerializer(categories, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = ServiceCategoryAdminSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)


class AdminCategoryDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def put(self, request, category_id):
        try:
            category = ServiceCategory.objects.get(id=category_id)
        except ServiceCategory.DoesNotExist:
            return Response({"error": "Category not found"}, status=404)

        serializer = ServiceCategoryAdminSerializer(category, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    def delete(self, request, category_id):
        try:
            category = ServiceCategory.objects.get(id=category_id)
        except ServiceCategory.DoesNotExist:
            return Response({"error": "Category not found"}, status=404)
        category.delete()
        return Response({"message": "Category deleted"})


class AdminServiceListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        services = Service.objects.select_related("category").order_by("name")
        serializer = ServiceAdminSerializer(services, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = ServiceAdminSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)


class AdminServiceDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def put(self, request, service_id):
        try:
            service = Service.objects.get(id=service_id)
        except Service.DoesNotExist:
            return Response({"error": "Service not found"}, status=404)

        serializer = ServiceAdminSerializer(service, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    def delete(self, request, service_id):
        try:
            service = Service.objects.get(id=service_id)
        except Service.DoesNotExist:
            return Response({"error": "Service not found"}, status=404)
        service.delete()
        return Response({"message": "Service deleted"})


class AdminImageUploadAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        uploaded = request.FILES.get("image")
        if not uploaded:
            return Response({"error": "No image file provided"}, status=400)

        allowed_ext = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
        ext = Path(uploaded.name).suffix.lower()
        if ext not in allowed_ext:
            return Response({"error": "Unsupported file type"}, status=400)

        safe_stem = get_valid_filename(Path(uploaded.name).stem)[:80] or "image"
        filename = f"service_uploads/{safe_stem}-{uuid4().hex[:10]}{ext}"
        stored_name = default_storage.save(filename, uploaded)
        absolute_url = request.build_absolute_uri(default_storage.url(stored_name))
        return Response({"url": absolute_url}, status=201)

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.permissions import AllowAny
from django.http import JsonResponse
import json
from urllib.request import urlopen, Request
from .models import User, Notification, ProviderProfile
from .serializers import ProviderListSerializer
from .serializers import CustomerSignupSerializer, ProviderSignupSerializer
from .serializers import NotificationSerializer
from .serializers import UserAdminSerializer
from services.models import Service
from accounts.permissions import IsAdmin, IsProvider


class CustomerSignupAPIView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        serializer = CustomerSignupSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {"message": "Customer registered successfully"},
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from .serializers import ProviderSignupSerializer


class ProviderSignupAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ProviderSignupSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {"message": "Provider registered successfully"},
                status=status.HTTP_201_CREATED
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



class ProfileAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "username": request.user.username,
            "role": request.user.role
        })
    



class ProviderListAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        providers = User.objects.filter(role="PROVIDER")

        # Sort by rating (high → low)
        providers = sorted(
            providers,
            key=lambda u: u.average_rating(),
            reverse=True
        )

        serializer = ProviderListSerializer(providers, many=True)
        return Response(serializer.data)



class NotificationListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = Notification.objects.filter(
            user=request.user
        ).order_by("-created_at")

        serializer = NotificationSerializer(notifications, many=True)
        return Response(serializer.data)


class NotificationReadAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id):
        try:
            notification = Notification.objects.get(
                id=notification_id,
                user=request.user
            )
        except Notification.DoesNotExist:
            return Response(
                {"error": "Notification not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        notification.is_read = True
        notification.save()

        return Response({"message": "Marked as read"})


class NotificationReadAllAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(
            user=request.user,
            is_read=False
        ).update(is_read=True)
        return Response({"message": "All notifications marked as read"})


class AdminUserListAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        users = User.objects.all().prefetch_related(
            "provider_profile__services"
        ).select_related(
            "customerprofile",
            "provider_profile",
        ).order_by("-date_joined")
        serializer = UserAdminSerializer(users, many=True)
        return Response(serializer.data)


class AdminUserToggleAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        user.is_active = not user.is_active
        user.save()

        return Response({"message": "User updated", "is_active": user.is_active})


class AdminProviderServicesAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id, role="PROVIDER")
        except User.DoesNotExist:
            return Response({"error": "Provider not found"}, status=status.HTTP_404_NOT_FOUND)

        service_ids = request.data.get("services", [])
        if not isinstance(service_ids, list):
            return Response({"error": "services must be a list"}, status=400)

        services = Service.objects.filter(id__in=service_ids)
        if services.count() != len(service_ids):
            return Response({"error": "Invalid service id(s)"}, status=400)

        profile, _ = ProviderProfile.objects.get_or_create(user=user)
        profile.services.set(services)
        return Response({"message": "Provider services updated"})


class ProviderServicesMeAPIView(APIView):
    permission_classes = [IsAuthenticated, IsProvider]

    def get(self, request):
        profile, _ = ProviderProfile.objects.get_or_create(user=request.user)
        services = profile.services.all()
        return Response({
            "services": [{"id": s.id, "name": s.name} for s in services]
        })

    def post(self, request):
        service_ids = request.data.get("services", [])
        if not isinstance(service_ids, list):
            return Response({"error": "services must be a list"}, status=400)

        services = Service.objects.filter(id__in=service_ids)
        if services.count() != len(service_ids):
            return Response({"error": "Invalid service id(s)"}, status=400)

        profile, _ = ProviderProfile.objects.get_or_create(user=request.user)
        profile.services.set(services)
        return Response({"message": "Services updated"})


class IpLocationAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            req = Request(
                "https://ipapi.co/json/",
                headers={"User-Agent": "django-app"},
            )
            with urlopen(req, timeout=5) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            return JsonResponse({
                "city": payload.get("city", ""),
                "country": payload.get("country_name", ""),
            })
        except Exception:
            return JsonResponse({"city": "", "country": ""})

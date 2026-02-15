from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.permissions import AllowAny
from django.http import JsonResponse
from django.conf import settings
from django.utils import timezone
import json
import random
from datetime import timedelta
from urllib.parse import urlencode
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, Notification, ProviderProfile, CustomerProfile, PhoneOTP, UserPhone
from .serializers import ProviderListSerializer
from .serializers import CustomerSignupSerializer, ProviderSignupSerializer
from .serializers import NotificationSerializer
from .serializers import UserAdminSerializer
from .serializers import normalize_indian_phone, validate_indian_phone
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


def _send_fast2sms_otp(phone, otp):
    api_key = (getattr(settings, "FAST2SMS_API_KEY", "") or "").strip()
    if not api_key:
        return False, "FAST2SMS API key is not configured"

    data = urlencode({
        "variables_values": otp,
        "route": "otp",
        "numbers": phone,
        "flash": "0",
    }).encode("utf-8")
    req = Request(
        "https://www.fast2sms.com/dev/bulkV2",
        data=data,
        method="POST",
        headers={
            "authorization": api_key,
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    try:
        with urlopen(req, timeout=8) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        if body.get("return") is True:
            return True, None
        message = body.get("message", "SMS provider error")
        if isinstance(message, list):
            message = ", ".join(str(m) for m in message)
        return False, str(message)
    except HTTPError as exc:
        try:
            payload = json.loads(exc.read().decode("utf-8"))
            message = payload.get("message", f"HTTP {exc.code}")
            if isinstance(message, list):
                message = ", ".join(str(m) for m in message)
            return False, f"Fast2SMS error: {message}"
        except Exception:
            return False, f"Fast2SMS HTTP error: {exc.code}"
    except URLError as exc:
        return False, f"Fast2SMS network error: {exc.reason}"
    except Exception as exc:
        return False, f"SMS provider request failed: {str(exc)}"


class SendLoginOTPAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw_phone = request.data.get("phone", "")
        try:
            phone = validate_indian_phone(raw_phone)
        except Exception as exc:
            return Response({"phone": [str(exc)]}, status=status.HTTP_400_BAD_REQUEST)

        if not UserPhone.objects.filter(phone=phone, user__is_active=True).exists():
            return Response({"error": "No active account found for this mobile number"}, status=404)

        cooldown_seconds = int(getattr(settings, "OTP_RESEND_COOLDOWN_SECONDS", 60))
        latest = PhoneOTP.objects.filter(
            phone=phone,
            purpose=PhoneOTP.Purpose.LOGIN,
            is_used=False,
            expires_at__gt=timezone.now(),
        ).order_by("-created_at").first()
        if latest and (timezone.now() - latest.created_at).total_seconds() < cooldown_seconds:
            wait = cooldown_seconds - int((timezone.now() - latest.created_at).total_seconds())
            return Response({"error": f"Please wait {max(wait, 1)} seconds before requesting a new OTP"}, status=429)

        otp = f"{random.randint(100000, 999999)}"
        expiry_seconds = int(getattr(settings, "OTP_EXPIRY_SECONDS", 300))
        PhoneOTP.objects.create(
            phone=phone,
            code=otp,
            purpose=PhoneOTP.Purpose.LOGIN,
            expires_at=timezone.now() + timedelta(seconds=expiry_seconds),
        )

        sent, reason = _send_fast2sms_otp(phone, otp)
        if not sent:
            if settings.DEBUG:
                return Response({
                    "message": "OTP generated (debug mode fallback)",
                    "dev_otp": otp,
                })
            return Response({"error": reason or "Failed to send OTP"}, status=502)

        return Response({"message": "OTP sent successfully"})


class VerifyLoginOTPAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        phone = normalize_indian_phone(request.data.get("phone", ""))
        otp_code = str(request.data.get("otp", "")).strip()
        if not phone or not otp_code:
            return Response({"error": "phone and otp are required"}, status=400)

        max_attempts = int(getattr(settings, "OTP_MAX_ATTEMPTS", 5))
        otp = PhoneOTP.objects.filter(
            phone=phone,
            purpose=PhoneOTP.Purpose.LOGIN,
            is_used=False,
            expires_at__gt=timezone.now(),
        ).order_by("-created_at").first()

        if not otp:
            return Response({"error": "OTP expired or not found"}, status=400)

        if otp.attempts >= max_attempts:
            return Response({"error": "Maximum attempts reached. Request a new OTP"}, status=400)

        if otp.code != otp_code:
            otp.attempts += 1
            otp.save(update_fields=["attempts"])
            return Response({"error": "Invalid OTP"}, status=400)

        otp.is_used = True
        otp.save(update_fields=["is_used"])

        phone_record = UserPhone.objects.filter(phone=phone, user__is_active=True).select_related("user").first()
        if not phone_record:
            return Response({"error": "No active account found for this mobile number"}, status=404)

        user = phone_record.user
        refresh = RefreshToken.for_user(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "role": "ADMIN" if user.is_staff or user.is_superuser else user.role,
            "username": user.username,
        })



class ProfileAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        effective_role = (
            "ADMIN"
            if request.user.is_staff or request.user.is_superuser
            else request.user.role
        )
        return Response({
            "username": request.user.username,
            "role": effective_role
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
            "phone_record",
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


class AdminUserDeleteAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def delete(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        if user.id == request.user.id:
            return Response({"error": "You cannot delete your own account"}, status=status.HTTP_400_BAD_REQUEST)

        user.delete()
        return Response({"message": "User deleted"})


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


class CustomerCityAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.role != "CUSTOMER":
            return Response({"message": "City update skipped for non-customer"})

        city = (request.data.get("city") or "").strip()
        if not city:
            return Response({"error": "city is required"}, status=400)

        profile, _ = CustomerProfile.objects.get_or_create(user=request.user)
        profile.city = city
        profile.save()
        return Response({"message": "City updated", "city": profile.city})

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


def _send_whatsapp_otp(phone, otp):
    token = (getattr(settings, "WHATSAPP_API_TOKEN", "") or "").strip()
    phone_number_id = (getattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "") or "").strip()
    template_name = (getattr(settings, "WHATSAPP_TEMPLATE_NAME", "") or "").strip()
    template_lang = (getattr(settings, "WHATSAPP_TEMPLATE_LANG", "en") or "en").strip()

    if not token or not phone_number_id or not template_name:
        return False, "WhatsApp API config is incomplete"

    # Stored number is Indian 10-digit, WhatsApp API expects country code format.
    to_number = f"91{phone}" if len(phone) == 10 else phone
    body = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": template_lang},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": otp},
                    ],
                }
            ],
        },
    }
    try:
        payload = json.dumps(body).encode("utf-8")
        req = Request(
            f"https://graph.facebook.com/v20.0/{phone_number_id}/messages",
            data=payload,
            method="POST",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
        with urlopen(req, timeout=8) as resp:
            response_data = json.loads(resp.read().decode("utf-8"))
        if response_data.get("messages"):
            return True, None
        return False, "WhatsApp message was not accepted by provider"
    except HTTPError as exc:
        try:
            payload = json.loads(exc.read().decode("utf-8"))
            meta_error = payload.get("error", {})
            message = meta_error.get("message", f"HTTP {exc.code}")
            return False, f"WhatsApp API error: {message}"
        except Exception:
            return False, f"WhatsApp API HTTP error: {exc.code}"
    except URLError as exc:
        return False, f"WhatsApp network error: {exc.reason}"
    except Exception as exc:
        return False, f"WhatsApp request failed: {str(exc)}"


class SendLoginOTPAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw_phone = request.data.get("phone", "")
        try:
            phone = validate_indian_phone(raw_phone)
        except Exception as exc:
            return Response({"phone": [str(exc)]}, status=status.HTTP_400_BAD_REQUEST)

        if not UserPhone.objects.filter(phone=phone, user__is_active=True).exists():
            return Response({"error": "No active account found for this WhatsApp number"}, status=404)

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

        sent, reason = _send_whatsapp_otp(phone, otp)
        if not sent:
            if settings.DEBUG:
                return Response({
                    "message": "OTP generated (debug mode fallback)",
                    "dev_otp": otp,
                })
            return Response({"error": reason or "Failed to send OTP"}, status=502)

        return Response({"message": "OTP sent successfully on WhatsApp"})


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
            return Response({"error": "No active account found for this WhatsApp number"}, status=404)

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


class ChangePasswordAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current_password = request.data.get("current_password", "")
        new_password = request.data.get("new_password", "")
        confirm_password = request.data.get("confirm_password", "")

        if not current_password or not new_password or not confirm_password:
            return Response({"error": "All password fields are required"}, status=400)

        if new_password != confirm_password:
            return Response({"error": "New password and confirm password do not match"}, status=400)

        if len(new_password) < 8:
            return Response({"error": "New password must be at least 8 characters"}, status=400)

        if not request.user.check_password(current_password):
            return Response({"error": "Current password is incorrect"}, status=400)

        if current_password == new_password:
            return Response({"error": "New password must be different from current password"}, status=400)

        request.user.set_password(new_password)
        request.user.save(update_fields=["password"])
        return Response({"message": "Password changed successfully"})
    



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

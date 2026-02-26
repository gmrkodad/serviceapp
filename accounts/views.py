from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.permissions import AllowAny
from django.conf import settings
from django.utils import timezone
import json
import random
from datetime import timedelta
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, Notification, ProviderProfile, CustomerProfile, PhoneOTP, UserPhone, ProviderServicePrice
from .serializers import ProviderListSerializer
from .serializers import CustomerSignupSerializer, ProviderSignupSerializer
from .serializers import NotificationSerializer
from .serializers import UserAdminSerializer
from .serializers import normalize_indian_phone, validate_indian_phone
from services.models import Service
from accounts.permissions import IsAdmin, IsProvider


def _consume_signup_otp(phone, otp_code):
    if not otp_code:
        return False, "otp is required"

    max_attempts = int(getattr(settings, "OTP_MAX_ATTEMPTS", 5))
    otp = PhoneOTP.objects.filter(
        phone=phone,
        purpose=PhoneOTP.Purpose.SIGNUP,
        is_used=False,
        expires_at__gt=timezone.now(),
    ).order_by("-created_at").first()

    if not otp:
        return False, "OTP expired or not found"

    if otp.attempts >= max_attempts:
        return False, "Maximum attempts reached. Request a new OTP"

    if otp.code != str(otp_code).strip():
        otp.attempts += 1
        otp.save(update_fields=["attempts"])
        return False, "Invalid OTP"

    otp.is_used = True
    otp.save(update_fields=["is_used"])
    return True, None


class CustomerSignupAPIView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        serializer = CustomerSignupSerializer(data=request.data)
        if serializer.is_valid():
            ok, err = _consume_signup_otp(
                serializer.validated_data["phone"],
                request.data.get("otp"),
            )
            if not ok:
                return Response({"error": err}, status=status.HTTP_400_BAD_REQUEST)
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
            ok, err = _consume_signup_otp(
                serializer.validated_data["phone"],
                request.data.get("otp"),
            )
            if not ok:
                return Response({"error": err}, status=status.HTTP_400_BAD_REQUEST)
            user = serializer.save()
            profile, _ = ProviderProfile.objects.get_or_create(user=user)
            _sync_provider_service_prices(profile)
            return Response(
                {"message": "Provider registered successfully"},
                status=status.HTTP_201_CREATED
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


def _send_sms_otp(phone, otp):
    api_key = (getattr(settings, "NINZA_SMS_AUTH_KEY", "") or "").strip()
    sender_id = (getattr(settings, "NINZA_SMS_SENDER_ID", "") or "").strip()
    route = (getattr(settings, "NINZA_SMS_ROUTE", "") or "").strip()

    if not api_key:
        return False, "NINZA_SMS_AUTH_KEY is not configured"
    if not sender_id:
        return False, "NINZA_SMS_SENDER_ID is not configured"

    payload = {
        "sender_id": sender_id,
        "variables_values": otp,
        "numbers": phone,
    }
    if route:
        payload["rout"] = route
    body = json.dumps(payload).encode("utf-8")

    try:
        req = Request(
            "https://ninzasms.in.net/auth/send_sms",
            data=body,
            method="POST",
            headers={
                "authorization": api_key,
                "Content-Type": "application/json",
            },
        )
        with urlopen(req, timeout=8) as resp:
            response_data = json.loads(resp.read().decode("utf-8", errors="ignore"))

        if response_data.get("return") is True or str(response_data.get("status", "")).lower() in {"success", "ok"}:
            return True, None
        return False, response_data.get("message") or "OTP provider rejected request"
    except HTTPError as exc:
        try:
            raw = exc.read().decode("utf-8", errors="ignore")
            payload = {}
            if raw:
                try:
                    payload = json.loads(raw)
                except Exception:
                    payload = {"raw": raw}
            errors = payload.get("errors") or []
            first_error = errors[0] if isinstance(errors, list) and errors else {}
            message = (
                first_error.get("message")
                or payload.get("message")
                or payload.get("error")
                or payload.get("raw")
                or "Forbidden"
            )
            return False, f"OTP provider HTTP {exc.code}: {message}"
        except Exception:
            return False, f"OTP provider HTTP error: {exc.code}"
    except URLError as exc:
        return False, f"OTP network error: {exc.reason}"
    except Exception as exc:
        return False, f"OTP request failed: {str(exc)}"


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

        cooldown_seconds = int(getattr(settings, "OTP_RESEND_COOLDOWN_SECONDS", 30))
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

        sent, reason = _send_sms_otp(phone, otp)
        if not sent:
            if settings.DEBUG:
                return Response({
                    "message": "OTP generated (debug mode fallback)",
                    "dev_otp": otp,
                })
            return Response({"error": reason or "Failed to send OTP"}, status=502)

        return Response({"message": "OTP sent successfully via SMS"})


class SendSignupOTPAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw_phone = request.data.get("phone", "")
        try:
            phone = validate_indian_phone(raw_phone)
        except Exception as exc:
            return Response({"phone": [str(exc)]}, status=status.HTTP_400_BAD_REQUEST)

        if UserPhone.objects.filter(phone=phone, user__is_active=True).exists():
            return Response({"error": "This mobile number is already registered"}, status=400)

        cooldown_seconds = int(getattr(settings, "OTP_RESEND_COOLDOWN_SECONDS", 30))
        latest = PhoneOTP.objects.filter(
            phone=phone,
            purpose=PhoneOTP.Purpose.SIGNUP,
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
            purpose=PhoneOTP.Purpose.SIGNUP,
            expires_at=timezone.now() + timedelta(seconds=expiry_seconds),
        )

        sent, reason = _send_sms_otp(phone, otp)
        if not sent:
            if settings.DEBUG:
                return Response({
                    "message": "OTP generated (debug mode fallback)",
                    "dev_otp": otp,
                })
            return Response({"error": reason or "Failed to send OTP"}, status=502)

        return Response({"message": "OTP sent successfully via SMS"})


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
        phone_record = UserPhone.objects.filter(user=request.user).first()
        full_name = (f"{request.user.first_name} {request.user.last_name}").strip()
        return Response({
            "username": request.user.username,
            "role": effective_role,
            "email": request.user.email or "",
            "phone": phone_record.phone if phone_record else "",
            "full_name": full_name,
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
        _sync_provider_service_prices(profile)
        return Response({"message": "Provider services updated"})


class AdminProviderServicePricesAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request, user_id):
        try:
            user = User.objects.get(id=user_id, role="PROVIDER")
        except User.DoesNotExist:
            return Response({"error": "Provider not found"}, status=404)

        profile, _ = ProviderProfile.objects.get_or_create(user=user)
        _sync_provider_service_prices(profile)
        prices = ProviderServicePrice.objects.filter(
            provider_profile=profile
        ).select_related("service")
        return Response({
            "prices": [
                {
                    "service_id": p.service_id,
                    "service_name": p.service.name,
                    "price": float(p.price),
                    "base_price": float(p.service.base_price),
                }
                for p in prices
            ]
        })

    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id, role="PROVIDER")
        except User.DoesNotExist:
            return Response({"error": "Provider not found"}, status=404)

        profile, _ = ProviderProfile.objects.get_or_create(user=user)
        _sync_provider_service_prices(profile)
        items = request.data.get("prices", [])
        if not isinstance(items, list):
            return Response({"error": "prices must be a list"}, status=400)

        provided_service_ids = set(profile.services.values_list("id", flat=True))
        for item in items:
            service_id = item.get("service_id")
            price = item.get("price")
            if service_id not in provided_service_ids:
                return Response({"error": "Invalid service for this provider"}, status=400)
            try:
                price_val = float(price)
            except (TypeError, ValueError):
                return Response({"error": "Invalid price value"}, status=400)
            if price_val <= 0:
                return Response({"error": "Price must be greater than 0"}, status=400)

            ProviderServicePrice.objects.update_or_create(
                provider_profile=profile,
                service_id=service_id,
                defaults={"price": price_val},
            )

        return Response({"message": "Provider prices updated"})


class ProviderServicesMeAPIView(APIView):
    permission_classes = [IsAuthenticated, IsProvider]

    def get(self, request):
        profile, _ = ProviderProfile.objects.get_or_create(user=request.user)
        _sync_provider_service_prices(profile)
        services = profile.services.all()
        price_map = {
            p.service_id: p.price
            for p in ProviderServicePrice.objects.filter(provider_profile=profile)
        }
        return Response({
            "services": [
                {
                    "id": s.id,
                    "name": s.name,
                    "price": float(price_map.get(s.id, s.base_price)),
                }
                for s in services
            ]
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
        _sync_provider_service_prices(profile)
        return Response({"message": "Services updated"})


class ProviderServicePriceMeAPIView(APIView):
    permission_classes = [IsAuthenticated, IsProvider]

    def get(self, request):
        profile, _ = ProviderProfile.objects.get_or_create(user=request.user)
        _sync_provider_service_prices(profile)
        prices = ProviderServicePrice.objects.filter(provider_profile=profile).select_related("service")
        return Response({
            "prices": [
                {
                    "service_id": p.service_id,
                    "service_name": p.service.name,
                    "price": float(p.price),
                    "base_price": float(p.service.base_price),
                }
                for p in prices
            ]
        })

    def post(self, request):
        profile, _ = ProviderProfile.objects.get_or_create(user=request.user)
        _sync_provider_service_prices(profile)
        items = request.data.get("prices", [])
        if not isinstance(items, list):
            return Response({"error": "prices must be a list"}, status=400)

        provided_service_ids = set(profile.services.values_list("id", flat=True))
        for item in items:
            service_id = item.get("service_id")
            price = item.get("price")
            if service_id not in provided_service_ids:
                return Response({"error": "Invalid service for this provider"}, status=400)
            try:
                price_val = float(price)
            except (TypeError, ValueError):
                return Response({"error": "Invalid price value"}, status=400)
            if price_val <= 0:
                return Response({"error": "Price must be greater than 0"}, status=400)

            ProviderServicePrice.objects.update_or_create(
                provider_profile=profile,
                service_id=service_id,
                defaults={"price": price_val},
            )

        return Response({"message": "Service prices updated"})


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


class ReverseGeocodeAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        lat = request.query_params.get("lat")
        lon = request.query_params.get("lon")

        try:
            lat_val = float(lat)
            lon_val = float(lon)
        except (TypeError, ValueError):
            return Response({"error": "lat and lon are required"}, status=400)

        url = (
            "https://nominatim.openstreetmap.org/reverse"
            f"?format=jsonv2&lat={lat_val}&lon={lon_val}&zoom=18&addressdetails=1"
        )
        req = Request(
            url,
            headers={
                "User-Agent": "serviceapp/1.0 (support@serviceapp.local)",
                "Accept": "application/json",
            },
        )

        try:
            with urlopen(req, timeout=8) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
        except Exception:
            return Response({"error": "Unable to resolve address"}, status=502)

        addr = payload.get("address", {}) or {}
        city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("county") or ""

        return Response(
            {
                "display_name": payload.get("display_name", ""),
                "city": city,
                "postcode": addr.get("postcode", ""),
                "state": addr.get("state", ""),
                "country": addr.get("country", ""),
            }
        )
def _sync_provider_service_prices(profile):
    service_ids = list(profile.services.values_list("id", flat=True))
    if not service_ids:
        ProviderServicePrice.objects.filter(provider_profile=profile).delete()
        return

    # Remove prices for services no longer provided.
    ProviderServicePrice.objects.filter(provider_profile=profile).exclude(service_id__in=service_ids).delete()

    # Ensure each selected service has at least one price entry.
    existing_ids = set(
        ProviderServicePrice.objects.filter(
            provider_profile=profile,
            service_id__in=service_ids,
        ).values_list("service_id", flat=True)
    )
    missing_ids = [sid for sid in service_ids if sid not in existing_ids]
    if not missing_ids:
        return

    services = Service.objects.filter(id__in=missing_ids)
    ProviderServicePrice.objects.bulk_create([
        ProviderServicePrice(
            provider_profile=profile,
            service=s,
            price=s.base_price,
        )
        for s in services
    ])

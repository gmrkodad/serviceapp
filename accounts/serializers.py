import re

from rest_framework import serializers

from services.models import Service

from .models import Notification, ProviderProfile, User, UserPhone


def normalize_indian_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    return digits


def validate_indian_phone(phone: str) -> str:
    digits = normalize_indian_phone(phone)
    if len(digits) != 10 or digits[0] not in "6789":
        raise serializers.ValidationError("Enter a valid 10-digit mobile number")
    return digits


class CustomerSignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    phone = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["username", "email", "password", "phone"]

    def validate_phone(self, value):
        phone = validate_indian_phone(value)
        if UserPhone.objects.filter(phone=phone).exists():
            raise serializers.ValidationError("This mobile number is already registered")
        return phone

    def create(self, validated_data):
        phone = validated_data.pop("phone")
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email"),
            password=validated_data["password"],
            role=User.Role.CUSTOMER,
        )
        from .models import CustomerProfile

        CustomerProfile.objects.get_or_create(user=user)
        UserPhone.objects.create(user=user, phone=phone, is_verified=True)
        return user


class ProviderSignupSerializer(serializers.ModelSerializer):
    services = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.all(),
        many=True,
        write_only=True,
    )
    city = serializers.CharField(write_only=True, required=True, allow_blank=False)
    phone = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["username", "email", "password", "services", "city", "phone"]
        extra_kwargs = {"password": {"write_only": True}}

    def validate_phone(self, value):
        phone = validate_indian_phone(value)
        if UserPhone.objects.filter(phone=phone).exists():
            raise serializers.ValidationError("This mobile number is already registered")
        return phone

    def create(self, validated_data):
        city = validated_data.pop("city", "")
        services = validated_data.pop("services")
        phone = validated_data.pop("phone")

        user = User.objects.create_user(
            **validated_data,
            role=User.Role.PROVIDER,
        )

        profile, _ = ProviderProfile.objects.get_or_create(user=user)
        profile.services.set(services)
        profile.city = city
        profile.save()
        UserPhone.objects.create(user=user, phone=phone, is_verified=True)
        return user


class ProviderListSerializer(serializers.ModelSerializer):
    average_rating = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "average_rating",
        ]

    def get_average_rating(self, obj):
        return obj.average_rating()


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "message", "is_read", "created_at"]


class UserAdminSerializer(serializers.ModelSerializer):
    provider_services = serializers.SerializerMethodField()
    city = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "role",
            "is_active",
            "date_joined",
            "provider_services",
            "city",
            "phone",
        ]

    def get_provider_services(self, obj):
        if getattr(obj, "role", None) != "PROVIDER":
            return []
        profile = getattr(obj, "provider_profile", None)
        if not profile:
            return []
        return [{"id": s.id, "name": s.name} for s in profile.services.all()]

    def get_city(self, obj):
        if getattr(obj, "role", None) == "PROVIDER":
            profile = getattr(obj, "provider_profile", None)
            return getattr(profile, "city", "") if profile else ""
        if getattr(obj, "role", None) == "CUSTOMER":
            profile = getattr(obj, "customerprofile", None)
            return getattr(profile, "city", "") if profile else ""
        return ""

    def get_phone(self, obj):
        record = getattr(obj, "phone_record", None)
        return getattr(record, "phone", "") if record else ""

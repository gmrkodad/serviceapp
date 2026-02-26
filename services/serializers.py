from rest_framework import serializers
from .models import ServiceCategory, Service
from django.db.models import Min

class ServiceSerializer(serializers.ModelSerializer):
    starts_from = serializers.SerializerMethodField()

    class Meta:
        model = Service
        fields = [
            "id",
            "category",
            "name",
            "description",
            "base_price",
            "is_active",
            "created_at",
            "starts_from",
        ]

    def get_starts_from(self, obj):
        min_price = obj.provider_prices.filter(
            provider_profile__user__is_active=True
        ).aggregate(v=Min("price"))["v"]
        return float(min_price) if min_price is not None else float(obj.base_price)


class ServiceCategorySerializer(serializers.ModelSerializer):
    services = ServiceSerializer(many=True, read_only=True)

    class Meta:
        model = ServiceCategory
        fields = ['id', 'name', 'description', 'services']

# services/serializers.py
from rest_framework import serializers
from accounts.models import ProviderProfile, ProviderServicePrice

class ProviderListSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username")
    full_name = serializers.SerializerMethodField()
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    rating = serializers.SerializerMethodField()
    price = serializers.SerializerMethodField()
    city = serializers.CharField(read_only=True)
    phone = serializers.SerializerMethodField()

    class Meta:
        model = ProviderProfile
        fields = ["id", "user_id", "username", "full_name", "rating", "price", "city", "phone"]

    def get_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip()

    def get_rating(self, obj):
        return obj.user.average_rating()

    def get_price(self, obj):
        service_id = self.context.get("service_id")
        if not service_id:
            return None
        p = ProviderServicePrice.objects.filter(
            provider_profile=obj,
            service_id=service_id,
        ).values_list("price", flat=True).first()
        return float(p) if p is not None else None

    def get_phone(self, obj):
        phone_record = getattr(obj.user, "phone_record", None)
        return getattr(phone_record, "phone", "")


class ServiceCategoryAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCategory
        fields = ["id", "name", "description", "is_active"]


class ServiceAdminSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Service
        fields = [
            "id",
            "name",
            "description",
            "base_price",
            "is_active",
            "category",
            "category_name",
        ]

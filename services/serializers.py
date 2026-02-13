from rest_framework import serializers
from .models import ServiceCategory, Service

class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = '__all__'


class ServiceCategorySerializer(serializers.ModelSerializer):
    services = ServiceSerializer(many=True, read_only=True)

    class Meta:
        model = ServiceCategory
        fields = ['id', 'name', 'description', 'services']

# services/serializers.py
from rest_framework import serializers
from accounts.models import ProviderProfile

class ProviderListSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username")
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    rating = serializers.SerializerMethodField()

    class Meta:
        model = ProviderProfile
        fields = ["id", "user_id", "username", "rating"]

    def get_rating(self, obj):
        return obj.user.average_rating()


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

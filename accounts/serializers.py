from rest_framework import serializers
from .models import User,Notification



class CustomerSignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    city = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'city']

    def create(self, validated_data):
        city = validated_data.pop("city", "")
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email'),
            password=validated_data['password'],
            role=User.Role.CUSTOMER
        )
        from .models import CustomerProfile
        CustomerProfile.objects.get_or_create(user=user, defaults={
            "city": city,
        })
        return user


from rest_framework import serializers
from services.models import Service
from .models import User, ProviderProfile

class ProviderSignupSerializer(serializers.ModelSerializer):
    services = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.all(),
        many=True,
        write_only=True
    )

    city = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ["username", "email", "password", "services", "city"]
        extra_kwargs = {"password": {"write_only": True}}

    def create(self, validated_data):
        city = validated_data.pop("city", "")
        services = validated_data.pop("services")

        user = User.objects.create_user(
            **validated_data,
            role="PROVIDER"
        )

        profile, _ = ProviderProfile.objects.get_or_create(user=user)
        profile.services.set(services)
        profile.city = city
        profile.save()

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
        ]

    def get_provider_services(self, obj):
        if getattr(obj, "role", None) != "PROVIDER":
            return []
        profile = getattr(obj, "provider_profile", None)
        if not profile:
            return []
        return [
            {"id": s.id, "name": s.name}
            for s in profile.services.all()
        ]

    def get_city(self, obj):
        if getattr(obj, "role", None) == "PROVIDER":
            profile = getattr(obj, "provider_profile", None)
            return getattr(profile, "city", "") if profile else ""
        if getattr(obj, "role", None) == "CUSTOMER":
            profile = getattr(obj, "customerprofile", None)
            return getattr(profile, "city", "") if profile else ""
        return ""


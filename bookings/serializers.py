from rest_framework import serializers
from .models import Booking, Review
from services.models import Service

class BookingCreateSerializer(serializers.ModelSerializer):
    service_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=True,
        write_only=True,
    )

    class Meta:
        model = Booking
        fields = ["service", "provider", "scheduled_date", "time_slot", "address", "service_ids"]

    def validate(self, attrs):
        provider = attrs.get("provider")
        primary_service = attrs.get("service")
        request = self.context.get("request")
        raw_ids = self.initial_data.get("service_ids", [])

        if raw_ids in ("", None):
            raw_ids = []
        if not isinstance(raw_ids, list):
            raise serializers.ValidationError({"service_ids": "Must be a list of service IDs"})

        requested_ids = []
        for value in raw_ids:
            try:
                requested_ids.append(int(value))
            except (TypeError, ValueError):
                raise serializers.ValidationError({"service_ids": "All IDs must be integers"})

        if primary_service and primary_service.id not in requested_ids:
            requested_ids.insert(0, primary_service.id)
        requested_ids = list(dict.fromkeys(requested_ids))

        if not requested_ids:
            raise serializers.ValidationError({"service_ids": "Select at least one service"})

        services = list(Service.objects.filter(id__in=requested_ids, is_active=True))
        if len(services) != len(requested_ids):
            raise serializers.ValidationError({"service_ids": "One or more services are invalid"})

        service_by_id = {s.id: s for s in services}
        attrs["_requested_services"] = [service_by_id[sid] for sid in requested_ids]

        if provider:
            if provider.role != "PROVIDER":
                raise serializers.ValidationError({"provider": "Invalid provider"})
            profile = getattr(provider, "provider_profile", None)
            if not profile:
                raise serializers.ValidationError({"provider": "Provider profile not found"})
            provider_service_ids = set(profile.services.values_list("id", flat=True))
            missing = [sid for sid in requested_ids if sid not in provider_service_ids]
            if missing:
                raise serializers.ValidationError(
                    {"service_ids": "Provider does not offer one or more selected services"}
                )

        return attrs

    def create(self, validated_data):
        requested_services = validated_data.pop("_requested_services", [])
        validated_data.pop("service_ids", None)
        validated_data.pop("service", None)

        primary_service = requested_services[0]
        booking = Booking.objects.create(service=primary_service, **validated_data)
        extra_services = [s for s in requested_services[1:] if s.id != primary_service.id]
        if extra_services:
            booking.additional_services.set(extra_services)
        return booking



class BookingListSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name", read_only=True)
    service_names = serializers.SerializerMethodField()
    category = serializers.CharField(source="service.category.name", read_only=True)
    provider_username = serializers.CharField(
        source="provider.username", read_only=True
    )
    provider_full_name = serializers.SerializerMethodField()
    customer_username = serializers.CharField(
        source="customer.username", read_only=True
    )
    has_review = serializers.SerializerMethodField()
    review_rating = serializers.SerializerMethodField()
    review_comment = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "id",
            "service_name",
            "service_names",
            "category",
            "provider_username",
            "provider_full_name",
            "customer_username",
            "address",
            "scheduled_date",
            "time_slot",
            "status",
            "created_at",
            "has_review",
            "review_rating",
            "review_comment",
        ]

    def get_has_review(self, obj):
        return hasattr(obj, "review")

    def get_review_rating(self, obj):
        if not hasattr(obj, "review"):
            return None
        return obj.review.rating

    def get_review_comment(self, obj):
        if not hasattr(obj, "review"):
            return ""
        return obj.review.comment

    def get_provider_full_name(self, obj):
        if not obj.provider:
            return ""
        return f"{obj.provider.first_name} {obj.provider.last_name}".strip()

    def get_service_names(self, obj):
        names = [obj.service.name]
        names.extend(obj.additional_services.values_list("name", flat=True))
        unique = []
        for name in names:
            if name not in unique:
                unique.append(name)
        return unique


class AssignProviderSerializer(serializers.Serializer):
    provider_id = serializers.IntegerField()


class ReviewCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ["rating", "comment"]

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError("Rating must be between 1 and 5")
        return value


class ReviewListSerializer(serializers.ModelSerializer):
    booking_id = serializers.IntegerField(source="booking.id", read_only=True)
    service_name = serializers.CharField(source="booking.service.name", read_only=True)
    provider_username = serializers.CharField(
        source="booking.provider.username", read_only=True
    )
    author_username = serializers.CharField(source="author.username", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id",
            "booking_id",
            "service_name",
            "provider_username",
            "author_username",
            "rating",
            "comment",
            "created_at",
        ]


class ProviderBookingSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name", read_only=True)
    service_names = serializers.SerializerMethodField()
    category = serializers.CharField(source="service.category.name", read_only=True)
    customer_username = serializers.CharField(source="customer.username", read_only=True)
    provider_rating = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "id",
            "service_name",
            "service_names",
            "category",
            "customer_username",
            "address",
            "scheduled_date",
            "time_slot",
            "status",
            "provider_rating",
            "created_at",
        ]

    def get_provider_rating(self, obj):
        if not obj.provider:
            return 0
        return obj.provider.average_rating()

    def get_service_names(self, obj):
        names = [obj.service.name]
        names.extend(obj.additional_services.values_list("name", flat=True))
        unique = []
        for name in names:
            if name not in unique:
                unique.append(name)
        return unique

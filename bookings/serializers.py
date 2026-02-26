from rest_framework import serializers
from .models import Booking, Review

class BookingCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ["service", "provider", "scheduled_date", "time_slot", "address"]

    def create(self, validated_data):
        return Booking.objects.create(**validated_data)



class BookingListSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name", read_only=True)
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
    category = serializers.CharField(source="service.category.name", read_only=True)
    customer_username = serializers.CharField(source="customer.username", read_only=True)
    provider_rating = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "id",
            "service_name",
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

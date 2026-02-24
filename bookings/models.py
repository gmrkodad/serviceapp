from django.db import models
from django.conf import settings
from services.models import Service

User = settings.AUTH_USER_MODEL


class Booking(models.Model):

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        ASSIGNED = "ASSIGNED", "Assigned"
        CONFIRMED = "CONFIRMED", "Confirmed"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    class TimeSlot(models.TextChoices):
        MORNING = "MORNING", "Morning (8 AM - 12 PM)"
        AFTERNOON = "AFTERNOON", "Afternoon (12 PM - 4 PM)"
        EVENING = "EVENING", "Evening (4 PM - 8 PM)"

    customer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="customer_bookings"
    )

    provider = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="provider_bookings"
    )

    service = models.ForeignKey(Service, on_delete=models.CASCADE)
    address = models.TextField()
    scheduled_date = models.DateField()
    time_slot = models.CharField(
        max_length=20,
        choices=TimeSlot.choices,
        default=TimeSlot.MORNING
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Booking #{self.id}"


class Review(models.Model):
    booking = models.OneToOneField(
        Booking,
        on_delete=models.CASCADE,
        related_name="review"
    )
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="booking_reviews"
    )
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Review for Booking #{self.booking_id}"



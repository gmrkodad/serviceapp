from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Booking
from accounts.models import Notification


@receiver(post_save, sender=Booking)
def booking_notifications(sender, instance, created, **kwargs):

    # 🔔 Provider gets notification when booking is assigned
    if created and instance.provider:
        Notification.objects.create(
            user=instance.provider,
            message=f"New booking assigned (#{instance.id})"
        )

    # 🔔 Customer gets notification when booking is completed
    if instance.status == Booking.Status.COMPLETED:
        Notification.objects.create(
            user=instance.customer,
            message=f"Booking #{instance.id} completed. Please leave a review."
        )

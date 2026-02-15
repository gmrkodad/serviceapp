from django.contrib.auth.models import AbstractUser
from django.db import models
from bookings.models import Review
from services.models import Service
from django.conf import settings



class User(AbstractUser):

    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        CUSTOMER = "CUSTOMER", "Customer"
        PROVIDER = "PROVIDER", "Service Provider"

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CUSTOMER
    )

    def average_rating(self):
        reviews = Review.objects.filter(
            booking__provider=self
        )

        if not reviews.exists():
            return 0

        return round(
            sum(r.rating for r in reviews) / reviews.count(),
            1
        )
    
    def __str__(self):
        return f"{self.username} ({self.role})"


class CustomerProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    phone = models.CharField(max_length=15, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return self.user.username


from django.db import models
from django.conf import settings
from services.models import Service


class ProviderProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="provider_profile"
    )

    services = models.ManyToManyField(
        Service,
        related_name="providers"
    )

    city = models.CharField(max_length=100, blank=True)
    is_verified = models.BooleanField(default=True)  # keep simple for now
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"ProviderProfile({self.user.username})"
   

class Notification(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notifications"
    )
    message = models.CharField(max_length=255)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Notification for {self.user.username}"


class UserPhone(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="phone_record",
    )
    phone = models.CharField(max_length=15, unique=True, db_index=True)
    is_verified = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.phone}"


class PhoneOTP(models.Model):
    class Purpose(models.TextChoices):
        LOGIN = "LOGIN", "Login"

    phone = models.CharField(max_length=15, db_index=True)
    code = models.CharField(max_length=6)
    purpose = models.CharField(max_length=20, choices=Purpose.choices, default=Purpose.LOGIN)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    attempts = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"OTP {self.phone} ({self.purpose})"

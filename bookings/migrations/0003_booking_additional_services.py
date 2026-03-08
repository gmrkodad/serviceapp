from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("services", "0001_initial"),
        ("bookings", "0002_booking_time_slot"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="additional_services",
            field=models.ManyToManyField(blank=True, related_name="extra_service_bookings", to="services.service"),
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="time_slot",
            field=models.CharField(
                choices=[
                    ("MORNING", "Morning (8 AM - 12 PM)"),
                    ("AFTERNOON", "Afternoon (12 PM - 4 PM)"),
                    ("EVENING", "Evening (4 PM - 8 PM)"),
                ],
                default="MORNING",
                max_length=20,
            ),
        ),
    ]

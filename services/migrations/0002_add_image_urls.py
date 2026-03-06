from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("services", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="servicecategory",
            name="image_url",
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name="service",
            name="image_url",
            field=models.URLField(blank=True),
        ),
    ]

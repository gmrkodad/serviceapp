from django.db import migrations


def seed_catalog(apps, schema_editor):
    ServiceCategory = apps.get_model("services", "ServiceCategory")
    Service = apps.get_model("services", "Service")

    categories = [
        {
            "name": "Home Cleaning",
            "description": "Professional home and room cleaning services.",
            "image_url": "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "name": "Plumbing",
            "description": "Tap, leakage, bathroom fitting, and drain solutions.",
            "image_url": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "name": "Electrician",
            "description": "Wiring, switch, fan, and electrical repair services.",
            "image_url": "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "name": "AC Repair",
            "description": "AC service, installation, and gas refill support.",
            "image_url": "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "name": "Beauty",
            "description": "At-home beauty and salon services.",
            "image_url": "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "name": "Appliance Repair",
            "description": "Repair and maintenance for home appliances.",
            "image_url": "https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "name": "Painting",
            "description": "Interior and exterior wall painting services.",
            "image_url": "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "name": "Pest Control",
            "description": "Effective pest, termite, and bed bug treatment.",
            "image_url": "https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "name": "Carpentry",
            "description": "Furniture, shelves, and woodwork solutions.",
            "image_url": "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "name": "Water Purifier",
            "description": "RO and water purifier installation and maintenance.",
            "image_url": "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=1200&q=85",
        },
        {
            "name": "Smart Locks",
            "description": "Digital lock installation and support.",
            "image_url": "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=1200&q=85",
        },
    ]

    category_map = {}
    for payload in categories:
        category, _ = ServiceCategory.objects.update_or_create(
            name=payload["name"],
            defaults={
                "description": payload["description"],
                "image_url": payload["image_url"],
                "is_active": True,
            },
        )
        category_map[payload["name"]] = category

    services = [
        ("Home Cleaning", "Balcony Cleaning", "Deep cleaning for balcony floors and grills.", "899.00", "https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=1200&q=85"),
        ("Home Cleaning", "Living Room Cleaning", "Dust and stain removal for living spaces.", "1299.00", "https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=1200&q=85"),
        ("Appliance Repair", "Laptop Repair", "Hardware and software diagnostics and repair.", "699.00", "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1200&q=85"),
        ("Appliance Repair", "Chimney Cleaning", "Kitchen chimney cleaning and filter service.", "999.00", "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1200&q=85"),
        ("Water Purifier", "RO Installation", "Installation of domestic RO water purifiers.", "799.00", "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=1200&q=85"),
        ("Water Purifier", "RO Service", "Full service and health check of purifier unit.", "599.00", "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?auto=format&fit=crop&w=1200&q=85"),
        ("Water Purifier", "RO Filter Replacement", "Sediment, carbon, and membrane replacement.", "1199.00", "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?auto=format&fit=crop&w=1200&q=85"),
        ("Smart Locks", "Smart Lock Installation", "Digital lock setup and calibration.", "1499.00", "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=1200&q=85"),
        ("Smart Locks", "Smart Lock Repair", "Troubleshooting and repair for smart locks.", "999.00", "https://images.unsplash.com/photo-1512428813834-c702c7702b78?auto=format&fit=crop&w=1200&q=85"),
    ]

    for category_name, name, description, base_price, image_url in services:
        Service.objects.update_or_create(
            category=category_map[category_name],
            name=name,
            defaults={
                "description": description,
                "base_price": base_price,
                "image_url": image_url,
                "is_active": True,
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("services", "0002_add_image_urls"),
    ]

    operations = [
        migrations.RunPython(seed_catalog, migrations.RunPython.noop),
    ]

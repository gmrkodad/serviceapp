from accounts.models import User

def get_best_provider():
    providers = User.objects.filter(role="PROVIDER")

    if not providers.exists():
        return None

    # Sort providers by rating (high → low)
    providers = sorted(
        providers,
        key=lambda p: p.average_rating(),
        reverse=True
    )

    return providers[0]

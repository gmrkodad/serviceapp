from django.contrib.auth import get_user_model
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class CaseInsensitiveTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        username = (attrs.get(self.username_field) or "").strip()
        if username:
            user = get_user_model().objects.filter(username__iexact=username).first()
            if user:
                attrs[self.username_field] = user.username
        return super().validate(attrs)

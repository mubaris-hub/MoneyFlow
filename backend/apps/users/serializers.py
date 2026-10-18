from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'first_name', 'last_name',
            'avatar_url', 'default_currency', 'date_format',
            'notify_email', 'notify_in_app', 'notify_on_expenses',
            'notify_on_settlements', 'notify_on_friend_ledgers',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'email', 'created_at', 'updated_at']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'username', 'email', 'password', 'confirm_password', 'default_currency']
        extra_kwargs = {
            'first_name': {'required': True},
            'email': {'required': True},
            'username': {'required': True},
        }

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        user = User.objects.create_user(
            email=validated_data['email'],
            username=validated_data['username'],
            first_name=validated_data['first_name'],
            last_name=validated_data.get('last_name', ''),
            password=validated_data['password'],
            default_currency=validated_data.get('default_currency', 'INR')
        )
        return user


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField(required=False, help_text="Email or Username")
    email = serializers.CharField(required=False)
    password = serializers.CharField(write_only=True, required=True)

    def validate(self, attrs):
        identifier = attrs.get('identifier') or attrs.get('email')
        password = attrs.get('password')

        if not identifier:
            raise serializers.ValidationError({"email": "Email or Username is required."})

        # Search user by email or username
        user = User.objects.filter(email__iexact=identifier).first() or User.objects.filter(username__iexact=identifier).first()

        if user is None or not user.check_password(password):
            raise serializers.ValidationError({"detail": "Invalid credentials provided."})

        if not user.is_active:
            raise serializers.ValidationError({"detail": "User account is disabled."})

        attrs['user'] = user
        return attrs


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField(required=True)
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True, required=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs


class UpdateProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'username', 'avatar_url',
            'default_currency', 'date_format',
            'notify_email', 'notify_in_app', 'notify_on_expenses',
            'notify_on_settlements', 'notify_on_friend_ledgers'
        ]
        extra_kwargs = {
            'first_name': {'required': False},
            'username': {'required': False},
        }

    def validate_username(self, value):
        user = self.context.get('request').user
        if User.objects.filter(username__iexact=value).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_default_currency(self, value):
        allowed = ['INR', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'AED', 'SGD']
        if value.upper() not in allowed:
            raise serializers.ValidationError(f"Currency '{value}' is not supported. Supported: {', '.join(allowed)}")
        return value.upper()


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, required=True)
    new_password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True, required=True)

    def validate_current_password(self, value):
        user = self.context.get('request').user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "New passwords do not match."})
        if attrs.get('current_password') == attrs.get('new_password'):
            raise serializers.ValidationError({"new_password": "New password cannot be the same as your current password."})
        return attrs


class DeactivateAccountSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, required=True)
    confirmation = serializers.CharField(required=True)

    def validate(self, attrs):
        user = self.context.get('request').user
        if not user.check_password(attrs['password']):
            raise serializers.ValidationError({"password": "Password is incorrect."})
        if attrs['confirmation'].strip().upper() != "DELETE":
            raise serializers.ValidationError({"confirmation": "Please type 'DELETE' to confirm account deactivation."})
        return attrs



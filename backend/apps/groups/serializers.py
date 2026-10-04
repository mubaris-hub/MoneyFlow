from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db import transaction
from .models import Group, GroupMember
from apps.users.serializers import UserSerializer

User = get_user_model()


class GroupMemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = GroupMember
        fields = ['id', 'user', 'role', 'joined_at']
        read_only_fields = ['id', 'joined_at']


class GroupSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    members = GroupMemberSerializer(source='memberships', many=True, read_only=True)
    members_count = serializers.SerializerMethodField()
    user_role = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = [
            'id', 'name', 'description', 'group_type', 'invite_code',
            'created_by', 'members', 'members_count', 'user_role',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'invite_code', 'created_by', 'created_at', 'updated_at']

    def get_members_count(self, obj):
        return obj.memberships.count()

    def get_user_role(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        membership = obj.memberships.filter(user=request.user).first()
        return membership.role if membership else None


class CreateGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ['id', 'name', 'description', 'group_type']

    def create(self, validated_data):
        user = self.context['request'].user
        with transaction.atomic():
            group = Group.objects.create(created_by=user, **validated_data)
            # Creator is automatically assigned as ADMIN
            GroupMember.objects.create(group=group, user=user, role='ADMIN')
        return group


class AddMemberSerializer(serializers.Serializer):
    identifier = serializers.CharField(required=True, help_text="Email or Username of user to add")
    role = serializers.ChoiceField(choices=GroupMember.ROLE_CHOICES, default='MEMBER')

    def validate(self, attrs):
        identifier = attrs['identifier'].strip()
        user = User.objects.filter(email__iexact=identifier).first() or User.objects.filter(username__iexact=identifier).first()

        if not user:
            raise serializers.ValidationError({"identifier": "No registered user found with that email or username."})

        attrs['user_to_add'] = user
        return attrs

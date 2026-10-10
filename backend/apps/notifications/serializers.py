from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    money_account_id = serializers.UUIDField(source='money_account.id', read_only=True, allow_null=True)
    transaction_id = serializers.UUIDField(source='transaction.id', read_only=True, allow_null=True)

    class Meta:
        model = Notification
        fields = [
            'id',
            'recipient',
            'notification_type',
            'title',
            'message',
            'money_account',
            'money_account_id',
            'transaction',
            'transaction_id',
            'is_read',
            'created_at',
            'read_at',
        ]
        read_only_fields = fields

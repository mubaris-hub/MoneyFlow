from django.utils import timezone
from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    money_account_id = serializers.UUIDField(source='money_account.id', read_only=True, allow_null=True)
    transaction_id = serializers.UUIDField(source='transaction.id', read_only=True, allow_null=True)
    invitation_id = serializers.UUIDField(source='invitation.id', read_only=True, allow_null=True)
    invitation_token = serializers.SerializerMethodField()

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
            'invitation',
            'invitation_id',
            'invitation_token',
            'is_read',
            'created_at',
            'read_at',
        ]
        read_only_fields = fields

    def get_invitation_token(self, obj):
        if obj.invitation:
            return obj.invitation.token
        if obj.notification_type == 'MONEY_ACCOUNT_INVITED' and obj.money_account:
            from apps.money_accounts.models import AccountInvitation
            inv = AccountInvitation.objects.filter(
                account=obj.money_account,
                recipient_email__iexact=obj.recipient.email,
                status='PENDING'
            ).order_by('-created_at').first()
            if inv and inv.expires_at > timezone.now():
                return inv.token
        return None

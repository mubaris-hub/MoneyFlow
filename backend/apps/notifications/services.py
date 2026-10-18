from django.utils import timezone
from .models import Notification


class NotificationService:
    @staticmethod
    def create_notification(
        recipient,
        notification_type,
        title,
        message,
        money_account=None,
        transaction=None,
        invitation=None,
        actor=None
    ):
        """
        Creates a notification safely.
        Enforces rule: Do NOT send notifications to the actor who performed the action.
        """
        if not recipient:
            return None
            
        if actor and recipient == actor:
            return None

        # Respect user notification preferences
        if not getattr(recipient, 'notify_in_app', True):
            return None

        ledger_types = [
            Notification.NotificationType.MONEY_ACCOUNT_INVITED,
            Notification.NotificationType.INVITATION_ACCEPTED,
            Notification.NotificationType.INVITATION_REJECTED,
            Notification.NotificationType.DEPOSIT_RECORDED,
            Notification.NotificationType.EXPENSE_RECORDED,
            Notification.NotificationType.REFUND_RECORDED,
            Notification.NotificationType.ADJUSTMENT_RECORDED,
            Notification.NotificationType.TRANSACTION_VOIDED,
            Notification.NotificationType.ACCOUNT_CLOSED,
        ]
        if notification_type in ledger_types and not getattr(recipient, 'notify_on_friend_ledgers', True):
            return None

        return Notification.objects.create(
            recipient=recipient,
            notification_type=notification_type,
            title=title,
            message=message,
            money_account=money_account,
            transaction=transaction,
            invitation=invitation
        )

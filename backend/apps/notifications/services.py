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

        return Notification.objects.create(
            recipient=recipient,
            notification_type=notification_type,
            title=title,
            message=message,
            money_account=money_account,
            transaction=transaction
        )

import uuid
from django.db import models
from django.conf import settings


class Notification(models.Model):
    class NotificationType(models.TextChoices):
        MONEY_ACCOUNT_INVITED = 'MONEY_ACCOUNT_INVITED', 'Money Account Invited'
        INVITATION_ACCEPTED = 'INVITATION_ACCEPTED', 'Invitation Accepted'
        INVITATION_REJECTED = 'INVITATION_REJECTED', 'Invitation Rejected'
        DEPOSIT_RECORDED = 'DEPOSIT_RECORDED', 'Deposit Recorded'
        EXPENSE_RECORDED = 'EXPENSE_RECORDED', 'Expense Recorded'
        REFUND_RECORDED = 'REFUND_RECORDED', 'Refund Recorded'
        ADJUSTMENT_RECORDED = 'ADJUSTMENT_RECORDED', 'Adjustment Recorded'
        TRANSACTION_VOIDED = 'TRANSACTION_VOIDED', 'Transaction Voided'
        ACCOUNT_CLOSED = 'ACCOUNT_CLOSED', 'Account Closed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    notification_type = models.CharField(
        max_length=50,
        choices=NotificationType.choices
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    money_account = models.ForeignKey(
        'money_accounts.MoneyAccount',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications'
    )
    transaction = models.ForeignKey(
        'money_accounts.AccountTransaction',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications'
    )
    invitation = models.ForeignKey(
        'money_accounts.AccountInvitation',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications'
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification({self.recipient.email}, {self.notification_type}, read={self.is_read})"

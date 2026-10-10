import uuid
from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()


class MoneyAccount(models.Model):
    STATUS_CHOICES = [
        ('DRAFT', 'Draft / Unlinked'),
        ('INVITED', 'Invitation Pending'),
        ('ACTIVE', 'Active & Linked'),
        ('CLOSED', 'Closed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=150)
    
    # Manager: Person who holds, manages, and spends the money
    manager = models.ForeignKey(User, on_delete=models.CASCADE, related_name='managed_money_accounts')
    
    # Owner: Person whose money is being managed (Null if friend is not registered yet)
    owner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='owned_money_accounts')
    owner_name = models.CharField(max_length=100)
    owner_email = models.EmailField(db_index=True)

    currency = models.CharField(max_length=3, default='INR')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT', db_index=True)
    allow_overdraft = models.BooleanField(default=False)
    
    notes = models.TextField(blank=True, default='')
    closed_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'money_accounts_account'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['manager', 'status']),
            models.Index(fields=['owner', 'status']),
            models.Index(fields=['owner_email']),
        ]

    def __str__(self):
        return f"{self.title} (Manager: {self.manager.username})"


class AccountCategory(models.Model):
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    icon = models.CharField(max_length=50, default='Tag')
    is_system = models.BooleanField(default=True)

    class Meta:
        db_table = 'money_accounts_category'
        verbose_name_plural = 'Account Categories'

    def __str__(self):
        return self.name


class AccountTransaction(models.Model):
    TRANSACTION_TYPE_CHOICES = [
        ('DEPOSIT', 'Funds Received (+ Balance)'),
        ('EXPENSE', 'Expense Logged (- Balance)'),
        ('REFUND', 'Funds Returned (- Balance)'),
        ('ADJUSTMENT', 'Balance Adjustment (± Balance)'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account = models.ForeignKey(MoneyAccount, on_delete=models.CASCADE, related_name='transactions')
    
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPE_CHOICES, db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=255)
    
    category = models.ForeignKey(AccountCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')
    date = models.DateField(default=timezone.now, db_index=True)
    
    receipt_url = models.URLField(max_length=500, blank=True, null=True)
    receipt_image = models.FileField(upload_to='receipts/', null=True, blank=True)
    receipt_uploaded_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')
    
    # Audit Trail & Voiding
    is_voided = models.BooleanField(default=False, db_index=True)
    voided_at = models.DateTimeField(null=True, blank=True)
    voided_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='voided_account_transactions')
    void_reason = models.TextField(blank=True, default='')

    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='created_account_transactions')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'money_accounts_transaction'
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['account', 'date']),
            models.Index(fields=['account', 'is_voided']),
        ]

    def __str__(self):
        return f"{self.transaction_type}: ₹{self.amount} - {self.description}"


class AccountInvitation(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('ACCEPTED', 'Accepted'),
        ('REJECTED', 'Rejected'),
        ('EXPIRED', 'Expired'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account = models.ForeignKey(MoneyAccount, on_delete=models.CASCADE, related_name='invitations')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_account_invitations')
    recipient_email = models.EmailField(db_index=True)
    token = models.CharField(max_length=64, unique=True, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = 'money_accounts_invitation'

    def __str__(self):
        return f"Invitation for {self.recipient_email} ({self.status})"


class AccountAuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account = models.ForeignKey(MoneyAccount, on_delete=models.CASCADE, related_name='audit_logs')
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='account_audit_logs')
    action = models.CharField(max_length=50)
    details = models.JSONField(default=dict)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'money_accounts_auditlog'
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.action} on {self.account.title} at {self.timestamp}"

import uuid
from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model
from apps.groups.models import Group

User = get_user_model()


class Category(models.Model):
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)
    icon = models.CharField(max_length=50, default='Tag')
    is_system = models.BooleanField(default=True)

    class Meta:
        db_table = 'expenses_category'
        verbose_name_plural = 'Categories'
        ordering = ['id']

    def __str__(self):
        return self.name


class Expense(models.Model):
    SPLIT_TYPE_CHOICES = [
        ('EQUAL', 'Equal'),
        ('EXACT', 'Exact Amount'),
        ('PERCENTAGE', 'Percentage'),
        ('SHARES', 'Shares / Ratio'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    description = models.CharField(max_length=255)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='INR')
    
    paid_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='paid_expenses')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_expenses')
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='expenses')
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='expenses')
    
    split_type = models.CharField(max_length=20, choices=SPLIT_TYPE_CHOICES, default='EQUAL')
    date = models.DateField(default=timezone.now)
    notes = models.TextField(blank=True, default='')
    receipt_url = models.URLField(max_length=500, blank=True, null=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'expenses_expense'
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['group', 'date']),
            models.Index(fields=['paid_by', 'date']),
        ]

    def __str__(self):
        return f"{self.description} (₹{self.total_amount}) in {self.group.name}"


class ExpenseSplit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name='splits')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='expense_splits')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    shares = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'expenses_expensesplit'
        unique_together = ('expense', 'user')

    def __str__(self):
        return f"{self.user.username}: ₹{self.amount} for {self.expense.description}"


class DirectPayment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_direct_payments')
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_direct_payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='INR')
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='direct_payments')
    date = models.DateField(default=timezone.now)
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'expenses_directpayment'
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"{self.sender.username} -> {self.receiver.username}: ₹{self.amount}"

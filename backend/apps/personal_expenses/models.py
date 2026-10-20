import uuid
from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()


class PersonalCategory(models.Model):
    TYPE_CHOICES = [
        ('EXPENSE', 'Expense'),
        ('INCOME', 'Income'),
    ]

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='personal_categories',
        db_index=True
    )
    name = models.CharField(max_length=100)
    icon = models.CharField(max_length=50, default='Tag')
    color = models.CharField(max_length=30, default='#10B981')
    category_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='EXPENSE')
    is_system = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'personal_categories'
        verbose_name_plural = 'Personal Categories'
        ordering = ['name']
        indexes = [
            models.Index(fields=['user', 'category_type']),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_category_type_display()})"


class PersonalTransaction(models.Model):
    TYPE_CHOICES = [
        ('EXPENSE', 'Expense'),
        ('INCOME', 'Income'),
    ]

    PAYMENT_METHOD_CHOICES = [
        ('CASH', 'Cash'),
        ('UPI', 'UPI'),
        ('CARD', 'Card'),
        ('NET_BANKING', 'Net Banking'),
        ('OTHER', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='personal_transactions',
        db_index=True
    )
    transaction_type = models.CharField(
        max_length=10,
        choices=TYPE_CHOICES,
        default='EXPENSE',
        db_index=True
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    title = models.CharField(max_length=255)
    category = models.ForeignKey(
        PersonalCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transactions'
    )
    category_name = models.CharField(max_length=100, blank=True)
    date = models.DateField(default=timezone.now, db_index=True)
    time = models.TimeField(null=True, blank=True)
    payment_method = models.CharField(
        max_length=30,
        choices=PAYMENT_METHOD_CHOICES,
        default='UPI'
    )
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'personal_transactions'
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['user', 'date']),
            models.Index(fields=['user', 'transaction_type', 'date']),
            models.Index(fields=['user', 'category']),
        ]

    def __str__(self):
        prefix = '-' if self.transaction_type == 'EXPENSE' else '+'
        return f"{self.user.username}: {prefix}₹{self.amount} - {self.title}"

    def save(self, *args, **kwargs):
        if self.category and not self.category_name:
            self.category_name = self.category.name
        super().save(*args, **kwargs)


class PersonalBudget(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='personal_budgets',
        db_index=True
    )
    month = models.PositiveSmallIntegerField()  # 1-12
    year = models.PositiveIntegerField()        # e.g., 2026
    category = models.ForeignKey(
        PersonalCategory,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='budgets'
    )  # None indicates overall total monthly spending budget
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'personal_budgets'
        ordering = ['-year', '-month']
        unique_together = ('user', 'year', 'month', 'category')
        indexes = [
            models.Index(fields=['user', 'year', 'month']),
        ]

    def __str__(self):
        cat = self.category.name if self.category else 'Total Budget'
        return f"{self.user.username} {self.month}/{self.year} {cat}: ₹{self.amount}"


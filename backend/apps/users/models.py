import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, error_messages={'unique': "A user with that email already exists."})
    username = models.CharField(max_length=150, unique=True, error_messages={'unique': "A user with that username already exists."})
    first_name = models.CharField(max_length=150, blank=False)
    last_name = models.CharField(max_length=150, blank=True, default='')
    avatar_url = models.URLField(max_length=500, blank=True, null=True)
    default_currency = models.CharField(max_length=3, default='INR')
    date_format = models.CharField(max_length=20, default='YYYY-MM-DD')
    notify_email = models.BooleanField(default=True)
    notify_in_app = models.BooleanField(default=True)
    notify_on_expenses = models.BooleanField(default=True)
    notify_on_settlements = models.BooleanField(default=True)
    notify_on_friend_ledgers = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    class Meta:
        db_table = 'users_user'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.email})"

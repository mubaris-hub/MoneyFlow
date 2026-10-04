import uuid
import secrets
from django.db import models
from django.conf import UserSettingsHolder, settings
from django.contrib.auth import get_user_model

User = get_user_model()


class Group(models.Model):
    GROUP_TYPE_CHOICES = [
        ('ROOMMATES', 'Roommates'),
        ('TRIP', 'Trip / Vacation'),
        ('STUDENT_HOUSE', 'Student House'),
        ('COUPLE', 'Couple'),
        ('OTHER', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    group_type = models.CharField(max_length=50, choices=GROUP_TYPE_CHOICES, default='OTHER')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_groups')
    invite_code = models.CharField(max_length=32, unique=True, db_index=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'groups_group'
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.invite_code:
            self.invite_code = secrets.token_urlsafe(8).replace('-', '').replace('_', '')[:10].upper()
        super().save(*args, **kwargs)


class GroupMember(models.Model):
    ROLE_CHOICES = [
        ('ADMIN', 'Admin'),
        ('MEMBER', 'Member'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='group_memberships')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='MEMBER')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'groups_groupmember'
        ordering = ['joined_at']
        unique_together = ('group', 'user')

    def __str__(self):
        return f"{self.user.username} in {self.group.name} ({self.role})"

from rest_framework import permissions
from apps.groups.models import GroupMember


class IsExpenseGroupMember(permissions.BasePermission):
    """
    Permission check to ensure the user is an active member of the expense's group.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        group = getattr(obj, 'group', None)
        if not group:
            return False

        return GroupMember.objects.filter(group=group, user=request.user).exists()

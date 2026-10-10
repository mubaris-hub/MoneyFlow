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


class CanModifySettlement(permissions.BasePermission):
    """
    Permission check to ensure only sender, receiver, created_by, or group ADMIN can modify a settlement.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        if not GroupMember.objects.filter(group=obj.group, user=request.user).exists():
            return False

        if request.method in permissions.SAFE_METHODS:
            return True

        is_participant = (request.user.id in [obj.sender_id, obj.receiver_id, obj.created_by_id])
        is_admin = GroupMember.objects.filter(group=obj.group, user=request.user, role='ADMIN').exists()
        return is_participant or is_admin


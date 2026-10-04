from rest_framework import permissions
from .models import GroupMember, Group


class IsGroupMember(permissions.BasePermission):
    """
    Permission check to ensure the authenticated user is a member of the group.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        group_id = view.kwargs.get('pk') or view.kwargs.get('group_id')
        if not group_id:
            return True  # Object-level check will handle it in has_object_permission

        return GroupMember.objects.filter(group_id=group_id, user=request.user).exists()

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        group = obj if isinstance(obj, Group) else getattr(obj, 'group', None)
        if not group:
            return False

        return GroupMember.objects.filter(group=group, user=request.user).exists()


class IsGroupAdmin(permissions.BasePermission):
    """
    Permission check to ensure the user is an ADMIN of the group.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        group_id = view.kwargs.get('pk') or view.kwargs.get('group_id')
        if not group_id:
            return True

        return GroupMember.objects.filter(group_id=group_id, user=request.user, role='ADMIN').exists()

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        group = obj if isinstance(obj, Group) else getattr(obj, 'group', None)
        if not group:
            return False

        return GroupMember.objects.filter(group=group, user=request.user, role='ADMIN').exists()

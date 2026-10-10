from rest_framework import permissions


class IsAccountManager(permissions.BasePermission):
    """
    Permission allowing full access to the manager of a MoneyAccount.
    """
    def has_object_permission(self, request, view, obj):
        account = getattr(obj, 'account', obj)
        return account.manager == request.user


class IsAccountOwnerOrManager(permissions.BasePermission):
    """
    Permission allowing read access to both owner and manager,
    and write access ONLY to the manager.
    """
    def has_object_permission(self, request, view, obj):
        account = getattr(obj, 'account', obj)
        is_manager = account.manager == request.user
        is_owner = account.owner == request.user

        if request.method in permissions.SAFE_METHODS:
            return is_manager or is_owner
        
        return is_manager

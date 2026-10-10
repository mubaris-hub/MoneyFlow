from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """List authenticated user's notifications ordered by newest first."""
        qs = Notification.objects.filter(recipient=request.user)

        unread_param = request.query_params.get('unread')
        if unread_param and unread_param.lower() in ['true', '1', 't']:
            qs = qs.filter(is_read=False)

        qs = qs.order_by('-created_at')
        serializer = NotificationSerializer(qs, many=True)

        unread_count = Notification.objects.filter(recipient=request.user, is_read=False).count()

        return Response({
            'notifications': serializer.data,
            'unread_count': unread_count
        }, status=status.HTTP_200_OK)


class NotificationMarkReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        """Mark a specific notification as read."""
        notification = get_object_or_404(Notification, id=pk)

        if notification.recipient != request.user:
            raise PermissionDenied("You do not have permission to modify this notification.")

        if not notification.is_read:
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save()

        serializer = NotificationSerializer(notification)
        return Response(serializer.data, status=status.HTTP_200_OK)


class NotificationMarkAllReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """Mark all unread notifications for the user as read."""
        updated_count = Notification.objects.filter(
            recipient=request.user,
            is_read=False
        ).update(
            is_read=True,
            read_at=timezone.now()
        )

        return Response({
            'detail': 'All notifications marked as read.',
            'count': updated_count
        }, status=status.HTTP_200_OK)

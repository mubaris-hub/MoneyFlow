from rest_framework import status, permissions, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction

from .models import Group, GroupMember
from .serializers import (
    GroupSerializer,
    CreateGroupSerializer,
    GroupMemberSerializer,
    AddMemberSerializer
)
from .permissions import IsGroupMember, IsGroupAdmin


class GroupListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        groups = Group.objects.filter(memberships__user=request.user).distinct()
        serializer = GroupSerializer(groups, many=True, context={'request': request})
        return Response({'groups': serializer.data}, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = CreateGroupSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            group = serializer.save()
            full_serializer = GroupSerializer(group, context={'request': request})
            return Response({
                'message': 'Group created successfully',
                'group': full_serializer.data
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GroupDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsGroupMember]

    def get_object(self, pk, user):
        group = get_object_or_404(Group, pk=pk)
        self.check_object_permissions(self.request, group)
        return group

    def get(self, request, pk):
        group = self.get_object(pk, request.user)
        serializer = GroupSerializer(group, context={'request': request})
        return Response({'group': serializer.data}, status=status.HTTP_200_OK)

    def put(self, request, pk):
        group = self.get_object(pk, request.user)
        # Check admin permission for editing group details
        if not GroupMember.objects.filter(group=group, user=request.user, role='ADMIN').exists():
            return Response({'detail': 'Only group admins can update group settings.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = CreateGroupSerializer(group, data=request.data, partial=True)
        if serializer.is_valid():
            updated_group = serializer.save()
            return Response({
                'message': 'Group updated successfully',
                'group': GroupSerializer(updated_group, context={'request': request}).data
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        group = self.get_object(pk, request.user)
        if not GroupMember.objects.filter(group=group, user=request.user, role='ADMIN').exists():
            return Response({'detail': 'Only group admins can delete groups.'}, status=status.HTTP_403_FORBIDDEN)

        group.delete()
        return Response({'message': 'Group deleted successfully'}, status=status.HTTP_200_OK)


class GroupMemberListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsGroupMember]

    def get(self, request, pk):
        group = get_object_or_404(Group, pk=pk)
        self.check_object_permissions(request, group)
        members = group.memberships.all()
        serializer = GroupMemberSerializer(members, many=True)
        return Response({'members': serializer.data}, status=status.HTTP_200_OK)

    def post(self, request, pk):
        group = get_object_or_404(Group, pk=pk)
        self.check_object_permissions(request, group)

        serializer = AddMemberSerializer(data=request.data)
        if serializer.is_valid():
            user_to_add = serializer.validated_data['user_to_add']
            role = serializer.validated_data.get('role', 'MEMBER')

            if GroupMember.objects.filter(group=group, user=user_to_add).exists():
                return Response({'detail': 'User is already a member of this group.'}, status=status.HTTP_400_BAD_REQUEST)

            member = GroupMember.objects.create(group=group, user=user_to_add, role=role)
            return Response({
                'message': f'Added {user_to_add.first_name} to {group.name}',
                'member': GroupMemberSerializer(member).data
            }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GroupMemberRemoveView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsGroupMember]

    def delete(self, request, pk, user_id):
        group = get_object_or_404(Group, pk=pk)
        self.check_object_permissions(request, group)

        member = get_object_or_404(GroupMember, group=group, user_id=user_id)

        # Allow user to remove themselves OR allow group admins to remove members
        is_self = (str(request.user.id) == str(user_id))
        is_admin = GroupMember.objects.filter(group=group, user=request.user, role='ADMIN').exists()

        if not (is_self or is_admin):
            return Response({'detail': 'You do not have permission to remove this member.'}, status=status.HTTP_403_FORBIDDEN)

        member.delete()
        return Response({'message': 'Member removed successfully'}, status=status.HTTP_200_OK)


class JoinGroupByCodeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, code=None):
        invite_code = code or request.data.get('invite_code')
        if not invite_code:
            return Response({'detail': 'Invite code is required.'}, status=status.HTTP_400_BAD_REQUEST)

        group = get_object_or_404(Group, invite_code__iexact=invite_code.strip())

        membership, created = GroupMember.objects.get_or_create(
            group=group,
            user=request.user,
            defaults={'role': 'MEMBER'}
        )

        message = f'Successfully joined {group.name}' if created else f'You are already a member of {group.name}'
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK

        return Response({
            'message': message,
            'group': GroupSerializer(group, context={'request': request}).data
        }, status=status_code)

from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from .models import Group, GroupMember

User = get_user_model()


class GroupAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            email="owner@example.com",
            username="owner",
            first_name="Owner",
            password="Password123!"
        )
        self.user2 = User.objects.create_user(
            email="member@example.com",
            username="member",
            first_name="Member",
            password="Password123!"
        )
        self.user3 = User.objects.create_user(
            email="stranger@example.com",
            username="stranger",
            first_name="Stranger",
            password="Password123!"
        )

        self.groups_url = reverse('group_list_create')

    def test_create_group_success(self):
        self.client.force_authenticate(user=self.user1)
        payload = {
            "name": "Flat 402 Roommates",
            "description": "Monthly rent and utilities",
            "group_type": "ROOMMATES"
        }
        response = self.client.post(self.groups_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        group_data = response.data['group']
        self.assertEqual(group_data['name'], "Flat 402 Roommates")
        self.assertEqual(group_data['user_role'], "ADMIN")
        self.assertIsNotNone(group_data['invite_code'])

        # Verify DB entry
        group = Group.objects.get(id=group_data['id'])
        self.assertTrue(GroupMember.objects.filter(group=group, user=self.user1, role='ADMIN').exists())

    def test_non_member_cannot_access_group_detail(self):
        self.client.force_authenticate(user=self.user1)
        res = self.client.post(self.groups_url, {"name": "Secret Trip", "group_type": "TRIP"}, format='json')
        group_id = res.data['group']['id']

        # Authenticate as stranger
        self.client.force_authenticate(user=self.user3)
        detail_url = reverse('group_detail', kwargs={'pk': group_id})
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_join_group_via_invite_code(self):
        # User 1 creates group
        self.client.force_authenticate(user=self.user1)
        res = self.client.post(self.groups_url, {"name": "Goa Trip", "group_type": "TRIP"}, format='json')
        invite_code = res.data['group']['invite_code']

        # User 2 joins group using invite code
        self.client.force_authenticate(user=self.user2)
        join_url = reverse('group_join_code', kwargs={'code': invite_code})
        response = self.client.post(join_url)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['group']['name'], "Goa Trip")

        # Verify User 2 is now a MEMBER
        group = Group.objects.get(invite_code=invite_code)
        self.assertTrue(GroupMember.objects.filter(group=group, user=self.user2, role='MEMBER').exists())

    def test_add_member_by_email(self):
        self.client.force_authenticate(user=self.user1)
        res = self.client.post(self.groups_url, {"name": "Project Group", "group_type": "STUDENT_HOUSE"}, format='json')
        group_id = res.data['group']['id']

        members_url = reverse('group_members', kwargs={'pk': group_id})
        response = self.client.post(members_url, {"identifier": "member@example.com"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify member in list
        group = Group.objects.get(id=group_id)
        self.assertEqual(group.memberships.count(), 2)

    def test_remove_member_from_group(self):
        # Create group and add user2
        group = Group.objects.create(name="Dinner Group", created_by=self.user1)
        GroupMember.objects.create(group=group, user=self.user1, role='ADMIN')
        GroupMember.objects.create(group=group, user=self.user2, role='MEMBER')

        # Admin removes user2
        self.client.force_authenticate(user=self.user1)
        remove_url = reverse('group_member_remove', kwargs={'pk': group.id, 'user_id': self.user2.id})
        response = self.client.delete(remove_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(group.memberships.count(), 1)

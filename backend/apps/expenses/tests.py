from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.groups.models import Group, GroupMember
from .models import Category, Expense, ExpenseSplit, DirectPayment
from .services import calculate_expense_splits

User = get_user_model()


class ExpenseServicesAndAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create 3 Users
        self.u1 = User.objects.create_user(email="u1@example.com", username="u1", password="Password123!", first_name="User1")
        self.u2 = User.objects.create_user(email="u2@example.com", username="u2", password="Password123!", first_name="User2")
        self.u3 = User.objects.create_user(email="u3@example.com", username="u3", password="Password123!", first_name="User3")
        self.u_stranger = User.objects.create_user(email="stranger@example.com", username="stranger", password="Password123!", first_name="Stranger")

        # Create Group & Memberships
        self.group = Group.objects.create(name="Test Group", created_by=self.u1)
        GroupMember.objects.create(group=self.group, user=self.u1, role='ADMIN')
        GroupMember.objects.create(group=self.group, user=self.u2, role='MEMBER')
        GroupMember.objects.create(group=self.group, user=self.u3, role='MEMBER')

        # Ensure Category exists
        self.category = Category.objects.get(id=1)

        self.expenses_url = reverse('expense_list_create')

    def test_equal_split_odd_cents_math(self):
        # Splitting ₹100.00 among 3 users -> 33.34, 33.33, 33.33
        participants = [
            {'user_id': self.u1.id},
            {'user_id': self.u2.id},
            {'user_id': self.u3.id}
        ]
        splits = calculate_expense_splits(Decimal('100.00'), 'EQUAL', participants)
        self.assertEqual(len(splits), 3)
        self.assertEqual(splits[0]['amount'], Decimal('33.34'))
        self.assertEqual(splits[1]['amount'], Decimal('33.33'))
        self.assertEqual(splits[2]['amount'], Decimal('33.33'))
        self.assertEqual(sum(s['amount'] for s in splits), Decimal('100.00'))

    def test_exact_split_sum_validation(self):
        # Exact split matching ₹150.00 -> 100.00 + 50.00
        participants = [
            {'user_id': self.u1.id, 'amount': Decimal('100.00')},
            {'user_id': self.u2.id, 'amount': Decimal('50.00')}
        ]
        splits = calculate_expense_splits(Decimal('150.00'), 'EXACT', participants)
        self.assertEqual(sum(s['amount'] for s in splits), Decimal('150.00'))

        # Exact split mismatching total -> raises ValidationError
        invalid_participants = [
            {'user_id': self.u1.id, 'amount': Decimal('100.00')},
            {'user_id': self.u2.id, 'amount': Decimal('40.00')}
        ]
        with self.assertRaises(Exception):
            calculate_expense_splits(Decimal('150.00'), 'EXACT', invalid_participants)

    def test_percentage_split_validation_and_rounding(self):
        # 50.00%, 30.00%, 20.00% of ₹100.00
        participants = [
            {'user_id': self.u1.id, 'percentage': Decimal('50.00')},
            {'user_id': self.u2.id, 'percentage': Decimal('30.00')},
            {'user_id': self.u3.id, 'percentage': Decimal('20.00')}
        ]
        splits = calculate_expense_splits(Decimal('100.00'), 'PERCENTAGE', participants)
        self.assertEqual(splits[0]['amount'], Decimal('50.00'))
        self.assertEqual(splits[1]['amount'], Decimal('30.00'))
        self.assertEqual(splits[2]['amount'], Decimal('20.00'))
        self.assertEqual(sum(s['amount'] for s in splits), Decimal('100.00'))

    def test_shares_split_ratio(self):
        # 2 shares vs 1 share of ₹90.00 -> 60.00 and 30.00
        participants = [
            {'user_id': self.u1.id, 'shares': 2},
            {'user_id': self.u2.id, 'shares': 1}
        ]
        splits = calculate_expense_splits(Decimal('90.00'), 'SHARES', participants)
        self.assertEqual(splits[0]['amount'], Decimal('60.00'))
        self.assertEqual(splits[1]['amount'], Decimal('30.00'))
        self.assertEqual(sum(s['amount'] for s in splits), Decimal('90.00'))

    def test_create_expense_api_success(self):
        self.client.force_authenticate(user=self.u1)
        payload = {
            "description": "Team Dinner",
            "total_amount": "120.00",
            "currency": "INR",
            "group_id": str(self.group.id),
            "category_id": self.category.id,
            "paid_by_id": str(self.u1.id),
            "split_type": "EQUAL",
            "splits": [
                {"user_id": str(self.u1.id)},
                {"user_id": str(self.u2.id)},
                {"user_id": str(self.u3.id)}
            ]
        }
        response = self.client.post(self.expenses_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        expense_data = response.data['expense']
        self.assertEqual(expense_data['description'], "Team Dinner")
        self.assertEqual(len(expense_data['splits']), 3)

        # DB Assertion
        expense = Expense.objects.get(id=expense_data['id'])
        self.assertEqual(expense.created_by, self.u1)
        self.assertEqual(expense.paid_by, self.u1)
        self.assertEqual(expense.splits.count(), 3)

    def test_non_member_cannot_create_expense(self):
        self.client.force_authenticate(user=self.u_stranger)
        payload = {
            "description": "Sneaky Expense",
            "total_amount": "50.00",
            "group_id": str(self.group.id),
            "category_id": self.category.id,
            "paid_by_id": str(self.u_stranger.id),
            "split_type": "EQUAL",
            "splits": [{"user_id": str(self.u_stranger.id)}]
        }
        response = self.client.post(self.expenses_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('group_id', response.data)

    def test_paid_by_must_be_group_member(self):
        self.client.force_authenticate(user=self.u1)
        payload = {
            "description": "Invalid Payer Expense",
            "total_amount": "50.00",
            "group_id": str(self.group.id),
            "category_id": self.category.id,
            "paid_by_id": str(self.u_stranger.id),
            "split_type": "EQUAL",
            "splits": [{"user_id": str(self.u1.id)}]
        }
        response = self.client.post(self.expenses_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('paid_by_id', response.data)

    def test_duplicate_user_in_splits_rejected(self):
        self.client.force_authenticate(user=self.u1)
        payload = {
            "description": "Duplicate Splits Expense",
            "total_amount": "50.00",
            "group_id": str(self.group.id),
            "category_id": self.category.id,
            "paid_by_id": str(self.u1.id),
            "split_type": "EQUAL",
            "splits": [
                {"user_id": str(self.u1.id)},
                {"user_id": str(self.u1.id)}
            ]
        }
        response = self.client.post(self.expenses_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('splits', response.data)

    def test_soft_delete_expense(self):
        self.client.force_authenticate(user=self.u1)
        expense = Expense.objects.create(
            description="To be deleted",
            total_amount=Decimal('50.00'),
            paid_by=self.u1,
            created_by=self.u1,
            group=self.group,
            category=self.category,
            split_type='EQUAL'
        )
        detail_url = reverse('expense_detail', kwargs={'pk': expense.id})
        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        expense.refresh_from_db()
        self.assertTrue(expense.is_deleted)

from decimal import Decimal
from datetime import date, timedelta
from django.utils import timezone
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from apps.groups.models import Group, GroupMember
from apps.expenses.models import Expense, Category as GroupCategory
from .models import PersonalCategory, PersonalTransaction, PersonalBudget
from .services import PersonalExpenseService

User = get_user_model()


class PersonalExpensesTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.user1 = User.objects.create_user(
            username='alice',
            email='alice@example.com',
            password='Password123!',
            first_name='Alice',
            last_name='Smith'
        )
        self.user2 = User.objects.create_user(
            username='bob',
            email='bob@example.com',
            password='Password123!',
            first_name='Bob',
            last_name='Jones'
        )

        PersonalExpenseService.ensure_system_categories()
        self.food_cat = PersonalCategory.objects.get(name='Food & Drinks', is_system=True)
        self.salary_cat = PersonalCategory.objects.get(name='Salary', is_system=True)

        self.client.force_authenticate(user=self.user1)

    def test_create_personal_expense(self):
        """User can record an everyday expense (e.g., ₹40 for tea) without creating a group."""
        url = reverse('personal_transactions')
        payload = {
            'title': 'Cutting Chai',
            'amount': '40.00',
            'transaction_type': 'EXPENSE',
            'category': self.food_cat.id,
            'payment_method': 'UPI',
            'notes': 'Street vendor',
            'date': str(date.today())
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['title'], 'Cutting Chai')
        self.assertEqual(res.data['amount'], '40.00')
        self.assertEqual(res.data['category_name'], 'Food & Drinks')

        # Verify in database
        tx = PersonalTransaction.objects.get(id=res.data['id'])
        self.assertEqual(tx.user, self.user1)
        self.assertEqual(tx.amount, Decimal('40.00'))

    def test_create_personal_income(self):
        """User can record personal income independently."""
        url = reverse('personal_transactions')
        payload = {
            'title': 'Monthly Salary',
            'amount': '75000.00',
            'transaction_type': 'INCOME',
            'category': self.salary_cat.id,
            'payment_method': 'NET_BANKING',
            'date': str(date.today())
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['transaction_type'], 'INCOME')
        self.assertEqual(res.data['amount'], '75000.00')

    def test_validation_invalid_amount(self):
        """Negative or zero amounts are rejected."""
        url = reverse('personal_transactions')
        res1 = self.client.post(url, {'title': 'Zero', 'amount': '0.00', 'transaction_type': 'EXPENSE'}, format='json')
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)

        res2 = self.client.post(url, {'title': 'Negative', 'amount': '-50.00', 'transaction_type': 'EXPENSE'}, format='json')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cross_user_isolation(self):
        """User2 cannot see, edit, or delete User1's personal transactions."""
        tx1 = PersonalTransaction.objects.create(
            user=self.user1,
            title='Secret Gift',
            amount=Decimal('500.00'),
            transaction_type='EXPENSE',
            category=self.food_cat,
            date=date.today()
        )

        # Authenticate as User2
        self.client.force_authenticate(user=self.user2)

        # List should not contain User1's transaction
        res_list = self.client.get(reverse('personal_transactions'))
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        ids = [item['id'] for item in res_list.data['results']]
        self.assertNotIn(str(tx1.id), ids)

        # Detail should return 404
        detail_url = reverse('personal_transaction_detail', kwargs={'id': tx1.id})
        res_detail = self.client.get(detail_url)
        self.assertEqual(res_detail.status_code, status.HTTP_404_NOT_FOUND)

        # Update should return 404
        res_update = self.client.patch(detail_url, {'title': 'Hacked'}, format='json')
        self.assertEqual(res_update.status_code, status.HTTP_404_NOT_FOUND)

        # Delete should return 404
        res_delete = self.client.delete(detail_url)
        self.assertEqual(res_delete.status_code, status.HTTP_404_NOT_FOUND)

    def test_personal_expense_does_not_affect_group_expenses(self):
        """Personal expenses must never appear as group expenses or alter group balances."""
        group = Group.objects.create(name='Trip Group', created_by=self.user1)
        GroupMember.objects.create(group=group, user=self.user1, role='ADMIN')
        GroupMember.objects.create(group=group, user=self.user2, role='MEMBER')

        # Add personal expense
        PersonalTransaction.objects.create(
            user=self.user1,
            title='Private Lunch',
            amount=Decimal('350.00'),
            transaction_type='EXPENSE',
            category=self.food_cat,
            date=timezone.localdate()
        )

        # Ensure Group has zero expenses
        self.assertEqual(group.expenses.count(), 0)
        self.assertEqual(Expense.objects.filter(group=group).count(), 0)

    def test_summary_and_net_cash_flow(self):
        """Test summary metrics, monthly totals, and net cash flow."""
        today = timezone.localdate()
        # Today's expense
        PersonalTransaction.objects.create(
            user=self.user1,
            title='Coffee',
            amount=Decimal('150.00'),
            transaction_type='EXPENSE',
            category=self.food_cat,
            date=today
        )
        # Today's income
        PersonalTransaction.objects.create(
            user=self.user1,
            title='Freelance Milestone',
            amount=Decimal('10000.00'),
            transaction_type='INCOME',
            category=self.salary_cat,
            date=today
        )

        res = self.client.get(reverse('personal_summary'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data

        self.assertEqual(Decimal(data['today_expenses']), Decimal('150.00'))
        self.assertEqual(Decimal(data['this_month_expenses']), Decimal('150.00'))
        self.assertEqual(Decimal(data['this_month_income']), Decimal('10000.00'))
        self.assertEqual(Decimal(data['net_cash_flow']), Decimal('9850.00'))

    def test_monthly_budget_management(self):
        """Set, update, and evaluate monthly budget."""
        today = timezone.localdate()
        budgets_url = reverse('personal_budgets')

        # Set monthly budget of ₹20,000
        post_data = {
            'year': today.year,
            'month': today.month,
            'amount': '20000.00'
        }
        res = self.client.post(budgets_url, post_data, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # Log expense of ₹5,000
        PersonalTransaction.objects.create(
            user=self.user1,
            title='Groceries',
            amount=Decimal('5000.00'),
            transaction_type='EXPENSE',
            category=self.food_cat,
            date=today
        )

        # Check budgets endpoint
        res_get = self.client.get(f"{budgets_url}?year={today.year}&month={today.month}")
        self.assertEqual(res_get.status_code, status.HTTP_200_OK)
        overall = res_get.data['overall_budget']
        self.assertIsNotNone(overall)
        self.assertEqual(Decimal(overall['budget_amount']), Decimal('20000.00'))
        self.assertEqual(Decimal(overall['spent_amount']), Decimal('5000.00'))
        self.assertEqual(Decimal(overall['remaining_amount']), Decimal('15000.00'))
        self.assertEqual(overall['status'], 'SAFE')


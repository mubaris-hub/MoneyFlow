from decimal import Decimal
from datetime import date, timedelta
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status

from apps.groups.models import Group, GroupMember
from apps.expenses.models import Expense, ExpenseSplit, Category, DirectPayment, Settlement
from apps.money_accounts.models import MoneyAccount, AccountTransaction
from apps.money_accounts.services import MoneyAccountService
from apps.reports.services import ReportService

User = get_user_model()


class ReportServicesAndAPITests(APITestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(
            username='user1', email='user1@example.com', password='Password123!'
        )
        self.user2 = User.objects.create_user(
            username='user2', email='user2@example.com', password='Password123!'
        )
        self.unrelated_user = User.objects.create_user(
            username='unrelated', email='unrelated@example.com', password='Password123!'
        )

        # Categories
        self.cat_food, _ = Category.objects.get_or_create(name='Food & Dining', defaults={'icon': 'Utensils'})
        self.cat_rent, _ = Category.objects.get_or_create(name='Rent & Housing', defaults={'icon': 'Home'})

        # Group setup
        self.group = Group.objects.create(name='Housemates Group', created_by=self.user1)
        GroupMember.objects.create(group=self.group, user=self.user1, role='ADMIN')
        GroupMember.objects.create(group=self.group, user=self.user2, role='MEMBER')

        # Create Shared Expense (Total 1000: User1 paid, split 500 each)
        self.expense1 = Expense.objects.create(
            description='Groceries Shopping',
            total_amount=Decimal('1000.00'),
            paid_by=self.user1,
            created_by=self.user1,
            group=self.group,
            category=self.cat_food,
            split_type='EQUAL',
            date=date(2026, 10, 1)
        )
        ExpenseSplit.objects.create(expense=self.expense1, user=self.user1, amount=Decimal('500.00'))
        ExpenseSplit.objects.create(expense=self.expense1, user=self.user2, amount=Decimal('500.00'))

        # Create Second Expense (User2 paid Rent 2000, User1 share 1000, User2 share 1000)
        self.expense2 = Expense.objects.create(
            description='Monthly Rent',
            total_amount=Decimal('2000.00'),
            paid_by=self.user2,
            created_by=self.user2,
            group=self.group,
            category=self.cat_rent,
            split_type='EQUAL',
            date=date(2026, 10, 5)
        )
        ExpenseSplit.objects.create(expense=self.expense2, user=self.user1, amount=Decimal('1000.00'))
        ExpenseSplit.objects.create(expense=self.expense2, user=self.user2, amount=Decimal('1000.00'))

        # Friend Ledger setup
        self.account = MoneyAccountService.create_account(
            manager=self.user1,
            title='Rahul Ledger',
            owner_name='Rahul',
            owner_email='rahul@example.com'
        )
        MoneyAccountService.add_transaction(
            account_id=self.account.id,
            created_by=self.user1,
            transaction_type='DEPOSIT',
            amount='5000.00',
            description='Initial Fund'
        )
        self.tx_expense = MoneyAccountService.add_transaction(
            account_id=self.account.id,
            created_by=self.user1,
            transaction_type='EXPENSE',
            amount='700.00',
            description='Ledger Expense'
        )
        # Voided transaction
        self.tx_void = MoneyAccountService.add_transaction(
            account_id=self.account.id,
            created_by=self.user1,
            transaction_type='EXPENSE',
            amount='300.00',
            description='Voided Ledger Expense'
        )
        MoneyAccountService.void_transaction(
            transaction_id=self.tx_void.id,
            voided_by=self.user1,
            void_reason='Test void'
        )

    def test_dashboard_report_service(self):
        data = ReportService.get_dashboard_analytics(self.user1)
        self.assertEqual(Decimal(data['personal_expenses_share']), Decimal('1500.00')) # 500 + 1000
        self.assertEqual(Decimal(data['total_paid_out_of_pocket']), Decimal('1000.00')) # Paid 1000
        self.assertEqual(data['friend_ledger_summary']['managed_accounts_count'], 1)
        self.assertEqual(Decimal(data['friend_ledger_summary']['total_deposits']), Decimal('5000.00'))
        self.assertEqual(Decimal(data['friend_ledger_summary']['total_expenses']), Decimal('700.00')) # Excludes 300 voided
        self.assertEqual(Decimal(data['friend_ledger_summary']['total_balance']), Decimal('4300.00'))

    def test_dashboard_report_api_unauthorized(self):
        res = self.client.get('/api/v1/reports/dashboard/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_dashboard_report_api_success(self):
        self.client.force_authenticate(user=self.user1)
        res = self.client.get('/api/v1/reports/dashboard/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('personal_expenses_share', res.data)
        self.assertEqual(Decimal(res.data['personal_expenses_share']), Decimal('1500.00'))

    def test_expense_report_api_filters_and_totals(self):
        self.client.force_authenticate(user=self.user1)
        res = self.client.get('/api/v1/reports/expenses/?start_date=2026-10-01&end_date=2026-10-31')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(res.data['total_user_share']), Decimal('1500.00'))
        self.assertEqual(Decimal(res.data['total_user_paid']), Decimal('1000.00'))

    def test_invalid_date_range_rejection(self):
        self.client.force_authenticate(user=self.user1)
        res = self.client.get('/api/v1/reports/expenses/?start_date=2026-10-31&end_date=2026-10-01')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_group_report_api_membership_permission(self):
        # Unrelated user denied access to group report
        self.client.force_authenticate(user=self.unrelated_user)
        res = self.client.get(f'/api/v1/reports/groups/{self.group.id}/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Member allowed access
        self.client.force_authenticate(user=self.user1)
        res_member = self.client.get(f'/api/v1/reports/groups/{self.group.id}/')
        self.assertEqual(res_member.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(res_member.data['total_group_expenses']), Decimal('3000.00')) # 1000 + 2000
        self.assertEqual(len(res_member.data['member_stats']), 2)

    def test_money_accounts_report_api(self):
        self.client.force_authenticate(user=self.user1)
        res = self.client.get('/api/v1/reports/money-accounts/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['managed_accounts_count'], 1)
        self.assertEqual(Decimal(res.data['total_deposits']), Decimal('5000.00'))
        self.assertEqual(Decimal(res.data['total_expenses']), Decimal('700.00'))
        self.assertEqual(Decimal(res.data['total_balance']), Decimal('4300.00'))

    def test_empty_dataset_handling(self):
        self.client.force_authenticate(user=self.unrelated_user)
        res = self.client.get('/api/v1/reports/dashboard/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(res.data['personal_expenses_share']), Decimal('0.00'))
        self.assertEqual(Decimal(res.data['available_balance']), Decimal('0.00'))
        self.assertEqual(Decimal(res.data['money_received']), Decimal('0.00'))
        self.assertEqual(res.data['received_count'], 0)
        self.assertEqual(Decimal(res.data['total_expenses_share']), Decimal('0.00'))
        self.assertEqual(res.data['expenses_count'], 0)
        self.assertEqual(Decimal(res.data['pending_settlements_amount']), Decimal('0.00'))
        self.assertEqual(res.data['pending_settlements_count'], 0)
        self.assertEqual(len(res.data['category_breakdown']), 0)

    def test_dashboard_summary_cards_calculations_and_api(self):
        self.client.force_authenticate(user=self.user1)
        res = self.client.get('/api/v1/reports/dashboard/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Available Balance: user1 paid 1000, share is 1500 -> owes 500
        self.assertEqual(Decimal(res.data['available_balance']), Decimal('-500.00'))

        # Money Received: initially 0
        self.assertEqual(Decimal(res.data['money_received']), Decimal('0.00'))
        self.assertEqual(res.data['received_count'], 0)

        # Total Expenses: assigned shares 500 + 1000 = 1500
        self.assertEqual(Decimal(res.data['total_expenses_share']), Decimal('1500.00'))
        self.assertEqual(res.data['expenses_count'], 2)

        # Pending Settlements: outstanding debt to be cleared is 500
        self.assertEqual(Decimal(res.data['pending_settlements_amount']), Decimal('500.00'))
        self.assertEqual(res.data['pending_settlements_count'], 0)

    def test_dashboard_money_received_from_direct_payment_and_settlement(self):
        # 1. DirectPayment received by user1 (200.00)
        DirectPayment.objects.create(
            sender=self.user2,
            receiver=self.user1,
            group=self.group,
            amount=Decimal('200.00'),
            date=date(2026, 10, 6)
        )

        # 2. Completed Settlement received by user1 (300.00)
        Settlement.objects.create(
            sender=self.user2,
            receiver=self.user1,
            group=self.group,
            amount=Decimal('300.00'),
            status='COMPLETED',
            created_by=self.user2,
            date=date(2026, 10, 7)
        )

        # 3. PENDING and CANCELLED settlements should NOT be counted in money_received
        Settlement.objects.create(
            sender=self.user2,
            receiver=self.user1,
            group=self.group,
            amount=Decimal('100.00'),
            status='PENDING',
            created_by=self.user2,
            date=date(2026, 10, 8)
        )
        Settlement.objects.create(
            sender=self.user2,
            receiver=self.user1,
            group=self.group,
            amount=Decimal('50.00'),
            status='CANCELLED',
            created_by=self.user2,
            date=date(2026, 10, 9)
        )

        self.client.force_authenticate(user=self.user1)
        res = self.client.get('/api/v1/reports/dashboard/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Money Received should sum DirectPayment (200) + COMPLETED Settlement (300) = 500.00, count = 2
        self.assertEqual(Decimal(res.data['money_received']), Decimal('500.00'))
        self.assertEqual(res.data['received_count'], 2)

        # Pending settlements count includes the 1 PENDING settlement
        self.assertEqual(res.data['pending_settlements_count'], 1)

    def test_dashboard_expense_count_matches_user_share_only(self):
        # Create an expense in the group where user1 is NOT in splits (only user2 has share)
        exp_solo = Expense.objects.create(
            description='Solo User2 Snack',
            total_amount=Decimal('150.00'),
            paid_by=self.user2,
            created_by=self.user2,
            group=self.group,
            category=self.cat_food,
            split_type='EXACT',
            date=date(2026, 10, 10)
        )
        ExpenseSplit.objects.create(expense=exp_solo, user=self.user2, amount=Decimal('150.00'))

        self.client.force_authenticate(user=self.user1)
        res = self.client.get('/api/v1/reports/dashboard/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Even though there are 3 group expenses, user1 only has shares in 2 of them!
        self.assertEqual(Decimal(res.data['total_expenses_share']), Decimal('1500.00'))
        self.assertEqual(res.data['expenses_count'], 2)

    def test_dashboard_pending_settlement_isolation_across_groups_and_users(self):
        # Create another group and another settlement between unrelated users
        other_group = Group.objects.create(name='Other Roommates', created_by=self.unrelated_user)
        other_user = User.objects.create_user(username='other_u', email='other_u@example.com', password='Password123!')
        GroupMember.objects.create(group=other_group, user=self.unrelated_user, role='ADMIN')
        GroupMember.objects.create(group=other_group, user=other_user, role='MEMBER')

        Settlement.objects.create(
            sender=self.unrelated_user,
            receiver=other_user,
            group=other_group,
            amount=Decimal('999.00'),
            status='PENDING',
            created_by=self.unrelated_user,
            date=date(2026, 10, 10)
        )

        # user1 should not see other_group's pending settlement
        self.client.force_authenticate(user=self.user1)
        res = self.client.get('/api/v1/reports/dashboard/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['pending_settlements_count'], 0)
        self.assertEqual(Decimal(res.data['pending_settlements_amount']), Decimal('500.00'))


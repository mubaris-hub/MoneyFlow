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


class Phase4BalancesAndSettlementTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.u1 = User.objects.create_user(email="u1@example.com", username="u1", password="Password123!", first_name="Rahul")
        self.u2 = User.objects.create_user(email="u2@example.com", username="u2", password="Password123!", first_name="Akhil")
        self.u3 = User.objects.create_user(email="u3@example.com", username="u3", password="Password123!", first_name="Mohammed")
        self.u4 = User.objects.create_user(email="u4@example.com", username="u4", password="Password123!", first_name="Jiyas")
        self.stranger = User.objects.create_user(email="stranger@example.com", username="stranger", password="Password123!", first_name="Stranger")

        self.group = Group.objects.create(name="Phase 4 Test Group", created_by=self.u1)
        GroupMember.objects.create(group=self.group, user=self.u1, role='ADMIN')
        GroupMember.objects.create(group=self.group, user=self.u2, role='MEMBER')
        GroupMember.objects.create(group=self.group, user=self.u3, role='MEMBER')
        GroupMember.objects.create(group=self.group, user=self.u4, role='MEMBER')

        self.category = Category.objects.get(id=1)

    def test_scenarios_a_c_n_two_person_equal_split(self):
        e = Expense.objects.create(
            description="Dinner for 2",
            total_amount=Decimal('100.00'),
            paid_by=self.u1,
            created_by=self.u1,
            group=self.group,
            category=self.category,
            split_type='EQUAL'
        )
        ExpenseSplit.objects.create(expense=e, user=self.u1, amount=Decimal('50.00'))
        ExpenseSplit.objects.create(expense=e, user=self.u2, amount=Decimal('50.00'))

        from .services import calculate_group_balances
        balances = calculate_group_balances(self.group)
        b1 = next(b for b in balances if b['user_id'] == self.u1.id)
        b2 = next(b for b in balances if b['user_id'] == self.u2.id)

        self.assertEqual(b1['net_balance'], Decimal('50.00'))
        self.assertEqual(b1['status'], 'GETS_BACK')
        self.assertEqual(b2['net_balance'], Decimal('-50.00'))
        self.assertEqual(b2['status'], 'OWES')

        total_sum = sum(b['net_balance'] for b in balances)
        self.assertEqual(total_sum, Decimal('0.00'))

    def test_scenarios_b_d_e_f_three_person_splits(self):
        e1 = Expense.objects.create(
            description="Hotel Exact",
            total_amount=Decimal('300.00'),
            paid_by=self.u1,
            created_by=self.u1,
            group=self.group,
            category=self.category,
            split_type='EXACT'
        )
        ExpenseSplit.objects.create(expense=e1, user=self.u1, amount=Decimal('150.00'))
        ExpenseSplit.objects.create(expense=e1, user=self.u2, amount=Decimal('100.00'))
        ExpenseSplit.objects.create(expense=e1, user=self.u3, amount=Decimal('50.00'))

        e2 = Expense.objects.create(
            description="Lunch Percentage",
            total_amount=Decimal('100.00'),
            paid_by=self.u2,
            created_by=self.u2,
            group=self.group,
            category=self.category,
            split_type='PERCENTAGE'
        )
        ExpenseSplit.objects.create(expense=e2, user=self.u1, amount=Decimal('50.00'), percentage=Decimal('50.00'))
        ExpenseSplit.objects.create(expense=e2, user=self.u2, amount=Decimal('30.00'), percentage=Decimal('30.00'))
        ExpenseSplit.objects.create(expense=e2, user=self.u3, amount=Decimal('20.00'), percentage=Decimal('20.00'))

        from .services import calculate_group_balances
        balances = calculate_group_balances(self.group)
        b1 = next(b for b in balances if b['user_id'] == self.u1.id)
        b2 = next(b for b in balances if b['user_id'] == self.u2.id)
        b3 = next(b for b in balances if b['user_id'] == self.u3.id)

        self.assertEqual(b1['net_balance'], Decimal('100.00'))
        self.assertEqual(b2['net_balance'], Decimal('-30.00'))
        self.assertEqual(b3['net_balance'], Decimal('-70.00'))

        total_sum = sum(b['net_balance'] for b in balances)
        self.assertEqual(total_sum, Decimal('0.00'))

    def test_scenario_g_direct_payment_affects_balance(self):
        e = Expense.objects.create(
            description="Coffee",
            total_amount=Decimal('100.00'),
            paid_by=self.u1,
            created_by=self.u1,
            group=self.group,
            category=self.category,
            split_type='EQUAL'
        )
        ExpenseSplit.objects.create(expense=e, user=self.u1, amount=Decimal('50.00'))
        ExpenseSplit.objects.create(expense=e, user=self.u2, amount=Decimal('50.00'))

        DirectPayment.objects.create(
            sender=self.u2,
            receiver=self.u1,
            amount=Decimal('20.00'),
            group=self.group
        )

        from .services import calculate_group_balances
        balances = calculate_group_balances(self.group)
        b1 = next(b for b in balances if b['user_id'] == self.u1.id)
        b2 = next(b for b in balances if b['user_id'] == self.u2.id)

        self.assertEqual(b1['net_balance'], Decimal('30.00'))
        self.assertEqual(b2['net_balance'], Decimal('-30.00'))

    def test_scenarios_h_i_j_k_settlement_lifecycles(self):
        e = Expense.objects.create(
            description="Uber",
            total_amount=Decimal('100.00'),
            paid_by=self.u1,
            created_by=self.u1,
            group=self.group,
            category=self.category,
            split_type='EQUAL'
        )
        ExpenseSplit.objects.create(expense=e, user=self.u1, amount=Decimal('50.00'))
        ExpenseSplit.objects.create(expense=e, user=self.u2, amount=Decimal('50.00'))

        from .models import Settlement
        from .services import calculate_group_balances

        # PENDING
        s_pending = Settlement.objects.create(
            group=self.group,
            sender=self.u2,
            receiver=self.u1,
            amount=Decimal('30.00'),
            status='PENDING',
            created_by=self.u2
        )
        balances1 = calculate_group_balances(self.group)
        b2_pending = next(b for b in balances1 if b['user_id'] == self.u2.id)
        self.assertEqual(b2_pending['net_balance'], Decimal('-50.00'))

        # COMPLETED
        s_pending.status = 'COMPLETED'
        s_pending.save()
        balances2 = calculate_group_balances(self.group)
        b2_completed = next(b for b in balances2 if b['user_id'] == self.u2.id)
        self.assertEqual(b2_completed['net_balance'], Decimal('-20.00'))

        # CANCELLED
        s_pending.status = 'CANCELLED'
        s_pending.save()
        balances3 = calculate_group_balances(self.group)
        b2_cancelled = next(b for b in balances3 if b['user_id'] == self.u2.id)
        self.assertEqual(b2_cancelled['net_balance'], Decimal('-50.00'))

    def test_scenario_l_m_complex_debt_simplification_and_rounding(self):
        from .services import calculate_debt_simplification
        member_balances = [
            {'user_id': self.u1.id, 'user': self.u1, 'net_balance': Decimal('500.00')},
            {'user_id': self.u2.id, 'user': self.u2, 'net_balance': Decimal('200.00')},
            {'user_id': self.u3.id, 'user': self.u3, 'net_balance': Decimal('-450.00')},
            {'user_id': self.u4.id, 'user': self.u4, 'net_balance': Decimal('-250.00')},
        ]
        suggested = calculate_debt_simplification(member_balances)
        self.assertEqual(len(suggested), 3)

        self.assertEqual(suggested[0]['sender_id'], str(self.u3.id))
        self.assertEqual(suggested[0]['receiver_id'], str(self.u1.id))
        self.assertEqual(suggested[0]['amount'], Decimal('450.00'))

        self.assertEqual(suggested[1]['sender_id'], str(self.u4.id))
        self.assertEqual(suggested[1]['receiver_id'], str(self.u1.id))
        self.assertEqual(suggested[1]['amount'], Decimal('50.00'))

        self.assertEqual(suggested[2]['sender_id'], str(self.u4.id))
        self.assertEqual(suggested[2]['receiver_id'], str(self.u2.id))
        self.assertEqual(suggested[2]['amount'], Decimal('200.00'))

    def test_scenario_o_self_settlement_rejected(self):
        self.client.force_authenticate(user=self.u1)
        url = reverse('group_settlements', kwargs={'group_id': self.group.id})
        payload = {
            "sender_id": str(self.u1.id),
            "receiver_id": str(self.u1.id),
            "amount": "50.00"
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('receiver_id', res.data)

    def test_scenario_p_non_member_settlement_rejected(self):
        self.client.force_authenticate(user=self.u1)
        url = reverse('group_settlements', kwargs={'group_id': self.group.id})
        payload = {
            "sender_id": str(self.u1.id),
            "receiver_id": str(self.stranger.id),
            "amount": "50.00"
        }
        res = self.client.post(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('receiver_id', res.data)

    def test_scenario_q_unauthorized_settlement_modification_rejected(self):
        from .models import Settlement
        s = Settlement.objects.create(
            group=self.group,
            sender=self.u1,
            receiver=self.u2,
            amount=Decimal('50.00'),
            status='PENDING',
            created_by=self.u1
        )
        url = reverse('settlement_detail', kwargs={'pk': s.id})

        self.client.force_authenticate(user=self.stranger)
        res = self.client.put(url, {'status': 'COMPLETED'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_scenario_r_soft_deleted_expenses_excluded(self):
        e = Expense.objects.create(
            description="Deleted Expense",
            total_amount=Decimal('100.00'),
            paid_by=self.u1,
            created_by=self.u1,
            group=self.group,
            category=self.category,
            split_type='EQUAL',
            is_deleted=True
        )
        ExpenseSplit.objects.create(expense=e, user=self.u1, amount=Decimal('50.00'))
        ExpenseSplit.objects.create(expense=e, user=self.u2, amount=Decimal('50.00'))

        from .services import calculate_group_balances
        balances = calculate_group_balances(self.group)
        b1 = next(b for b in balances if b['user_id'] == self.u1.id)
        b2 = next(b for b in balances if b['user_id'] == self.u2.id)

        self.assertEqual(b1['net_balance'], Decimal('0.00'))
        self.assertEqual(b2['net_balance'], Decimal('0.00'))


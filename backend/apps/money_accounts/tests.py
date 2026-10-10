import threading
from decimal import Decimal
from django.test import TestCase, TransactionTestCase
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import OperationalError
from django.utils import timezone
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status

from apps.money_accounts.models import (
    MoneyAccount,
    AccountTransaction,
    AccountInvitation,
    AccountAuditLog
)
from apps.money_accounts.services import MoneyAccountService

User = get_user_model()


class MoneyAccountServiceTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(
            username="manager_user",
            email="manager@example.com",
            password="Password123!"
        )
        self.owner = User.objects.create_user(
            username="owner_user",
            email="owner@example.com",
            password="Password123!"
        )
        self.stranger = User.objects.create_user(
            username="stranger_user",
            email="stranger@example.com",
            password="Password123!"
        )

    def test_account_creation(self):
        account = MoneyAccountService.create_account(
            manager=self.manager,
            title="Rahul's Trip Fund",
            owner_name="Rahul",
            owner_email="owner@example.com",
            owner=self.owner,
            allow_overdraft=False,
            notes="Initial trip pool"
        )
        self.assertEqual(account.manager, self.manager)
        self.assertEqual(account.owner, self.owner)
        self.assertEqual(account.title, "Rahul's Trip Fund")
        self.assertEqual(account.status, "ACTIVE")
        self.assertFalse(account.allow_overdraft)

        # Audit log creation verification
        audit = AccountAuditLog.objects.filter(account=account, action="ACCOUNT_CREATED").first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.actor, self.manager)

    def test_manager_and_owner_relationship_constraints(self):
        # Manager cannot be owner of their own custodial account
        with self.assertRaises(ValidationError):
            MoneyAccountService.create_account(
                manager=self.manager,
                title="Self Managed",
                owner_name="Manager",
                owner_email="manager@example.com",
                owner=self.manager
            )

    def test_deposit_transaction(self):
        account = MoneyAccountService.create_account(
            manager=self.manager, title="Fund", owner_name="Rahul", owner_email="owner@example.com"
        )
        tx = MoneyAccountService.add_transaction(
            account_id=account.id,
            created_by=self.manager,
            transaction_type="DEPOSIT",
            amount=Decimal("5000.00"),
            description="Initial Deposit"
        )
        self.assertEqual(tx.amount, Decimal("5000.00"))
        stats = MoneyAccountService.calculate_balance(account)
        self.assertEqual(stats["balance"], Decimal("5000.00"))
        self.assertEqual(stats["total_deposits"], Decimal("5000.00"))

        # Audit log check
        audit = AccountAuditLog.objects.filter(account=account, action="TRANSACTION_CREATED").first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.details["transaction_type"], "DEPOSIT")

    def test_expense_transaction(self):
        account = MoneyAccountService.create_account(
            manager=self.manager, title="Fund", owner_name="Rahul", owner_email="owner@example.com"
        )
        MoneyAccountService.add_transaction(
            account_id=account.id, created_by=self.manager, transaction_type="DEPOSIT", amount="5000.00", description="Deposit"
        )
        tx_exp = MoneyAccountService.add_transaction(
            account_id=account.id, created_by=self.manager, transaction_type="EXPENSE", amount="700.00", description="Hotel"
        )
        self.assertEqual(tx_exp.amount, Decimal("700.00"))
        stats = MoneyAccountService.calculate_balance(account)
        self.assertEqual(stats["balance"], Decimal("4300.00"))
        self.assertEqual(stats["total_expenses"], Decimal("700.00"))

    def test_refund_decreases_balance(self):
        account = MoneyAccountService.create_account(
            manager=self.manager, title="Fund", owner_name="Rahul", owner_email="owner@example.com"
        )
        MoneyAccountService.add_transaction(
            account_id=account.id, created_by=self.manager, transaction_type="DEPOSIT", amount="5000.00", description="Deposit"
        )
        # Refund 1000 back to owner
        tx_ref = MoneyAccountService.add_transaction(
            account_id=account.id, created_by=self.manager, transaction_type="REFUND", amount="1000.00", description="Returned to owner"
        )
        self.assertEqual(tx_ref.amount, Decimal("1000.00"))
        stats = MoneyAccountService.calculate_balance(account)
        # 5000 - 1000 = 4000
        self.assertEqual(stats["balance"], Decimal("4000.00"))
        self.assertEqual(stats["total_refunds"], Decimal("1000.00"))

    def test_positive_and_negative_adjustments(self):
        account = MoneyAccountService.create_account(
            manager=self.manager, title="Fund", owner_name="Rahul", owner_email="owner@example.com"
        )
        MoneyAccountService.add_transaction(
            account_id=account.id, created_by=self.manager, transaction_type="DEPOSIT", amount="1000.00", description="Deposit"
        )
        # Positive adjustment
        MoneyAccountService.add_transaction(
            account_id=account.id, created_by=self.manager, transaction_type="ADJUSTMENT", amount="150.00", description="Found bonus", notes="Correcting missing cash"
        )
        stats = MoneyAccountService.calculate_balance(account)
        self.assertEqual(stats["balance"], Decimal("1150.00"))

        # Negative adjustment
        MoneyAccountService.add_transaction(
            account_id=account.id, created_by=self.manager, transaction_type="ADJUSTMENT", amount="-50.00", description="Bank fee deduction", notes="Service charge adjustment"
        )
        stats = MoneyAccountService.calculate_balance(account)
        self.assertEqual(stats["balance"], Decimal("1100.00"))

        # Adjustment requires notes/reason
        with self.assertRaises(ValidationError):
            MoneyAccountService.add_transaction(
                account_id=account.id, created_by=self.manager, transaction_type="ADJUSTMENT", amount="20.00", description="No notes", notes=""
            )

    def test_exact_balance_calculation_and_decimal_precision(self):
        account = MoneyAccountService.create_account(
            manager=self.manager, title="Precision Test", owner_name="Rahul", owner_email="owner@example.com"
        )
        MoneyAccountService.add_transaction(
            account_id=account.id, created_by=self.manager, transaction_type="DEPOSIT", amount="5000.55", description="Deposit"
        )
        MoneyAccountService.add_transaction(
            account_id=account.id, created_by=self.manager, transaction_type="EXPENSE", amount="700.33", description="Item 1"
        )
        MoneyAccountService.add_transaction(
            account_id=account.id, created_by=self.manager, transaction_type="EXPENSE", amount="500.11", description="Item 2"
        )
        MoneyAccountService.add_transaction(
            account_id=account.id, created_by=self.manager, transaction_type="REFUND", amount="300.05", description="Refund"
        )
        MoneyAccountService.add_transaction(
            account_id=account.id, created_by=self.manager, transaction_type="ADJUSTMENT", amount="-0.06", description="Adjustment", notes="Round off fix"
        )

        stats = MoneyAccountService.calculate_balance(account)
        # Expected: 5000.55 - 700.33 - 500.11 - 300.05 - 0.06 = 3500.00
        self.assertEqual(stats["balance"], Decimal("3500.00"))
        self.assertIsInstance(stats["balance"], Decimal)

    def test_voided_transactions_excluded_from_balance(self):
        account = MoneyAccountService.create_account(
            manager=self.manager, title="Void Test", owner_name="Rahul", owner_email="owner@example.com"
        )
        MoneyAccountService.add_transaction(
            account_id=account.id, created_by=self.manager, transaction_type="DEPOSIT", amount="5000.00", description="Deposit"
        )
        tx_exp = MoneyAccountService.add_transaction(
            account_id=account.id, created_by=self.manager, transaction_type="EXPENSE", amount="1000.00", description="Wrong Expense"
        )
        self.assertEqual(MoneyAccountService.calculate_balance(account)["balance"], Decimal("4000.00"))

        # Void the expense
        MoneyAccountService.void_transaction(
            transaction_id=tx_exp.id, voided_by=self.manager, void_reason="Entered by mistake"
        )

        # Balance should restore to 5000.00
        stats = MoneyAccountService.calculate_balance(account)
        self.assertEqual(stats["balance"], Decimal("5000.00"))

        tx_exp.refresh_from_db()
        self.assertTrue(tx_exp.is_voided)

        # Audit log creation check
        audit = AccountAuditLog.objects.filter(account=account, action="TRANSACTION_VOIDED").first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.details["void_reason"], "Entered by mistake")

    def test_overdraft_rejection_when_disallowed(self):
        account = MoneyAccountService.create_account(
            manager=self.manager, title="Strict Fund", owner_name="Rahul", owner_email="owner@example.com", allow_overdraft=False
        )
        MoneyAccountService.add_transaction(
            account_id=account.id, created_by=self.manager, transaction_type="DEPOSIT", amount="1000.00", description="Deposit"
        )
        # Attempt expense of 1500 when balance is 1000
        with self.assertRaises(ValidationError) as cm:
            MoneyAccountService.add_transaction(
                account_id=account.id, created_by=self.manager, transaction_type="EXPENSE", amount="1500.00", description="Too large"
            )
        self.assertIn("exceeds available balance", str(cm.exception))

    def test_overdraft_allowed_when_enabled(self):
        account = MoneyAccountService.create_account(
            manager=self.manager, title="Overdraft Fund", owner_name="Rahul", owner_email="owner@example.com", allow_overdraft=True
        )
        MoneyAccountService.add_transaction(
            account_id=account.id, created_by=self.manager, transaction_type="DEPOSIT", amount="1000.00", description="Deposit"
        )
        # Expense of 1500 allowed when allow_overdraft=True
        MoneyAccountService.add_transaction(
            account_id=account.id, created_by=self.manager, transaction_type="EXPENSE", amount="1500.00", description="Overdraft expense"
        )
        stats = MoneyAccountService.calculate_balance(account)
        self.assertEqual(stats["balance"], Decimal("-500.00"))

    def test_zero_balance_closure_and_non_zero_rejection(self):
        account = MoneyAccountService.create_account(
            manager=self.manager, title="Closure Test", owner_name="Rahul", owner_email="owner@example.com"
        )
        MoneyAccountService.add_transaction(
            account_id=account.id, created_by=self.manager, transaction_type="DEPOSIT", amount="1000.00", description="Deposit"
        )

        # Attempt to close while balance is 1000
        with self.assertRaises(ValidationError) as cm:
            MoneyAccountService.close_account(account_id=account.id, manager=self.manager)
        self.assertIn("Cannot close account with non-zero balance", str(cm.exception))

        # Return full 1000 via refund
        MoneyAccountService.add_transaction(
            account_id=account.id, created_by=self.manager, transaction_type="REFUND", amount="1000.00", description="Final settlement refund"
        )
        self.assertEqual(MoneyAccountService.calculate_balance(account)["balance"], Decimal("0.00"))

        # Now close account
        closed_acc = MoneyAccountService.close_account(account_id=account.id, manager=self.manager)
        self.assertEqual(closed_acc.status, "CLOSED")
        self.assertIsNotNone(closed_acc.closed_at)

        # Audit log verify
        audit = AccountAuditLog.objects.filter(account=account, action="ACCOUNT_CLOSED").first()
        self.assertIsNotNone(audit)

    def test_manager_ownership_and_permission_enforcement(self):
        account = MoneyAccountService.create_account(
            manager=self.manager, title="Ownership Test", owner_name="Rahul", owner_email="owner@example.com"
        )
        # Non-manager (stranger) cannot add transactions
        with self.assertRaises(ValidationError) as cm:
            MoneyAccountService.add_transaction(
                account_id=account.id, created_by=self.stranger, transaction_type="DEPOSIT", amount="500.00", description="Unauthorized"
            )
        self.assertIn("Only the account manager", str(cm.exception))

        # Non-manager cannot close account
        with self.assertRaises(ValidationError) as cm:
            MoneyAccountService.close_account(account_id=account.id, manager=self.stranger)
        self.assertIn("Only the account manager", str(cm.exception))

    def test_invitation_lifecycle_secure_token_and_response(self):
        account = MoneyAccountService.create_account(
            manager=self.manager, title="Invite Test", owner_name="Owner", owner_email="owner@example.com"
        )
        self.assertEqual(account.status, "DRAFT")

        # Create invitation
        inv = MoneyAccountService.create_invitation(account_id=account.id, sender=self.manager)
        account.refresh_from_db()
        self.assertEqual(account.status, "INVITED")
        self.assertEqual(inv.status, "PENDING")
        self.assertTrue(len(inv.token) > 20)

        # Wrong user attempts to accept -> ValidationError
        with self.assertRaises(ValidationError):
            MoneyAccountService.respond_invitation(token=inv.token, user=self.stranger, accept=True)

        # Rejection by owner -> status returns to DRAFT
        MoneyAccountService.respond_invitation(token=inv.token, user=self.owner, accept=False)
        account.refresh_from_db()
        self.assertEqual(account.status, "DRAFT")

        # Create new invitation and accept -> status becomes ACTIVE and owner set
        inv2 = MoneyAccountService.create_invitation(account_id=account.id, sender=self.manager)
        MoneyAccountService.respond_invitation(token=inv2.token, user=self.owner, accept=True)
        account.refresh_from_db()
        self.assertEqual(account.status, "ACTIVE")
        self.assertEqual(account.owner, self.owner)


class MoneyAccountConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.manager = User.objects.create_user(
            username="concurrent_mgr", email="mgr@example.com", password="Password123!"
        )

    def test_concurrent_transactions_prevent_overdraft(self):
        account = MoneyAccountService.create_account(
            manager=self.manager, title="Concurrent Test", owner_name="Rahul", owner_email="rahul@example.com", allow_overdraft=False
        )
        MoneyAccountService.add_transaction(
            account_id=account.id, created_by=self.manager, transaction_type="DEPOSIT", amount="100.00", description="Initial 100"
        )

        errors = []

        def attempt_expense():
            try:
                MoneyAccountService.add_transaction(
                    account_id=account.id, created_by=self.manager, transaction_type="EXPENSE", amount="80.00", description="Expense 80"
                )
            except Exception as e:
                errors.append(e)

        t1 = threading.Thread(target=attempt_expense)
        t2 = threading.Thread(target=attempt_expense)

        t1.start()
        t2.start()
        t1.join()
        t2.join()

        # One transaction of 80 should succeed, reducing balance to 20. The second 80 expense must fail with ValidationError or DB locking error.
        self.assertGreaterEqual(len(errors), 1)
        self.assertTrue(isinstance(errors[0], (ValidationError, OperationalError)))

        stats = MoneyAccountService.calculate_balance(account)
        self.assertGreaterEqual(stats["balance"], Decimal("0.00"))


class MoneyAccountAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.manager = User.objects.create_user(
            username="api_manager", email="api_mgr@example.com", password="Password123!"
        )
        self.owner = User.objects.create_user(
            username="api_owner", email="api_owner@example.com", password="Password123!"
        )
        self.stranger = User.objects.create_user(
            username="api_stranger", email="api_stranger@example.com", password="Password123!"
        )
        
        self.list_create_url = reverse('money_account_list_create')

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    # A. Manager account creation
    def test_a_manager_account_creation(self):
        self.authenticate(self.manager)
        payload = {
            "title": "API Test Fund",
            "owner_name": "API Owner",
            "owner_email": "api_owner@example.com",
            "currency": "INR",
            "allow_overdraft": False
        }
        res = self.client.post(self.list_create_url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['title'], "API Test Fund")
        self.assertEqual(res.data['manager']['username'], "api_manager")

    # B. Account listing
    def test_b_account_listing(self):
        acc = MoneyAccountService.create_account(
            manager=self.manager, title="Fund 1", owner_name="Owner", owner_email="api_owner@example.com", owner=self.owner
        )
        # Manager list view
        self.authenticate(self.manager)
        res = self.client.get(self.list_create_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)

        # Owner list view
        self.authenticate(self.owner)
        res_owner = self.client.get(self.list_create_url)
        self.assertEqual(res_owner.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_owner.data), 1)

        # Stranger list view (should be empty)
        self.authenticate(self.stranger)
        res_stranger = self.client.get(self.list_create_url)
        self.assertEqual(res_stranger.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_stranger.data), 0)

    # C. Manager account retrieval & D. Owner account retrieval & E. Unauthorized retrieval
    def test_c_d_e_account_retrieval_permissions(self):
        acc = MoneyAccountService.create_account(
            manager=self.manager, title="Retrieval Fund", owner_name="Owner", owner_email="api_owner@example.com", owner=self.owner
        )
        url = reverse('money_account_detail', kwargs={'pk': acc.id})

        # C. Manager retrieval
        self.authenticate(self.manager)
        res_mgr = self.client.get(url)
        self.assertEqual(res_mgr.status_code, status.HTTP_200_OK)
        self.assertEqual(res_mgr.data['id'], str(acc.id))

        # D. Owner retrieval
        self.authenticate(self.owner)
        res_own = self.client.get(url)
        self.assertEqual(res_own.status_code, status.HTTP_200_OK)

        # E. Unauthorized retrieval (Stranger)
        self.authenticate(self.stranger)
        res_str = self.client.get(url)
        self.assertEqual(res_str.status_code, status.HTTP_403_FORBIDDEN)

    # F. Manager PATCH & G. Owner PATCH rejection
    def test_f_g_patch_permissions(self):
        acc = MoneyAccountService.create_account(
            manager=self.manager, title="Old Title", owner_name="Owner", owner_email="api_owner@example.com", owner=self.owner
        )
        url = reverse('money_account_detail', kwargs={'pk': acc.id})

        # G. Owner PATCH -> 403
        self.authenticate(self.owner)
        res_own = self.client.patch(url, {'title': 'Hacked Title'}, format='json')
        self.assertEqual(res_own.status_code, status.HTTP_403_FORBIDDEN)

        # F. Manager PATCH -> 200
        self.authenticate(self.manager)
        res_mgr = self.client.patch(url, {'title': 'New Title'}, format='json')
        self.assertEqual(res_mgr.status_code, status.HTTP_200_OK)
        self.assertEqual(res_mgr.data['title'], 'New Title')

    # H. Deposit, I. Expense, J. Refund, K. Positive Adj, L. Negative Adj via API
    def test_h_to_l_transaction_apis(self):
        acc = MoneyAccountService.create_account(
            manager=self.manager, title="Tx API Fund", owner_name="Owner", owner_email="api_owner@example.com", owner=self.owner
        )
        url = reverse('money_account_transaction_list_create', kwargs={'pk': acc.id})

        self.authenticate(self.manager)

        # H. Deposit 5000
        res_dep = self.client.post(url, {'transaction_type': 'DEPOSIT', 'amount': '5000.00', 'description': 'Dep'}, format='json')
        self.assertEqual(res_dep.status_code, status.HTTP_201_CREATED)

        # I. Expense 700
        res_exp = self.client.post(url, {'transaction_type': 'EXPENSE', 'amount': '700.00', 'description': 'Exp'}, format='json')
        self.assertEqual(res_exp.status_code, status.HTTP_201_CREATED)

        # J. Refund 300
        res_ref = self.client.post(url, {'transaction_type': 'REFUND', 'amount': '300.00', 'description': 'Ref'}, format='json')
        self.assertEqual(res_ref.status_code, status.HTTP_201_CREATED)

        # K. Positive Adj 100
        res_pos_adj = self.client.post(url, {'transaction_type': 'ADJUSTMENT', 'amount': '100.00', 'description': 'Pos', 'notes': 'Bonus'}, format='json')
        self.assertEqual(res_pos_adj.status_code, status.HTTP_201_CREATED)

        # L. Negative Adj -50
        res_neg_adj = self.client.post(url, {'transaction_type': 'ADJUSTMENT', 'amount': '-50.00', 'description': 'Neg', 'notes': 'Fee'}, format='json')
        self.assertEqual(res_neg_adj.status_code, status.HTTP_201_CREATED)

        # Verify balance via detail API
        detail_url = reverse('money_account_detail', kwargs={'pk': acc.id})
        res_detail = self.client.get(detail_url)
        # Expected balance: 5000 - 700 - 300 + 100 - 50 = 4050.00
        self.assertEqual(Decimal(res_detail.data['balance_summary']['balance']), Decimal('4050.00'))

    # M. Transaction listing & N. Filtering
    def test_m_n_transaction_listing_and_filtering(self):
        acc = MoneyAccountService.create_account(
            manager=self.manager, title="Filter Fund", owner_name="Owner", owner_email="api_owner@example.com", owner=self.owner
        )
        tx1 = MoneyAccountService.add_transaction(acc.id, self.manager, 'DEPOSIT', '1000.00', 'Dep 1')
        tx2 = MoneyAccountService.add_transaction(acc.id, self.manager, 'EXPENSE', '200.00', 'Exp 1')

        url = reverse('money_account_transaction_list_create', kwargs={'pk': acc.id})
        
        # Owner can view list
        self.authenticate(self.owner)
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 2)

        # Filter by type=EXPENSE
        res_filter = self.client.get(f"{url}?transaction_type=EXPENSE")
        self.assertEqual(res_filter.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_filter.data), 1)
        self.assertEqual(res_filter.data[0]['transaction_type'], 'EXPENSE')

    # O. Void transaction & P. Double void rejection
    def test_o_p_void_transaction_api(self):
        acc = MoneyAccountService.create_account(
            manager=self.manager, title="Void API Fund", owner_name="Owner", owner_email="api_owner@example.com"
        )
        tx = MoneyAccountService.add_transaction(acc.id, self.manager, 'DEPOSIT', '1000.00', 'Dep')
        url = reverse('money_account_transaction_void', kwargs={'pk': acc.id, 'tx_id': tx.id})

        self.authenticate(self.manager)
        # O. First void -> 200
        res_void = self.client.post(url, {'void_reason': 'Entered twice'}, format='json')
        self.assertEqual(res_void.status_code, status.HTTP_200_OK)
        self.assertTrue(res_void.data['is_voided'])

        # P. Double void -> 400 Bad Request
        res_double_void = self.client.post(url, {'void_reason': 'Again'}, format='json')
        self.assertEqual(res_double_void.status_code, status.HTTP_400_BAD_REQUEST)

    # Q. Invitation creation, R. Wrong email, S. Correct acceptance, T. Rejection, U. Expired, V. Reused
    def test_q_to_v_invitation_flow_api(self):
        acc = MoneyAccountService.create_account(
            manager=self.manager, title="Invite API Fund", owner_name="Owner", owner_email="api_owner@example.com"
        )
        invite_url = reverse('money_account_invite', kwargs={'pk': acc.id})

        self.authenticate(self.manager)
        # Q. Invitation creation
        res_inv = self.client.post(invite_url)
        self.assertEqual(res_inv.status_code, status.HTTP_201_CREATED)
        token = res_inv.data['token']

        respond_url = reverse('money_account_invitation_respond', kwargs={'token': token})

        # R. Wrong-email acceptance -> 400
        self.authenticate(self.stranger)
        res_wrong = self.client.post(respond_url, {'action': 'ACCEPT'}, format='json')
        self.assertEqual(res_wrong.status_code, status.HTTP_400_BAD_REQUEST)

        # T. Rejection by owner -> 200, status returns to DRAFT
        self.authenticate(self.owner)
        res_rej = self.client.post(respond_url, {'action': 'REJECT'}, format='json')
        self.assertEqual(res_rej.status_code, status.HTTP_200_OK)
        self.assertEqual(res_rej.data['status'], 'DRAFT')

        # V. Reused invitation -> 400
        res_reused = self.client.post(respond_url, {'action': 'ACCEPT'}, format='json')
        self.assertEqual(res_reused.status_code, status.HTTP_400_BAD_REQUEST)

        # Create new invitation and S. Correct acceptance
        self.authenticate(self.manager)
        res_inv2 = self.client.post(invite_url)
        token2 = res_inv2.data['token']
        respond_url2 = reverse('money_account_invitation_respond', kwargs={'token': token2})

        self.authenticate(self.owner)
        res_acc = self.client.post(respond_url2, {'action': 'ACCEPT'}, format='json')
        self.assertEqual(res_acc.status_code, status.HTTP_200_OK)
        self.assertEqual(res_acc.data['status'], 'ACTIVE')
        self.assertEqual(res_acc.data['owner']['username'], 'api_owner')

    # W. Account closure at zero, X. Closure with balance, Y. Tx after closure
    def test_w_x_y_closure_and_post_closure(self):
        acc = MoneyAccountService.create_account(
            manager=self.manager, title="Closure API Fund", owner_name="Owner", owner_email="api_owner@example.com"
        )
        MoneyAccountService.add_transaction(acc.id, self.manager, 'DEPOSIT', '1000.00', 'Dep')

        close_url = reverse('money_account_close', kwargs={'pk': acc.id})
        tx_url = reverse('money_account_transaction_list_create', kwargs={'pk': acc.id})

        self.authenticate(self.manager)

        # X. Account closure with balance -> 400
        res_fail_close = self.client.post(close_url)
        self.assertEqual(res_fail_close.status_code, status.HTTP_400_BAD_REQUEST)

        # Refund 1000 to bring balance to zero
        MoneyAccountService.add_transaction(acc.id, self.manager, 'REFUND', '1000.00', 'Refund all')

        # W. Account closure at zero -> 200
        res_close = self.client.post(close_url)
        self.assertEqual(res_close.status_code, status.HTTP_200_OK)
        self.assertEqual(res_close.data['status'], 'CLOSED')

        # Y. Transaction after closure -> 400
        res_post_tx = self.client.post(tx_url, {'transaction_type': 'DEPOSIT', 'amount': '500.00', 'description': 'Late'}, format='json')
        self.assertEqual(res_post_tx.status_code, status.HTTP_400_BAD_REQUEST)

    # Z. IDOR Protection
    def test_z_idor_protection(self):
        acc = MoneyAccountService.create_account(
            manager=self.manager, title="IDOR Fund", owner_name="Owner", owner_email="api_owner@example.com"
        )
        detail_url = reverse('money_account_detail', kwargs={'pk': acc.id})
        tx_url = reverse('money_account_transaction_list_create', kwargs={'pk': acc.id})
        close_url = reverse('money_account_close', kwargs={'pk': acc.id})

        # Stranger attempts to view detail -> 403
        self.authenticate(self.stranger)
        self.assertEqual(self.client.get(detail_url).status_code, status.HTTP_403_FORBIDDEN)
        # Stranger attempts to list transactions -> 403
        self.assertEqual(self.client.get(tx_url).status_code, status.HTTP_403_FORBIDDEN)
        # Stranger attempts to post transaction -> 403
        self.assertEqual(self.client.post(tx_url, {'transaction_type': 'DEPOSIT', 'amount': '100.00', 'description': 'Hacked'}).status_code, status.HTTP_403_FORBIDDEN)
        # Stranger attempts to close -> 403
        self.assertEqual(self.client.post(close_url).status_code, status.HTTP_403_FORBIDDEN)


class MoneyAccountReceiptTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.manager = User.objects.create_user(
            username="rcpt_mgr", email="rcpt_mgr@example.com", password="Password123!"
        )
        self.owner = User.objects.create_user(
            username="rcpt_owner", email="rcpt_owner@example.com", password="Password123!"
        )
        self.stranger = User.objects.create_user(
            username="rcpt_stranger", email="rcpt_stranger@example.com", password="Password123!"
        )

        self.account = MoneyAccountService.create_account(
            manager=self.manager,
            title="Receipt Test Fund",
            owner_name="Rahul",
            owner_email="rcpt_owner@example.com",
            owner=self.owner
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_transaction_creation_with_valid_jpg_png_webp(self):
        self.authenticate(self.manager)
        url = reverse('money_account_transaction_list_create', kwargs={'pk': self.account.id})

        for fmt, mime in [('jpg', 'image/jpeg'), ('png', 'image/png'), ('webp', 'image/webp')]:
            file_obj = SimpleUploadedFile(f"receipt.{fmt}", b"fake_image_bytes", content_type=mime)
            payload = {
                'transaction_type': 'DEPOSIT',
                'amount': '1000.00',
                'description': f'Test {fmt}',
                'receipt_image': file_obj
            }
            res = self.client.post(url, payload, format='multipart')
            self.assertEqual(res.status_code, status.HTTP_201_CREATED)
            self.assertIsNotNone(res.data['receipt_image_url'])

    def test_invalid_file_type_rejection(self):
        self.authenticate(self.manager)
        url = reverse('money_account_transaction_list_create', kwargs={'pk': self.account.id})
        pdf_file = SimpleUploadedFile("doc.pdf", b"%PDF-1.4 fake", content_type="application/pdf")

        res = self.client.post(url, {
            'transaction_type': 'EXPENSE',
            'amount': '100.00',
            'description': 'PDF test',
            'receipt_image': pdf_file
        }, format='multipart')

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_oversized_file_rejection(self):
        self.authenticate(self.manager)
        url = reverse('money_account_transaction_list_create', kwargs={'pk': self.account.id})
        big_bytes = b"x" * (5 * 1024 * 1024 + 10)  # > 5 MB
        big_file = SimpleUploadedFile("big.jpg", big_bytes, content_type="image/jpeg")

        res = self.client.post(url, {
            'transaction_type': 'EXPENSE',
            'amount': '100.00',
            'description': 'Big test',
            'receipt_image': big_file
        }, format='multipart')

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_receipt_view_permissions_and_idor_protection(self):
        # Create transaction with receipt
        file_obj = SimpleUploadedFile("receipt.jpg", b"fake_image_bytes", content_type="image/jpeg")
        tx = MoneyAccountService.add_transaction(
            account_id=self.account.id,
            created_by=self.manager,
            transaction_type='DEPOSIT',
            amount='5000.00',
            description='Deposit with receipt',
            receipt_image=file_obj
        )

        receipt_view_url = reverse('money_account_transaction_receipt', kwargs={'pk': self.account.id, 'tx_id': tx.id})

        # 1. Manager can view receipt -> 200 OK
        self.authenticate(self.manager)
        res_mgr = self.client.get(receipt_view_url)
        self.assertEqual(res_mgr.status_code, status.HTTP_200_OK)

        # 2. Owner can view receipt -> 200 OK (read-only)
        self.authenticate(self.owner)
        res_own = self.client.get(receipt_view_url)
        self.assertEqual(res_own.status_code, status.HTTP_200_OK)

        # 3. Owner CANNOT upload/replace receipt -> 403 Forbidden
        new_file = SimpleUploadedFile("new.png", b"new_bytes", content_type="image/png")
        res_own_post = self.client.post(receipt_view_url, {'receipt_image': new_file}, format='multipart')
        self.assertEqual(res_own_post.status_code, status.HTTP_403_FORBIDDEN)

        # 4. Owner CANNOT delete receipt -> 403 Forbidden
        res_own_del = self.client.delete(receipt_view_url)
        self.assertEqual(res_own_del.status_code, status.HTTP_403_FORBIDDEN)

        # 5. Stranger (unrelated user) CANNOT view receipt -> 403 Forbidden (IDOR Protection)
        self.authenticate(self.stranger)
        res_str = self.client.get(receipt_view_url)
        self.assertEqual(res_str.status_code, status.HTTP_403_FORBIDDEN)

    def test_receipt_replacement_and_removal(self):
        file_obj = SimpleUploadedFile("old.jpg", b"old_bytes", content_type="image/jpeg")
        tx = MoneyAccountService.add_transaction(
            account_id=self.account.id,
            created_by=self.manager,
            transaction_type='DEPOSIT',
            amount='5000.00',
            description='Deposit',
            receipt_image=file_obj
        )

        receipt_url = reverse('money_account_transaction_receipt', kwargs={'pk': self.account.id, 'tx_id': tx.id})
        self.authenticate(self.manager)

        # Replace receipt
        new_file = SimpleUploadedFile("new.png", b"new_bytes", content_type="image/png")
        res_replace = self.client.post(receipt_url, {'receipt_image': new_file}, format='multipart')
        self.assertEqual(res_replace.status_code, status.HTTP_200_OK)

        # Remove receipt
        res_remove = self.client.delete(receipt_url)
        self.assertEqual(res_remove.status_code, status.HTTP_200_OK)
        self.assertIsNone(res_remove.data['receipt_image_url'])

    def test_balance_invariance_on_receipt_operations(self):
        tx = MoneyAccountService.add_transaction(
            account_id=self.account.id,
            created_by=self.manager,
            transaction_type='DEPOSIT',
            amount='5000.00',
            description='Deposit'
        )
        MoneyAccountService.add_transaction(
            account_id=self.account.id,
            created_by=self.manager,
            transaction_type='EXPENSE',
            amount='700.00',
            description='Expense'
        )

        bal_before = MoneyAccountService.calculate_balance(self.account)['balance']
        self.assertEqual(bal_before, Decimal('4300.00'))

        # Add receipt to expense
        file_obj = SimpleUploadedFile("receipt.jpg", b"bytes", content_type="image/jpeg")
        MoneyAccountService.update_receipt(tx.id, self.manager, receipt_image=file_obj)

        bal_after_add = MoneyAccountService.calculate_balance(self.account)['balance']
        self.assertEqual(bal_after_add, Decimal('4300.00'))

        # Replace receipt
        new_file = SimpleUploadedFile("new.png", b"bytes", content_type="image/png")
        MoneyAccountService.update_receipt(tx.id, self.manager, receipt_image=new_file)

        bal_after_replace = MoneyAccountService.calculate_balance(self.account)['balance']
        self.assertEqual(bal_after_replace, Decimal('4300.00'))

        # Remove receipt
        MoneyAccountService.update_receipt(tx.id, self.manager, remove_receipt=True)

        bal_after_remove = MoneyAccountService.calculate_balance(self.account)['balance']
        self.assertEqual(bal_after_remove, Decimal('4300.00'))

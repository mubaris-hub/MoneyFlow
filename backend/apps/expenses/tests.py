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


class ReceiptScanAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="scanner@example.com",
            username="scanner",
            password="Password123!",
            first_name="Scanner"
        )
        self.scan_url = reverse('receipt_scan')

    def _create_image_file(self, filename="receipt.png", content_type="image/png", size_bytes=None):
        import io
        from PIL import Image
        from django.core.files.uploadedfile import SimpleUploadedFile

        buf = io.BytesIO()
        img = Image.new('RGB', (100, 100), color='white')
        fmt = 'PNG' if 'png' in filename.lower() else 'JPEG'
        img.save(buf, format=fmt)
        img_bytes = buf.getvalue()

        if size_bytes:
            img_bytes = img_bytes + b'\x00' * (size_bytes - len(img_bytes))

        return SimpleUploadedFile(filename, img_bytes, content_type=content_type)

    def test_scan_receipt_unauthenticated_fails(self):
        img = self._create_image_file()
        response = self.client.post(self.scan_url, {'receipt_image': img}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_scan_receipt_missing_file_fails(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.scan_url, {}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Receipt image file is required', response.data['error'])

    def test_scan_receipt_unsupported_extension_fails(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.client.force_authenticate(user=self.user)
        bad_file = SimpleUploadedFile("receipt.pdf", b"%PDF-1.4...", content_type="application/pdf")
        response = self.client.post(self.scan_url, {'receipt_image': bad_file}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Unsupported file format", response.data['error'])

    def test_scan_receipt_exceeds_5mb_fails(self):
        self.client.force_authenticate(user=self.user)
        large_file = self._create_image_file(filename="receipt.png", size_bytes=6 * 1024 * 1024)
        response = self.client.post(self.scan_url, {'receipt_image': large_file}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("File size exceeds maximum allowed limit of 5 MB", response.data['error'])

    def test_scan_receipt_corrupt_file_fails(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.client.force_authenticate(user=self.user)
        corrupt_file = SimpleUploadedFile("corrupt.png", b"not-a-real-image-payload", content_type="image/png")
        response = self.client.post(self.scan_url, {'receipt_image': corrupt_file}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid or unreadable image file", response.data['error'])

    def test_scan_receipt_successful_extraction(self):
        from django.test import override_settings
        self.client.force_authenticate(user=self.user)
        img = self._create_image_file()

        mock_ocr = (
            "BLUE TOKAI COFFEE\n"
            "Date: 2026-10-12\n"
            "Cold Brew 1 240.00\n"
            "Croissant 1 180.00\n"
            "Total Amount: 420.00 INR\n"
        )
        with override_settings(MOCK_OCR_TEXT=mock_ocr):
            response = self.client.post(self.scan_url, {'receipt_image': img}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        extracted = response.data['extracted_data']
        self.assertEqual(extracted['merchant_name'], "BLUE TOKAI COFFEE")
        self.assertEqual(extracted['date'], "2026-10-12")
        self.assertEqual(extracted['total_amount'], "420.00")
        self.assertEqual(extracted['currency'], "INR")
        self.assertEqual(len(extracted['line_items']), 2)
        self.assertEqual(extracted['line_items'][0]['description'], "Cold Brew")
        self.assertEqual(extracted['line_items'][0]['amount'], "240.00")
        self.assertEqual(extracted['field_status']['merchant_name'], "detected")
        self.assertEqual(extracted['field_status']['total_amount'], "detected")

    def test_scan_receipt_missing_fields_represented_as_unknown(self):
        from django.test import override_settings
        self.client.force_authenticate(user=self.user)
        img = self._create_image_file()

        # Mock text with unparseable or absent fields
        mock_ocr = "RANDOM NOISE\n***\n123456\n"
        with override_settings(MOCK_OCR_TEXT=mock_ocr):
            response = self.client.post(self.scan_url, {'receipt_image': img}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        extracted = response.data['extracted_data']
        # Unknown values must be None / unknown status, NOT invented!
        self.assertIsNone(extracted['date'])
        self.assertIsNone(extracted['total_amount'])
        self.assertEqual(extracted['line_items'], [])
        self.assertEqual(extracted['field_status']['date'], "unknown")
        self.assertEqual(extracted['field_status']['total_amount'], "unknown")
        self.assertEqual(extracted['field_status']['line_items'], "unknown")

    def test_scan_receipt_balance_and_transaction_invariance(self):
        from django.test import override_settings
        from apps.money_accounts.models import AccountTransaction
        self.client.force_authenticate(user=self.user)
        img = self._create_image_file()

        # Capture counts before
        expense_count_before = Expense.objects.count()
        split_count_before = ExpenseSplit.objects.count()
        account_tx_count_before = AccountTransaction.objects.count()

        mock_ocr = "STORE\nDate: 2026-10-12\nTotal: 100.00 INR\n"
        with override_settings(MOCK_OCR_TEXT=mock_ocr):
            response = self.client.post(self.scan_url, {'receipt_image': img}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Invariance verification
        self.assertEqual(Expense.objects.count(), expense_count_before)
        self.assertEqual(ExpenseSplit.objects.count(), split_count_before)
        self.assertEqual(AccountTransaction.objects.count(), account_tx_count_before)

    def test_scan_receipt_upi_payment_screenshot_extraction(self):
        from django.test import override_settings
        self.client.force_authenticate(user=self.user)
        img = self._create_image_file()

        upi_mock = (
            "Payment successful\n"
            "14 Aug 2026, 11:19 PM\n"
            "₹3,450\n"
            "Paid to\n"
            "VESTIGE MARKETING PV\n"
            "vestigedlcpmellattur@okaxis\n"
            "UPI transaction ID: 659233356877\n"
            "From: State Bank of India\n"
            "Google Pay\n"
            "Pay again\n"
            "Share receipt\n"
        )
        with override_settings(MOCK_OCR_TEXT=upi_mock):
            response = self.client.post(self.scan_url, {'receipt_image': img}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        extracted = response.data['extracted_data']
        # Merchant must be VESTIGE MARKETING PV, not 'Payment successful' or 'Paid to'
        self.assertEqual(extracted['merchant_name'], "VESTIGE MARKETING PV")
        self.assertEqual(extracted['field_status']['merchant_name'], "detected")
        # Amount must be extracted from ₹3,450 as 3450.00
        self.assertEqual(extracted['total_amount'], "3450.00")
        self.assertEqual(extracted['field_status']['total_amount'], "detected")
        # Date must be 2026-08-14
        self.assertEqual(extracted['date'], "2026-08-14")
        self.assertEqual(extracted['field_status']['date'], "detected")
        # Currency must be INR
        self.assertEqual(extracted['currency'], "INR")
        self.assertEqual(extracted['field_status']['currency'], "detected")
        # Line items should be empty / unknown for UPI
        self.assertEqual(extracted['line_items'], [])
        self.assertEqual(extracted['field_status']['line_items'], "unknown")

    def test_scan_receipt_upi_payment_no_currency_symbol_comma_amount(self):
        from django.test import override_settings
        self.client.force_authenticate(user=self.user)
        img = self._create_image_file()

        upi_mock = (
            "Payment successful\n"
            "14 Aug 2026, 11:19 PM\n"
            "3,450\n"
            "Paid to\n"
            "VESTIGE MARKETING PV\n"
            "vestigedlcpmellattur@okaxis\n"
            "UPI transaction ID: 659233356877\n"
        )
        with override_settings(MOCK_OCR_TEXT=upi_mock):
            response = self.client.post(self.scan_url, {'receipt_image': img}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        extracted = response.data['extracted_data']
        self.assertEqual(extracted['merchant_name'], "VESTIGE MARKETING PV")
        self.assertEqual(extracted['total_amount'], "3450.00")
        self.assertEqual(extracted['date'], "2026-08-14")
        self.assertEqual(extracted['currency'], "INR")

    def test_scan_receipt_upi_inline_paid_to_and_decimal(self):
        from django.test import override_settings
        self.client.force_authenticate(user=self.user)
        img = self._create_image_file()

        upi_mock = (
            "Payment successful\n"
            "14 Aug 2026, 11:19 PM\n"
            "₹ 3,450.75\n"
            "Paid to: VESTIGE MARKETING PV\n"
            "vestigedlcpmellattur@okaxis\n"
            "UPI transaction ID: 659233356877\n"
        )
        with override_settings(MOCK_OCR_TEXT=upi_mock):
            response = self.client.post(self.scan_url, {'receipt_image': img}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        extracted = response.data['extracted_data']
        self.assertEqual(extracted['merchant_name'], "VESTIGE MARKETING PV")
        self.assertEqual(extracted['total_amount'], "3450.75")
        self.assertEqual(extracted['date'], "2026-08-14")
        self.assertEqual(extracted['currency'], "INR")

    def test_scan_receipt_real_windows_ocr_engine_integration(self):
        import sys
        if sys.platform != 'win32':
            return

        import io
        from PIL import Image, ImageDraw, ImageFont
        from django.core.files.uploadedfile import SimpleUploadedFile
        from django.test import override_settings

        img = Image.new('RGB', (600, 450), color='white')
        d = ImageDraw.Draw(img)
        f_title = ImageFont.truetype('segoeui.ttf', 24)
        f_amt = ImageFont.truetype('segoeui.ttf', 38)
        d.text((20, 20), 'Payment successful\n14 Aug 2026, 11:19 PM', font=f_title, fill='black')
        d.text((20, 90), '\u20b9 3,450', font=f_amt, fill='black')
        d.text((20, 160), 'Paid to\nVESTIGE MARKETING PV\nvestigedlcpmellattur@okaxis\nUPI transaction ID: 659233356877', font=f_title, fill='black')

        buf = io.BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)
        uploaded = SimpleUploadedFile("real_upi.png", buf.getvalue(), content_type="image/png")

        self.client.force_authenticate(user=self.user)
        # Ensure MOCK_OCR_TEXT is None so the real Windows OCR engine executes
        with override_settings(MOCK_OCR_TEXT=None):
            response = self.client.post(self.scan_url, {'receipt_image': uploaded}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        extracted = response.data['extracted_data']
        self.assertEqual(extracted['merchant_name'], "VESTIGE MARKETING PV")
        self.assertEqual(extracted['total_amount'], "3450.00")
        self.assertEqual(extracted['date'], "2026-08-14")
        self.assertEqual(extracted['currency'], "INR")

    def test_scan_receipt_college_fee_dated_two_digit_year_and_exam_fee(self):
        from django.test import override_settings
        self.client.force_authenticate(user=self.user)
        img = self._create_image_file()

        college_mock = (
            "Eranad Knowledge City Technical Campus\n"
            "Dated: 13-Oct-25\n"
            "Receipt No: 4821\n"
            "Particulars Amount\n"
            "EXAM FEE 2,625.00\n"
            "Total: ₹2,625.00\n"
        )
        with override_settings(MOCK_OCR_TEXT=college_mock):
            response = self.client.post(self.scan_url, {'receipt_image': img}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        extracted = response.data['extracted_data']
        self.assertEqual(extracted['merchant_name'], "Eranad Knowledge City Technical Campus")
        self.assertEqual(extracted['field_status']['merchant_name'], "detected")
        # 13-Oct-25 normalized to 2025-10-13
        self.assertEqual(extracted['date'], "2025-10-13")
        self.assertEqual(extracted['field_status']['date'], "detected")
        self.assertEqual(extracted['total_amount'], "2625.00")
        self.assertEqual(extracted['currency'], "INR")
        # EXAM FEE line item extracted
        self.assertEqual(len(extracted['line_items']), 1)
        self.assertEqual(extracted['line_items'][0]['description'], "EXAM FEE")
        self.assertEqual(extracted['line_items'][0]['quantity'], 1)
        self.assertEqual(extracted['line_items'][0]['amount'], "2625.00")
        self.assertEqual(extracted['field_status']['line_items'], "detected")

    def test_scan_receipt_college_fee_two_line_item(self):
        from django.test import override_settings
        self.client.force_authenticate(user=self.user)
        img = self._create_image_file()

        college_mock = (
            "Eranad Knowledge City Technical Campus\n"
            "Dated: 13-Oct-25\n"
            "Receipt No: 4821\n"
            "EXAM FEE\n"
            "2,625.00\n"
            "Total: ₹2,625.00\n"
        )
        with override_settings(MOCK_OCR_TEXT=college_mock):
            response = self.client.post(self.scan_url, {'receipt_image': img}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        extracted = response.data['extracted_data']
        self.assertEqual(extracted['merchant_name'], "Eranad Knowledge City Technical Campus")
        self.assertEqual(extracted['date'], "2025-10-13")
        self.assertEqual(len(extracted['line_items']), 1)
        self.assertEqual(extracted['line_items'][0]['description'], "EXAM FEE")
        self.assertEqual(extracted['line_items'][0]['amount'], "2625.00")

    def test_scan_receipt_date_format_variations(self):
        from apps.expenses.ocr.parser import ReceiptTextParser

        variations = [
            ("Dated: 13-Oct-25\nTotal: 100.00", "2025-10-13"),
            ("Dated: 13-Oct-2025\nTotal: 100.00", "2025-10-13"),
            ("Dated: 13/10/2025\nTotal: 100.00", "2025-10-13"),
            ("Dated: 13-10-2025\nTotal: 100.00", "2025-10-13"),
            ("Dated: 13/10/25\nTotal: 100.00", "2025-10-13"),
            ("Invoice Date: 2025-10-13\nTotal: 100.00", "2025-10-13"),
            ("Receipt Date: 14 Aug 2026\nTotal: 100.00", "2026-08-14"),
            ("Date: Oct 13, 2025\nTotal: 100.00", "2025-10-13"),
            ("Dated 13.Oct.25\nTotal: 100.00", "2025-10-13"),
        ]

        for text, expected_date in variations:
            res = ReceiptTextParser(text).extract()
            self.assertEqual(res['date'], expected_date, f"Failed for text: {text}")
            self.assertEqual(res['field_status']['date'], "detected")

    def test_scan_receipt_invalid_calendar_dates_and_non_dates(self):
        from apps.expenses.ocr.parser import ReceiptTextParser

        invalid_cases = [
            "Dated: 31-Feb-25\nTotal: 100.00",       # 31 Feb is invalid
            "Dated: 29-Feb-25\nTotal: 100.00",       # 2025 is not a leap year
            "Dated: 32-13-25\nTotal: 100.00",        # month 13, day 32
            "Dated: 13-Oct-99\nTotal: 100.00",       # 1999 is outside 2000-2035 range
            "Receipt No: 12345/67/89\nTotal: 100.00", # receipt ID format
            "Transaction ID: 659233356877\nTotal: 100.00", # UTR numeric sequence
        ]

        for text in invalid_cases:
            res = ReceiptTextParser(text).extract()
            self.assertIsNone(res['date'], f"Expected None date for invalid case: {text}")
            self.assertEqual(res['field_status']['date'], "unknown")

        # Leap year 2024 must succeed
        res_leap = ReceiptTextParser("Dated: 29-Feb-24\nTotal: 100.00").extract()
        self.assertEqual(res_leap['date'], "2024-02-29")
        self.assertEqual(res_leap['field_status']['date'], "detected")


class SmartCategoryAndSaveExpenseTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            email="cat_user1@example.com",
            username="cat_user1",
            password="Password123!",
            first_name="User1"
        )
        self.user2 = User.objects.create_user(
            email="cat_user2@example.com",
            username="cat_user2",
            password="Password123!",
            first_name="User2"
        )
        self.stranger = User.objects.create_user(
            email="stranger_cat@example.com",
            username="stranger_cat",
            password="Password123!"
        )

        self.group = Group.objects.create(name="College Roommates", created_by=self.user1)
        GroupMember.objects.create(group=self.group, user=self.user1, role='admin')
        GroupMember.objects.create(group=self.group, user=self.user2, role='member')

        # Ensure seed categories exist
        self.cat_education, _ = Category.objects.get_or_create(
            name='Education',
            defaults={'id': 9, 'icon': 'GraduationCap', 'is_system': True}
        )
        self.cat_groceries, _ = Category.objects.get_or_create(
            name='Groceries',
            defaults={'id': 4, 'icon': 'ShoppingCart', 'is_system': True}
        )
        self.cat_dining, _ = Category.objects.get_or_create(
            name='Food & Dining',
            defaults={'id': 1, 'icon': 'Utensils', 'is_system': True}
        )
        self.cat_transport, _ = Category.objects.get_or_create(
            name='Travel & Transport',
            defaults={'id': 5, 'icon': 'Car', 'is_system': True}
        )
        self.cat_healthcare, _ = Category.objects.get_or_create(
            name='Healthcare',
            defaults={'id': 10, 'icon': 'HeartPulse', 'is_system': True}
        )
        self.cat_general, _ = Category.objects.get_or_create(
            name='General / Other',
            defaults={'id': 8, 'icon': 'Tag', 'is_system': True}
        )

        self.scan_url = reverse('receipt_scan')
        self.expense_url = reverse('expense_list_create')

    def _create_image_file(self, filename="receipt.png"):
        import io
        from PIL import Image
        from django.core.files.uploadedfile import SimpleUploadedFile

        buf = io.BytesIO()
        img = Image.new('RGB', (100, 100), color='white')
        img.save(buf, format='PNG')
        return SimpleUploadedFile(filename, buf.getvalue(), content_type="image/png")

    def test_category_suggestion_known_merchants_and_descriptions(self):
        from apps.expenses.ocr.category_suggester import suggest_category

        # Education
        edu = suggest_category("Eranad Knowledge City Technical Campus", [{"description": "EXAM FEE"}])
        self.assertIsNotNone(edu)
        self.assertEqual(edu['category_name'], "Education")
        self.assertEqual(edu['confidence'], "suggested")
        self.assertIn("campus", str(edu['matched_keywords']))

        # Groceries
        groc = suggest_category("Whole Foods Market", [{"description": "Organic Milk 1 40.00"}])
        self.assertIsNotNone(groc)
        self.assertEqual(groc['category_name'], "Groceries")

        # Food & Dining
        food = suggest_category("Blue Tokai Coffee", [{"description": "Cold Brew 1 240.00"}])
        self.assertIsNotNone(food)
        self.assertEqual(food['category_name'], "Food & Dining")

        # Travel & Transport
        trans = suggest_category("Shell Petrol Station", [])
        self.assertIsNotNone(trans)
        self.assertEqual(trans['category_name'], "Travel & Transport")

        # Healthcare
        health = suggest_category("Apollo Pharmacy", [{"description": "Paracetamol Tablet"}])
        self.assertIsNotNone(health)
        self.assertEqual(health['category_name'], "Healthcare")

    def test_category_suggestion_unknown_or_ambiguous_merchants(self):
        from apps.expenses.ocr.category_suggester import suggest_category

        # Unknown merchant with no category indicators
        unknown = suggest_category("VESTIGE MARKETING PV", [])
        self.assertIsNone(unknown)

        # Ambiguous tie: "University Cafe" (matches Education and Food & Dining with identical score)
        ambiguous = suggest_category("University Cafe", [])
        self.assertIsNone(ambiguous)

    def test_scan_receipt_suggested_category_in_api_response(self):
        from django.test import override_settings
        self.client.force_authenticate(user=self.user1)
        img = self._create_image_file()

        college_mock = (
            "Eranad Knowledge City Technical Campus\n"
            "Dated: 13-Oct-25\n"
            "EXAM FEE 2,625.00\n"
            "Total: ₹2,625.00\n"
        )
        with override_settings(MOCK_OCR_TEXT=college_mock):
            response = self.client.post(self.scan_url, {'receipt_image': img}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        extracted = response.data['extracted_data']
        self.assertIn('suggested_category', extracted)
        sug = extracted['suggested_category']
        self.assertIsNotNone(sug)
        self.assertEqual(sug['category_name'], "Education")
        self.assertEqual(sug['confidence'], "suggested")
        self.assertEqual(extracted['field_status']['suggested_category'], "suggested")

    def test_confirm_and_save_expense_successful(self):
        self.client.force_authenticate(user=self.user1)

        payload = {
            "description": "Eranad Knowledge City Technical Campus - Exam Fee",
            "total_amount": "2625.00",
            "currency": "INR",
            "group_id": str(self.group.id),
            "category_id": self.cat_education.id,
            "paid_by_id": str(self.user1.id),
            "split_type": "EQUAL",
            "date": "2025-10-13",
            "notes": "Receipt items: EXAM FEE (1x INR 2625.00)",
            "splits": [
                {"user_id": str(self.user1.id)},
                {"user_id": str(self.user2.id)}
            ]
        }

        response = self.client.post(self.expense_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('expense', response.data)

        # Verify database records
        expense_obj = Expense.objects.get(id=response.data['expense']['id'])
        self.assertEqual(expense_obj.description, "Eranad Knowledge City Technical Campus - Exam Fee")
        self.assertEqual(expense_obj.total_amount, Decimal('2625.00'))
        self.assertEqual(expense_obj.category, self.cat_education)
        self.assertEqual(str(expense_obj.date), "2025-10-13")

        # Splits verification
        splits = list(expense_obj.splits.all())
        self.assertEqual(len(splits), 2)
        total_split = sum(s.amount for s in splits)
        self.assertEqual(total_split, Decimal('2625.00'))

    def test_confirm_and_save_expense_user_overriding_category(self):
        self.client.force_authenticate(user=self.user1)

        # User chooses General / Other instead of suggested Education
        payload = {
            "description": "College Fee Manual Category",
            "total_amount": "1000.00",
            "currency": "INR",
            "group_id": str(self.group.id),
            "category_id": self.cat_general.id,
            "paid_by_id": str(self.user1.id),
            "split_type": "EQUAL",
            "date": "2025-10-13",
            "splits": [
                {"user_id": str(self.user1.id)},
                {"user_id": str(self.user2.id)}
            ]
        }

        response = self.client.post(self.expense_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        saved = Expense.objects.get(id=response.data['expense']['id'])
        self.assertEqual(saved.category, self.cat_general)

    def test_confirm_and_save_duplicate_submission_protection(self):
        self.client.force_authenticate(user=self.user1)

        payload = {
            "description": "Idempotent Expense Test",
            "total_amount": "500.00",
            "currency": "INR",
            "group_id": str(self.group.id),
            "category_id": self.cat_dining.id,
            "paid_by_id": str(self.user1.id),
            "split_type": "EQUAL",
            "date": "2025-10-13",
            "splits": [
                {"user_id": str(self.user1.id)},
                {"user_id": str(self.user2.id)}
            ]
        }

        # First submission
        res1 = self.client.post(self.expense_url, payload, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        first_id = res1.data['expense']['id']

        # Rapid second submission (same payload)
        res2 = self.client.post(self.expense_url, payload, format='json')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data['expense']['id'], first_id)

        # Database must only have 1 expense, not 2
        count = Expense.objects.filter(description="Idempotent Expense Test").count()
        self.assertEqual(count, 1)

    def test_confirm_and_save_invalid_or_missing_fields(self):
        self.client.force_authenticate(user=self.user1)

        # Missing total amount (or 0)
        res_zero = self.client.post(self.expense_url, {
            "description": "Zero Amount",
            "total_amount": "0.00",
            "group_id": str(self.group.id),
            "category_id": self.cat_dining.id,
            "paid_by_id": str(self.user1.id),
            "splits": [{"user_id": str(self.user1.id)}]
        }, format='json')
        self.assertEqual(res_zero.status_code, status.HTTP_400_BAD_REQUEST)

        # Missing description
        res_no_desc = self.client.post(self.expense_url, {
            "description": "",
            "total_amount": "100.00",
            "group_id": str(self.group.id),
            "category_id": self.cat_dining.id,
            "paid_by_id": str(self.user1.id),
            "splits": [{"user_id": str(self.user1.id)}]
        }, format='json')
        self.assertEqual(res_no_desc.status_code, status.HTTP_400_BAD_REQUEST)

        # Invalid category ID
        res_bad_cat = self.client.post(self.expense_url, {
            "description": "Bad Category",
            "total_amount": "100.00",
            "group_id": str(self.group.id),
            "category_id": 99999,
            "paid_by_id": str(self.user1.id),
            "splits": [{"user_id": str(self.user1.id)}]
        }, format='json')
        self.assertEqual(res_bad_cat.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirm_and_save_unauthenticated_and_permission_denied(self):
        # Unauthenticated request
        res_unauth = self.client.post(self.expense_url, {"description": "Test"}, format='json')
        self.assertEqual(res_unauth.status_code, status.HTTP_401_UNAUTHORIZED)

        # Stranger not in group cannot add expense
        self.client.force_authenticate(user=self.stranger)
        res_stranger = self.client.post(self.expense_url, {
            "description": "Intrusion Expense",
            "total_amount": "100.00",
            "group_id": str(self.group.id),
            "category_id": self.cat_dining.id,
            "paid_by_id": str(self.stranger.id),
            "splits": [{"user_id": str(self.stranger.id)}]
        }, format='json')
        self.assertEqual(res_stranger.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("must be a member", str(res_stranger.data))

    def test_dashboard_and_reports_reflect_saved_expense(self):
        self.client.force_authenticate(user=self.user1)

        # Create expense
        payload = {
            "description": "Exam Fee Analytics Test",
            "total_amount": "2625.00",
            "currency": "INR",
            "group_id": str(self.group.id),
            "category_id": self.cat_education.id,
            "paid_by_id": str(self.user1.id),
            "split_type": "EQUAL",
            "date": "2025-10-13",
            "splits": [
                {"user_id": str(self.user1.id)},
                {"user_id": str(self.user2.id)}
            ]
        }
        res_create = self.client.post(self.expense_url, payload, format='json')
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)

        # Query reports
        dash_url = reverse('report_dashboard')
        dash_res = self.client.get(dash_url)
        self.assertEqual(dash_res.status_code, status.HTTP_200_OK)
        # Check Education category is in category breakdown
        cats = [c['category_name'] for c in dash_res.data.get('category_breakdown', [])]
        self.assertIn('Education', cats)

    def test_ocr_scanning_does_not_create_expense_or_mutate_balances(self):
        from django.test import override_settings
        from apps.money_accounts.models import AccountTransaction
        from apps.expenses.models import Settlement

        self.client.force_authenticate(user=self.user1)
        img = self._create_image_file()

        exp_count = Expense.objects.count()
        split_count = ExpenseSplit.objects.count()
        settle_count = Settlement.objects.count()
        tx_count = AccountTransaction.objects.count()

        mock_ocr = (
            "Eranad Knowledge City Technical Campus\n"
            "Dated: 13-Oct-25\n"
            "EXAM FEE 2,625.00\n"
            "Total: ₹2,625.00\n"
        )
        with override_settings(MOCK_OCR_TEXT=mock_ocr):
            res = self.client.post(self.scan_url, {'receipt_image': img}, format='multipart')

        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Zero side-effects verification
        self.assertEqual(Expense.objects.count(), exp_count)
        self.assertEqual(ExpenseSplit.objects.count(), split_count)
        self.assertEqual(Settlement.objects.count(), settle_count)
        self.assertEqual(AccountTransaction.objects.count(), tx_count)

    def test_friend_ledger_and_settlement_isolation(self):
        from apps.money_accounts.models import AccountTransaction
        from apps.expenses.models import Settlement

        self.client.force_authenticate(user=self.user1)

        settle_count = Settlement.objects.count()
        tx_count = AccountTransaction.objects.count()

        payload = {
            "description": "Group Expense Only",
            "total_amount": "300.00",
            "currency": "INR",
            "group_id": str(self.group.id),
            "category_id": self.cat_dining.id,
            "paid_by_id": str(self.user1.id),
            "split_type": "EQUAL",
            "date": "2025-10-13",
            "splits": [
                {"user_id": str(self.user1.id)},
                {"user_id": str(self.user2.id)}
            ]
        }
        res = self.client.post(self.expense_url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        # Neither settlements nor money account transactions should be created
        self.assertEqual(Settlement.objects.count(), settle_count)
        self.assertEqual(AccountTransaction.objects.count(), tx_count)


class UnifiedTransactionAPITests(TestCase):
    def setUp(self):
        from apps.groups.models import Group, GroupMember
        from apps.money_accounts.models import MoneyAccount, AccountTransaction, AccountCategory
        from apps.expenses.models import Expense, ExpenseSplit, Category, DirectPayment, Settlement

        self.client = APIClient()
        self.user_a = User.objects.create_user(username="user_a", email="a@example.com", password="Password123!", first_name="Alice", last_name="A")
        self.user_b = User.objects.create_user(username="user_b", email="b@example.com", password="Password123!", first_name="Bob", last_name="B")
        self.user_c = User.objects.create_user(username="user_c", email="c@example.com", password="Password123!", first_name="Charlie", last_name="C")

        self.group_ab = Group.objects.create(name="Trip to Goa", created_by=self.user_a)
        GroupMember.objects.create(group=self.group_ab, user=self.user_a)
        GroupMember.objects.create(group=self.group_ab, user=self.user_b)

        self.group_c_private = Group.objects.create(name="Secret Club", created_by=self.user_c)
        GroupMember.objects.create(group=self.group_c_private, user=self.user_c)

        self.cat = Category.objects.create(name="Dining", icon="Utensils")

        # 1. Expense in group_ab
        self.expense1 = Expense.objects.create(
            description="Beach Dinner",
            total_amount=Decimal('1200.00'),
            paid_by=self.user_a,
            created_by=self.user_a,
            group=self.group_ab,
            category=self.cat,
            date="2026-08-01"
        )
        ExpenseSplit.objects.create(expense=self.expense1, user=self.user_a, amount=Decimal('600.00'))
        ExpenseSplit.objects.create(expense=self.expense1, user=self.user_b, amount=Decimal('600.00'))

        # 2. DirectPayment in group_ab
        self.dp1 = DirectPayment.objects.create(
            sender=self.user_b,
            receiver=self.user_a,
            amount=Decimal('400.00'),
            group=self.group_ab,
            date="2026-08-02",
            notes="Transfer for snacks"
        )

        # 3. Settlement in group_ab
        self.settlement1 = Settlement.objects.create(
            group=self.group_ab,
            sender=self.user_b,
            receiver=self.user_a,
            amount=Decimal('200.00'),
            date="2026-08-03",
            status="PENDING",
            created_by=self.user_b,
            notes="Final trip settlement"
        )

        # 4. Friend Ledger for user_a (manager) and user_b (owner)
        self.ledger = MoneyAccount.objects.create(
            title="House Budget",
            manager=self.user_a,
            owner=self.user_b,
            owner_name="Bob B",
            owner_email="b@example.com",
            status="ACTIVE"
        )
        self.ledger_cat = AccountCategory.objects.create(name="Groceries", icon="ShoppingBag")
        self.ledger_tx = AccountTransaction.objects.create(
            account=self.ledger,
            transaction_type="EXPENSE",
            amount=Decimal('150.00'),
            description="Vegetables",
            category=self.ledger_cat,
            date="2026-08-04",
            created_by=self.user_a
        )

        # 5. Private expense in group_c_private (user_a is NOT a member)
        self.expense_private = Expense.objects.create(
            description="Private Charlie Lunch",
            total_amount=Decimal('5000.00'),
            paid_by=self.user_c,
            created_by=self.user_c,
            group=self.group_c_private,
            category=self.cat,
            date="2026-08-05"
        )

        self.tx_list_url = reverse('transaction_list')

    def test_list_transactions_authorized_access_only(self):
        self.client.force_authenticate(user=self.user_a)
        res = self.client.get(self.tx_list_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        transactions = res.data['transactions']
        tx_ids = [t['id'] for t in transactions]

        # User A must see transactions from group_ab and their ledger
        self.assertIn(f"expense_{self.expense1.id}", tx_ids)
        self.assertIn(f"direct_payment_{self.dp1.id}", tx_ids)
        self.assertIn(f"settlement_{self.settlement1.id}", tx_ids)
        self.assertIn(f"account_tx_{self.ledger_tx.id}", tx_ids)

        # User A MUST NOT see Charlie's private group transaction
        self.assertNotIn(f"expense_{self.expense_private.id}", tx_ids)

    def test_filter_by_transaction_type(self):
        self.client.force_authenticate(user=self.user_a)

        # Filter: EXPENSE
        res = self.client.get(self.tx_list_url, {'transaction_type': 'EXPENSE'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        for t in res.data['transactions']:
            self.assertEqual(t['transaction_type'], 'EXPENSE')

        # Filter: SETTLEMENT
        res = self.client.get(self.tx_list_url, {'transaction_type': 'SETTLEMENT'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['transactions']), 1)
        self.assertEqual(res.data['transactions'][0]['id'], f"settlement_{self.settlement1.id}")

    def test_filter_by_status(self):
        self.client.force_authenticate(user=self.user_a)

        # Filter: PENDING (only the pending settlement matches)
        res = self.client.get(self.tx_list_url, {'status': 'PENDING'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['transactions']), 1)
        self.assertEqual(res.data['transactions'][0]['id'], f"settlement_{self.settlement1.id}")

    def test_filter_by_search(self):
        self.client.force_authenticate(user=self.user_a)

        # Search for "Beach"
        res = self.client.get(self.tx_list_url, {'search': 'Beach'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['transactions']), 1)
        self.assertEqual(res.data['transactions'][0]['id'], f"expense_{self.expense1.id}")

    def test_filter_by_date_range(self):
        self.client.force_authenticate(user=self.user_a)

        res = self.client.get(self.tx_list_url, {'date_from': '2026-08-03', 'date_to': '2026-08-04'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        tx_ids = [t['id'] for t in res.data['transactions']]
        self.assertIn(f"settlement_{self.settlement1.id}", tx_ids)
        self.assertIn(f"account_tx_{self.ledger_tx.id}", tx_ids)
        self.assertNotIn(f"expense_{self.expense1.id}", tx_ids)

    def test_sorting_by_amount(self):
        self.client.force_authenticate(user=self.user_a)

        # highest_amount
        res = self.client.get(self.tx_list_url, {'ordering': 'highest_amount'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        amounts = [float(t['amount']) for t in res.data['transactions']]
        self.assertEqual(amounts, sorted(amounts, reverse=True))

        # lowest_amount
        res2 = self.client.get(self.tx_list_url, {'ordering': 'lowest_amount'})
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        amounts2 = [float(t['amount']) for t in res2.data['transactions']]
        self.assertEqual(amounts2, sorted(amounts2))

    def test_pagination(self):
        self.client.force_authenticate(user=self.user_a)

        res = self.client.get(self.tx_list_url, {'page_size': 2, 'page': 1})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['transactions']), 2)
        self.assertEqual(res.data['page'], 1)
        self.assertEqual(res.data['page_size'], 2)
        self.assertGreaterEqual(res.data['total_pages'], 2)

    def test_single_transaction_detail(self):
        self.client.force_authenticate(user=self.user_a)

        detail_url = reverse('transaction_detail', kwargs={'transaction_id': f"expense_{self.expense1.id}"})
        res = self.client.get(detail_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['transaction']['description'], "Beach Dinner")
        self.assertEqual(len(res.data['transaction']['participants']), 2)

    def test_single_transaction_detail_unauthorized(self):
        self.client.force_authenticate(user=self.user_a)

        # User A tries to view Charlie's private group transaction
        detail_url = reverse('transaction_detail', kwargs={'transaction_id': f"expense_{self.expense_private.id}"})
        res = self.client.get(detail_url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)







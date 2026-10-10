from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status

from apps.money_accounts.models import MoneyAccount, AccountTransaction, AccountInvitation
from apps.money_accounts.services import MoneyAccountService
from apps.notifications.models import Notification

User = get_user_model()


class NotificationAndExportTests(APITestCase):
    def setUp(self):
        self.manager = User.objects.create_user(
            username='manager_user',
            email='manager@example.com',
            password='Password123!'
        )
        self.rahul = User.objects.create_user(
            username='rahul_user',
            email='rahul@example.com',
            password='Password123!'
        )
        self.unrelated = User.objects.create_user(
            username='unrelated_user',
            email='unrelated@example.com',
            password='Password123!'
        )

        # Create MoneyAccount
        self.account = MoneyAccountService.create_account(
            manager=self.manager,
            title="Rahul's Managed Ledger",
            owner_name="Rahul",
            owner_email="rahul@example.com"
        )

    def test_complete_e2e_lifecycle_and_notifications(self):
        # 1. Manager invites Rahul
        invitation = MoneyAccountService.create_invitation(
            account_id=self.account.id,
            sender=self.manager
        )
        
        # Confirm Rahul received invitation notification
        rahul_notifs = Notification.objects.filter(recipient=self.rahul)
        self.assertEqual(rahul_notifs.count(), 1)
        self.assertEqual(rahul_notifs.first().notification_type, 'MONEY_ACCOUNT_INVITED')
        self.assertEqual(rahul_notifs.first().is_read, False)

        # 2. Rahul accepts invitation
        MoneyAccountService.respond_invitation(
            token=invitation.token,
            user=self.rahul,
            accept=True
        )
        self.account.refresh_from_db()
        self.assertEqual(self.account.status, 'ACTIVE')
        self.assertEqual(self.account.owner, self.rahul)

        # Confirm Manager received INVITATION_ACCEPTED notification
        mgr_notifs = Notification.objects.filter(recipient=self.manager)
        self.assertEqual(mgr_notifs.count(), 1)
        self.assertEqual(mgr_notifs.first().notification_type, 'INVITATION_ACCEPTED')

        # 3. Manager deposits 5,000
        dep_tx = MoneyAccountService.add_transaction(
            account_id=self.account.id,
            created_by=self.manager,
            transaction_type='DEPOSIT',
            amount='5000.00',
            description='Initial deposit'
        )

        # Confirm Rahul received DEPOSIT_RECORDED notification
        rahul_dep_notif = Notification.objects.filter(recipient=self.rahul, notification_type='DEPOSIT_RECORDED').first()
        self.assertIsNotNone(rahul_dep_notif)
        self.assertIn('5000.00', rahul_dep_notif.message)

        # 4. Manager adds 700 expense & 500 expense
        exp1 = MoneyAccountService.add_transaction(
            account_id=self.account.id,
            created_by=self.manager,
            transaction_type='EXPENSE',
            amount='700.00',
            description='Books purchase'
        )
        exp2 = MoneyAccountService.add_transaction(
            account_id=self.account.id,
            created_by=self.manager,
            transaction_type='EXPENSE',
            amount='500.00',
            description='Groceries'
        )

        # 5. Confirm balance = 3,800
        stats = MoneyAccountService.calculate_balance(self.account)
        self.assertEqual(stats['balance'], Decimal('3800.00'))

        # Rahul views Money Held For Me via API
        self.client.force_authenticate(user=self.rahul)
        response = self.client.get(f'/api/v1/money-accounts/{self.account.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        summary = response.data['balance_summary']
        self.assertEqual(Decimal(summary['total_deposits']), Decimal('5000.00'))
        self.assertEqual(Decimal(summary['total_expenses']), Decimal('1200.00'))
        self.assertEqual(Decimal(summary['balance']), Decimal('3800.00'))

        # 6. Manager voids 500 expense
        MoneyAccountService.void_transaction(
            transaction_id=exp2.id,
            voided_by=self.manager,
            void_reason='Duplicate entry'
        )

        # Confirm Rahul received TRANSACTION_VOIDED notification
        void_notif = Notification.objects.filter(recipient=self.rahul, notification_type='TRANSACTION_VOIDED').first()
        self.assertIsNotNone(void_notif)

        # 7. Confirm updated balance = 4,300
        stats_after_void = MoneyAccountService.calculate_balance(self.account)
        self.assertEqual(stats_after_void['balance'], Decimal('4300.00'))

        # 8. Export CSV
        export_resp = self.client.get(f'/api/v1/money-accounts/{self.account.id}/export/')
        self.assertEqual(export_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(export_resp['Content-Type'], 'text/csv; charset=utf-8')
        csv_content = export_resp.content.decode('utf-8')
        self.assertIn('Date,Transaction ID,Transaction Type', csv_content)
        self.assertIn('Initial deposit', csv_content)
        self.assertIn('Books purchase', csv_content)
        self.assertIn('VOIDED', csv_content)

        # 9. Clear balance with Refund & Close Account
        MoneyAccountService.add_transaction(
            account_id=self.account.id,
            created_by=self.manager,
            transaction_type='REFUND',
            amount='4300.00',
            description='Full refund to owner'
        )
        MoneyAccountService.close_account(
            account_id=self.account.id,
            manager=self.manager
        )
        self.account.refresh_from_db()
        self.assertEqual(self.account.status, 'CLOSED')

        # Confirm ACCOUNT_CLOSED notification
        close_notif = Notification.objects.filter(recipient=self.rahul, notification_type='ACCOUNT_CLOSED').first()
        self.assertIsNotNone(close_notif)

        # Cannot add new transactions to closed account
        with self.assertRaises(Exception):
            MoneyAccountService.add_transaction(
                account_id=self.account.id,
                created_by=self.manager,
                transaction_type='EXPENSE',
                amount='10.00',
                description='Failed expense'
            )

    def test_notification_api_security_and_filtering(self):
        # Create notification for Rahul
        notif_rahul = Notification.objects.create(
            recipient=self.rahul,
            notification_type='MONEY_ACCOUNT_INVITED',
            title='Test Title',
            message='Test Message'
        )
        # Create notification for Manager
        notif_mgr = Notification.objects.create(
            recipient=self.manager,
            notification_type='INVITATION_ACCEPTED',
            title='Mgr Title',
            message='Mgr Message'
        )

        # Rahul fetches notifications
        self.client.force_authenticate(user=self.rahul)
        res = self.client.get('/api/v1/notifications/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['notifications']), 1)
        self.assertEqual(res.data['notifications'][0]['id'], str(notif_rahul.id))

        # Rahul tries to mark Manager's notification as read -> 403 PermissionDenied
        res_bad = self.client.post(f'/api/v1/notifications/{notif_mgr.id}/read/')
        self.assertEqual(res_bad.status_code, status.HTTP_403_FORBIDDEN)

        # Rahul marks own notification as read
        res_good = self.client.post(f'/api/v1/notifications/{notif_rahul.id}/read/')
        self.assertEqual(res_good.status_code, status.HTTP_200_OK)
        notif_rahul.refresh_from_db()
        self.assertTrue(notif_rahul.is_read)

        # Rahul calls read-all
        res_all = self.client.post('/api/v1/notifications/read-all/')
        self.assertEqual(res_all.status_code, status.HTTP_200_OK)

    def test_export_security_and_permissions(self):
        # Unrelated user tries to export -> 403
        self.client.force_authenticate(user=self.unrelated)
        res = self.client.get(f'/api/v1/money-accounts/{self.account.id}/export/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Manager can export
        self.client.force_authenticate(user=self.manager)
        res_mgr = self.client.get(f'/api/v1/money-accounts/{self.account.id}/export/')
        self.assertEqual(res_mgr.status_code, status.HTTP_200_OK)

    def test_invitation_token_security_and_edge_cases(self):
        # Create invitation
        inv = MoneyAccountService.create_invitation(account_id=self.account.id, sender=self.manager)

        # Reject invitation
        MoneyAccountService.respond_invitation(token=inv.token, user=self.rahul, accept=False)
        self.account.refresh_from_db()
        self.assertEqual(self.account.status, 'DRAFT')

        # Trying to use same token again fails
        with self.assertRaises(Exception):
            MoneyAccountService.respond_invitation(token=inv.token, user=self.rahul, accept=True)

        # Expired token test
        inv_expired = MoneyAccountService.create_invitation(account_id=self.account.id, sender=self.manager)
        inv_expired.expires_at = timezone.now() - timedelta(days=1)
        inv_expired.save()

        with self.assertRaises(Exception):
            MoneyAccountService.respond_invitation(token=inv_expired.token, user=self.rahul, accept=True)

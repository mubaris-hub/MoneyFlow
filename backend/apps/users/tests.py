from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


class AuthAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse('auth_register')
        self.login_url = reverse('auth_login')
        self.me_url = reverse('auth_me')
        
        self.user_data = {
            "first_name": "Jane",
            "last_name": "Doe",
            "username": "janedoe",
            "email": "jane@example.com",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "default_currency": "INR"
        }

    def test_user_registration_success(self):
        response = self.client.post(self.register_url, self.user_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('tokens', response.data)
        self.assertIn('access', response.data['tokens'])
        self.assertEqual(response.data['user']['email'], "jane@example.com")
        self.assertEqual(response.data['user']['default_currency'], "INR")

    def test_user_registration_password_mismatch(self):
        data = self.user_data.copy()
        data['confirm_password'] = 'WrongPassword!'
        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('confirm_password', response.data)

    def test_user_login_success_with_email(self):
        # Register user first
        self.client.post(self.register_url, self.user_data, format='json')
        
        # Login
        login_data = {
            "identifier": "jane@example.com",
            "password": "Password123!"
        }
        response = self.client.post(self.login_url, login_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('tokens', response.data)
        self.assertIn('access', response.data['tokens'])

    def test_user_login_success_with_username(self):
        self.client.post(self.register_url, self.user_data, format='json')
        
        login_data = {
            "identifier": "janedoe",
            "password": "Password123!"
        }
        response = self.client.post(self.login_url, login_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('tokens', response.data)

    def test_user_login_invalid_password(self):
        self.client.post(self.register_url, self.user_data, format='json')
        
        login_data = {
            "identifier": "jane@example.com",
            "password": "WrongPassword!"
        }
        response = self.client.post(self.login_url, login_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_me_endpoint_unauthenticated(self):
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_endpoint_authenticated(self):
        reg_resp = self.client.post(self.register_url, self.user_data, format='json')
        token = reg_resp.data['tokens']['access']
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['email'], 'jane@example.com')

    def test_password_reset_request_generic_response_for_known_and_unknown_email(self):
        self.client.post(self.register_url, self.user_data, format='json')
        reset_url = reverse('password_reset_request')

        # Known email
        resp1 = self.client.post(reset_url, {"email": "jane@example.com"}, format='json')
        self.assertEqual(resp1.status_code, status.HTTP_200_OK)
        self.assertEqual(resp1.data['message'], "If an account with that email exists, a password reset link has been sent.")

        # Unknown email
        resp2 = self.client.post(reset_url, {"email": "unknown@example.com"}, format='json')
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        self.assertEqual(resp2.data['message'], "If an account with that email exists, a password reset link has been sent.")

    def test_password_reset_email_sent_to_mail_outbox(self):
        from django.core import mail
        self.client.post(self.register_url, self.user_data, format='json')
        reset_url = reverse('password_reset_request')

        response = self.client.post(reset_url, {"email": "jane@example.com"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertEqual(len(mail.outbox), 1)
        sent_email = mail.outbox[0]
        self.assertEqual(sent_email.to, ["jane@example.com"])
        self.assertIn("Password Reset Request", sent_email.subject)
        self.assertIn("/reset-password?uid=", sent_email.body)
        self.assertIn("&token=", sent_email.body)

    def test_password_reset_confirm_successful_flow(self):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes

        self.client.post(self.register_url, self.user_data, format='json')
        user = User.objects.get(email="jane@example.com")
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        confirm_url = reverse('password_reset_confirm')
        confirm_data = {
            "uid": uid,
            "token": token,
            "new_password": "NewStrongPassword123!",
            "confirm_password": "NewStrongPassword123!"
        }
        response = self.client.post(confirm_url, confirm_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify old password no longer works
        old_login = self.client.post(self.login_url, {"email": "jane@example.com", "password": "Password123!"}, format='json')
        self.assertEqual(old_login.status_code, status.HTTP_400_BAD_REQUEST)

        # Verify new password works
        new_login = self.client.post(self.login_url, {"email": "jane@example.com", "password": "NewStrongPassword123!"}, format='json')
        self.assertEqual(new_login.status_code, status.HTTP_200_OK)

    def test_password_reset_confirm_invalid_token(self):
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes

        self.client.post(self.register_url, self.user_data, format='json')
        user = User.objects.get(email="jane@example.com")
        uid = urlsafe_base64_encode(force_bytes(user.pk))

        confirm_url = reverse('password_reset_confirm')
        confirm_data = {
            "uid": uid,
            "token": "invalid-token-123",
            "new_password": "NewStrongPassword123!",
            "confirm_password": "NewStrongPassword123!"
        }
        response = self.client.post(confirm_url, confirm_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_password_reset_confirm_password_mismatch(self):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes

        self.client.post(self.register_url, self.user_data, format='json')
        user = User.objects.get(email="jane@example.com")
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        confirm_url = reverse('password_reset_confirm')
        confirm_data = {
            "uid": uid,
            "token": token,
            "new_password": "NewStrongPassword123!",
            "confirm_password": "DifferentPassword123!"
        }
        response = self.client.post(confirm_url, confirm_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_password_reset_confirm_weak_password(self):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes

        self.client.post(self.register_url, self.user_data, format='json')
        user = User.objects.get(email="jane@example.com")
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        confirm_url = reverse('password_reset_confirm')
        confirm_data = {
            "uid": uid,
            "token": token,
            "new_password": "password",
            "confirm_password": "password"
        }
        response = self.client.post(confirm_url, confirm_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class UserSettingsAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="settings_user",
            email="settings@example.com",
            password="OriginalPassword123!",
            first_name="John",
            last_name="Doe",
            default_currency="INR"
        )
        self.other_user = User.objects.create_user(
            username="other_user",
            email="other@example.com",
            password="OriginalPassword123!",
            first_name="Other",
            last_name="Person"
        )
        self.me_url = reverse('auth_me')
        self.change_pwd_url = reverse('auth_change_password')
        self.deactivate_url = reverse('auth_deactivate_account')
        self.client.force_authenticate(user=self.user)

    def test_get_current_user_profile(self):
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user_data = response.data['user']
        self.assertEqual(user_data['email'], "settings@example.com")
        self.assertEqual(user_data['default_currency'], "INR")
        self.assertEqual(user_data['date_format'], "YYYY-MM-DD")
        self.assertTrue(user_data['notify_in_app'])

    def test_update_profile_success(self):
        update_data = {
            "first_name": "Johnny",
            "last_name": "Smith",
            "default_currency": "USD",
            "date_format": "DD/MM/YYYY",
            "notify_in_app": False,
            "notify_on_friend_ledgers": False
        }
        response = self.client.patch(self.me_url, update_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['first_name'], "Johnny")
        self.assertEqual(response.data['user']['last_name'], "Smith")
        self.assertEqual(response.data['user']['default_currency'], "USD")
        self.assertEqual(response.data['user']['date_format'], "DD/MM/YYYY")
        self.assertFalse(response.data['user']['notify_in_app'])
        self.assertFalse(response.data['user']['notify_on_friend_ledgers'])

        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Johnny")
        self.assertEqual(self.user.default_currency, "USD")
        self.assertFalse(self.user.notify_in_app)

    def test_update_profile_username_taken(self):
        response = self.client.patch(self.me_url, {"username": "other_user"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.data)

    def test_change_password_success(self):
        data = {
            "current_password": "OriginalPassword123!",
            "new_password": "BrandNewPassword123!",
            "confirm_password": "BrandNewPassword123!"
        }
        response = self.client.post(self.change_pwd_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("BrandNewPassword123!"))

    def test_change_password_wrong_current(self):
        data = {
            "current_password": "WrongPassword123!",
            "new_password": "BrandNewPassword123!",
            "confirm_password": "BrandNewPassword123!"
        }
        response = self.client.post(self.change_pwd_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_change_password_mismatch(self):
        data = {
            "current_password": "OriginalPassword123!",
            "new_password": "BrandNewPassword123!",
            "confirm_password": "DifferentPassword123!"
        }
        response = self.client.post(self.change_pwd_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_notification_preference_respected(self):
        from apps.notifications.services import NotificationService
        from apps.notifications.models import Notification

        # When notify_in_app is False, NotificationService returns None
        self.user.notify_in_app = False
        self.user.save()

        notif = NotificationService.create_notification(
            recipient=self.user,
            notification_type=Notification.NotificationType.DEPOSIT_RECORDED,
            title="Deposit Added",
            message="A deposit was made"
        )
        self.assertIsNone(notif)

        # When notify_in_app is True but notify_on_friend_ledgers is False
        self.user.notify_in_app = True
        self.user.notify_on_friend_ledgers = False
        self.user.save()

        notif2 = NotificationService.create_notification(
            recipient=self.user,
            notification_type=Notification.NotificationType.DEPOSIT_RECORDED,
            title="Deposit Added",
            message="A deposit was made"
        )
        self.assertIsNone(notif2)

    def test_deactivate_account_success(self):
        data = {
            "password": "OriginalPassword123!",
            "confirmation": "DELETE"
        }
        response = self.client.post(self.deactivate_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)



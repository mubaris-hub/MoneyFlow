import secrets
from decimal import Decimal, ROUND_HALF_UP
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

from django.contrib.auth import get_user_model
from apps.notifications.services import NotificationService

from .models import (
    MoneyAccount,
    AccountTransaction,
    AccountInvitation,
    AccountAuditLog,
    AccountCategory
)
from .validators import validate_receipt_file

ZERO = Decimal('0.00')


def to_decimal(val) -> Decimal:
    """Safely convert any numeric value or string to Decimal formatted to 2 decimal places."""
    if val is None:
        return ZERO
    if isinstance(val, Decimal):
        d = val
    else:
        d = Decimal(str(val))
    return d.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


class MoneyAccountService:
    @staticmethod
    def calculate_balance(account: MoneyAccount) -> dict:
        """
        Calculate exact balance for non-voided transactions using pure Decimal arithmetic:
        Balance = Deposits - Expenses - Refunds + Adjustments
        """
        txs = account.transactions.filter(is_voided=False)
        
        deposits = ZERO
        expenses = ZERO
        refunds = ZERO
        adjustments = ZERO
        
        for tx in txs:
            amt = to_decimal(tx.amount)
            if tx.transaction_type == 'DEPOSIT':
                deposits += amt
            elif tx.transaction_type == 'EXPENSE':
                expenses += amt
            elif tx.transaction_type == 'REFUND':
                refunds += amt
            elif tx.transaction_type == 'ADJUSTMENT':
                # Adjustments can be positive or negative
                adjustments += amt

        balance = deposits - expenses - refunds + adjustments
        
        return {
            'balance': balance.quantize(Decimal('0.01')),
            'total_deposits': deposits.quantize(Decimal('0.01')),
            'total_expenses': expenses.quantize(Decimal('0.01')),
            'total_refunds': refunds.quantize(Decimal('0.01')),
            'total_adjustments': adjustments.quantize(Decimal('0.01')),
        }

    @staticmethod
    def create_account(
        manager,
        title: str,
        owner_name: str,
        owner_email: str,
        owner=None,
        currency: str = 'INR',
        allow_overdraft: bool = False,
        notes: str = ''
    ) -> MoneyAccount:
        """
        Creates a new custodial MoneyAccount managed by manager for owner.
        """
        if owner and owner == manager:
            raise ValidationError("Account manager cannot be the owner of their own custodial account.")

        with transaction.atomic():
            account = MoneyAccount.objects.create(
                manager=manager,
                owner=owner,
                owner_name=owner_name,
                owner_email=owner_email.lower().strip(),
                title=title,
                currency=currency,
                status='ACTIVE' if owner else 'DRAFT',
                allow_overdraft=allow_overdraft,
                notes=notes
            )
            
            AccountAuditLog.objects.create(
                account=account,
                actor=manager,
                action='ACCOUNT_CREATED',
                details={
                    'title': title,
                    'owner_email': owner_email,
                    'owner_name': owner_name,
                    'allow_overdraft': allow_overdraft
                }
            )
            
            return account

    @staticmethod
    def add_transaction(
        account_id,
        created_by,
        transaction_type: str,
        amount,
        description: str,
        category=None,
        date=None,
        notes: str = '',
        receipt_url: str = None,
        receipt_image=None
    ) -> AccountTransaction:
        """
        Adds a transaction to the account with atomic lock and overdraft protection.
        """
        if transaction_type not in dict(AccountTransaction.TRANSACTION_TYPE_CHOICES):
            raise ValidationError(f"Invalid transaction type: {transaction_type}")

        if receipt_image:
            validate_receipt_file(receipt_image)

        dec_amount = to_decimal(amount)

        if transaction_type in ['DEPOSIT', 'EXPENSE', 'REFUND']:
            if dec_amount <= ZERO:
                raise ValidationError("Amount must be greater than zero for DEPOSIT, EXPENSE, or REFUND.")

        if transaction_type == 'ADJUSTMENT':
            if dec_amount == ZERO:
                raise ValidationError("Adjustment amount cannot be zero.")
            if not notes or not notes.strip():
                raise ValidationError("Reason (notes) is mandatory for balance adjustments.")

        with transaction.atomic():
            account = MoneyAccount.objects.select_for_update().get(id=account_id)

            if account.status == 'CLOSED':
                raise ValidationError("Cannot add transactions to a closed account.")

            if created_by != account.manager:
                raise ValidationError("Only the account manager can add transactions.")

            # Calculate current balance before adding transaction
            stats = MoneyAccountService.calculate_balance(account)
            current_balance = stats['balance']

            # Calculate impact of this transaction
            if transaction_type == 'DEPOSIT':
                impact = dec_amount
            elif transaction_type == 'EXPENSE':
                impact = -dec_amount
            elif transaction_type == 'REFUND':
                impact = -dec_amount
            elif transaction_type == 'ADJUSTMENT':
                impact = dec_amount

            new_balance = current_balance + impact

            if not account.allow_overdraft and new_balance < ZERO:
                raise ValidationError(
                    f"Transaction amount ({dec_amount}) exceeds available balance ({current_balance}). Overdraft is not enabled."
                )

            tx_date = date or timezone.now().date()

            tx = AccountTransaction.objects.create(
                account=account,
                transaction_type=transaction_type,
                amount=dec_amount,
                description=description,
                category=category,
                date=tx_date,
                notes=notes,
                receipt_url=receipt_url,
                receipt_image=receipt_image,
                receipt_uploaded_at=timezone.now() if receipt_image else None,
                created_by=created_by
            )

            AccountAuditLog.objects.create(
                account=account,
                actor=created_by,
                action='TRANSACTION_CREATED',
                details={
                    'transaction_id': str(tx.id),
                    'transaction_type': transaction_type,
                    'amount': str(dec_amount),
                    'description': description,
                    'new_balance': str(new_balance)
                }
            )

            if account.owner and account.status == 'ACTIVE':
                type_map = {
                    'DEPOSIT': ('DEPOSIT_RECORDED', 'Deposit Recorded', f"Deposit of ₹{dec_amount} recorded in '{account.title}'."),
                    'EXPENSE': ('EXPENSE_RECORDED', 'Expense Recorded', f"Expense of ₹{dec_amount} ({description}) recorded in '{account.title}'."),
                    'REFUND': ('REFUND_RECORDED', 'Refund Recorded', f"Refund of ₹{dec_amount} recorded in '{account.title}'."),
                    'ADJUSTMENT': ('ADJUSTMENT_RECORDED', 'Adjustment Recorded', f"Adjustment of ₹{dec_amount} recorded in '{account.title}'.")
                }
                n_type, n_title, n_msg = type_map.get(transaction_type, ('DEPOSIT_RECORDED', 'Transaction Recorded', f"Transaction recorded in '{account.title}'."))
                NotificationService.create_notification(
                    recipient=account.owner,
                    notification_type=n_type,
                    title=n_title,
                    message=n_msg,
                    money_account=account,
                    transaction=tx,
                    actor=created_by
                )

            return tx

    @staticmethod
    def void_transaction(transaction_id, voided_by, void_reason: str) -> AccountTransaction:
        """
        Soft-voids a transaction while enforcing audit rules and overdraft protection.
        """
        if not void_reason or not void_reason.strip():
            raise ValidationError("A valid void reason is mandatory.")

        with transaction.atomic():
            tx = AccountTransaction.objects.select_for_update().get(id=transaction_id)
            account = MoneyAccount.objects.select_for_update().get(id=tx.account_id)

            if tx.is_voided:
                raise ValidationError("Transaction is already voided.")

            if voided_by != account.manager:
                raise ValidationError("Only the account manager can void transactions.")

            # Check if voiding this transaction breaks non-overdraft rule
            # Temporarily calculate balance if tx were voided
            tx.is_voided = True
            stats = MoneyAccountService.calculate_balance(account)
            new_balance = stats['balance']

            if not account.allow_overdraft and new_balance < ZERO:
                tx.is_voided = False  # revert
                raise ValidationError(
                    f"Cannot void transaction as it would cause the account balance to drop to {new_balance} (below zero)."
                )

            # Apply voiding
            tx.voided_at = timezone.now()
            tx.voided_by = voided_by
            tx.void_reason = void_reason
            tx.save()

            AccountAuditLog.objects.create(
                account=account,
                actor=voided_by,
                action='TRANSACTION_VOIDED',
                details={
                    'transaction_id': str(tx.id),
                    'transaction_type': tx.transaction_type,
                    'amount': str(tx.amount),
                    'void_reason': void_reason,
                    'new_balance': str(new_balance)
                }
            )

            if account.owner:
                NotificationService.create_notification(
                    recipient=account.owner,
                    notification_type='TRANSACTION_VOIDED',
                    title='Transaction Voided',
                    message=f"Transaction '{tx.description}' of ₹{tx.amount} was voided in '{account.title}'.",
                    money_account=account,
                    transaction=tx,
                    actor=voided_by
                )

            return tx

    @staticmethod
    def update_receipt(transaction_id, manager, receipt_image=None, remove_receipt=False) -> AccountTransaction:
        """
        Uploads, replaces, or removes a receipt image for a transaction.
        Does NOT alter transaction amounts, transaction types, or account balances.
        """
        with transaction.atomic():
            tx = AccountTransaction.objects.select_for_update().get(id=transaction_id)
            account = MoneyAccount.objects.select_for_update().get(id=tx.account_id)

            if manager != account.manager:
                raise ValidationError("Only the account manager can modify transaction receipts.")

            if account.status == 'CLOSED':
                raise ValidationError("Cannot modify receipts on a closed account.")

            if tx.is_voided:
                raise ValidationError("Cannot modify receipts on a voided transaction.")

            if remove_receipt:
                if tx.receipt_image:
                    tx.receipt_image.delete(save=False)
                tx.receipt_image = None
                tx.receipt_uploaded_at = None
                tx.save()

                AccountAuditLog.objects.create(
                    account=account,
                    actor=manager,
                    action='RECEIPT_REMOVED',
                    details={'transaction_id': str(tx.id)}
                )
            elif receipt_image:
                validate_receipt_file(receipt_image)
                if tx.receipt_image:
                    tx.receipt_image.delete(save=False)
                tx.receipt_image = receipt_image
                tx.receipt_uploaded_at = timezone.now()
                tx.save()

                AccountAuditLog.objects.create(
                    account=account,
                    actor=manager,
                    action='RECEIPT_UPDATED',
                    details={'transaction_id': str(tx.id)}
                )
            else:
                raise ValidationError("No receipt file provided or remove action specified.")

            return tx

    @staticmethod
    def create_invitation(account_id, sender) -> AccountInvitation:
        """
        Generates a cryptographically secure, expiring invitation token for the owner.
        """
        with transaction.atomic():
            account = MoneyAccount.objects.select_for_update().get(id=account_id)

            if sender != account.manager:
                raise ValidationError("Only the manager can send account invitations.")

            if account.status == 'CLOSED':
                raise ValidationError("Cannot invite users to a closed account.")

            # Invalidate any existing pending invitations
            account.invitations.filter(status='PENDING').update(status='EXPIRED')

            token = secrets.token_urlsafe(32)
            expires_at = timezone.now() + timedelta(days=7)

            invitation = AccountInvitation.objects.create(
                account=account,
                sender=sender,
                recipient_email=account.owner_email.lower(),
                token=token,
                status='PENDING',
                expires_at=expires_at
            )

            account.status = 'INVITED'
            account.save()

            AccountAuditLog.objects.create(
                account=account,
                actor=sender,
                action='INVITATION_SENT',
                details={
                    'invitation_id': str(invitation.id),
                    'recipient_email': account.owner_email,
                    'expires_at': expires_at.isoformat()
                }
            )

            try:
                User = get_user_model()
                target_user = User.objects.get(email__iexact=account.owner_email.lower())
                if target_user != sender:
                    sender_name = sender.first_name or sender.email
                    NotificationService.create_notification(
                        recipient=target_user,
                        notification_type='MONEY_ACCOUNT_INVITED',
                        title='Money Account Invitation',
                        message=f"{sender_name} invited you to view the Money Account '{account.title}'.",
                        money_account=account,
                        actor=sender
                    )
            except Exception:
                pass

            return invitation

    @staticmethod
    def respond_invitation(token: str, user, accept: bool) -> MoneyAccount:
        """
        Process explicit acceptance or rejection of an invitation token by the owner.
        """
        with transaction.atomic():
            invitation = AccountInvitation.objects.select_for_update().get(token=token)
            account = MoneyAccount.objects.select_for_update().get(id=invitation.account_id)

            if invitation.status != 'PENDING':
                raise ValidationError(f"Invitation is no longer pending (current status: {invitation.status}).")

            if invitation.expires_at <= timezone.now():
                invitation.status = 'EXPIRED'
                invitation.save()
                raise ValidationError("Invitation token has expired.")

            if user.email.lower() != invitation.recipient_email.lower():
                raise ValidationError("Your account email does not match the invitation email.")

            if accept:
                invitation.status = 'ACCEPTED'
                invitation.save()

                account.owner = user
                account.status = 'ACTIVE'
                account.save()

                AccountAuditLog.objects.create(
                    account=account,
                    actor=user,
                    action='INVITATION_ACCEPTED',
                    details={'owner_id': str(user.id), 'owner_email': user.email}
                )

                user_name = user.first_name or user.email
                NotificationService.create_notification(
                    recipient=account.manager,
                    notification_type='INVITATION_ACCEPTED',
                    title='Invitation Accepted',
                    message=f"{user_name} accepted your invitation for Money Account '{account.title}'.",
                    money_account=account,
                    actor=user
                )
            else:
                invitation.status = 'REJECTED'
                invitation.save()

                # Rejection returns status to DRAFT
                account.status = 'DRAFT'
                account.save()

                AccountAuditLog.objects.create(
                    account=account,
                    actor=user,
                    action='INVITATION_REJECTED',
                    details={'rejected_by_email': user.email}
                )

                user_name = user.first_name or user.email
                NotificationService.create_notification(
                    recipient=account.manager,
                    notification_type='INVITATION_REJECTED',
                    title='Invitation Rejected',
                    message=f"{user_name} rejected your invitation for Money Account '{account.title}'.",
                    money_account=account,
                    actor=user
                )

            return account

    @staticmethod
    def close_account(account_id, manager) -> MoneyAccount:
        """
        Closes an account. Requires the remaining balance to be exactly ₹0.00.
        """
        with transaction.atomic():
            account = MoneyAccount.objects.select_for_update().get(id=account_id)

            if manager != account.manager:
                raise ValidationError("Only the account manager can close the account.")

            stats = MoneyAccountService.calculate_balance(account)
            balance = stats['balance']

            if balance != ZERO:
                raise ValidationError(f"Cannot close account with non-zero balance ({balance}). Balance must be exactly ₹0.00.")

            account.status = 'CLOSED'
            account.closed_at = timezone.now()
            account.save()

            AccountAuditLog.objects.create(
                account=account,
                actor=manager,
                action='ACCOUNT_CLOSED',
                details={'final_balance': '0.00'}
            )

            if account.owner:
                NotificationService.create_notification(
                    recipient=account.owner,
                    notification_type='ACCOUNT_CLOSED',
                    title='Account Closed',
                    message=f"Money Account '{account.title}' has been closed.",
                    money_account=account,
                    actor=manager
                )

            return account

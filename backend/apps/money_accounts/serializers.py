from decimal import Decimal
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    MoneyAccount,
    AccountTransaction,
    AccountInvitation,
    AccountCategory
)
from .services import MoneyAccountService, ZERO

User = get_user_model()


class UserSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']


class AccountCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = AccountCategory
        fields = ['id', 'name', 'icon', 'is_system']


class MoneyAccountSerializer(serializers.ModelSerializer):
    manager = UserSummarySerializer(read_only=True)
    owner = UserSummarySerializer(read_only=True)
    balance_summary = serializers.SerializerMethodField()

    class Meta:
        model = MoneyAccount
        fields = [
            'id', 'title', 'manager', 'owner', 'owner_name', 'owner_email',
            'currency', 'status', 'allow_overdraft', 'notes', 'closed_at',
            'balance_summary', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'manager', 'owner', 'status', 'closed_at',
            'created_at', 'updated_at', 'balance_summary'
        ]

    def get_balance_summary(self, obj):
        return MoneyAccountService.calculate_balance(obj)


class CreateMoneyAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = MoneyAccount
        fields = ['title', 'owner_name', 'owner_email', 'currency', 'allow_overdraft', 'notes']

    def validate_owner_email(self, value):
        return value.lower().strip()


class UpdateMoneyAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = MoneyAccount
        fields = ['title', 'owner_name', 'currency', 'allow_overdraft', 'notes']


class AccountTransactionSerializer(serializers.ModelSerializer):
    category = AccountCategorySerializer(read_only=True)
    created_by = UserSummarySerializer(read_only=True)
    voided_by = UserSummarySerializer(read_only=True)
    receipt_image_url = serializers.SerializerMethodField()

    class Meta:
        model = AccountTransaction
        fields = [
            'id', 'account_id', 'transaction_type', 'amount', 'description',
            'category', 'date', 'receipt_url', 'receipt_image_url', 'receipt_uploaded_at',
            'notes', 'is_voided', 'voided_at', 'voided_by', 'void_reason',
            'created_by', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'account_id', 'receipt_image_url', 'receipt_uploaded_at', 'is_voided',
            'voided_at', 'voided_by', 'void_reason', 'created_by',
            'created_at', 'updated_at'
        ]

    def get_receipt_image_url(self, obj):
        if obj.receipt_image:
            return f"/api/v1/money-accounts/{obj.account_id}/transactions/{obj.id}/receipt/"
        return None


class CreateTransactionSerializer(serializers.Serializer):
    transaction_type = serializers.ChoiceField(choices=AccountTransaction.TRANSACTION_TYPE_CHOICES)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    description = serializers.CharField(max_length=255)
    category_id = serializers.IntegerField(required=False, allow_null=True)
    date = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    receipt_url = serializers.URLField(required=False, allow_null=True, allow_blank=True)
    receipt_image = serializers.FileField(required=False, allow_null=True)

    def validate(self, data):
        tx_type = data['transaction_type']
        amt = data['amount']
        notes = data.get('notes', '')

        if tx_type in ['DEPOSIT', 'EXPENSE', 'REFUND']:
            if amt <= ZERO:
                raise serializers.ValidationError({"amount": "Amount must be greater than zero."})
        elif tx_type == 'ADJUSTMENT':
            if amt == ZERO:
                raise serializers.ValidationError({"amount": "Adjustment amount cannot be zero."})
            if not notes or not notes.strip():
                raise serializers.ValidationError({"notes": "Notes / reason is mandatory for adjustments."})

        return data


class VoidTransactionSerializer(serializers.Serializer):
    void_reason = serializers.CharField(max_length=500, required=True)

    def validate_void_reason(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("A valid void reason is required.")
        return value.strip()


class AccountInvitationSerializer(serializers.ModelSerializer):
    sender = UserSummarySerializer(read_only=True)

    class Meta:
        model = AccountInvitation
        fields = ['id', 'account_id', 'sender', 'recipient_email', 'status', 'created_at', 'expires_at']
        read_only_fields = ['id', 'account_id', 'sender', 'recipient_email', 'status', 'created_at', 'expires_at']


class RespondInvitationSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['ACCEPT', 'REJECT'])

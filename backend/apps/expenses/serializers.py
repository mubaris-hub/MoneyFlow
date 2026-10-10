from decimal import Decimal
from rest_framework import serializers

from django.db import transaction
from django.utils import timezone
from django.contrib.auth import get_user_model
from .models import Category, Expense, ExpenseSplit, DirectPayment
from .services import calculate_expense_splits
from apps.users.serializers import UserSerializer
from apps.groups.models import Group, GroupMember

User = get_user_model()


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'icon', 'is_system']


class ExpenseSplitSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = ExpenseSplit
        fields = ['id', 'user', 'amount', 'percentage', 'shares']


class ExpenseSerializer(serializers.ModelSerializer):
    paid_by = UserSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    category = CategorySerializer(read_only=True)
    splits = ExpenseSplitSerializer(many=True, read_only=True)
    my_share = serializers.SerializerMethodField()

    class Meta:
        model = Expense
        fields = [
            'id', 'description', 'total_amount', 'currency',
            'paid_by', 'created_by', 'group', 'category',
            'split_type', 'date', 'notes', 'receipt_url',
            'splits', 'my_share', 'created_at', 'updated_at'
        ]

    def get_my_share(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        split = obj.splits.filter(user=request.user).first()
        return str(split.amount) if split else '0.00'


class ParticipantSplitInputSerializer(serializers.Serializer):
    user_id = serializers.UUIDField(required=True)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    percentage = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, allow_null=True)
    shares = serializers.IntegerField(required=False, allow_null=True)


class CreateExpenseSerializer(serializers.ModelSerializer):
    group_id = serializers.UUIDField(required=True, write_only=True)
    category_id = serializers.IntegerField(required=True, write_only=True)
    paid_by_id = serializers.UUIDField(required=True, write_only=True)
    splits = ParticipantSplitInputSerializer(many=True, required=True, write_only=True)

    class Meta:
        model = Expense
        fields = [
            'id', 'description', 'total_amount', 'currency',
            'group_id', 'category_id', 'paid_by_id', 'split_type',
            'date', 'notes', 'receipt_url', 'splits'
        ]

    def validate(self, attrs):
        request_user = self.context['request'].user
        group_id = attrs['group_id']
        paid_by_id = attrs['paid_by_id']
        category_id = attrs['category_id']
        splits_input = attrs['splits']

        # 1. Verify Group exists
        group = Group.objects.filter(id=group_id).first()
        if not group:
            raise serializers.ValidationError({"group_id": "Group does not exist."})

        # 2. Enforce Backend Group Membership for Creator
        if not GroupMember.objects.filter(group=group, user=request_user).exists():
            raise serializers.ValidationError({"group_id": "You must be a member of this group to add an expense."})

        # 3. Enforce Backend Group Membership for Paid By user
        paid_by_user = User.objects.filter(id=paid_by_id).first()
        if not paid_by_user or not GroupMember.objects.filter(group=group, user=paid_by_user).exists():
            raise serializers.ValidationError({"paid_by_id": "The user specified in paid_by must be an active member of the group."})

        # 4. Verify Category exists
        category = Category.objects.filter(id=category_id).first()
        if not category:
            raise serializers.ValidationError({"category_id": "Category does not exist."})

        # 5. Enforce Backend Group Membership for EVERY participant in splits
        member_user_ids = set(GroupMember.objects.filter(group=group).values_list('user_id', flat=True))
        for p in splits_input:
            uid = p['user_id']
            if uid not in member_user_ids:
                raise serializers.ValidationError({"splits": f"User {uid} is not a member of group {group.name}."})

        # 6. Perform Split Calculation Math Engine
        calculated_splits = calculate_expense_splits(
            total_amount=attrs['total_amount'],
            split_type=attrs.get('split_type', 'EQUAL'),
            participants=splits_input
        )

        attrs['validated_group'] = group
        attrs['validated_paid_by'] = paid_by_user
        attrs['validated_category'] = category
        attrs['calculated_splits'] = calculated_splits
        return attrs

    def create(self, validated_data):
        request_user = self.context['request'].user
        group = validated_data['validated_group']
        paid_by = validated_data['validated_paid_by']
        category = validated_data['validated_category']
        calculated_splits = validated_data['calculated_splits']

        # Atomic Transaction: Expense + all ExpenseSplit records created together
        with transaction.atomic():
            date_val = validated_data.get('date') or timezone.now().date()
            expense = Expense.objects.create(
                description=validated_data['description'],
                total_amount=validated_data['total_amount'],
                currency=validated_data.get('currency', 'INR'),
                paid_by=paid_by,
                created_by=request_user,
                group=group,
                category=category,
                split_type=validated_data.get('split_type', 'EQUAL'),
                date=date_val,
                notes=validated_data.get('notes', ''),
                receipt_url=validated_data.get('receipt_url')
            )

            split_objects = [
                ExpenseSplit(
                    expense=expense,
                    user_id=s['user_id'],
                    amount=s['amount'],
                    percentage=s['percentage'],
                    shares=s['shares']
                )
                for s in calculated_splits
            ]
            ExpenseSplit.objects.bulk_create(split_objects)

        return expense


class DirectPaymentSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    receiver = UserSerializer(read_only=True)
    receiver_id = serializers.UUIDField(write_only=True, required=True)
    group_id = serializers.UUIDField(write_only=True, required=True)

    class Meta:
        model = DirectPayment
        fields = ['id', 'sender', 'receiver', 'receiver_id', 'group_id', 'amount', 'currency', 'date', 'notes', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate(self, attrs):
        request_user = self.context['request'].user
        group_id = attrs['group_id']
        receiver_id = attrs['receiver_id']

        group = Group.objects.filter(id=group_id).first()
        if not group or not GroupMember.objects.filter(group=group, user=request_user).exists():
            raise serializers.ValidationError({"group_id": "You must belong to this group to record a direct payment."})

        receiver = User.objects.filter(id=receiver_id).first()
        if not receiver or not GroupMember.objects.filter(group=group, user=receiver).exists():
            raise serializers.ValidationError({"receiver_id": "Receiver must be an active member of the group."})

        if str(request_user.id) == str(receiver_id):
            raise serializers.ValidationError({"receiver_id": "Sender and receiver cannot be the same user."})

        attrs['validated_group'] = group
        attrs['validated_receiver'] = receiver
        return attrs

    def create(self, validated_data):
        request_user = self.context['request'].user
        return DirectPayment.objects.create(
            sender=request_user,
            receiver=validated_data['validated_receiver'],
            group=validated_data['validated_group'],
            amount=validated_data['amount'],
            currency=validated_data.get('currency', 'INR'),
            date=validated_data.get('date'),
            notes=validated_data.get('notes', '')
        )


class SettlementSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    receiver = UserSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)

    class Meta:
        from .models import Settlement
        model = Settlement
        fields = [
            'id', 'group', 'sender', 'receiver', 'amount',
            'currency', 'date', 'status', 'notes',
            'created_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'group', 'created_by', 'created_at', 'updated_at']


class CreateSettlementSerializer(serializers.ModelSerializer):
    sender_id = serializers.UUIDField(required=True, write_only=True)
    receiver_id = serializers.UUIDField(required=True, write_only=True)

    class Meta:
        from .models import Settlement
        model = Settlement
        fields = ['id', 'sender_id', 'receiver_id', 'amount', 'currency', 'date', 'status', 'notes']

    def validate(self, attrs):
        from .models import Settlement
        request_user = self.context['request'].user
        group = self.context['group']
        sender_id = attrs['sender_id']
        receiver_id = attrs['receiver_id']

        if attrs['amount'] <= Decimal('0.00'):
            raise serializers.ValidationError({"amount": "Settlement amount must be greater than zero."})

        if str(sender_id) == str(receiver_id):
            raise serializers.ValidationError({"receiver_id": "Sender and receiver cannot be the same user."})

        sender = User.objects.filter(id=sender_id).first()
        if not sender or not GroupMember.objects.filter(group=group, user=sender).exists():
            raise serializers.ValidationError({"sender_id": "Sender must be an active member of the group."})

        receiver = User.objects.filter(id=receiver_id).first()
        if not receiver or not GroupMember.objects.filter(group=group, user=receiver).exists():
            raise serializers.ValidationError({"receiver_id": "Receiver must be an active member of the group."})

        attrs['validated_sender'] = sender
        attrs['validated_receiver'] = receiver
        return attrs

    def create(self, validated_data):
        from .models import Settlement
        request_user = self.context['request'].user
        group = self.context['group']
        date_val = validated_data.get('date') or timezone.now().date()
        status_val = validated_data.get('status', 'COMPLETED')

        return Settlement.objects.create(
            group=group,
            sender=validated_data['validated_sender'],
            receiver=validated_data['validated_receiver'],
            amount=validated_data['amount'],
            currency=validated_data.get('currency', 'INR'),
            date=date_val,
            status=status_val,
            notes=validated_data.get('notes', ''),
            created_by=request_user
        )


from decimal import Decimal
from rest_framework import serializers
from .models import PersonalCategory, PersonalTransaction, PersonalBudget


class PersonalCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonalCategory
        fields = [
            'id',
            'name',
            'icon',
            'color',
            'category_type',
            'is_system',
            'created_at'
        ]
        read_only_fields = ['id', 'is_system', 'created_at']

    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['user'] = user
        validated_data['is_system'] = False
        return super().create(validated_data)


class PersonalTransactionSerializer(serializers.ModelSerializer):
    category_detail = PersonalCategorySerializer(source='category', read_only=True)

    class Meta:
        model = PersonalTransaction
        fields = [
            'id',
            'transaction_type',
            'amount',
            'title',
            'category',
            'category_detail',
            'category_name',
            'date',
            'time',
            'payment_method',
            'notes',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'category_name', 'created_at', 'updated_at']

    def validate_amount(self, value):
        if value is None or Decimal(value) <= Decimal('0.00'):
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value

    def validate_title(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Title or description is required.")
        return value.strip()

    def validate(self, attrs):
        user = self.context['request'].user
        category = attrs.get('category')
        if category and not category.is_system and category.user_id != user.id:
            raise serializers.ValidationError({"category": "You do not have access to this category."})
        return attrs

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        category = validated_data.get('category')
        if category and not validated_data.get('category_name'):
            validated_data['category_name'] = category.name
        return super().create(validated_data)

    def update(self, instance, validated_data):
        category = validated_data.get('category', instance.category)
        if category:
            validated_data['category_name'] = category.name
        return super().update(instance, validated_data)


class PersonalBudgetSerializer(serializers.ModelSerializer):
    category_detail = PersonalCategorySerializer(source='category', read_only=True)

    class Meta:
        model = PersonalBudget
        fields = [
            'id',
            'month',
            'year',
            'category',
            'category_detail',
            'amount',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_month(self, value):
        if value < 1 or value > 12:
            raise serializers.ValidationError("Month must be between 1 and 12.")
        return value

    def validate_year(self, value):
        if value < 2000 or value > 2100:
            raise serializers.ValidationError("Year must be a valid four-digit year.")
        return value

    def validate_amount(self, value):
        if value is None or Decimal(value) <= Decimal('0.00'):
            raise serializers.ValidationError("Budget amount must be greater than zero.")
        return value

    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['user'] = user

        # Update or create to prevent duplicates
        budget, created = PersonalBudget.objects.update_or_create(
            user=user,
            year=validated_data['year'],
            month=validated_data['month'],
            category=validated_data.get('category'),
            defaults={'amount': validated_data['amount']}
        )
        return budget


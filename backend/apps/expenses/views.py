from rest_framework import status, permissions, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction

from .models import Category, Expense, ExpenseSplit, DirectPayment
from .serializers import (
    CategorySerializer,
    ExpenseSerializer,
    CreateExpenseSerializer,
    DirectPaymentSerializer
)
from .permissions import IsExpenseGroupMember, CanModifySettlement
from apps.groups.permissions import IsGroupMember
from apps.groups.models import Group, GroupMember




class CategoryListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        categories = Category.objects.all().order_by('id')
        serializer = CategorySerializer(categories, many=True)
        return Response({'categories': serializer.data}, status=status.HTTP_200_OK)


class ExpenseListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        queryset = Expense.objects.filter(
            group__memberships__user=request.user,
            is_deleted=False
        ).distinct()

        # Filtering options
        group_id = request.query_params.get('group_id')
        category_id = request.query_params.get('category_id')
        search = request.query_params.get('search')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')

        if group_id:
            queryset = queryset.filter(group_id=group_id)
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        if search:
            queryset = queryset.filter(description__icontains=search.strip())
        if date_from:
            queryset = queryset.filter(date__gte=date_from)
        if date_to:
            queryset = queryset.filter(date__lte=date_to)

        serializer = ExpenseSerializer(queryset, many=True, context={'request': request})
        return Response({'expenses': serializer.data}, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = CreateExpenseSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            expense = serializer.save()
            full_serializer = ExpenseSerializer(expense, context={'request': request})
            return Response({
                'message': 'Expense recorded successfully',
                'expense': full_serializer.data
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ExpenseDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsExpenseGroupMember]

    def get_object(self, pk, user):
        expense = get_object_or_404(Expense, pk=pk, is_deleted=False)
        self.check_object_permissions(self.request, expense)
        return expense

    def get(self, request, pk):
        expense = self.get_object(pk, request.user)
        serializer = ExpenseSerializer(expense, context={'request': request})
        return Response({'expense': serializer.data}, status=status.HTTP_200_OK)

    def put(self, request, pk):
        expense = self.get_object(pk, request.user)
        serializer = CreateExpenseSerializer(expense, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            # Update splits atomically
            with transaction.atomic():
                if 'splits' in request.data:
                    expense.splits.all().delete()
                updated_expense = serializer.save()

            full_serializer = ExpenseSerializer(updated_expense, context={'request': request})
            return Response({
                'message': 'Expense updated successfully',
                'expense': full_serializer.data
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        expense = self.get_object(pk, request.user)
        expense.is_deleted = True
        expense.save()
        return Response({'message': 'Expense deleted successfully'}, status=status.HTTP_200_OK)


class DirectPaymentListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        queryset = DirectPayment.objects.filter(
            group__memberships__user=request.user
        ).distinct()

        group_id = request.query_params.get('group_id')
        if group_id:
            queryset = queryset.filter(group_id=group_id)

        serializer = DirectPaymentSerializer(queryset, many=True, context={'request': request})
        return Response({'direct_payments': serializer.data}, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = DirectPaymentSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            payment = serializer.save()
            return Response({
                'message': 'Direct payment logged successfully',
                'direct_payment': DirectPaymentSerializer(payment, context={'request': request}).data
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GroupBalancesView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsGroupMember]

    def get(self, request, group_id):
        group = get_object_or_404(Group, pk=group_id)
        self.check_object_permissions(request, group)

        from .services import calculate_group_balances
        from apps.users.serializers import UserSerializer

        member_balances = calculate_group_balances(group)
        serialized_balances = []
        for mb in member_balances:
            serialized_balances.append({
                'user': UserSerializer(mb['user']).data,
                'total_paid': str(mb['total_paid']),
                'total_share': str(mb['total_share']),
                'net_balance': str(mb['net_balance']),
                'status': mb['status'],
            })

        return Response({
            'group_id': str(group.id),
            'member_balances': serialized_balances,
        }, status=status.HTTP_200_OK)


class GroupBalancesSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsGroupMember]

    def get(self, request, group_id):
        group = get_object_or_404(Group, pk=group_id)
        self.check_object_permissions(request, group)

        from decimal import Decimal
        from django.db.models import Sum
        from .services import calculate_group_balances, calculate_debt_simplification
        from apps.users.serializers import UserSerializer

        total_spent_qs = Expense.objects.filter(group=group, is_deleted=False).aggregate(total=Sum('total_amount'))
        total_spent = (total_spent_qs['total'] or Decimal('0.00')).quantize(Decimal('0.01'))

        member_balances = calculate_group_balances(group)

        my_mb = next((mb for mb in member_balances if mb['user_id'] == request.user.id), None)
        if my_mb:
            my_balance_data = {
                'user': UserSerializer(my_mb['user']).data,
                'total_paid': str(my_mb['total_paid']),
                'total_share': str(my_mb['total_share']),
                'net_balance': str(my_mb['net_balance']),
                'status': my_mb['status'],
            }
            if my_mb['net_balance'] < Decimal('0.00'):
                you_owe = str(abs(my_mb['net_balance']))
                you_are_owed = '0.00'
            elif my_mb['net_balance'] > Decimal('0.00'):
                you_owe = '0.00'
                you_are_owed = str(my_mb['net_balance'])
            else:
                you_owe = '0.00'
                you_are_owed = '0.00'
        else:
            my_balance_data = None
            you_owe = '0.00'
            you_are_owed = '0.00'

        suggested = calculate_debt_simplification(member_balances)
        serialized_suggested = []
        for s in suggested:
            serialized_suggested.append({
                'sender_id': s['sender_id'],
                'sender': UserSerializer(s['sender']).data,
                'receiver_id': s['receiver_id'],
                'receiver': UserSerializer(s['receiver']).data,
                'amount': str(s['amount']),
            })

        serialized_member_balances = []
        for mb in member_balances:
            serialized_member_balances.append({
                'user': UserSerializer(mb['user']).data,
                'total_paid': str(mb['total_paid']),
                'total_share': str(mb['total_share']),
                'net_balance': str(mb['net_balance']),
                'status': mb['status'],
            })

        return Response({
            'group_id': str(group.id),
            'total_spent': str(total_spent),
            'my_balance': my_balance_data,
            'you_owe': you_owe,
            'you_are_owed': you_are_owed,
            'member_balances': serialized_member_balances,
            'suggested_settlements': serialized_suggested,
        }, status=status.HTTP_200_OK)


class GroupSettlementListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsGroupMember]

    def get(self, request, group_id):
        group = get_object_or_404(Group, pk=group_id)
        self.check_object_permissions(request, group)

        from .models import Settlement
        from .serializers import SettlementSerializer

        queryset = Settlement.objects.filter(group=group).select_related('sender', 'receiver', 'created_by')

        status_param = request.query_params.get('status')
        sender_id = request.query_params.get('sender_id')
        receiver_id = request.query_params.get('receiver_id')

        if status_param:
            queryset = queryset.filter(status=status_param.upper())
        if sender_id:
            queryset = queryset.filter(sender_id=sender_id)
        if receiver_id:
            queryset = queryset.filter(receiver_id=receiver_id)

        serializer = SettlementSerializer(queryset, many=True, context={'request': request})
        return Response({'settlements': serializer.data}, status=status.HTTP_200_OK)

    def post(self, request, group_id):
        group = get_object_or_404(Group, pk=group_id)
        self.check_object_permissions(request, group)

        from .serializers import SettlementSerializer, CreateSettlementSerializer

        serializer = CreateSettlementSerializer(
            data=request.data,
            context={'request': request, 'group': group}
        )
        if serializer.is_valid():
            with transaction.atomic():
                settlement = serializer.save()
            return Response({
                'message': 'Settlement created successfully',
                'settlement': SettlementSerializer(settlement, context={'request': request}).data
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SettlementDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, CanModifySettlement]

    def get_object(self, pk):
        from .models import Settlement
        settlement = get_object_or_404(Settlement.objects.select_related('group', 'sender', 'receiver', 'created_by'), pk=pk)
        self.check_object_permissions(self.request, settlement)
        return settlement

    def get(self, request, pk):
        settlement = self.get_object(pk)
        from .serializers import SettlementSerializer
        serializer = SettlementSerializer(settlement, context={'request': request})
        return Response({'settlement': serializer.data}, status=status.HTTP_200_OK)

    def put(self, request, pk):
        settlement = self.get_object(pk)
        from .serializers import SettlementSerializer

        new_status = request.data.get('status')
        new_notes = request.data.get('notes')

        if new_status and new_status not in ['PENDING', 'COMPLETED', 'CANCELLED']:
            return Response({'status': 'Invalid settlement status.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            if new_status:
                settlement.status = new_status
            if new_notes is not None:
                settlement.notes = new_notes
            settlement.save()

        serializer = SettlementSerializer(settlement, context={'request': request})
        return Response({
            'message': 'Settlement updated successfully',
            'settlement': serializer.data
        }, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        return self.put(request, pk)

    def delete(self, request, pk):
        settlement = self.get_object(pk)
        with transaction.atomic():
            settlement.status = 'CANCELLED'
            settlement.save()
        return Response({'message': 'Settlement cancelled successfully'}, status=status.HTTP_200_OK)


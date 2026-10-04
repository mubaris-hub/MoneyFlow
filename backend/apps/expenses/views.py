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
from .permissions import IsExpenseGroupMember


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

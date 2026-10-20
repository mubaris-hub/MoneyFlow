from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q
from .models import PersonalCategory, PersonalTransaction, PersonalBudget
from .serializers import (
    PersonalCategorySerializer,
    PersonalTransactionSerializer,
    PersonalBudgetSerializer
)
from .services import PersonalExpenseService


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class PersonalCategoryListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PersonalCategorySerializer

    def get_queryset(self):
        cat_type = self.request.query_params.get('type')
        return PersonalExpenseService.get_categories_for_user(self.request.user, cat_type)


class PersonalTransactionListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PersonalTransactionSerializer
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        user = self.request.user
        qs = PersonalTransaction.objects.filter(user=user).select_related('category')

        # Filters
        tx_type = self.request.query_params.get('type')
        if tx_type and tx_type.upper() in ['EXPENSE', 'INCOME']:
            qs = qs.filter(transaction_type=tx_type.upper())

        category_id = self.request.query_params.get('category')
        if category_id:
            qs = qs.filter(category_id=category_id)

        payment_method = self.request.query_params.get('payment_method')
        if payment_method:
            qs = qs.filter(payment_method=payment_method)

        date_from = self.request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(date__gte=date_from)

        date_to = self.request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(date__lte=date_to)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(title__icontains=search) |
                Q(notes__icontains=search) |
                Q(category_name__icontains=search)
            )

        # Ordering
        ordering = self.request.query_params.get('ordering', 'newest')
        if ordering == 'oldest':
            qs = qs.order_by('date', 'created_at')
        elif ordering == 'highest_amount':
            qs = qs.order_by('-amount')
        elif ordering == 'lowest_amount':
            qs = qs.order_by('amount')
        else:  # newest
            qs = qs.order_by('-date', '-created_at')

        return qs


class PersonalTransactionDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PersonalTransactionSerializer
    lookup_field = 'id'

    def get_queryset(self):
        # Strict user ownership protection
        return PersonalTransaction.objects.filter(user=self.request.user).select_related('category')


class PersonalSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        target_date = request.query_params.get('date')
        summary = PersonalExpenseService.get_summary(request.user, target_date=target_date)
        return Response(summary, status=status.HTTP_200_OK)


class PersonalAnalyticsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        period = request.query_params.get('period', 'this_month')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        analytics = PersonalExpenseService.get_analytics(
            request.user,
            period=period,
            date_from=date_from,
            date_to=date_to
        )
        return Response(analytics, status=status.HTTP_200_OK)


class PersonalBudgetListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        budgets_data = PersonalExpenseService.get_budgets(request.user, year=year, month=month)
        return Response(budgets_data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = PersonalBudgetSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        budget = serializer.save()
        return Response(
            PersonalBudgetSerializer(budget).data,
            status=status.HTTP_201_CREATED
        )


class PersonalBudgetDetailView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PersonalBudgetSerializer
    lookup_field = 'id'

    def get_queryset(self):
        return PersonalBudget.objects.filter(user=self.request.user)


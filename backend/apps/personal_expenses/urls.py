from django.urls import path
from .views import (
    PersonalCategoryListCreateView,
    PersonalTransactionListCreateView,
    PersonalTransactionDetailView,
    PersonalSummaryView,
    PersonalAnalyticsView,
    PersonalBudgetListCreateView,
    PersonalBudgetDetailView,
)

urlpatterns = [
    path('categories/', PersonalCategoryListCreateView.as_view(), name='personal_categories'),
    path('transactions/', PersonalTransactionListCreateView.as_view(), name='personal_transactions'),
    path('transactions/<uuid:id>/', PersonalTransactionDetailView.as_view(), name='personal_transaction_detail'),
    path('summary/', PersonalSummaryView.as_view(), name='personal_summary'),
    path('analytics/', PersonalAnalyticsView.as_view(), name='personal_analytics'),
    path('budgets/', PersonalBudgetListCreateView.as_view(), name='personal_budgets'),
    path('budgets/<uuid:id>/', PersonalBudgetDetailView.as_view(), name='personal_budget_detail'),
]


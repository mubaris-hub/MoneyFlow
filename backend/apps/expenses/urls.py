from django.urls import path
from .views import (
    CategoryListView,
    ExpenseListCreateView,
    ExpenseDetailView,
    DirectPaymentListCreateView,
    SettlementDetailView
)

urlpatterns = [
    path('', ExpenseListCreateView.as_view(), name='expense_list_create'),
    path('categories/', CategoryListView.as_view(), name='category_list'),
    path('direct-payments/', DirectPaymentListCreateView.as_view(), name='direct_payment_list_create'),
    path('settlements/<uuid:pk>/', SettlementDetailView.as_view(), name='settlement_detail'),
    path('<uuid:pk>/', ExpenseDetailView.as_view(), name='expense_detail'),
]


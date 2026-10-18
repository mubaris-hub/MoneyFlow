from django.urls import path
from .views import (
    CategoryListView,
    ExpenseListCreateView,
    ExpenseDetailView,
    DirectPaymentListCreateView,
    SettlementDetailView,
    ReceiptScanView,
    TransactionListView,
    TransactionDetailView
)

urlpatterns = [
    path('', ExpenseListCreateView.as_view(), name='expense_list_create'),
    path('transactions/', TransactionListView.as_view(), name='transaction_list'),
    path('transactions/<str:transaction_id>/', TransactionDetailView.as_view(), name='transaction_detail'),
    path('categories/', CategoryListView.as_view(), name='category_list'),
    path('direct-payments/', DirectPaymentListCreateView.as_view(), name='direct_payment_list_create'),
    path('settlements/<uuid:pk>/', SettlementDetailView.as_view(), name='settlement_detail'),
    path('receipts/scan/', ReceiptScanView.as_view(), name='receipt_scan'),
    path('<uuid:pk>/', ExpenseDetailView.as_view(), name='expense_detail'),
]


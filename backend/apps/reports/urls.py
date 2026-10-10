from django.urls import path
from .views import (
    DashboardReportView,
    ExpenseReportView,
    GroupReportView,
    MoneyAccountReportView
)

urlpatterns = [
    path('dashboard/', DashboardReportView.as_view(), name='report_dashboard'),
    path('expenses/', ExpenseReportView.as_view(), name='report_expenses'),
    path('groups/<uuid:group_id>/', GroupReportView.as_view(), name='report_group'),
    path('money-accounts/', MoneyAccountReportView.as_view(), name='report_money_accounts'),
]


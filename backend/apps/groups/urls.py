from django.urls import path
from .views import (
    GroupListCreateView,
    GroupDetailView,
    GroupMemberListCreateView,
    GroupMemberRemoveView,
    JoinGroupByCodeView
)

from apps.expenses.views import (
    GroupBalancesView,
    GroupBalancesSummaryView,
    GroupSettlementListCreateView
)

urlpatterns = [
    path('', GroupListCreateView.as_view(), name='group_list_create'),
    path('join/', JoinGroupByCodeView.as_view(), name='group_join'),
    path('join/<str:code>/', JoinGroupByCodeView.as_view(), name='group_join_code'),
    path('<uuid:pk>/', GroupDetailView.as_view(), name='group_detail'),
    path('<uuid:pk>/members/', GroupMemberListCreateView.as_view(), name='group_members'),
    path('<uuid:pk>/members/<uuid:user_id>/', GroupMemberRemoveView.as_view(), name='group_member_remove'),
    path('<uuid:group_id>/balances/', GroupBalancesView.as_view(), name='group_balances'),
    path('<uuid:group_id>/balances/summary/', GroupBalancesSummaryView.as_view(), name='group_balances_summary'),
    path('<uuid:group_id>/settlements/', GroupSettlementListCreateView.as_view(), name='group_settlements'),
]


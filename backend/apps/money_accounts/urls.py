from django.urls import path
from .views import (
    MoneyAccountListCreateView,
    MoneyAccountDetailView,
    AccountTransactionListCreateView,
    VoidTransactionView,
    TransactionReceiptView,
    InviteOwnerView,
    RespondInvitationView,
    AccountPendingInvitationView,
    CloseAccountView,
    ExportLedgerView
)

urlpatterns = [
    path('', MoneyAccountListCreateView.as_view(), name='money_account_list_create'),
    path('<uuid:pk>/', MoneyAccountDetailView.as_view(), name='money_account_detail'),
    path('<uuid:pk>/transactions/', AccountTransactionListCreateView.as_view(), name='money_account_transaction_list_create'),
    path('<uuid:pk>/transactions/<uuid:tx_id>/void/', VoidTransactionView.as_view(), name='money_account_transaction_void'),
    path('<uuid:pk>/transactions/<uuid:tx_id>/receipt/', TransactionReceiptView.as_view(), name='money_account_transaction_receipt'),
    path('<uuid:pk>/invite/', InviteOwnerView.as_view(), name='money_account_invite'),
    path('<uuid:pk>/invitation/', AccountPendingInvitationView.as_view(), name='money_account_pending_invitation'),
    path('invitations/<str:token>/', RespondInvitationView.as_view(), name='money_account_invitation_detail'),
    path('invitations/<str:token>/respond/', RespondInvitationView.as_view(), name='money_account_invitation_respond'),
    path('<uuid:pk>/close/', CloseAccountView.as_view(), name='money_account_close'),
    path('<uuid:pk>/export/', ExportLedgerView.as_view(), name='money_account_export'),
]

import csv
import io
import mimetypes
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.http import FileResponse, Http404, HttpResponse
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status, permissions, parsers
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError

from .models import (
    MoneyAccount,
    AccountTransaction,
    AccountInvitation,
    AccountCategory
)
from .serializers import (
    MoneyAccountSerializer,
    CreateMoneyAccountSerializer,
    UpdateMoneyAccountSerializer,
    AccountTransactionSerializer,
    CreateTransactionSerializer,
    VoidTransactionSerializer,
    AccountInvitationSerializer,
    RespondInvitationSerializer
)
from .services import MoneyAccountService
from .permissions import IsAccountManager, IsAccountOwnerOrManager


class MoneyAccountListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """List accounts where request.user is manager OR owner."""
        accounts = MoneyAccount.objects.filter(
            Q(manager=request.user) | Q(owner=request.user)
        ).distinct()
        serializer = MoneyAccountSerializer(accounts, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        """Create a new Money Account managed by request.user."""
        serializer = CreateMoneyAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            account = MoneyAccountService.create_account(
                manager=request.user,
                title=serializer.validated_data['title'],
                owner_name=serializer.validated_data['owner_name'],
                owner_email=serializer.validated_data['owner_email'],
                currency=serializer.validated_data.get('currency', 'INR'),
                allow_overdraft=serializer.validated_data.get('allow_overdraft', False),
                notes=serializer.validated_data.get('notes', '')
            )
            res_serializer = MoneyAccountSerializer(account)
            return Response(res_serializer.data, status=status.HTTP_201_CREATED)
        except DjangoValidationError as e:
            raise DRFValidationError(e.message if hasattr(e, 'message') else str(e))


class MoneyAccountDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, request, pk):
        account = get_object_or_404(MoneyAccount, id=pk)
        if account.manager != request.user and account.owner != request.user:
            raise PermissionDenied("You do not have permission to view this money account.")
        return account

    def get(self, request, pk):
        """Retrieve account details (Manager or Owner)."""
        account = self.get_object(request, pk)
        serializer = MoneyAccountSerializer(account)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        """Update account metadata (Manager only)."""
        account = self.get_object(request, pk)
        if account.manager != request.user:
            raise PermissionDenied("Only the account manager can update account settings.")

        serializer = UpdateMoneyAccountSerializer(account, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        res_serializer = MoneyAccountSerializer(account)
        return Response(res_serializer.data, status=status.HTTP_200_OK)


class AccountTransactionListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_account(self, request, pk):
        account = get_object_or_404(MoneyAccount, id=pk)
        if account.manager != request.user and account.owner != request.user:
            raise PermissionDenied("You do not have permission to access transactions for this account.")
        return account

    def get(self, request, pk):
        """List transactions for account with optional filtering (Manager or Owner)."""
        account = self.get_account(request, pk)
        txs = account.transactions.all()

        # Filtering options
        tx_type = request.query_params.get('transaction_type')
        if tx_type:
            txs = txs.filter(transaction_type=tx_type)

        category_id = request.query_params.get('category')
        if category_id:
            txs = txs.filter(category_id=category_id)

        is_voided = request.query_params.get('is_voided')
        if is_voided is not None:
            txs = txs.filter(is_voided=is_voided.lower() in ['true', '1'])

        date_val = request.query_params.get('date')
        if date_val:
            txs = txs.filter(date=date_val)

        serializer = AccountTransactionSerializer(txs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, pk):
        """Add a transaction to account (Manager only)."""
        account = self.get_account(request, pk)
        if account.manager != request.user:
            raise PermissionDenied("Only the account manager can add transactions.")

        serializer = CreateTransactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        category = None
        cat_id = serializer.validated_data.get('category_id')
        if cat_id:
            category = get_object_or_404(AccountCategory, id=cat_id)

        try:
            tx = MoneyAccountService.add_transaction(
                account_id=account.id,
                created_by=request.user,
                transaction_type=serializer.validated_data['transaction_type'],
                amount=serializer.validated_data['amount'],
                description=serializer.validated_data['description'],
                category=category,
                date=serializer.validated_data.get('date'),
                notes=serializer.validated_data.get('notes', ''),
                receipt_url=serializer.validated_data.get('receipt_url'),
                receipt_image=serializer.validated_data.get('receipt_image') or request.FILES.get('receipt_image')
            )
            res_serializer = AccountTransactionSerializer(tx)
            return Response(res_serializer.data, status=status.HTTP_201_CREATED)
        except DjangoValidationError as e:
            raise DRFValidationError(e.message if hasattr(e, 'message') else str(e))


class TransactionReceiptView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_account_and_tx(self, request, pk, tx_id):
        account = get_object_or_404(MoneyAccount, id=pk)
        if account.manager != request.user and account.owner != request.user:
            raise PermissionDenied("You do not have permission to view receipts for this account.")
        tx = get_object_or_404(AccountTransaction, id=tx_id, account=account)
        return account, tx

    def get(self, request, pk, tx_id):
        """View/download receipt image (Manager or Owner)."""
        account, tx = self.get_account_and_tx(request, pk, tx_id)
        if not tx.receipt_image:
            raise Http404("No receipt image attached to this transaction.")

        content_type, _ = mimetypes.guess_type(tx.receipt_image.path)
        content_type = content_type or 'application/octet-stream'
        return FileResponse(tx.receipt_image.open('rb'), content_type=content_type)

    def post(self, request, pk, tx_id):
        """Replace/upload receipt image (Manager only)."""
        account, tx = self.get_account_and_tx(request, pk, tx_id)
        if account.manager != request.user:
            raise PermissionDenied("Only the account manager can upload or replace receipts.")

        receipt_file = request.FILES.get('receipt_image')
        if not receipt_file:
            raise DRFValidationError({"receipt_image": "Receipt image file is required."})

        try:
            updated_tx = MoneyAccountService.update_receipt(
                transaction_id=tx.id,
                manager=request.user,
                receipt_image=receipt_file
            )
            serializer = AccountTransactionSerializer(updated_tx)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except DjangoValidationError as e:
            raise DRFValidationError(e.message if hasattr(e, 'message') else str(e))

    def delete(self, request, pk, tx_id):
        """Remove receipt image (Manager only)."""
        account, tx = self.get_account_and_tx(request, pk, tx_id)
        if account.manager != request.user:
            raise PermissionDenied("Only the account manager can remove receipts.")

        try:
            updated_tx = MoneyAccountService.update_receipt(
                transaction_id=tx.id,
                manager=request.user,
                remove_receipt=True
            )
            serializer = AccountTransactionSerializer(updated_tx)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except DjangoValidationError as e:
            raise DRFValidationError(e.message if hasattr(e, 'message') else str(e))


class VoidTransactionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, tx_id):
        """Soft-void a transaction (Manager only)."""
        account = get_object_or_404(MoneyAccount, id=pk)
        if account.manager != request.user:
            raise PermissionDenied("Only the account manager can void transactions.")

        tx = get_object_or_404(AccountTransaction, id=tx_id, account=account)

        serializer = VoidTransactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            voided_tx = MoneyAccountService.void_transaction(
                transaction_id=tx.id,
                voided_by=request.user,
                void_reason=serializer.validated_data['void_reason']
            )
            res_serializer = AccountTransactionSerializer(voided_tx)
            return Response(res_serializer.data, status=status.HTTP_200_OK)
        except DjangoValidationError as e:
            raise DRFValidationError(e.message if hasattr(e, 'message') else str(e))


class InviteOwnerView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        """Generate an account invitation for owner (Manager only)."""
        account = get_object_or_404(MoneyAccount, id=pk)
        if account.manager != request.user:
            raise PermissionDenied("Only the account manager can send invitations.")

        try:
            invitation = MoneyAccountService.create_invitation(
                account_id=account.id,
                sender=request.user
            )
            serializer = AccountInvitationSerializer(invitation)
            data = serializer.data
            # Include token in response to manager so invitation link can be copied/sent
            data['token'] = invitation.token
            return Response(data, status=status.HTTP_201_CREATED)
        except DjangoValidationError as e:
            raise DRFValidationError(e.message if hasattr(e, 'message') else str(e))


class RespondInvitationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, token):
        """Accept or reject an invitation using token."""
        serializer = RespondInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action = serializer.validated_data['action']
        accept = (action == 'ACCEPT')

        try:
            account = MoneyAccountService.respond_invitation(
                token=token,
                user=request.user,
                accept=accept
            )
            res_serializer = MoneyAccountSerializer(account)
            return Response(res_serializer.data, status=status.HTTP_200_OK)
        except DjangoValidationError as e:
            raise DRFValidationError(e.message if hasattr(e, 'message') else str(e))


class CloseAccountView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        """Close an account (Manager only, requires ₹0.00 balance)."""
        account = get_object_or_404(MoneyAccount, id=pk)
        if account.manager != request.user:
            raise PermissionDenied("Only the account manager can close the account.")

        try:
            closed_account = MoneyAccountService.close_account(
                account_id=account.id,
                manager=request.user
            )
            serializer = MoneyAccountSerializer(closed_account)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except DjangoValidationError as e:
            raise DRFValidationError(e.message if hasattr(e, 'message') else str(e))


class ExportLedgerView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        """
        Export MoneyAccount transaction ledger to CSV.
        Manager or Owner authorized.
        Supports filters: start_date, end_date, transaction_type, include_voided.
        """
        account = get_object_or_404(MoneyAccount, id=pk)
        if account.manager != request.user and account.owner != request.user:
            raise PermissionDenied("You do not have permission to export this account.")

        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        tx_type = request.query_params.get('transaction_type')
        include_voided_param = request.query_params.get('include_voided', 'true')
        include_voided = include_voided_param.lower() in ['true', '1', 't']

        all_txs = account.transactions.all().order_by('date', 'created_at')

        from decimal import Decimal
        running_balance = Decimal('0.00')

        filtered_rows = []

        for tx in all_txs:
            amt = tx.amount
            if not tx.is_voided:
                if tx.transaction_type == 'DEPOSIT':
                    running_balance += amt
                elif tx.transaction_type in ['EXPENSE', 'REFUND']:
                    running_balance -= amt
                elif tx.transaction_type == 'ADJUSTMENT':
                    running_balance += amt

            # Apply filters
            if not include_voided and tx.is_voided:
                continue

            if tx_type and tx.transaction_type != tx_type:
                continue

            if start_date:
                if str(tx.date) < start_date:
                    continue

            if end_date:
                if str(tx.date) > end_date:
                    continue

            receipt_avail = "YES" if (tx.receipt_image or tx.receipt_url) else "NO"
            status_str = "VOIDED" if tx.is_voided else "COMPLETED"

            filtered_rows.append([
                tx.date.strftime('%Y-%m-%d'),
                str(tx.id),
                tx.transaction_type,
                tx.description,
                tx.category.name if tx.category else '',
                f"{tx.amount:.2f}",
                account.currency,
                status_str,
                f"{running_balance:.2f}",
                receipt_avail,
                tx.created_at.strftime('%Y-%m-%d %H:%M:%S')
            ])

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            'Date',
            'Transaction ID',
            'Transaction Type',
            'Description',
            'Category',
            'Amount',
            'Currency',
            'Status',
            'Balance After Transaction',
            'Receipt Available',
            'Created At'
        ])
        for row in filtered_rows:
            writer.writerow(row)

        response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="money_account_{account.id}_export.csv"'
        return response


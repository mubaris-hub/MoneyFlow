from datetime import datetime
from django.shortcuts import get_object_or_404
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError

from apps.groups.models import Group
from .services import ReportService


def parse_date(date_str, field_name='date'):
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        raise DRFValidationError(f"Invalid format for {field_name}. Use YYYY-MM-DD.")


def validate_date_range(start_date, end_date):
    if start_date and end_date and start_date > end_date:
        raise DRFValidationError("start_date cannot be after end_date.")


class DashboardReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        start_date = parse_date(request.query_params.get('start_date'), 'start_date')
        end_date = parse_date(request.query_params.get('end_date'), 'end_date')
        validate_date_range(start_date, end_date)

        data = ReportService.get_dashboard_analytics(
            user=request.user,
            start_date=start_date,
            end_date=end_date
        )
        return Response(data, status=status.HTTP_200_OK)


class ExpenseReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        start_date = parse_date(request.query_params.get('start_date'), 'start_date')
        end_date = parse_date(request.query_params.get('end_date'), 'end_date')
        validate_date_range(start_date, end_date)

        group_id = request.query_params.get('group_id')
        category_id = request.query_params.get('category_id')

        data = ReportService.get_expense_analytics(
            user=request.user,
            start_date=start_date,
            end_date=end_date,
            group_id=group_id,
            category_id=category_id
        )
        return Response(data, status=status.HTTP_200_OK)


class GroupReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, group_id):
        group = get_object_or_404(Group, id=group_id)

        # Check membership
        if not group.memberships.filter(user=request.user).exists():
            raise PermissionDenied("You are not a member of this group.")

        start_date = parse_date(request.query_params.get('start_date'), 'start_date')
        end_date = parse_date(request.query_params.get('end_date'), 'end_date')
        validate_date_range(start_date, end_date)

        data = ReportService.get_group_analytics(
            user=request.user,
            group=group,
            start_date=start_date,
            end_date=end_date
        )
        return Response(data, status=status.HTTP_200_OK)


class MoneyAccountReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        start_date = parse_date(request.query_params.get('start_date'), 'start_date')
        end_date = parse_date(request.query_params.get('end_date'), 'end_date')
        validate_date_range(start_date, end_date)

        account_id = request.query_params.get('account_id')

        data = ReportService.get_money_accounts_analytics(
            user=request.user,
            start_date=start_date,
            end_date=end_date,
            account_id=account_id
        )
        return Response(data, status=status.HTTP_200_OK)

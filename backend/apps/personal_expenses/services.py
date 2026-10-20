from decimal import Decimal
from datetime import date, datetime, timedelta
from django.utils import timezone
from django.db.models import Sum, Count, Q
from django.db import transaction
from .models import PersonalCategory, PersonalTransaction, PersonalBudget

SYSTEM_EXPENSE_CATEGORIES = [
    {'name': 'Food & Drinks', 'icon': 'Utensils', 'color': '#F59E0B', 'category_type': 'EXPENSE'},
    {'name': 'Groceries', 'icon': 'ShoppingCart', 'color': '#10B981', 'category_type': 'EXPENSE'},
    {'name': 'Transportation', 'icon': 'Car', 'color': '#3B82F6', 'category_type': 'EXPENSE'},
    {'name': 'Fuel', 'icon': 'Fuel', 'color': '#EF4444', 'category_type': 'EXPENSE'},
    {'name': 'Shopping', 'icon': 'ShoppingBag', 'color': '#EC4899', 'category_type': 'EXPENSE'},
    {'name': 'Bills & Utilities', 'icon': 'Receipt', 'color': '#8B5CF6', 'category_type': 'EXPENSE'},
    {'name': 'Entertainment', 'icon': 'Film', 'color': '#6366F1', 'category_type': 'EXPENSE'},
    {'name': 'Health', 'icon': 'HeartPulse', 'color': '#14B8A6', 'category_type': 'EXPENSE'},
    {'name': 'Education', 'icon': 'GraduationCap', 'color': '#0EA5E9', 'category_type': 'EXPENSE'},
    {'name': 'Travel', 'icon': 'Plane', 'color': '#F97316', 'category_type': 'EXPENSE'},
    {'name': 'Personal Care', 'icon': 'Sparkles', 'color': '#D946EF', 'category_type': 'EXPENSE'},
    {'name': 'Other', 'icon': 'Tag', 'color': '#64748B', 'category_type': 'EXPENSE'},
]

SYSTEM_INCOME_CATEGORIES = [
    {'name': 'Salary', 'icon': 'Briefcase', 'color': '#10B981', 'category_type': 'INCOME'},
    {'name': 'Freelance', 'icon': 'Laptop', 'color': '#06B6D4', 'category_type': 'INCOME'},
    {'name': 'Investments', 'icon': 'TrendingUp', 'color': '#8B5CF6', 'category_type': 'INCOME'},
    {'name': 'Gifts', 'icon': 'Gift', 'color': '#F43F5E', 'category_type': 'INCOME'},
    {'name': 'Refunds', 'icon': 'RotateCcw', 'color': '#F59E0B', 'category_type': 'INCOME'},
    {'name': 'Other Income', 'icon': 'Wallet', 'color': '#10B981', 'category_type': 'INCOME'},
]


class PersonalExpenseService:

    @staticmethod
    def ensure_system_categories():
        """Ensure all standard system categories exist."""
        for item in SYSTEM_EXPENSE_CATEGORIES + SYSTEM_INCOME_CATEGORIES:
            PersonalCategory.objects.get_or_create(
                name=item['name'],
                category_type=item['category_type'],
                is_system=True,
                defaults={
                    'icon': item['icon'],
                    'color': item['color'],
                    'user': None,
                }
            )

    @staticmethod
    def get_categories_for_user(user, category_type=None):
        """Returns system categories and custom user categories."""
        PersonalExpenseService.ensure_system_categories()
        qs = PersonalCategory.objects.filter(Q(is_system=True) | Q(user=user))
        if category_type:
            qs = qs.filter(category_type=category_type.upper())
        return qs.order_by('category_type', 'name')

    @staticmethod
    def get_summary(user, target_date=None):
        """
        Calculates key dashboard summary cards for the user:
        - Today's expenses
        - This month's expenses
        - Previous month's expenses & percentage change
        - This month's income
        - Net cash flow (Income - Expenses)
        - Monthly budget status & remaining amount
        - Category breakdown for current month
        """
        if target_date is None:
            target_date = timezone.now().date()
        elif isinstance(target_date, str):
            target_date = datetime.strptime(target_date, '%Y-%m-%d').date()

        current_year = target_date.year
        current_month = target_date.month

        # Date ranges
        first_day_current_month = date(current_year, current_month, 1)
        if current_month == 12:
            first_day_next_month = date(current_year + 1, 1, 1)
        else:
            first_day_next_month = date(current_year, current_month + 1, 1)

        # Previous month
        if current_month == 1:
            first_day_prev_month = date(current_year - 1, 12, 1)
        else:
            first_day_prev_month = date(current_year, current_month - 1, 1)
        last_day_prev_month = first_day_current_month - timedelta(days=1)

        user_txs = PersonalTransaction.objects.filter(user=user)

        # 1. Today's Expenses
        today_expenses = user_txs.filter(
            transaction_type='EXPENSE',
            date=target_date
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        today_income = user_txs.filter(
            transaction_type='INCOME',
            date=target_date
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        # 2. This Month's Expenses & Income
        current_month_txs = user_txs.filter(
            date__gte=first_day_current_month,
            date__lt=first_day_next_month
        )

        month_expenses = current_month_txs.filter(
            transaction_type='EXPENSE'
        ).aggregate(total=Sum('amount'), count=Count('id'))
        total_month_expenses = month_expenses['total'] or Decimal('0.00')
        expenses_count = month_expenses['count'] or 0

        month_income = current_month_txs.filter(
            transaction_type='INCOME'
        ).aggregate(total=Sum('amount'), count=Count('id'))
        total_month_income = month_income['total'] or Decimal('0.00')
        income_count = month_income['count'] or 0

        # Net cash flow = Income - Expenses
        net_cash_flow = total_month_income - total_month_expenses

        # 3. Previous Month's Comparison
        prev_month_expenses = user_txs.filter(
            transaction_type='EXPENSE',
            date__gte=first_day_prev_month,
            date__lte=last_day_prev_month
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        expense_diff = total_month_expenses - prev_month_expenses
        expense_percent_change = None
        if prev_month_expenses > 0:
            expense_percent_change = float(
                ((total_month_expenses - prev_month_expenses) / prev_month_expenses) * 100
            )

        # 4. Budget remaining
        overall_budget_obj = PersonalBudget.objects.filter(
            user=user,
            year=current_year,
            month=current_month,
            category__isnull=True
        ).first()

        budget_amount = overall_budget_obj.amount if overall_budget_obj else None
        budget_remaining = None
        budget_percent_spent = None
        budget_status = 'NO_BUDGET'

        if budget_amount is not None and budget_amount > 0:
            budget_remaining = budget_amount - total_month_expenses
            budget_percent_spent = float(min(Decimal('999.0'), (total_month_expenses / budget_amount) * 100))
            if total_month_expenses >= budget_amount:
                budget_status = 'EXCEEDED'
            elif total_month_expenses >= (budget_amount * Decimal('0.85')):
                budget_status = 'WARNING'
            else:
                budget_status = 'SAFE'

        # 5. Category-wise Spending Breakdown for this month
        category_breakdown = []
        cat_agg = current_month_txs.filter(
            transaction_type='EXPENSE'
        ).values(
            'category_id',
            'category__name',
            'category__icon',
            'category__color'
        ).annotate(
            total=Sum('amount'),
            count=Count('id')
        ).order_by('-total')

        for item in cat_agg:
            cat_name = item['category__name'] or 'Uncategorized'
            cat_total = item['total'] or Decimal('0.00')
            pct = float((cat_total / total_month_expenses * 100) if total_month_expenses > 0 else 0)
            category_breakdown.append({
                'category_id': item['category_id'],
                'category_name': cat_name,
                'category_icon': item['category__icon'] or 'Tag',
                'category_color': item['category__color'] or '#64748B',
                'total_amount': str(cat_total),
                'percentage': round(pct, 1),
                'transaction_count': item['count']
            })

        return {
            'target_date': str(target_date),
            'current_month': current_month,
            'current_year': current_year,
            'today_expenses': str(today_expenses),
            'today_income': str(today_income),
            'this_month_expenses': str(total_month_expenses),
            'expenses_count': expenses_count,
            'this_month_income': str(total_month_income),
            'income_count': income_count,
            'net_cash_flow': str(net_cash_flow),
            'previous_month_expenses': str(prev_month_expenses),
            'expense_diff': str(expense_diff),
            'expense_percent_change': round(expense_percent_change, 1) if expense_percent_change is not None else None,
            'budget': {
                'amount': str(budget_amount) if budget_amount is not None else None,
                'remaining': str(budget_remaining) if budget_remaining is not None else None,
                'percent_spent': round(budget_percent_spent, 1) if budget_percent_spent is not None else None,
                'status': budget_status
            },
            'category_breakdown': category_breakdown
        }

    @staticmethod
    def get_analytics(user, period='this_month', date_from=None, date_to=None):
        """
        Lightweight analytics:
        - Daily spending timeline for the chosen period
        - Last 6 months trend (Expenses vs Income)
        - Spending by category
        - Highest-spending category
        """
        today = timezone.now().date()

        if period == 'last_30_days':
            start_date = today - timedelta(days=29)
            end_date = today
        elif period == 'this_week':
            start_date = today - timedelta(days=today.weekday())
            end_date = today
        elif period == 'custom' and date_from and date_to:
            start_date = datetime.strptime(date_from, '%Y-%m-%d').date() if isinstance(date_from, str) else date_from
            end_date = datetime.strptime(date_to, '%Y-%m-%d').date() if isinstance(date_to, str) else date_to
        else:  # this_month
            start_date = date(today.year, today.month, 1)
            end_date = today

        # 1. Daily timeline in range
        daily_txs = PersonalTransaction.objects.filter(
            user=user,
            date__gte=start_date,
            date__lte=end_date
        )

        daily_expense_map = {
            item['date']: item['total']
            for item in daily_txs.filter(transaction_type='EXPENSE').values('date').annotate(total=Sum('amount'))
        }
        daily_income_map = {
            item['date']: item['total']
            for item in daily_txs.filter(transaction_type='INCOME').values('date').annotate(total=Sum('amount'))
        }

        daily_trends = []
        curr = start_date
        total_period_expense = Decimal('0.00')
        total_period_income = Decimal('0.00')

        while curr <= end_date:
            exp = daily_expense_map.get(curr, Decimal('0.00'))
            inc = daily_income_map.get(curr, Decimal('0.00'))
            total_period_expense += exp
            total_period_income += inc

            daily_trends.append({
                'date': str(curr),
                'formatted_date': curr.strftime('%b %d'),
                'expense': float(exp),
                'income': float(inc)
            })
            curr += timedelta(days=1)

        # 2. Last 6 months trend
        monthly_trends = []
        for i in range(5, -1, -1):
            # calculate year and month i months ago
            m = today.month - i
            y = today.year
            while m <= 0:
                m += 12
                y -= 1

            m_start = date(y, m, 1)
            if m == 12:
                m_end = date(y + 1, 1, 1) - timedelta(days=1)
            else:
                m_end = date(y, m + 1, 1) - timedelta(days=1)

            m_txs = PersonalTransaction.objects.filter(
                user=user,
                date__gte=m_start,
                date__lte=m_end
            )
            m_exp = m_txs.filter(transaction_type='EXPENSE').aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
            m_inc = m_txs.filter(transaction_type='INCOME').aggregate(t=Sum('amount'))['t'] or Decimal('0.00')

            monthly_trends.append({
                'month_name': m_start.strftime('%b %Y'),
                'short_month': m_start.strftime('%b'),
                'year': y,
                'month': m,
                'expense': float(m_exp),
                'income': float(m_inc)
            })

        # 3. Category Breakdown for period
        cat_agg = daily_txs.filter(transaction_type='EXPENSE').values(
            'category_id',
            'category__name',
            'category__icon',
            'category__color'
        ).annotate(
            total=Sum('amount'),
            count=Count('id')
        ).order_by('-total')

        category_stats = []
        highest_category = None

        for item in cat_agg:
            cat_name = item['category__name'] or 'Uncategorized'
            cat_total = item['total'] or Decimal('0.00')
            pct = float((cat_total / total_period_expense * 100) if total_period_expense > 0 else 0)
            entry = {
                'name': cat_name,
                'icon': item['category__icon'] or 'Tag',
                'color': item['category__color'] or '#64748B',
                'amount': float(cat_total),
                'percentage': round(pct, 1),
                'count': item['count']
            }
            category_stats.append(entry)
            if highest_category is None:
                highest_category = entry

        return {
            'period': period,
            'start_date': str(start_date),
            'end_date': str(end_date),
            'total_expense': float(total_period_expense),
            'total_income': float(total_period_income),
            'net_savings': float(total_period_income - total_period_expense),
            'highest_spending_category': highest_category,
            'daily_trends': daily_trends,
            'monthly_trends': monthly_trends,
            'category_stats': category_stats
        }

    @staticmethod
    def get_budgets(user, year=None, month=None):
        """
        Retrieves all budgets set for a month/year with actual spending and remaining balances.
        """
        today = timezone.now().date()
        year = int(year) if year else today.year
        month = int(month) if month else today.month

        # Month range
        m_start = date(year, month, 1)
        if month == 12:
            m_end = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            m_end = date(year, month + 1, 1) - timedelta(days=1)

        budgets = PersonalBudget.objects.filter(
            user=user,
            year=year,
            month=month
        ).select_related('category')

        # Total personal expense for this month
        total_spent = PersonalTransaction.objects.filter(
            user=user,
            transaction_type='EXPENSE',
            date__gte=m_start,
            date__lte=m_end
        ).aggregate(t=Sum('amount'))['t'] or Decimal('0.00')

        # Spent by category
        spent_by_cat = {
            item['category_id']: item['total']
            for item in PersonalTransaction.objects.filter(
                user=user,
                transaction_type='EXPENSE',
                date__gte=m_start,
                date__lte=m_end
            ).values('category_id').annotate(total=Sum('amount'))
        }

        budget_list = []
        overall_budget = None

        for b in budgets:
            if b.category is None:
                spent = total_spent
                cat_name = 'Total Monthly Budget'
                cat_icon = 'Wallet'
                cat_color = '#10B981'
            else:
                spent = spent_by_cat.get(b.category_id, Decimal('0.00'))
                cat_name = b.category.name
                cat_icon = b.category.icon
                cat_color = b.category.color

            rem = b.amount - spent
            pct = float((spent / b.amount * 100) if b.amount > 0 else 0)

            item = {
                'id': str(b.id),
                'year': b.year,
                'month': b.month,
                'category_id': b.category_id,
                'category_name': cat_name,
                'category_icon': cat_icon,
                'category_color': cat_color,
                'budget_amount': str(b.amount),
                'spent_amount': str(spent),
                'remaining_amount': str(rem),
                'percent_spent': round(min(999.0, pct), 1),
                'is_overall': (b.category is None),
                'status': 'EXCEEDED' if spent >= b.amount else ('WARNING' if spent >= (b.amount * Decimal('0.85')) else 'SAFE')
            }

            if b.category is None:
                overall_budget = item
            else:
                budget_list.append(item)

        return {
            'year': year,
            'month': month,
            'overall_budget': overall_budget,
            'category_budgets': budget_list,
            'total_spent': str(total_spent)
        }


from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime
from django.db.models import Sum, Count, Q
from django.utils import timezone
from apps.expenses.models import Expense, ExpenseSplit, Category
from apps.groups.models import Group
from apps.money_accounts.models import MoneyAccount, AccountTransaction
from apps.money_accounts.services import MoneyAccountService

ZERO = Decimal('0.00')


def to_dec(val) -> Decimal:
    if val is None:
        return ZERO
    if isinstance(val, Decimal):
        d = val
    else:
        d = Decimal(str(val))
    return d.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


class ReportService:
    @staticmethod
    def get_dashboard_analytics(user, start_date=None, end_date=None):
        """
        Dashboard analytics aggregated for the authenticated user.
        Distinguishes personal group expense splits from custodial Friend Ledger balances.
        """
        splits = ExpenseSplit.objects.filter(user=user, expense__is_deleted=False)
        paid_expenses = Expense.objects.filter(paid_by=user, is_deleted=False)

        if start_date:
            splits = splits.filter(expense__date__gte=start_date)
            paid_expenses = paid_expenses.filter(date__gte=start_date)

        if end_date:
            splits = splits.filter(expense__date__lte=end_date)
            paid_expenses = paid_expenses.filter(date__lte=end_date)

        total_personal_share = to_dec(splits.aggregate(val=Sum('amount'))['val'])
        total_paid_by_user = to_dec(paid_expenses.aggregate(val=Sum('total_amount'))['val'])

        managed_accs = MoneyAccount.objects.filter(manager=user)
        held_accs = MoneyAccount.objects.filter(owner=user)

        total_managed_deposits = ZERO
        total_managed_expenses = ZERO
        total_managed_balance = ZERO

        for acc in managed_accs:
            stats = MoneyAccountService.calculate_balance(acc)
            total_managed_deposits += stats['total_deposits']
            total_managed_expenses += stats['total_expenses']
            total_managed_balance += stats['balance']

        category_data = []
        categories = Category.objects.all()
        for cat in categories:
            cat_splits = splits.filter(expense__category=cat)
            cat_sum = to_dec(cat_splits.aggregate(val=Sum('amount'))['val'])
            if cat_sum > ZERO:
                percentage = (cat_sum / total_personal_share * Decimal('100')).quantize(Decimal('0.1')) if total_personal_share > ZERO else ZERO
                category_data.append({
                    'category_id': cat.id,
                    'category_name': cat.name,
                    'icon': cat.icon,
                    'total_amount': f"{cat_sum:.2f}",
                    'percentage': float(percentage),
                    'count': cat_splits.count()
                })

        category_data.sort(key=lambda x: float(x['total_amount']), reverse=True)

        monthly_trends = []
        recent_splits = splits.select_related('expense', 'expense__category', 'expense__group').order_by('-expense__date', '-expense__created_at')[:6]

        monthly_map = {}
        for s in splits.select_related('expense'):
            m_key = s.expense.date.strftime('%Y-%m')
            monthly_map[m_key] = monthly_map.get(m_key, ZERO) + to_dec(s.amount)

        sorted_months = sorted(monthly_map.keys())
        for m in sorted_months:
            monthly_trends.append({
                'month': m,
                'personal_share': f"{monthly_map[m]:.2f}"
            })

        recent_activity = []
        for s in recent_splits:
            recent_activity.append({
                'type': 'EXPENSE_SPLIT',
                'id': str(s.id),
                'title': s.expense.description,
                'group': s.expense.group.name,
                'category': s.expense.category.name,
                'amount': f"{s.amount:.2f}",
                'date': s.expense.date.strftime('%Y-%m-%d')
            })

        return {
            'personal_expenses_share': f"{total_personal_share:.2f}",
            'total_paid_out_of_pocket': f"{total_paid_by_user:.2f}",
            'friend_ledger_summary': {
                'managed_accounts_count': managed_accs.count(),
                'held_accounts_count': held_accs.count(),
                'total_deposits': f"{total_managed_deposits:.2f}",
                'total_expenses': f"{total_managed_expenses:.2f}",
                'total_balance': f"{total_managed_balance:.2f}"
            },
            'category_breakdown': category_data,
            'monthly_trends': monthly_trends,
            'recent_activity': recent_activity
        }

    @staticmethod
    def get_expense_analytics(user, start_date=None, end_date=None, group_id=None, category_id=None):
        splits = ExpenseSplit.objects.filter(user=user, expense__is_deleted=False)
        paid_expenses = Expense.objects.filter(paid_by=user, is_deleted=False)

        if start_date:
            splits = splits.filter(expense__date__gte=start_date)
            paid_expenses = paid_expenses.filter(date__gte=start_date)
        if end_date:
            splits = splits.filter(expense__date__lte=end_date)
            paid_expenses = paid_expenses.filter(date__lte=end_date)
        if group_id:
            splits = splits.filter(expense__group_id=group_id)
            paid_expenses = paid_expenses.filter(group_id=group_id)
        if category_id:
            splits = splits.filter(expense__category_id=category_id)
            paid_expenses = paid_expenses.filter(category_id=category_id)

        total_user_share = to_dec(splits.aggregate(val=Sum('amount'))['val'])
        total_user_paid = to_dec(paid_expenses.aggregate(val=Sum('total_amount'))['val'])

        user_groups = Group.objects.filter(memberships__user=user)
        group_expenses = Expense.objects.filter(group__in=user_groups, is_deleted=False)
        if start_date:
            group_expenses = group_expenses.filter(date__gte=start_date)
        if end_date:
            group_expenses = group_expenses.filter(date__lte=end_date)
        if group_id:
            group_expenses = group_expenses.filter(group_id=group_id)
        if category_id:
            group_expenses = group_expenses.filter(category_id=category_id)

        total_group_volume = to_dec(group_expenses.aggregate(val=Sum('total_amount'))['val'])

        categories = Category.objects.all()
        category_data = []
        for cat in categories:
            cat_splits = splits.filter(expense__category=cat)
            cat_share = to_dec(cat_splits.aggregate(val=Sum('amount'))['val'])
            cat_paid = to_dec(paid_expenses.filter(category=cat).aggregate(val=Sum('total_amount'))['val'])

            if cat_share > ZERO or cat_paid > ZERO:
                pct = (cat_share / total_user_share * Decimal('100')).quantize(Decimal('0.1')) if total_user_share > ZERO else ZERO
                category_data.append({
                    'category_id': cat.id,
                    'category_name': cat.name,
                    'icon': cat.icon,
                    'user_share': f"{cat_share:.2f}",
                    'user_paid': f"{cat_paid:.2f}",
                    'percentage': float(pct),
                    'count': cat_splits.count()
                })

        category_data.sort(key=lambda x: float(x['user_share']), reverse=True)
        top_categories = category_data[:5]

        monthly_map = {}
        for s in splits.select_related('expense'):
            m_key = s.expense.date.strftime('%Y-%m')
            if m_key not in monthly_map:
                monthly_map[m_key] = {'share': ZERO, 'paid': ZERO}
            monthly_map[m_key]['share'] += to_dec(s.amount)

        for p in paid_expenses:
            m_key = p.date.strftime('%Y-%m')
            if m_key not in monthly_map:
                monthly_map[m_key] = {'share': ZERO, 'paid': ZERO}
            monthly_map[m_key]['paid'] += to_dec(p.total_amount)

        monthly_trends = []
        for m in sorted(monthly_map.keys()):
            monthly_trends.append({
                'month': m,
                'user_share': f"{monthly_map[m]['share']:.2f}",
                'user_paid': f"{monthly_map[m]['paid']:.2f}"
            })

        drilldown = []
        for s in splits.select_related('expense', 'expense__category', 'expense__group', 'expense__paid_by').order_by('-expense__date', '-expense__created_at')[:50]:
            e = s.expense
            drilldown.append({
                'id': str(e.id),
                'description': e.description,
                'group_name': e.group.name,
                'category_name': e.category.name,
                'total_amount': f"{e.total_amount:.2f}",
                'user_share': f"{s.amount:.2f}",
                'paid_by': e.paid_by.first_name or e.paid_by.username,
                'is_paid_by_me': e.paid_by == user,
                'date': e.date.strftime('%Y-%m-%d')
            })

        return {
            'total_user_share': f"{total_user_share:.2f}",
            'total_user_paid': f"{total_user_paid:.2f}",
            'total_group_volume': f"{total_group_volume:.2f}",
            'category_breakdown': category_data,
            'top_categories': top_categories,
            'monthly_trends': monthly_trends,
            'transactions': drilldown
        }

    @staticmethod
    def get_group_analytics(user, group, start_date=None, end_date=None):
        expenses = Expense.objects.filter(group=group, is_deleted=False)
        if start_date:
            expenses = expenses.filter(date__gte=start_date)
        if end_date:
            expenses = expenses.filter(date__lte=end_date)

        total_group_expenses = to_dec(expenses.aggregate(val=Sum('total_amount'))['val'])

        category_data = []
        categories = Category.objects.all()
        for cat in categories:
            cat_expenses = expenses.filter(category=cat)
            cat_sum = to_dec(cat_expenses.aggregate(val=Sum('total_amount'))['val'])
            if cat_sum > ZERO:
                pct = (cat_sum / total_group_expenses * Decimal('100')).quantize(Decimal('0.1')) if total_group_expenses > ZERO else ZERO
                category_data.append({
                    'category_id': cat.id,
                    'category_name': cat.name,
                    'icon': cat.icon,
                    'total_amount': f"{cat_sum:.2f}",
                    'percentage': float(pct),
                    'count': cat_expenses.count()
                })
        category_data.sort(key=lambda x: float(x['total_amount']), reverse=True)

        memberships = group.memberships.select_related('user')
        member_stats = []

        for m in memberships:
            mb_user = m.user
            paid_sum = to_dec(expenses.filter(paid_by=mb_user).aggregate(val=Sum('total_amount'))['val'])
            share_sum = to_dec(ExpenseSplit.objects.filter(expense__in=expenses, user=mb_user).aggregate(val=Sum('amount'))['val'])

            member_stats.append({
                'user_id': mb_user.id,
                'name': mb_user.first_name or mb_user.username,
                'email': mb_user.email,
                'total_paid': f"{paid_sum:.2f}",
                'total_share': f"{share_sum:.2f}",
                'net_balance': f"{(paid_sum - share_sum):.2f}"
            })

        monthly_map = {}
        for e in expenses:
            m_key = e.date.strftime('%Y-%m')
            monthly_map[m_key] = monthly_map.get(m_key, ZERO) + to_dec(e.total_amount)

        monthly_trends = []
        for m in sorted(monthly_map.keys()):
            monthly_trends.append({
                'month': m,
                'total_amount': f"{monthly_map[m]:.2f}"
            })

        tx_list = []
        for e in expenses.select_related('category', 'paid_by').order_by('-date', '-created_at')[:50]:
            tx_list.append({
                'id': str(e.id),
                'description': e.description,
                'category_name': e.category.name,
                'paid_by': e.paid_by.first_name or e.paid_by.username,
                'total_amount': f"{e.total_amount:.2f}",
                'date': e.date.strftime('%Y-%m-%d')
            })

        return {
            'group_id': str(group.id),
            'group_name': group.name,
            'member_count': memberships.count(),
            'total_group_expenses': f"{total_group_expenses:.2f}",
            'category_breakdown': category_data,
            'member_stats': member_stats,
            'monthly_trends': monthly_trends,
            'transactions': tx_list
        }

    @staticmethod
    def get_money_accounts_analytics(user, start_date=None, end_date=None, account_id=None):
        managed_qs = MoneyAccount.objects.filter(manager=user)
        held_qs = MoneyAccount.objects.filter(owner=user)

        if account_id:
            managed_qs = managed_qs.filter(id=account_id)
            held_qs = held_qs.filter(id=account_id)

        accounts = MoneyAccount.objects.filter(Q(manager=user) | Q(owner=user)).distinct()
        if account_id:
            accounts = accounts.filter(id=account_id)

        account_summaries = []
        total_deposits_all = ZERO
        total_expenses_all = ZERO
        total_balance_all = ZERO

        for acc in accounts:
            stats = MoneyAccountService.calculate_balance(acc)
            total_deposits_all += stats['total_deposits']
            total_expenses_all += stats['total_expenses']
            total_balance_all += stats['balance']

            account_summaries.append({
                'id': str(acc.id),
                'title': acc.title,
                'status': acc.status,
                'role': 'MANAGER' if acc.manager == user else 'OWNER',
                'manager_name': acc.manager.first_name or acc.manager.username,
                'owner_name': acc.owner_name,
                'balance': f"{stats['balance']:.2f}",
                'total_deposits': f"{stats['total_deposits']:.2f}",
                'total_expenses': f"{stats['total_expenses']:.2f}",
                'total_refunds': f"{stats['total_refunds']:.2f}"
            })

        txs = AccountTransaction.objects.filter(account__in=accounts, is_voided=False)
        if start_date:
            txs = txs.filter(date__gte=start_date)
        if end_date:
            txs = txs.filter(date__lte=end_date)

        monthly_map = {}
        for tx in txs:
            m_key = tx.date.strftime('%Y-%m')
            if m_key not in monthly_map:
                monthly_map[m_key] = {'deposits': ZERO, 'expenses': ZERO}
            
            amt = to_dec(tx.amount)
            if tx.transaction_type == 'DEPOSIT':
                monthly_map[m_key]['deposits'] += amt
            elif tx.transaction_type in ['EXPENSE', 'REFUND']:
                monthly_map[m_key]['expenses'] += amt

        monthly_trends = []
        for m in sorted(monthly_map.keys()):
            monthly_trends.append({
                'month': m,
                'deposits': f"{monthly_map[m]['deposits']:.2f}",
                'expenses': f"{monthly_map[m]['expenses']:.2f}"
            })

        all_recent_txs = AccountTransaction.objects.filter(account__in=accounts).order_by('-date', '-created_at')[:30]
        recent_list = []
        for tx in all_recent_txs:
            recent_list.append({
                'id': str(tx.id),
                'account_title': tx.account.title,
                'transaction_type': tx.transaction_type,
                'amount': f"{tx.amount:.2f}",
                'description': tx.description,
                'is_voided': tx.is_voided,
                'date': tx.date.strftime('%Y-%m-%d')
            })

        return {
            'managed_accounts_count': managed_qs.count(),
            'held_accounts_count': held_qs.count(),
            'total_deposits': f"{total_deposits_all:.2f}",
            'total_expenses': f"{total_expenses_all:.2f}",
            'total_balance': f"{total_balance_all:.2f}",
            'account_summaries': account_summaries,
            'monthly_trends': monthly_trends,
            'transactions': recent_list
        }

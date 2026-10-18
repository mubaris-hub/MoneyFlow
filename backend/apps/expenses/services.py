from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP
from django.db.models import Q
from rest_framework import serializers


def calculate_expense_splits(total_amount, split_type, participants):
    """
    Calculates exact split amounts (Decimal) for an expense using integer-cent arithmetic.
    Guarantees that SUM(split.amount) == total_amount down to the exact 0.01 cent.

    :param total_amount: Decimal total expense amount
    :param split_type: Choice 'EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES'
    :param participants: List of dicts: [{'user_id': UUID, 'amount': Decimal, 'percentage': Decimal, 'shares': int}]
    :return: List of dicts: [{'user_id': UUID, 'amount': Decimal, 'percentage': Decimal, 'shares': int}]
    """
    if not participants:
        raise serializers.ValidationError({"splits": "Expense must include at least one participant."})

    # Validate unique users in splits
    user_ids = [p['user_id'] for p in participants]
    if len(user_ids) != len(set(user_ids)):
        raise serializers.ValidationError({"splits": "Duplicate participant users are not allowed in the same expense split."})

    total_amount = Decimal(str(total_amount)).quantize(Decimal('0.01'))
    if total_amount <= Decimal('0.00'):
        raise serializers.ValidationError({"total_amount": "Expense total amount must be greater than zero."})

    n = len(participants)
    total_cents = int(round(total_amount * 100))

    calculated_splits = []

    if split_type == 'EQUAL':
        base_cents = total_cents // n
        remainder_cents = total_cents % n

        for i, p in enumerate(participants):
            user_cents = base_cents + (1 if i < remainder_cents else 0)
            user_amount = Decimal(user_cents) / Decimal(100)
            calculated_splits.append({
                'user_id': p['user_id'],
                'amount': user_amount,
                'percentage': None,
                'shares': None
            })

    elif split_type == 'EXACT':
        sum_cents = 0
        for p in participants:
            raw_amt = p.get('amount')
            if raw_amt is None:
                raise serializers.ValidationError({"splits": f"Amount is required for exact split for user {p['user_id']}."})
            
            amt = Decimal(str(raw_amt)).quantize(Decimal('0.01'))
            if amt < Decimal('0.00'):
                raise serializers.ValidationError({"splits": "Split amount cannot be negative."})
            
            cents = int(round(amt * 100))
            sum_cents += cents
            calculated_splits.append({
                'user_id': p['user_id'],
                'amount': amt,
                'percentage': None,
                'shares': None
            })

        if sum_cents != total_cents:
            actual_sum = Decimal(sum_cents) / Decimal(100)
            raise serializers.ValidationError({
                "splits": f"Sum of exact splits (₹{actual_sum}) does not match total expense amount (₹{total_amount})."
            })

    elif split_type == 'PERCENTAGE':
        sum_pct = Decimal('0.00')
        raw_pcts = []
        for p in participants:
            raw_p = p.get('percentage')
            if raw_p is None:
                raise serializers.ValidationError({"splits": f"Percentage is required for user {p['user_id']}."})
            
            pct = Decimal(str(raw_p)).quantize(Decimal('0.01'))
            if pct < Decimal('0.00'):
                raise serializers.ValidationError({"splits": "Percentage cannot be negative."})
            
            sum_pct += pct
            raw_pcts.append((p['user_id'], pct))

        if sum_pct != Decimal('100.00'):
            raise serializers.ValidationError({
                "splits": f"Sum of percentages ({sum_pct}%) must equal 100.00%."
            })

        # Calculate base cents & remainder cents
        cent_allocations = []
        allocated_cents_sum = 0
        for uid, pct in raw_pcts:
            # Base cents floor
            c = int((Decimal(total_cents) * pct / Decimal('100.00')).quantize(Decimal('1'), rounding=ROUND_DOWN))
            cent_allocations.append({'user_id': uid, 'percentage': pct, 'cents': c})
            allocated_cents_sum += c

        remainder_cents = total_cents - allocated_cents_sum

        # Distribute remainder cents to largest percentages
        cent_allocations.sort(key=lambda x: x['percentage'], reverse=True)
        for i in range(remainder_cents):
            cent_allocations[i]['cents'] += 1

        for item in participants:
            uid = item['user_id']
            alloc = next(a for a in cent_allocations if a['user_id'] == uid)
            user_amount = Decimal(alloc['cents']) / Decimal(100)
            calculated_splits.append({
                'user_id': uid,
                'amount': user_amount,
                'percentage': alloc['percentage'],
                'shares': None
            })

    elif split_type == 'SHARES':
        total_shares = 0
        raw_shares = []
        for p in participants:
            raw_s = p.get('shares')
            if raw_s is None or int(raw_s) < 1:
                raise serializers.ValidationError({"splits": f"Shares must be an integer >= 1 for user {p['user_id']}."})
            
            sh = int(raw_s)
            total_shares += sh
            raw_shares.append((p['user_id'], sh))

        if total_shares <= 0:
            raise serializers.ValidationError({"splits": "Total shares must be greater than zero."})

        cent_allocations = []
        allocated_cents_sum = 0
        for uid, sh in raw_shares:
            c = int((Decimal(total_cents) * Decimal(sh) / Decimal(total_shares)).quantize(Decimal('1'), rounding=ROUND_DOWN))
            cent_allocations.append({'user_id': uid, 'shares': sh, 'cents': c})
            allocated_cents_sum += c

        remainder_cents = total_cents - allocated_cents_sum
        cent_allocations.sort(key=lambda x: x['shares'], reverse=True)
        for i in range(remainder_cents):
            cent_allocations[i]['cents'] += 1

        for item in participants:
            uid = item['user_id']
            alloc = next(a for a in cent_allocations if a['user_id'] == uid)
            user_amount = Decimal(alloc['cents']) / Decimal(100)
            calculated_splits.append({
                'user_id': uid,
                'amount': user_amount,
                'percentage': None,
                'shares': alloc['shares']
            })

    else:
        raise serializers.ValidationError({"split_type": f"Invalid split type '{split_type}'."})

    # Final Invariant Assertion Check
    final_sum = sum(s['amount'] for s in calculated_splits)
    if final_sum != total_amount:
        raise serializers.ValidationError({
            "splits": f"Internal split calculation mismatch: Sum (₹{final_sum}) != Total (₹{total_amount})."
        })

    return calculated_splits


def calculate_group_balances(group):
    """
    Calculates net balances for all members of a group.
    
    Formula per member U:
    net_balance = (total_paid - total_share) 
                + (dp_sent - dp_received) 
                + (settlements_sent - settlements_received)
                
    Guarantees:
    - Excludes soft-deleted expenses (is_deleted=True)
    - Excludes non-COMPLETED settlements (PENDING and CANCELLED excluded)
    - Includes DirectPayment records directly
    - Quantized to exact 0.01 cent using Decimal arithmetic
    - Group-wide sum of member net balances equals exactly Decimal('0.00')
    """
    from django.db.models import Sum
    from apps.groups.models import GroupMember
    from apps.expenses.models import Expense, ExpenseSplit, DirectPayment, Settlement

    memberships = GroupMember.objects.filter(group=group).select_related('user')
    member_balances = []
    
    expenses_paid = Expense.objects.filter(group=group, is_deleted=False).values('paid_by').annotate(total=Sum('total_amount'))
    paid_map = {item['paid_by']: item['total'] for item in expenses_paid}

    splits_share = ExpenseSplit.objects.filter(expense__group=group, expense__is_deleted=False).values('user').annotate(total=Sum('amount'))
    share_map = {item['user']: item['total'] for item in splits_share}

    dp_sent_qs = DirectPayment.objects.filter(group=group).values('sender').annotate(total=Sum('amount'))
    dp_sent_map = {item['sender']: item['total'] for item in dp_sent_qs}

    dp_recv_qs = DirectPayment.objects.filter(group=group).values('receiver').annotate(total=Sum('amount'))
    dp_recv_map = {item['receiver']: item['total'] for item in dp_recv_qs}

    st_sent_qs = Settlement.objects.filter(group=group, status='COMPLETED').values('sender').annotate(total=Sum('amount'))
    st_sent_map = {item['sender']: item['total'] for item in st_sent_qs}

    st_recv_qs = Settlement.objects.filter(group=group, status='COMPLETED').values('receiver').annotate(total=Sum('amount'))
    st_recv_map = {item['receiver']: item['total'] for item in st_recv_qs}

    for m in memberships:
        u_id = m.user.id
        total_paid = (paid_map.get(u_id) or Decimal('0.00')).quantize(Decimal('0.01'))
        total_share = (share_map.get(u_id) or Decimal('0.00')).quantize(Decimal('0.01'))
        dp_sent = (dp_sent_map.get(u_id) or Decimal('0.00')).quantize(Decimal('0.01'))
        dp_received = (dp_recv_map.get(u_id) or Decimal('0.00')).quantize(Decimal('0.01'))
        st_sent = (st_sent_map.get(u_id) or Decimal('0.00')).quantize(Decimal('0.01'))
        st_received = (st_recv_map.get(u_id) or Decimal('0.00')).quantize(Decimal('0.01'))

        net_balance = (total_paid - total_share) + (dp_sent - dp_received) + (st_sent - st_received)
        net_balance = net_balance.quantize(Decimal('0.01'))

        if net_balance > Decimal('0.00'):
            status = 'GETS_BACK'
        elif net_balance < Decimal('0.00'):
            status = 'OWES'
        else:
            status = 'SETTLED'

        member_balances.append({
            'user_id': u_id,
            'user': m.user,
            'total_paid': total_paid,
            'total_share': total_share,
            'net_balance': net_balance,
            'status': status,
        })

    sum_net = sum((mb['net_balance'] for mb in member_balances), Decimal('0.00'))
    if sum_net != Decimal('0.00'):
        diff = sum_net
        for mb in member_balances:
            if mb['net_balance'] != Decimal('0.00'):
                mb['net_balance'] = (mb['net_balance'] - diff).quantize(Decimal('0.01'))
                if mb['net_balance'] > Decimal('0.00'):
                    mb['status'] = 'GETS_BACK'
                elif mb['net_balance'] < Decimal('0.00'):
                    mb['status'] = 'OWES'
                else:
                    mb['status'] = 'SETTLED'
                break

    return member_balances


def calculate_debt_simplification(member_balances):
    """
    Greedy integer-cent debt simplification algorithm.
    Generates a read-only list of suggested transfers to settle all group debts.
    
    Guarantees:
    - Exact cent precision
    - Creditor total equals debtor total
    - No self-transfers
    - No zero-value transfers
    - At most N-1 suggested transfers
    """
    debtors = []
    creditors = []
    
    for mb in member_balances:
        net_cents = int(round(Decimal(str(mb['net_balance'])) * 100))
        if net_cents < 0:
            debtors.append({'user_id': mb['user_id'], 'user': mb['user'], 'cents': -net_cents})
        elif net_cents > 0:
            creditors.append({'user_id': mb['user_id'], 'user': mb['user'], 'cents': net_cents})

    debtors.sort(key=lambda x: x['cents'], reverse=True)
    creditors.sort(key=lambda x: x['cents'], reverse=True)

    suggested_settlements = []

    i = 0
    j = 0
    while i < len(debtors) and j < len(creditors):
        debtor = debtors[i]
        creditor = creditors[j]

        transfer_cents = min(debtor['cents'], creditor['cents'])

        if transfer_cents > 0:
            amount = Decimal(transfer_cents) / Decimal(100)
            suggested_settlements.append({
                'sender_id': str(debtor['user_id']),
                'sender': debtor['user'],
                'receiver_id': str(creditor['user_id']),
                'receiver': creditor['user'],
                'amount': amount,
            })

            debtor['cents'] -= transfer_cents
            creditor['cents'] -= transfer_cents

        if debtor['cents'] == 0:
            i += 1
        if creditor['cents'] == 0:
            j += 1

    return suggested_settlements


class TransactionHistoryService:
    @staticmethod
    def get_user_transactions(
        user,
        search=None,
        transaction_type=None,
        group_id=None,
        date_from=None,
        date_to=None,
        status=None,
        ordering='newest',
        page=1,
        page_size=20
    ):
        from apps.groups.models import Group
        from apps.expenses.models import Expense, DirectPayment, Settlement
        from apps.money_accounts.models import MoneyAccount, AccountTransaction
        from django.db.models import Q

        user_groups = Group.objects.filter(memberships__user=user)
        user_accounts = MoneyAccount.objects.filter(Q(manager=user) | Q(owner=user))

        if group_id:
            user_groups = user_groups.filter(id=group_id)
            user_accounts = user_accounts.filter(id=group_id)

        all_transactions = []
        normalized_type = (transaction_type or '').strip().upper()
        normalized_status = (status or '').strip().upper()
        search_query = (search or '').strip()

        # 1. EXPENSES
        if normalized_type in ['', 'ALL', 'EXPENSE']:
            if normalized_status in ['', 'ALL', 'COMPLETED']:
                exp_qs = Expense.objects.filter(
                    group__in=user_groups,
                    is_deleted=False
                ).select_related('paid_by', 'created_by', 'group', 'category').prefetch_related('splits__user')

                if date_from:
                    exp_qs = exp_qs.filter(date__gte=date_from)
                if date_to:
                    exp_qs = exp_qs.filter(date__lte=date_to)
                if search_query:
                    exp_qs = exp_qs.filter(
                        Q(description__icontains=search_query) |
                        Q(paid_by__first_name__icontains=search_query) |
                        Q(paid_by__last_name__icontains=search_query) |
                        Q(paid_by__username__icontains=search_query) |
                        Q(group__name__icontains=search_query)
                    )

                for exp in exp_qs:
                    splits_list = list(exp.splits.all())
                    user_split = next((s for s in splits_list if s.user_id == user.id), None)
                    is_payer = (exp.paid_by_id == user.id)

                    all_transactions.append({
                        'id': f"expense_{exp.id}",
                        'raw_id': str(exp.id),
                        'transaction_type': 'EXPENSE',
                        'type_label': 'Group Expense',
                        'description': exp.description,
                        'amount': str(exp.total_amount),
                        'currency': exp.currency,
                        'date': exp.date.isoformat() if hasattr(exp.date, 'isoformat') else str(exp.date),
                        'created_at': exp.created_at.isoformat() if hasattr(exp.created_at, 'isoformat') else str(exp.created_at),
                        'group': {
                            'id': str(exp.group.id),
                            'name': exp.group.name,
                            'is_ledger': False,
                        },
                        'payer': {
                            'id': str(exp.paid_by.id),
                            'name': f"{exp.paid_by.first_name} {exp.paid_by.last_name}".strip() or exp.paid_by.username,
                            'email': exp.paid_by.email,
                        },
                        'receiver': None,
                        'category': {
                            'id': exp.category.id,
                            'name': exp.category.name,
                            'icon': exp.category.icon
                        } if exp.category else None,
                        'status': 'COMPLETED',
                        'status_label': 'Completed',
                        'notes': exp.notes,
                        'receipt_url': exp.receipt_url,
                        'user_role': 'PAID' if is_payer else ('PARTICIPANT' if user_split else 'MEMBER'),
                        'my_share': str(user_split.amount) if user_split else ('0.00' if not is_payer else str(exp.total_amount)),
                        'participants': [
                            {
                                'user': {
                                    'id': str(s.user.id),
                                    'name': f"{s.user.first_name} {s.user.last_name}".strip() or s.user.username,
                                    'email': s.user.email
                                },
                                'amount': str(s.amount),
                                'percentage': str(s.percentage) if s.percentage is not None else None,
                                'shares': s.shares
                            }
                            for s in splits_list
                        ]
                    })

        # 2. DIRECT PAYMENTS / TRANSFERS
        if normalized_type in ['', 'ALL', 'DIRECT_PAYMENT', 'TRANSFER', 'REPAYMENT']:
            if normalized_status in ['', 'ALL', 'COMPLETED']:
                dp_qs = DirectPayment.objects.filter(
                    group__in=user_groups
                ).select_related('sender', 'receiver', 'group')

                if date_from:
                    dp_qs = dp_qs.filter(date__gte=date_from)
                if date_to:
                    dp_qs = dp_qs.filter(date__lte=date_to)
                if search_query:
                    dp_qs = dp_qs.filter(
                        Q(notes__icontains=search_query) |
                        Q(sender__first_name__icontains=search_query) |
                        Q(sender__last_name__icontains=search_query) |
                        Q(receiver__first_name__icontains=search_query) |
                        Q(receiver__last_name__icontains=search_query) |
                        Q(group__name__icontains=search_query)
                    )

                for dp in dp_qs:
                    sender_name = f"{dp.sender.first_name} {dp.sender.last_name}".strip() or dp.sender.username
                    receiver_name = f"{dp.receiver.first_name} {dp.receiver.last_name}".strip() or dp.receiver.username

                    all_transactions.append({
                        'id': f"direct_payment_{dp.id}",
                        'raw_id': str(dp.id),
                        'transaction_type': 'DIRECT_PAYMENT',
                        'type_label': 'Direct Transfer',
                        'description': dp.notes or f"Transfer: {sender_name} → {receiver_name}",
                        'amount': str(dp.amount),
                        'currency': dp.currency,
                        'date': dp.date.isoformat() if hasattr(dp.date, 'isoformat') else str(dp.date),
                        'created_at': dp.created_at.isoformat() if hasattr(dp.created_at, 'isoformat') else str(dp.created_at),
                        'group': {
                            'id': str(dp.group.id),
                            'name': dp.group.name,
                            'is_ledger': False,
                        },
                        'payer': {
                            'id': str(dp.sender.id),
                            'name': sender_name,
                            'email': dp.sender.email,
                        },
                        'receiver': {
                            'id': str(dp.receiver.id),
                            'name': receiver_name,
                            'email': dp.receiver.email,
                        },
                        'category': {'id': None, 'name': 'Transfer', 'icon': 'ArrowRightLeft'},
                        'status': 'COMPLETED',
                        'status_label': 'Completed',
                        'notes': dp.notes,
                        'receipt_url': None,
                        'user_role': 'SENDER' if dp.sender_id == user.id else ('RECEIVER' if dp.receiver_id == user.id else 'MEMBER'),
                        'my_share': str(dp.amount) if (dp.sender_id == user.id or dp.receiver_id == user.id) else '0.00',
                        'participants': []
                    })

        # 3. SETTLEMENTS
        if normalized_type in ['', 'ALL', 'SETTLEMENT']:
            st_qs = Settlement.objects.filter(
                group__in=user_groups
            ).select_related('sender', 'receiver', 'created_by', 'group')

            if normalized_status and normalized_status != 'ALL':
                st_qs = st_qs.filter(status=normalized_status)
            if date_from:
                st_qs = st_qs.filter(date__gte=date_from)
            if date_to:
                st_qs = st_qs.filter(date__lte=date_to)
            if search_query:
                st_qs = st_qs.filter(
                    Q(notes__icontains=search_query) |
                    Q(sender__first_name__icontains=search_query) |
                    Q(sender__last_name__icontains=search_query) |
                    Q(receiver__first_name__icontains=search_query) |
                    Q(receiver__last_name__icontains=search_query) |
                    Q(group__name__icontains=search_query)
                )

            for st in st_qs:
                sender_name = f"{st.sender.first_name} {st.sender.last_name}".strip() or st.sender.username
                receiver_name = f"{st.receiver.first_name} {st.receiver.last_name}".strip() or st.receiver.username

                all_transactions.append({
                    'id': f"settlement_{st.id}",
                    'raw_id': str(st.id),
                    'transaction_type': 'SETTLEMENT',
                    'type_label': 'Group Settlement',
                    'description': st.notes or f"Settlement: {sender_name} → {receiver_name}",
                    'amount': str(st.amount),
                    'currency': st.currency,
                    'date': st.date.isoformat() if hasattr(st.date, 'isoformat') else str(st.date),
                    'created_at': st.created_at.isoformat() if hasattr(st.created_at, 'isoformat') else str(st.created_at),
                    'group': {
                        'id': str(st.group.id),
                        'name': st.group.name,
                        'is_ledger': False,
                    },
                    'payer': {
                        'id': str(st.sender.id),
                        'name': sender_name,
                        'email': st.sender.email,
                    },
                    'receiver': {
                        'id': str(st.receiver.id),
                        'name': receiver_name,
                        'email': st.receiver.email,
                    },
                    'category': {'id': None, 'name': 'Settlement', 'icon': 'HandCoins'},
                    'status': st.status,
                    'status_label': st.get_status_display(),
                    'notes': st.notes,
                    'receipt_url': None,
                    'user_role': 'SENDER' if st.sender_id == user.id else ('RECEIVER' if st.receiver_id == user.id else 'MEMBER'),
                    'my_share': str(st.amount) if (st.sender_id == user.id or st.receiver_id == user.id) else '0.00',
                    'participants': []
                })

        # 4. FRIEND LEDGER TRANSACTIONS
        if normalized_type in ['', 'ALL', 'FRIEND_LEDGER', 'LEDGER']:
            at_qs = AccountTransaction.objects.filter(
                account__in=user_accounts
            ).select_related('account', 'created_by', 'category')

            if normalized_status == 'VOIDED':
                at_qs = at_qs.filter(is_voided=True)
            elif normalized_status == 'COMPLETED':
                at_qs = at_qs.filter(is_voided=False)
            elif normalized_status and normalized_status not in ['', 'ALL']:
                # No match for PENDING or CANCELLED in Friend Ledgers
                at_qs = at_qs.none()

            if date_from:
                at_qs = at_qs.filter(date__gte=date_from)
            if date_to:
                at_qs = at_qs.filter(date__lte=date_to)
            if search_query:
                at_qs = at_qs.filter(
                    Q(description__icontains=search_query) |
                    Q(notes__icontains=search_query) |
                    Q(account__title__icontains=search_query)
                )

            for at in at_qs:
                creator_name = f"{at.created_by.first_name} {at.created_by.last_name}".strip() or at.created_by.username

                all_transactions.append({
                    'id': f"account_tx_{at.id}",
                    'raw_id': str(at.id),
                    'transaction_type': 'FRIEND_LEDGER',
                    'type_label': f"Friend Ledger ({at.get_transaction_type_display()})",
                    'description': at.description,
                    'amount': str(at.amount),
                    'currency': at.account.currency,
                    'date': at.date.isoformat() if hasattr(at.date, 'isoformat') else str(at.date),
                    'created_at': at.created_at.isoformat() if hasattr(at.created_at, 'isoformat') else str(at.created_at),
                    'group': {
                        'id': str(at.account.id),
                        'name': f"Ledger: {at.account.title}",
                        'is_ledger': True,
                    },
                    'payer': {
                        'id': str(at.created_by.id),
                        'name': creator_name,
                        'email': at.created_by.email,
                    },
                    'receiver': None,
                    'category': {
                        'id': at.category.id,
                        'name': at.category.name,
                        'icon': at.category.icon
                    } if at.category else None,
                    'status': 'VOIDED' if at.is_voided else 'COMPLETED',
                    'status_label': 'Voided' if at.is_voided else 'Completed',
                    'notes': at.notes,
                    'receipt_url': at.receipt_url,
                    'user_role': 'MANAGER' if at.account.manager_id == user.id else ('OWNER' if at.account.owner_id == user.id else 'MEMBER'),
                    'my_share': str(at.amount),
                    'participants': []
                })

        # Sorting
        if ordering == 'oldest':
            all_transactions.sort(key=lambda t: (t['date'], t['created_at']))
        elif ordering == 'highest_amount':
            all_transactions.sort(key=lambda t: Decimal(t['amount']), reverse=True)
        elif ordering == 'lowest_amount':
            all_transactions.sort(key=lambda t: Decimal(t['amount']))
        else:  # newest
            all_transactions.sort(key=lambda t: (t['date'], t['created_at']), reverse=True)

        total_count = len(all_transactions)
        total_volume = sum((Decimal(t['amount']) for t in all_transactions), Decimal('0.00')).quantize(Decimal('0.01'))

        summary = {
            'total_count': total_count,
            'total_volume': str(total_volume),
            'expenses_count': sum(1 for t in all_transactions if t['transaction_type'] == 'EXPENSE'),
            'direct_payments_count': sum(1 for t in all_transactions if t['transaction_type'] == 'DIRECT_PAYMENT'),
            'settlements_count': sum(1 for t in all_transactions if t['transaction_type'] == 'SETTLEMENT'),
            'ledgers_count': sum(1 for t in all_transactions if t['transaction_type'] == 'FRIEND_LEDGER'),
        }

        # Pagination
        try:
            page = max(1, int(page))
        except (ValueError, TypeError):
            page = 1

        try:
            page_size = min(100, max(1, int(page_size)))
        except (ValueError, TypeError):
            page_size = 20

        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_transactions = all_transactions[start_idx:end_idx]
        total_pages = (total_count + page_size - 1) // page_size if page_size > 0 else 1

        return {
            'count': total_count,
            'page': page,
            'page_size': page_size,
            'total_pages': total_pages,
            'transactions': paginated_transactions,
            'summary': summary
        }

    @staticmethod
    def get_single_transaction(user, transaction_id):
        from apps.groups.models import Group
        from apps.expenses.models import Expense, DirectPayment, Settlement
        from apps.money_accounts.models import MoneyAccount, AccountTransaction
        from rest_framework.exceptions import PermissionDenied, NotFound

        user_groups = Group.objects.filter(memberships__user=user)
        user_accounts = MoneyAccount.objects.filter(Q(manager=user) | Q(owner=user))

        if transaction_id.startswith('expense_'):
            raw_id = transaction_id[len('expense_'):]
            exp = Expense.objects.filter(id=raw_id, is_deleted=False).select_related('paid_by', 'created_by', 'group', 'category').prefetch_related('splits__user').first()
            if not exp:
                raise NotFound("Expense transaction not found.")
            if not user_groups.filter(id=exp.group_id).exists():
                raise PermissionDenied("You do not have access to this transaction.")
            
            splits_list = list(exp.splits.all())
            user_split = next((s for s in splits_list if s.user_id == user.id), None)
            is_payer = (exp.paid_by_id == user.id)

            return {
                'id': f"expense_{exp.id}",
                'raw_id': str(exp.id),
                'transaction_type': 'EXPENSE',
                'type_label': 'Group Expense',
                'description': exp.description,
                'amount': str(exp.total_amount),
                'currency': exp.currency,
                'date': exp.date.isoformat() if hasattr(exp.date, 'isoformat') else str(exp.date),
                'created_at': exp.created_at.isoformat() if hasattr(exp.created_at, 'isoformat') else str(exp.created_at),
                'group': {'id': str(exp.group.id), 'name': exp.group.name, 'is_ledger': False},
                'payer': {'id': str(exp.paid_by.id), 'name': f"{exp.paid_by.first_name} {exp.paid_by.last_name}".strip() or exp.paid_by.username, 'email': exp.paid_by.email},
                'receiver': None,
                'category': {'id': exp.category.id, 'name': exp.category.name, 'icon': exp.category.icon} if exp.category else None,
                'status': 'COMPLETED',
                'status_label': 'Completed',
                'notes': exp.notes,
                'receipt_url': exp.receipt_url,
                'user_role': 'PAID' if is_payer else ('PARTICIPANT' if user_split else 'MEMBER'),
                'my_share': str(user_split.amount) if user_split else ('0.00' if not is_payer else str(exp.total_amount)),
                'participants': [
                    {
                        'user': {'id': str(s.user.id), 'name': f"{s.user.first_name} {s.user.last_name}".strip() or s.user.username, 'email': s.user.email},
                        'amount': str(s.amount),
                        'percentage': str(s.percentage) if s.percentage is not None else None,
                        'shares': s.shares
                    }
                    for s in splits_list
                ]
            }

        elif transaction_id.startswith('direct_payment_'):
            raw_id = transaction_id[len('direct_payment_'):]
            dp = DirectPayment.objects.filter(id=raw_id).select_related('sender', 'receiver', 'group').first()
            if not dp:
                raise NotFound("Direct payment transaction not found.")
            if not user_groups.filter(id=dp.group_id).exists():
                raise PermissionDenied("You do not have access to this transaction.")

            sender_name = f"{dp.sender.first_name} {dp.sender.last_name}".strip() or dp.sender.username
            receiver_name = f"{dp.receiver.first_name} {dp.receiver.last_name}".strip() or dp.receiver.username

            return {
                'id': f"direct_payment_{dp.id}",
                'raw_id': str(dp.id),
                'transaction_type': 'DIRECT_PAYMENT',
                'type_label': 'Direct Transfer',
                'description': dp.notes or f"Transfer: {sender_name} → {receiver_name}",
                'amount': str(dp.amount),
                'currency': dp.currency,
                'date': dp.date.isoformat() if hasattr(dp.date, 'isoformat') else str(dp.date),
                'created_at': dp.created_at.isoformat() if hasattr(dp.created_at, 'isoformat') else str(dp.created_at),
                'group': {'id': str(dp.group.id), 'name': dp.group.name, 'is_ledger': False},
                'payer': {'id': str(dp.sender.id), 'name': sender_name, 'email': dp.sender.email},
                'receiver': {'id': str(dp.receiver.id), 'name': receiver_name, 'email': dp.receiver.email},
                'category': {'id': None, 'name': 'Transfer', 'icon': 'ArrowRightLeft'},
                'status': 'COMPLETED',
                'status_label': 'Completed',
                'notes': dp.notes,
                'receipt_url': None,
                'user_role': 'SENDER' if dp.sender_id == user.id else ('RECEIVER' if dp.receiver_id == user.id else 'MEMBER'),
                'my_share': str(dp.amount) if (dp.sender_id == user.id or dp.receiver_id == user.id) else '0.00',
                'participants': []
            }

        elif transaction_id.startswith('settlement_'):
            raw_id = transaction_id[len('settlement_'):]
            st = Settlement.objects.filter(id=raw_id).select_related('sender', 'receiver', 'created_by', 'group').first()
            if not st:
                raise NotFound("Settlement transaction not found.")
            if not user_groups.filter(id=st.group_id).exists():
                raise PermissionDenied("You do not have access to this transaction.")

            sender_name = f"{st.sender.first_name} {st.sender.last_name}".strip() or st.sender.username
            receiver_name = f"{st.receiver.first_name} {st.receiver.last_name}".strip() or st.receiver.username

            return {
                'id': f"settlement_{st.id}",
                'raw_id': str(st.id),
                'transaction_type': 'SETTLEMENT',
                'type_label': 'Group Settlement',
                'description': st.notes or f"Settlement: {sender_name} → {receiver_name}",
                'amount': str(st.amount),
                'currency': st.currency,
                'date': st.date.isoformat() if hasattr(st.date, 'isoformat') else str(st.date),
                'created_at': st.created_at.isoformat() if hasattr(st.created_at, 'isoformat') else str(st.created_at),
                'group': {'id': str(st.group.id), 'name': st.group.name, 'is_ledger': False},
                'payer': {'id': str(st.sender.id), 'name': sender_name, 'email': st.sender.email},
                'receiver': {'id': str(st.receiver.id), 'name': receiver_name, 'email': st.receiver.email},
                'category': {'id': None, 'name': 'Settlement', 'icon': 'HandCoins'},
                'status': st.status,
                'status_label': st.get_status_display(),
                'notes': st.notes,
                'receipt_url': None,
                'user_role': 'SENDER' if st.sender_id == user.id else ('RECEIVER' if st.receiver_id == user.id else 'MEMBER'),
                'my_share': str(st.amount) if (st.sender_id == user.id or st.receiver_id == user.id) else '0.00',
                'participants': []
            }

        elif transaction_id.startswith('account_tx_'):
            raw_id = transaction_id[len('account_tx_'):]
            at = AccountTransaction.objects.filter(id=raw_id).select_related('account', 'created_by', 'category').first()
            if not at:
                raise NotFound("Ledger transaction not found.")
            if not user_accounts.filter(id=at.account_id).exists():
                raise PermissionDenied("You do not have access to this transaction.")

            creator_name = f"{at.created_by.first_name} {at.created_by.last_name}".strip() or at.created_by.username

            return {
                'id': f"account_tx_{at.id}",
                'raw_id': str(at.id),
                'transaction_type': 'FRIEND_LEDGER',
                'type_label': f"Friend Ledger ({at.get_transaction_type_display()})",
                'description': at.description,
                'amount': str(at.amount),
                'currency': at.account.currency,
                'date': at.date.isoformat() if hasattr(at.date, 'isoformat') else str(at.date),
                'created_at': at.created_at.isoformat() if hasattr(at.created_at, 'isoformat') else str(at.created_at),
                'group': {'id': str(at.account.id), 'name': f"Ledger: {at.account.title}", 'is_ledger': True},
                'payer': {'id': str(at.created_by.id), 'name': creator_name, 'email': at.created_by.email},
                'receiver': None,
                'category': {'id': at.category.id, 'name': at.category.name, 'icon': at.category.icon} if at.category else None,
                'status': 'VOIDED' if at.is_voided else 'COMPLETED',
                'status_label': 'Voided' if at.is_voided else 'Completed',
                'notes': at.notes,
                'receipt_url': at.receipt_url,
                'user_role': 'MANAGER' if at.account.manager_id == user.id else ('OWNER' if at.account.owner_id == user.id else 'MEMBER'),
                'my_share': str(at.amount),
                'participants': []
            }

        else:
            raise NotFound("Invalid transaction ID format.")



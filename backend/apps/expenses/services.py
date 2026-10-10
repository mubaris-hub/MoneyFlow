from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP
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


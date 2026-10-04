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

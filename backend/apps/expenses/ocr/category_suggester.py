"""
Deterministic and explainable category suggestion engine for MoneyFlow OCR scanner.

Analyzes extracted merchant names and line item descriptions to suggest
an appropriate expense category from the system categories:
- Education (College, university, campus, school, exam fee, tuition...)
- Groceries (Supermarket, grocery, mart, whole foods, bakery...)
- Food & Dining (Restaurant, cafe, coffee, bistro, kitchen, burger...)
- Travel & Transport (Fuel, petrol, diesel, uber, ola, flight, train...)
- Healthcare (Pharmacy, chemist, hospital, clinic, medicine, doctor...)
- Utilities & Bills (Electricity, water, gas, broadband, recharge, wifi...)
- Entertainment (Cinema, theater, movie, netflix, concert, gaming...)
- Shopping (Clothing, fashion, apparel, electronics, gadgets...)
- Rent & Housing (Rent, apartment, landlord, housing, society maintenance...)

Rules are deterministic and explainable:
- Merchant matches are weighted with score 2.
- Line item description matches are weighted with score 1.
- In case of an ambiguous tie between multiple top categories, returns None (no suggestion).
- If no keywords match, returns None (no suggestion).
- Clearly labeled as 'suggested' confidence, allowing user manual override.
"""

from typing import Optional, Dict, List, Any

CATEGORY_RULES: Dict[str, Dict[str, Any]] = {
    'Education': {
        'keywords': [
            'college', 'university', 'campus', 'school', 'academy', 'institute',
            'tuition', 'exam fee', 'examination fee', 'semester fee', 'admission fee',
            'course', 'textbook', 'library', 'coaching', 'student', 'degree',
            'udemy', 'coursera', 'edx', 'education'
        ],
        'canonical_name': 'Education',
        'icon': 'GraduationCap'
    },
    'Groceries': {
        'keywords': [
            'supermarket', 'grocery', 'groceries', 'hypermarket', 'provisions',
            'vegetables', 'fruits', 'bakery', 'bazaar', 'spices', 'milk', 'dairy',
            'safeway', 'trader joe', 'whole foods', 'dmart', 'reliance fresh',
            'bigbasket', 'blinkit', 'zepto', 'instamart', 'food store'
        ],
        'canonical_name': 'Groceries',
        'icon': 'ShoppingCart'
    },
    'Food & Dining': {
        'keywords': [
            'restaurant', 'cafe', 'coffee', 'bistro', 'kitchen', 'pizzeria',
            'burger', 'pizza', 'diner', 'bar', 'pub', 'grill', 'fast food',
            'starbucks', 'blue tokai', 'mcdonald', 'kfc', 'subway', 'domino',
            'swiggy', 'zomato', 'cold brew', 'croissant', 'espresso', 'latte',
            'cappuccino', 'tea', 'sandwich', 'dining', 'food court'
        ],
        'canonical_name': 'Food & Dining',
        'icon': 'Utensils'
    },
    'Travel & Transport': {
        'keywords': [
            'fuel', 'petrol', 'diesel', 'gas station', 'oil', 'shell', 'bpcl',
            'hpcl', 'iocl', 'uber', 'ola', 'cab', 'taxi', 'metro', 'train',
            'irctc', 'airline', 'flight', 'indigo', 'air india', 'bus', 'toll',
            'parking', 'railway', 'transportation', 'transit'
        ],
        'canonical_name': 'Travel & Transport',
        'icon': 'Car'
    },
    'Healthcare': {
        'keywords': [
            'pharmacy', 'chemist', 'medical', 'hospital', 'clinic', 'doctor',
            'healthcare', 'medicine', 'druggist', 'apollo', 'medplus', 'pathology',
            'diagnostic', 'lab', 'dentist', 'health', 'pharma'
        ],
        'canonical_name': 'Healthcare',
        'icon': 'HeartPulse'
    },
    'Utilities & Bills': {
        'keywords': [
            'electricity', 'electric', 'water bill', 'gas bill', 'utility',
            'power', 'broadband', 'internet', 'wifi', 'recharge', 'telecom',
            'airtel', 'jio', 'vi', 'bsnl', 'bill payment', 'sewer'
        ],
        'canonical_name': 'Utilities & Bills',
        'icon': 'Zap'
    },
    'Entertainment': {
        'keywords': [
            'cinema', 'theater', 'theatre', 'movie', 'film', 'pvr', 'inox',
            'cinepolis', 'netflix', 'spotify', 'disney', 'prime video',
            'amusement', 'gaming', 'concert', 'ticket'
        ],
        'canonical_name': 'Entertainment',
        'icon': 'Film'
    },
    'Shopping': {
        'keywords': [
            'clothing', 'apparel', 'fashion', 'shoes', 'footwear', 'boutique',
            'electronics', 'gadgets', 'croma', 'apple store', 'zara', 'h&m',
            'westside', 'mall', 'retail', 'amazon', 'flipkart', 'myntra',
            'department store'
        ],
        'canonical_name': 'Shopping',
        'icon': 'ShoppingBag'
    },
    'Rent & Housing': {
        'keywords': [
            'rent', 'apartment', 'landlord', 'maintenance fee', 'housing',
            'society maintenance', 'hostel', 'lease'
        ],
        'canonical_name': 'Rent & Housing',
        'icon': 'Home'
    }
}


def suggest_category(
    merchant_name: Optional[str] = None,
    line_items: Optional[List[Dict[str, Any]]] = None,
    raw_text: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Evaluates merchant name and line items against deterministic category rules.

    Returns:
        Dict with keys:
            - category_name (str)
            - category_id (Optional[int])
            - confidence (str: 'suggested')
            - reason (str)
            - matched_keywords (List[str])
        Or None if ambiguous or no match.
    """
    merchant_clean = (merchant_name or "").lower().strip()
    items = line_items or []

    scores: Dict[str, int] = {}
    matched_reasons: Dict[str, List[str]] = {}

    for cat_name, config in CATEGORY_RULES.items():
        score = 0
        matched = []

        # 1. Check merchant name (weighted score: 2)
        if merchant_clean:
            for kw in config['keywords']:
                if kw in merchant_clean:
                    score += 2
                    matched.append(f"merchant '{kw}'")

        # 2. Check line items (weighted score: 1)
        for item in items:
            desc = (item.get('description') or "").lower().strip()
            if desc:
                for kw in config['keywords']:
                    if kw in desc and f"item '{kw}'" not in matched:
                        score += 1
                        matched.append(f"item '{kw}'")

        if score > 0:
            scores[cat_name] = score
            matched_reasons[cat_name] = matched

    if not scores:
        return None

    # Sort scores descending
    sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    best_cat, best_score = sorted_scores[0]

    # Ambiguity check: if 2nd place has the exact same top score, match is ambiguous
    if len(sorted_scores) > 1 and sorted_scores[1][1] == best_score:
        return None

    # Look up database category ID if available
    category_id = None
    canonical_name = best_cat
    try:
        from apps.expenses.models import Category
        db_cat = Category.objects.filter(name__iexact=best_cat).first()
        if db_cat:
            category_id = db_cat.id
            canonical_name = db_cat.name
    except Exception:
        pass

    matches_str = ", ".join(matched_reasons[best_cat])
    return {
        "category_name": canonical_name,
        "category_id": category_id,
        "confidence": "suggested",
        "reason": f"Suggested based on {matches_str}",
        "matched_keywords": matched_reasons[best_cat]
    }

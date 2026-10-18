import re
from decimal import Decimal, InvalidOperation
from datetime import datetime, date

# Month lookup map supporting full English names and standard 3-letter abbreviations
MONTH_MAP = {
    'jan': 1, 'january': 1,
    'feb': 2, 'february': 2,
    'mar': 3, 'march': 3,
    'apr': 4, 'april': 4,
    'may': 5,
    'jun': 6, 'june': 6,
    'jul': 7, 'july': 7,
    'aug': 8, 'august': 8,
    'sep': 9, 'september': 9, 'sept': 9,
    'oct': 10, 'october': 10,
    'nov': 11, 'november': 11,
    'dec': 12, 'december': 12,
}

# Date label indicators prioritizing explicit receipt dates
DATE_LABEL_PATTERNS = [
    re.compile(r'\b(?:dated|date of issue|invoice\s*date|receipt\s*date|txn\s*date|transaction\s*date|bill\s*date|date)\s*[:\-]?\s*(.+)$', re.IGNORECASE),
]


def normalize_two_digit_year(year_val: int) -> int:
    """
    Two-digit years (YY) are interpreted using a 2000-based cutoff window:
    - 00 to 69 map to 2000-2069 (e.g. 25 -> 2025, 26 -> 2026, 00 -> 2000).
    - 70 to 99 map to 1970-1999 (e.g. 99 -> 1999).
    Valid financial receipt dates are strictly validated between years 2000 and 2035.
    """
    if year_val < 100:
        return 2000 + year_val if year_val <= 69 else 1900 + year_val
    return year_val


# Currency indicators
CURRENCY_PATTERNS = [
    (re.compile(r'(?:₹|INR\b|Rs\.?)', re.IGNORECASE), 'INR'),
    (re.compile(r'(?:\$|USD\b)', re.IGNORECASE), 'USD'),
    (re.compile(r'(?:€|EUR\b)', re.IGNORECASE), 'EUR'),
    (re.compile(r'(?:£|GBP\b)', re.IGNORECASE), 'GBP'),
    # UPI signals indicating Indian Rupee
    (re.compile(r'(?:UPI|@okaxis|@okhdfcbank|@paytm|@upi|@ybl|@axl|@ibl)\b', re.IGNORECASE), 'INR'),
]

# Total amount keywords sorted by priority
TOTAL_KEYWORDS = [
    'grand total',
    'total amount',
    'amount due',
    'net amount',
    'final total',
    'total due',
    'balance due',
    'total'
]

# Generic interface phrases and labels that should NEVER be classified as a merchant
NON_MERCHANT_TOKENS = {
    'receipt', 'tax invoice', 'invoice', 'bill', 'cash memo', 'sale',
    'order', 'store', 'thank you', 'thanks', 'welcome', 'customer copy',
    'duplicate', 'original', 'tel', 'phone', 'gstin', 'gst', 'date', 'dated',
    'time', 'table', 'token', 'pos', 'terminal', 'cashier', 'server',
    # Payment app interface words:
    'payment successful', 'transaction successful', 'paid successfully',
    'payment completed', 'transfer successful', 'payment approved',
    'payment confirmed', 'payment received', 'money sent', 'transferred successfully',
    'payment to', 'paid to', 'pay to', 'transfer to', 'sent to',
    'debited from', 'credited to', 'sent from', 'received from',
    'pay again', 'share receipt', 'share', 'view details', 'split with friends',
    'done', 'check balance', 'repeat payment', 'send again',
    'upi transaction id', 'transaction id', 'google transaction id',
    'phonepe transaction id', 'paytm transaction id', 'utr', 'ref no',
    'reference id', 'rrn', 'order id', 'google pay', 'phonepe', 'paytm',
    'bhim', 'amazon pay', 'cred', 'banking name', 'from', 'to'
}


class ReceiptTextParser:
    """
    Heuristic rule-based extractor that parses raw OCR text lines from both:
    1. Mobile UPI payment confirmations (Google Pay, PhonePe, Paytm, etc.)
    2. Conventional itemized retail receipts and invoices.

    Strictly follows requirement:
    'Represent uncertain or missing values as unknown, not invented values.'
    """

    def __init__(self, raw_text: str):
        self.raw_text = raw_text or ""
        self.lines = [line.strip() for line in self.raw_text.splitlines() if line.strip()]

    def extract(self) -> dict:
        merchant_name, merchant_status = self._extract_merchant()
        date_str, date_status = self._extract_date()
        currency, currency_status = self._extract_currency()
        total_amount, total_status = self._extract_total()
        line_items, line_items_status = self._extract_line_items()

        from .category_suggester import suggest_category
        suggested_category = suggest_category(merchant_name, line_items, self.raw_text)

        return {
            "merchant_name": merchant_name,
            "date": date_str,
            "total_amount": total_amount,
            "currency": currency,
            "line_items": line_items,
            "suggested_category": suggested_category,
            "raw_text": self.raw_text,
            "field_status": {
                "merchant_name": merchant_status,
                "date": date_status,
                "total_amount": total_status,
                "currency": currency_status,
                "line_items": line_items_status,
                "suggested_category": "suggested" if suggested_category else "unknown"
            }
        }

    def _is_valid_merchant_candidate(self, cand: str) -> bool:
        if not cand:
            return False
        lower = cand.lower().strip()

        # Check against blacklist
        for token in NON_MERCHANT_TOKENS:
            if lower == token or lower.startswith(token + ' ') or lower.endswith(' ' + token):
                return False

        # Check if it contains a UPI ID
        if re.search(r'[\w\.\-]+@[\w\.\-]+', cand):
            return False

        # Check if it looks like a date or time
        if re.search(r'\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}', cand):
            return False
        if re.search(r'\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b', lower) and re.search(r'\d{2,4}', cand):
            return False
        if re.search(r'\b\d{1,2}:\d{2}\b', cand):
            return False

        # Check if it is a pure amount or number
        if re.search(r'^[₹Rs$€£]?\s*[\d,]+(?:\.\d+)?$', cand):
            return False

        # Must have at least 3 alphabetic characters
        if len(re.findall(r'[A-Za-z]', cand)) < 3:
            return False

        return True

    def _clean_merchant_name(self, name: str) -> str:
        cleaned = re.sub(r'[#*^~_=+;:<>{}]', '', name).strip()
        # Clean leading "To " if any
        cleaned = re.sub(r'^(?:to|paid to)\s*[:\-]?\s*', '', cleaned, flags=re.IGNORECASE).strip()
        return cleaned

    def _extract_merchant(self) -> tuple:
        """
        Extract merchant / payee name.
        Handles both UPI payments ('Paid to <Name>') and conventional receipts.
        Returns (name, 'detected') or (None, 'unknown').
        """
        # Step 1: Check for explicit UPI / Payment payee markers ("Paid to", "Payment to", "To")
        for idx, line in enumerate(self.lines):
            clean_l = line.strip()

            # Check for inline "Paid to <Merchant>"
            m = re.search(r'^(?:paid to|payment to|transfer to|sent to)\s*[:\-]?\s*(.+)$', clean_l, re.IGNORECASE)
            if m:
                cand = m.group(1).strip()
                if self._is_valid_merchant_candidate(cand):
                    return self._clean_merchant_name(cand), "detected"

            # Check for standalone "Paid to" followed by merchant on next line
            if re.match(r'^(?:paid to|payment to|transfer to|sent to)\s*[:\-]?$', clean_l, re.IGNORECASE):
                for next_idx in range(idx + 1, min(idx + 4, len(self.lines))):
                    cand = self.lines[next_idx].strip()
                    if self._is_valid_merchant_candidate(cand):
                        return self._clean_merchant_name(cand), "detected"

        # Step 2: Check for line preceding a UPI ID handle (e.g. Line above 'vestige...@okaxis')
        for idx, line in enumerate(self.lines):
            if re.search(r'[\w\.\-]+@[\w\.\-]+', line) and idx > 0:
                cand = self.lines[idx - 1].strip()
                if self._is_valid_merchant_candidate(cand):
                    return self._clean_merchant_name(cand), "detected"

        # Step 3: Conventional receipt: scan top 6 lines
        for line in self.lines[:6]:
            if self._is_valid_merchant_candidate(line):
                return self._clean_merchant_name(line), "detected"

        return None, "unknown"

    @staticmethod
    def _try_parse_date(text: str) -> str | None:
        """
        Parses and validates calendar date strings in formats:
        - DD-Mon-YY / DD-Mon-YYYY (e.g. 13-Oct-25, 13-Oct-2025, 14 Aug 2026)
        - Mon DD, YYYY / Mon DD, YY (e.g. Oct 13, 2025, Aug 14, 2026)
        - YYYY-MM-DD / YYYY/MM/DD (e.g. 2025-10-13, 2026/08/14)
        - DD-MM-YYYY / DD/MM/YYYY (e.g. 13-10-2025, 13/10/2025)
        - DD-MM-YY / DD/MM/YY (e.g. 13-10-25, 13/10/25)
        Normalizes consistently to 'YYYY-MM-DD'.
        Strictly rejects invalid calendar dates (e.g. 31-Feb, 29-Feb on non-leap years)
        and years outside the financial window 2000-2035.
        """
        if not text:
            return None

        # 1. Textual Month: DD-Mon-YY(YY) or DD Mon YY(YY)
        m = re.search(r'\b(0?[1-9]|[12]\d|3[01])\s*[-/. ]\s*([A-Za-z]{3,9})\s*[-/. ]\s*(\d{4}|\d{2})\b', text)
        if m:
            d_s, m_s, y_s = m.groups()
            m_lower = m_s.lower()
            if m_lower in MONTH_MAP:
                m_v = MONTH_MAP[m_lower]
                y_v = normalize_two_digit_year(int(y_s))
                d_v = int(d_s)
                try:
                    dt = date(y_v, m_v, d_v)
                    if 2000 <= dt.year <= 2035:
                        return dt.strftime('%Y-%m-%d')
                except ValueError:
                    pass

        # 2. Textual Month: Mon DD, YYYY or Mon DD, YY
        m = re.search(r'\b([A-Za-z]{3,9})\s+(0?[1-9]|[12]\d|3[01]),?\s*(\d{4}|\d{2})\b', text)
        if m:
            m_s, d_s, y_s = m.groups()
            m_lower = m_s.lower()
            if m_lower in MONTH_MAP:
                m_v = MONTH_MAP[m_lower]
                y_v = normalize_two_digit_year(int(y_s))
                d_v = int(d_s)
                try:
                    dt = date(y_v, m_v, d_v)
                    if 2000 <= dt.year <= 2035:
                        return dt.strftime('%Y-%m-%d')
                except ValueError:
                    pass

        # 3. YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
        m = re.search(r'\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b', text)
        if m:
            y_s, m_s, d_s = m.groups()
            try:
                dt = date(int(y_s), int(m_s), int(d_s))
                if 2000 <= dt.year <= 2035:
                    return dt.strftime('%Y-%m-%d')
            except ValueError:
                pass

        # 4. DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
        m = re.search(r'\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2})\b', text)
        if m:
            d_s, m_s, y_s = m.groups()
            try:
                dt = date(int(y_s), int(m_s), int(d_s))
                if 2000 <= dt.year <= 2035:
                    return dt.strftime('%Y-%m-%d')
            except ValueError:
                pass

        # 5. DD-MM-YY or DD/MM/YY or DD.MM.YY (2-digit year)
        m = re.search(r'\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](\d{2})\b', text)
        if m:
            d_s, m_s, y_s = m.groups()
            try:
                y_v = normalize_two_digit_year(int(y_s))
                dt = date(y_v, int(m_s), int(d_s))
                if 2000 <= dt.year <= 2035:
                    return dt.strftime('%Y-%m-%d')
            except ValueError:
                pass

        return None

    def _extract_date(self) -> tuple:
        """
        Search for date pattern across lines.
        Prioritizes lines with explicit date labels (e.g. 'Dated: 13-Oct-25', 'Date: 2026-10-12').
        Returns ('YYYY-MM-DD', 'detected') or (None, 'unknown').
        """
        # Pass 1: Lines containing explicit date labels
        for line in self.lines:
            for label_pat in DATE_LABEL_PATTERNS:
                m = label_pat.search(line)
                if m:
                    cand = m.group(1).strip()
                    parsed = self._try_parse_date(cand)
                    if parsed:
                        return parsed, "detected"
                    parsed = self._try_parse_date(line)
                    if parsed:
                        return parsed, "detected"

        # Pass 2: Any line in receipt containing a valid calendar date
        for line in self.lines:
            parsed = self._try_parse_date(line)
            if parsed:
                return parsed, "detected"

        return None, "unknown"

    def _extract_currency(self) -> tuple:
        """
        Detect currency symbols or codes. Default to INR if not specified.
        Returns (currency_code, 'detected'|'default').
        """
        for line in self.lines:
            for pattern, code in CURRENCY_PATTERNS:
                if pattern.search(line):
                    return code, "detected"

        # Default fallback without inventing fake symbol
        return "INR", "default"

    def _is_non_amount_line(self, lower: str) -> bool:
        """Helper to ignore lines that are transaction IDs, phone numbers, dates, times, etc."""
        skip_words = [
            'transaction id', 'utr', 'ref no', 'reference id', 'order id',
            'phone', 'mobile', 'account', 'a/c', 'date:', 'time:'
        ]
        if any(w in lower for w in skip_words):
            return True
        # If line contains time (e.g. 11:19 PM) and month name, it's a date/time line
        if re.search(r'\b\d{1,2}:\d{2}\s*(?:am|pm)?\b', lower) and re.search(r'\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b', lower):
            return True
        return False

    def _extract_total(self) -> tuple:
        """
        Locate total amount using keyword associations, prominent currency prefixes,
        comma-formatted values, or standalone decimals.
        Returns ('0.00', 'detected') or (None, 'unknown').
        Strictly never fabricates 0.00 when amount is missing.
        """
        # Pass 1: Look for explicit TOTAL keywords (conventional receipts)
        for keyword in TOTAL_KEYWORDS:
            for idx, line in enumerate(self.lines):
                lower = line.lower()
                if keyword in lower:
                    if keyword == 'total' and 'sub' in lower:
                        continue

                    # Search on same line: handles ₹3,450, 3,450.00, 420.00, etc.
                    amts = re.findall(
                        r'(?:₹|Rs\.?|INR|\$|€|£)?\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\b',
                        line
                    )
                    if amts:
                        for raw in reversed(amts):
                            clean_amt = raw.replace(',', '')
                            try:
                                dec = Decimal(clean_amt)
                                if dec > 0:
                                    return f"{dec:.2f}", "detected"
                            except InvalidOperation:
                                pass

                    # Check next line if same line has keyword but no amount
                    if idx + 1 < len(self.lines):
                        next_line = self.lines[idx + 1]
                        next_amts = re.findall(
                            r'(?:₹|Rs\.?|INR|\$|€|£)?\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\b',
                            next_line
                        )
                        if next_amts:
                            for raw in reversed(next_amts):
                                clean_amt = raw.replace(',', '')
                                try:
                                    dec = Decimal(clean_amt)
                                    if dec > 0:
                                        return f"{dec:.2f}", "detected"
                                except InvalidOperation:
                                    pass

        # Pass 2: Look for prominent currency-symbol prefixed amounts e.g. ₹3,450, ₹ 3,450.00, Rs. 500
        for line in self.lines:
            lower = line.lower()
            if self._is_non_amount_line(lower):
                continue
            m = re.search(
                r'(?:₹|Rs\.?|INR|\$|€|£)\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\b',
                line,
                re.IGNORECASE
            )
            if m:
                clean_amt = m.group(1).replace(',', '')
                try:
                    dec = Decimal(clean_amt)
                    if dec > 0:
                        return f"{dec:.2f}", "detected"
                except InvalidOperation:
                    pass

        # Pass 3: Look for standalone comma-formatted amounts e.g. 3,450 or 3,450.00
        for line in self.lines:
            lower = line.lower()
            if self._is_non_amount_line(lower):
                continue
            m = re.match(
                r'^\s*[₹RsINR$€£]?\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?)\s*(?:INR|USD|EUR|GBP)?\s*$',
                line.strip(),
                re.IGNORECASE
            )
            if m:
                clean_amt = m.group(1).replace(',', '')
                try:
                    dec = Decimal(clean_amt)
                    if dec > 0:
                        return f"{dec:.2f}", "detected"
                except InvalidOperation:
                    pass

        # Pass 4: Standalone decimal amounts near the bottom (conventional receipts)
        for line in reversed(self.lines[-6:]):
            lower = line.lower()
            if self._is_non_amount_line(lower):
                continue
            amts = re.findall(r'\b\d+\.\d{2}\b', line)
            if amts:
                try:
                    dec = Decimal(amts[-1])
                    if dec > 0:
                        return f"{dec:.2f}", "detected"
                except InvalidOperation:
                    pass

        return None, "unknown"

    def _extract_line_items(self) -> tuple:
        """
        Extract line item candidates matching description and amount.
        Handles both itemized receipts (e.g. "Cold Brew 1 240.00", "EXAM FEE 2,625.00")
        and multi-line particulars tables ("EXAM FEE" followed by "2,625.00").
        Returns (list_of_items, 'detected'|'unknown').
        """
        items = []
        skip_words = {
            'total', 'subtotal', 'tax', 'gst', 'vat', 'cgst', 'sgst', 'date', 'dated',
            'cash', 'card', 'change', 'balance', 'discount', 'bill', 'round off',
            'paid to', 'payment', 'transaction', 'debited', 'credited', 'google',
            'phonepe', 'paytm', 'bhim', 'upi', 'receipt no', 'invoice no', 'particulars',
            'description', 'amount', 'sl no', 's.no', 'from', 'to'
        }

        used_line_indices = set()
        for idx, line in enumerate(self.lines):
            if idx in used_line_indices:
                continue
            lower = line.lower().strip()
            if any(sw in lower for sw in skip_words):
                continue
            if re.search(r'[\w\.\-]+@[\w\.\-]+', line):
                continue
            if re.search(r'\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b', lower) and re.search(r'\d{2,4}', line):
                continue

            # Strategy 1: Description and amount on the same line
            amount_match = re.search(
                r'(?:\s+|[₹Rs$€£]\s*)([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)$',
                line.strip()
            )
            if amount_match:
                amt_str = amount_match.group(1).strip()
                prefix = line.strip()[:amount_match.start()].strip()
                prefix = re.sub(r'[\s:₹Rs$€£\-]+$', '', prefix).strip()

                qty = 1
                qty_match = re.search(r'^(.*?)(?:\s+x?(\d+)|\s+(\d+)x)$', prefix, re.IGNORECASE)
                if qty_match:
                    desc = qty_match.group(1).strip()
                    qty_raw = qty_match.group(2) or qty_match.group(3)
                    if qty_raw and qty_raw.isdigit():
                        qty = int(qty_raw)
                else:
                    desc = prefix

                desc = re.sub(r'^[0-9]+[.)]\s*', '', desc).strip()
                if len(re.findall(r'[A-Za-z]', desc)) >= 2 and not any(sw in desc.lower() for sw in skip_words):
                    try:
                        amt_dec = Decimal(amt_str.replace(',', ''))
                        if amt_dec > 0:
                            items.append({
                                "description": desc,
                                "quantity": qty,
                                "amount": f"{amt_dec:.2f}"
                            })
                            used_line_indices.add(idx)
                            continue
                    except InvalidOperation:
                        pass

            # Strategy 2: Description on line idx, pure amount on line idx+1
            if len(re.findall(r'[A-Za-z]', line)) >= 2 and idx + 1 < len(self.lines):
                next_line = self.lines[idx + 1].strip()
                next_lower = next_line.lower()
                if not any(sw in next_lower for sw in skip_words):
                    next_amt_match = re.match(
                        r'^[₹Rs$€£]?\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)$',
                        next_line
                    )
                    if next_amt_match:
                        desc = re.sub(r'^[0-9]+[.)]\s*', '', line.strip()).strip()
                        desc = re.sub(r'[\s:₹Rs$€£\-]+$', '', desc).strip()
                        if len(re.findall(r'[A-Za-z]', desc)) >= 2 and not any(sw in desc.lower() for sw in skip_words):
                            try:
                                amt_dec = Decimal(next_amt_match.group(1).replace(',', ''))
                                if amt_dec > 0:
                                    items.append({
                                        "description": desc,
                                        "quantity": 1,
                                        "amount": f"{amt_dec:.2f}"
                                    })
                                    used_line_indices.add(idx)
                                    used_line_indices.add(idx + 1)
                            except InvalidOperation:
                                pass

        if items:
            return items, "detected"
        return [], "unknown"

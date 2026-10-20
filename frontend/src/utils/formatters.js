export const formatINR = (amount) => {
  const numericAmount = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(numericAmount);
};

export const formatCurrency = (amount, currency = 'INR') => {
  const numericAmount = Number(amount) || 0;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 2,
    }).format(numericAmount);
  } catch (e) {
    return `${currency} ${numericAmount.toFixed(2)}`;
  }
};

export const getInitials = (firstName = '', lastName = '') => {
  const first = firstName ? firstName.charAt(0).toUpperCase() : '';
  const last = lastName ? lastName.charAt(0).toUpperCase() : '';
  return `${first}${last}` || 'U';
};

export const formatDate = (dateString) => {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (e) {
    return dateString;
  }
};

/**
 * Returns consistent Tailwind CSS color classes for transaction amounts based on
 * the actual transaction type, category, and direction.
 *
 * - EXPENSE: red (text-red-600 dark:text-red-400 / #DC2626)
 * - DEPOSIT / positive incoming: green (text-emerald-600 dark:text-emerald-400)
 * - Other types (refunds, transfers, settlements): default neutral styling
 * - Voided: strike-through muted
 *
 * @param {Object|string} tx - The transaction object or transaction type string
 * @param {string} [defaultColor='text-slate-900 dark:text-white'] - Fallback color class
 * @returns {string} Tailwind CSS class string
 */
export const getTransactionAmountColor = (tx, defaultColor = 'text-slate-900 dark:text-white') => {
  if (!tx) return defaultColor;

  if (typeof tx === 'object') {
    if (tx.is_voided || tx.status === 'VOIDED') {
      return 'line-through text-slate-400 dark:text-slate-500';
    }

    const type = (tx.transaction_type || '').toUpperCase();
    const typeLabel = (tx.type_label || '').toLowerCase();
    const desc = (tx.description || '').toLowerCase();
    const amountNum = Number(tx.amount);

    // EXPENSE (Group Expense, Friend Ledger Expense, or negative adjustment)
    if (
      type === 'EXPENSE' ||
      typeLabel.includes('expense') ||
      (type === 'FRIEND_LEDGER' && (typeLabel.includes('expense') || desc.includes('expense'))) ||
      (type === 'ADJUSTMENT' && amountNum < 0)
    ) {
      return 'text-red-600 dark:text-red-400';
    }

    // DEPOSIT & positive incoming transfers/credits
    if (
      type === 'DEPOSIT' ||
      typeLabel.includes('deposit') ||
      (type === 'FRIEND_LEDGER' && (typeLabel.includes('deposit') || desc.includes('deposit'))) ||
      (type === 'ADJUSTMENT' && amountNum > 0) ||
      tx.user_role === 'RECEIVER'
    ) {
      return 'text-emerald-600 dark:text-emerald-400';
    }

    return defaultColor;
  }

  const typeStr = String(tx).toUpperCase();
  if (typeStr === 'EXPENSE') return 'text-red-600 dark:text-red-400';
  if (typeStr === 'DEPOSIT') return 'text-emerald-600 dark:text-emerald-400';
  return defaultColor;
};

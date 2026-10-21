import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import Button from '../../components/ui/Button';
import personalExpenseService from '../../services/personalExpense.service';
import { getCategoryIcon, PAYMENT_METHODS } from './categoryIcons';
import { modalBackdropVariants, modalDialogVariants } from '../../utils/animations';

export const EditPersonalTransactionModal = ({
  isOpen,
  onClose,
  transaction,
  categories = [],
  onTransactionUpdated
}) => {
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Manage body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (transaction) {
      setAmount(String(transaction.amount || ''));
      setTitle(transaction.title || '');
      setCategoryId(transaction.category ? String(transaction.category) : '');
      setPaymentMethod(transaction.payment_method || 'UPI');
      setDate(transaction.date || '');
      setTime(transaction.time ? transaction.time.slice(0, 5) : '');
      setNotes(transaction.notes || '');
      setError('');
    }
  }, [transaction]);

  const handleAmountChange = (e) => {
    let val = e.target.value;
    val = val.replace(/,/g, '.');
    val = val.replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    if (parts.length > 2) {
      val = parts[0] + '.' + parts.slice(1).join('');
    }
    if (parts.length === 2 && parts[1].length > 2) {
      val = parts[0] + '.' + parts[1].slice(0, 2);
    }
    if (val.length > 1 && val.startsWith('0') && val[1] !== '.') {
      val = val.replace(/^0+/, '') || '0';
    }
    setAmount(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!transaction) return;
    setError('');

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        amount: numAmount.toFixed(2),
        title: title.trim(),
        category: categoryId ? parseInt(categoryId, 10) : null,
        payment_method: paymentMethod,
        date: date || undefined,
        time: time || undefined,
        notes: notes.trim(),
      };

      const updated = await personalExpenseService.updateTransaction(transaction.id, payload);
      if (onTransactionUpdated) {
        onTransactionUpdated(updated);
      }
      onClose();
    } catch (err) {
      const data = err.response?.data;
      let msg = 'Failed to update transaction.';
      if (typeof data === 'object' && data !== null) {
        msg = data.detail || data.amount?.[0] || data.title?.[0] || JSON.stringify(data);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const currentCategories = transaction
    ? categories.filter((c) => c.category_type === transaction.transaction_type)
    : [];

  return (
    <AnimatePresence>
      {isOpen && transaction && (
        <motion.div
          key="edit-personal-modal-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 overflow-y-auto"
        >
          <motion.div
            variants={modalBackdropVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={loading ? undefined : onClose}
            aria-hidden="true"
          />

          <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center pointer-events-none">
            <motion.div
              variants={modalDialogVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              role="dialog"
              aria-modal="true"
              className="pointer-events-auto w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-6 text-left align-middle shadow-2xl border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 relative"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Edit {transaction.transaction_type === 'EXPENSE' ? 'Expense' : 'Income'}
              </h3>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mt-3 p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="edit-personal-amount-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 cursor-pointer">
                  Amount (₹)
                </label>
                <input
                  id="edit-personal-amount-input"
                  name="amount"
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.]?[0-9]*"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  value={amount}
                  onChange={handleAmountChange}
                  className="w-full px-3 py-2 text-base font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="edit-personal-title-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 cursor-pointer">
                  Title / Description
                </label>
                <input
                  id="edit-personal-title-input"
                  name="title"
                  type="text"
                  inputMode="text"
                  autoCapitalize="sentences"
                  autoCorrect="on"
                  spellCheck="true"
                  autoComplete="off"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Uncategorized</option>
                  {currentCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm.value} value={pm.value}>
                        {pm.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="edit-personal-notes-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 cursor-pointer">
                  Notes
                </label>
                <input
                  id="edit-personal-notes-input"
                  name="notes"
                  type="text"
                  inputMode="text"
                  autoCapitalize="sentences"
                  autoCorrect="on"
                  spellCheck="true"
                  autoComplete="off"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={loading} disabled={loading}>
                  Update
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
  );
};

export default EditPersonalTransactionModal;


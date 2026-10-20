import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Check, ArrowDownLeft, ArrowUpRight, Clock, Calendar, Sparkles } from 'lucide-react';
import Button from '../../components/ui/Button';
import personalExpenseService from '../../services/personalExpense.service';
import { getCategoryIcon, PAYMENT_METHODS } from './categoryIcons';
import { modalBackdropVariants, modalDialogVariants } from '../../utils/animations';

export const AddPersonalTransactionModal = ({
  isOpen,
  onClose,
  initialType = 'EXPENSE',
  categories = [],
  onTransactionSaved
}) => {
  const [transactionType, setTransactionType] = useState(initialType);
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  const amountInputRef = useRef(null);

  // Sync initial type when opened
  useEffect(() => {
    if (isOpen) {
      setTransactionType(initialType);
      setError('');
      setSuccessToast('');
      // Autofocus amount after modal transition
      const timer = setTimeout(() => {
        amountInputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialType]);

  // Set default category when type or categories change
  useEffect(() => {
    const available = categories.filter((c) => c.category_type === transactionType);
    if (available.length > 0 && !available.some((c) => String(c.id) === String(categoryId))) {
      setCategoryId(String(available[0].id));
    }
  }, [transactionType, categories]);

  const handleQuickAddAmount = (addVal) => {
    const current = parseFloat(amount) || 0;
    const next = current + addVal;
    setAmount(next.toFixed(next % 1 === 0 ? 0 : 2));
  };

  const resetForm = () => {
    setAmount('');
    setTitle('');
    setNotes('');
    setDate(new Date().toISOString().split('T')[0]);
    const now = new Date();
    setTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    amountInputRef.current?.focus();
  };

  const handleSubmit = async (e, keepOpen = false) => {
    if (e) e.preventDefault();
    setError('');

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount greater than zero.');
      amountInputRef.current?.focus();
      return;
    }

    if (!title.trim()) {
      setError('Please enter a description (e.g. Chai, Groceries, Metro).');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        transaction_type: transactionType,
        amount: numAmount.toFixed(2),
        title: title.trim(),
        category: categoryId ? parseInt(categoryId, 10) : null,
        payment_method: paymentMethod,
        date,
        time: time || undefined,
        notes: notes.trim(),
      };

      const newTx = await personalExpenseService.createTransaction(payload);

      if (onTransactionSaved) {
        onTransactionSaved(newTx);
      }

      if (keepOpen) {
        setSuccessToast(`Saved ₹${numAmount.toFixed(0)}! Add another below.`);
        resetForm();
        setTimeout(() => setSuccessToast(''), 2500);
      } else {
        resetForm();
        onClose();
      }
    } catch (err) {
      const data = err.response?.data;
      let msg = 'Failed to save transaction. Please check your inputs.';
      if (typeof data === 'object' && data !== null) {
        msg = data.detail || data.amount?.[0] || data.title?.[0] || JSON.stringify(data);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentCategories = categories.filter((c) => c.category_type === transactionType);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        {/* Semi-transparent Backdrop Overlay */}
        <motion.div
          variants={modalBackdropVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
          onClick={loading ? undefined : onClose}
          aria-hidden="true"
        />

        {/* Centering Dialog Container */}
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
            {/* Header: Segmented Type Selector & Close Button */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTransactionType('EXPENSE')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    transactionType === 'EXPENSE'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => setTransactionType('INCOME')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    transactionType === 'INCOME'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Income
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success Micro-toast */}
            {successToast && (
              <div className="mt-3 p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-150">
                <span>{successToast}</span>
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mt-3 p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium">
                {error}
              </div>
            )}

            <form onSubmit={(e) => handleSubmit(e, false)} className="mt-4 space-y-4">
              {/* Prominent Amount Input with Quick Increments */}
              <div
                className={`p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border transition-all duration-150 ${
                  transactionType === 'EXPENSE'
                    ? 'border-slate-200/80 dark:border-slate-800 focus-within:border-rose-500/60 dark:focus-within:border-rose-500/60 focus-within:ring-2 focus-within:ring-rose-500/20'
                    : 'border-slate-200/80 dark:border-slate-800 focus-within:border-emerald-500/60 dark:focus-within:border-emerald-500/60 focus-within:ring-2 focus-within:ring-emerald-500/20'
                }`}
              >
                <label
                  htmlFor="personal-tx-amount-input"
                  className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 cursor-pointer"
                >
                  Amount (₹)
                </label>
                <div
                  className="relative flex items-center cursor-text"
                  onClick={() => amountInputRef.current?.focus()}
                >
                  <span
                    className={`text-2xl sm:text-3xl font-extrabold mr-1 select-none ${
                      transactionType === 'EXPENSE'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    ₹
                  </span>
                  <input
                    id="personal-tx-amount-input"
                    ref={amountInputRef}
                    type="number"
                    step="any"
                    min="0.01"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-transparent text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700 border-none outline-none focus:outline-none focus:ring-0 p-0"
                    required
                  />
                </div>

                {/* Quick Add Amount Buttons */}
                <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold self-center mr-1 select-none">Quick Add:</span>
                  {[20, 50, 100, 200, 500, 1000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleQuickAddAmount(val)}
                      className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:text-emerald-600 transition-colors focus:outline-none"
                    >
                      +{val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title / Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder={transactionType === 'EXPENSE' ? 'e.g., Morning Coffee, Grocery Run, Cab ride' : 'e.g., Monthly Salary, Freelance project'}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Category Selection Grid */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Category
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-36 overflow-y-auto pr-1">
                  {currentCategories.map((cat) => {
                    const isSelected = String(cat.id) === String(categoryId);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategoryId(String(cat.id))}
                        className={`flex items-center gap-1.5 p-2 rounded-xl text-xs font-semibold transition-all border text-left truncate ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500/30'
                            : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span style={{ color: cat.color }} className="shrink-0">
                          {getCategoryIcon(cat.icon, 'w-4 h-4')}
                        </span>
                        <span className="truncate">{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date, Time & Payment Method Row */}
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
                    Payment
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

              {/* Optional Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Additional context or merchant details..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, true)}
                  disabled={loading}
                  className="w-full sm:w-auto text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 px-3 py-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                >
                  Save & Add Another
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={onClose}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={loading}
                    disabled={loading}
                    className="shadow-sm"
                  >
                    Save {transactionType === 'EXPENSE' ? 'Expense' : 'Income'}
                  </Button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};

export default AddPersonalTransactionModal;


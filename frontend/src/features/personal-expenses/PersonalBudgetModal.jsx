import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Target, Plus, Trash2, Check, AlertCircle } from 'lucide-react';
import Button from '../../components/ui/Button';
import personalExpenseService from '../../services/personalExpense.service';
import { formatCurrency } from '../../utils/formatters';
import { getCategoryIcon } from './categoryIcons';
import { modalBackdropVariants, modalDialogVariants } from '../../utils/animations';

export const PersonalBudgetModal = ({
  isOpen,
  onClose,
  categories = [],
  onBudgetsUpdated
}) => {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [overallBudgetAmount, setOverallBudgetAmount] = useState('');
  const [budgetsData, setBudgetsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add category budget inline
  const [addCatId, setAddCatId] = useState('');
  const [addCatAmount, setAddCatAmount] = useState('');

  const fetchBudgets = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await personalExpenseService.getBudgets({
        year: selectedYear,
        month: selectedMonth
      });
      setBudgetsData(data);
      if (data.overall_budget) {
        setOverallBudgetAmount(data.overall_budget.budget_amount);
      } else {
        setOverallBudgetAmount('');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load budgets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBudgets();
    }
  }, [isOpen, selectedMonth, selectedYear]);

  const handleSaveOverallBudget = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const num = parseFloat(overallBudgetAmount);
    if (isNaN(num) || num <= 0) {
      setError('Please enter a valid monthly budget greater than zero.');
      return;
    }

    setSaving(true);
    try {
      await personalExpenseService.saveBudget({
        year: selectedYear,
        month: selectedMonth,
        amount: num.toFixed(2),
        category: null,
      });
      setSuccess('Monthly budget saved successfully!');
      fetchBudgets();
      if (onBudgetsUpdated) onBudgetsUpdated();
      setTimeout(() => setSuccess(''), 2500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save budget.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategoryBudget = async (e) => {
    e.preventDefault();
    if (!addCatId || !addCatAmount) return;
    const num = parseFloat(addCatAmount);
    if (isNaN(num) || num <= 0) {
      setError('Please enter a valid category budget amount.');
      return;
    }

    setSaving(true);
    try {
      await personalExpenseService.saveBudget({
        year: selectedYear,
        month: selectedMonth,
        amount: num.toFixed(2),
        category: parseInt(addCatId, 10),
      });
      setAddCatId('');
      setAddCatAmount('');
      fetchBudgets();
      if (onBudgetsUpdated) onBudgetsUpdated();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add category budget.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBudget = async (budgetId) => {
    try {
      await personalExpenseService.deleteBudget(budgetId);
      fetchBudgets();
      if (onBudgetsUpdated) onBudgetsUpdated();
    } catch (err) {
      alert('Failed to delete budget.');
    }
  };

  if (!isOpen) return null;

  const expenseCategories = categories.filter((c) => c.category_type === 'EXPENSE');
  const existingCategoryIds = new Set(
    (budgetsData?.category_budgets || []).map((b) => b.category_id)
  );
  const availableCategoriesForBudget = expenseCategories.filter(
    (c) => !existingCategoryIds.has(c.id)
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <motion.div
          variants={modalBackdropVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
          onClick={saving ? undefined : onClose}
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
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Monthly Budgets</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Set spending limits to stay on track</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mt-3 p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium">
                {error}
              </div>
            )}
            {success && (
              <div className="mt-3 p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between">
                <span>{success}</span>
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            )}

            <div className="mt-4 space-y-5">
              {/* Overall Monthly Budget Form */}
              <form onSubmit={handleSaveOverallBudget} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 dark:text-white">
                    Overall Monthly Budget
                  </label>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </span>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      placeholder="e.g. 25000"
                      value={overallBudgetAmount}
                      onChange={(e) => setOverallBudgetAmount(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 text-sm font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500"
                      required
                    />
                  </div>
                  <Button type="submit" variant="primary" size="sm" isLoading={saving} disabled={saving}>
                    Set Budget
                  </Button>
                </div>

                {budgetsData?.overall_budget && (
                  <div className="pt-2 text-xs space-y-1.5">
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-500 dark:text-slate-400">Spent: {formatCurrency(budgetsData.overall_budget.spent_amount)}</span>
                      <span className={budgetsData.overall_budget.status === 'EXCEEDED' ? 'text-rose-600 font-bold' : 'text-emerald-600 dark:text-emerald-400 font-bold'}>
                        Remaining: {formatCurrency(budgetsData.overall_budget.remaining_amount)}
                      </span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          budgetsData.overall_budget.status === 'EXCEEDED'
                            ? 'bg-rose-500'
                            : budgetsData.overall_budget.status === 'WARNING'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, budgetsData.overall_budget.percent_spent)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 text-right">
                      {budgetsData.overall_budget.percent_spent}% spent
                    </p>
                  </div>
                )}
              </form>

              {/* Category-Specific Budgets Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Category Budgets (Optional)
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    {budgetsData?.category_budgets?.length || 0} configured
                  </span>
                </div>

                {/* Add Category Budget Inline */}
                {availableCategoriesForBudget.length > 0 && (
                  <form onSubmit={handleAddCategoryBudget} className="flex gap-2 text-xs">
                    <select
                      value={addCatId}
                      onChange={(e) => setAddCatId(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-hidden"
                    >
                      <option value="">Select Category...</option>
                      {availableCategoriesForBudget.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="₹ Limit"
                      value={addCatAmount}
                      onChange={(e) => setAddCatAmount(e.target.value)}
                      className="w-24 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-hidden"
                    />
                    <Button type="submit" variant="secondary" size="sm" disabled={saving || !addCatId || !addCatAmount}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add
                    </Button>
                  </form>
                )}

                {/* Configured Category Budgets List */}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {budgetsData?.category_budgets?.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-3">
                      No category limits set yet. Add limits above to track specific buckets.
                    </p>
                  )}

                  {budgetsData?.category_budgets?.map((b) => (
                    <div
                      key={b.id}
                      className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <div className="flex items-center gap-1.5">
                          <span style={{ color: b.category_color }}>
                            {getCategoryIcon(b.category_icon, 'w-3.5 h-3.5')}
                          </span>
                          <span className="text-slate-900 dark:text-white">{b.category_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-600 dark:text-slate-300">
                            {formatCurrency(b.spent_amount)} / {formatCurrency(b.budget_amount)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteBudget(b.id)}
                            className="text-slate-400 hover:text-rose-500 p-1"
                            title="Remove budget"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            b.status === 'EXCEEDED'
                              ? 'bg-rose-500'
                              : b.status === 'WARNING'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, b.percent_spent)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-5 flex justify-end">
              <Button variant="secondary" size="sm" onClick={onClose}>
                Done
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};

export default PersonalBudgetModal;


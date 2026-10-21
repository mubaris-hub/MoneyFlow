import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, X } from 'lucide-react';
import Button from '../../components/ui/Button';
import personalExpenseService from '../../services/personalExpense.service';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { modalBackdropVariants, modalDialogVariants } from '../../utils/animations';

export const DeletePersonalTransactionModal = ({
  isOpen,
  onClose,
  transaction,
  onTransactionDeleted
}) => {
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

  const handleDelete = async () => {
    if (!transaction) return;
    setLoading(true);
    setError('');

    try {
      await personalExpenseService.deleteTransaction(transaction.id);
      if (onTransactionDeleted) {
        onTransactionDeleted(transaction.id);
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete transaction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && transaction && (
        <motion.div
          key="delete-personal-modal-root"
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
              className="pointer-events-auto w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-6 text-left align-middle shadow-2xl border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 relative"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Delete Personal {transaction.transaction_type === 'EXPENSE' ? 'Expense' : 'Income'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    This action will permanently remove this record
                  </p>
                </div>
              </div>

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

            <div className="py-4 space-y-2">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">{transaction.title}</p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    {formatDate(transaction.date)} • {transaction.category_name || 'Uncategorized'}
                  </p>
                </div>
                <span className={`text-base font-extrabold ${
                  transaction.transaction_type === 'EXPENSE' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {transaction.transaction_type === 'EXPENSE' ? '-' : '+'}{formatCurrency(transaction.amount)}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Are you sure you want to delete this transaction? It will be permanently removed from your personal spending history.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDelete}
                isLoading={loading}
                disabled={loading}
              >
                Yes, Delete
              </Button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
  );
};

export default DeletePersonalTransactionModal;


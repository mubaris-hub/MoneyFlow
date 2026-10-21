import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import settlementService from '../../services/settlement.service';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import { Wallet, X, AlertCircle, ArrowRight } from 'lucide-react';
import { formatINR } from '../../utils/formatters';
import { modalBackdropVariants, modalDialogVariants } from '../../utils/animations';

export const SettleUpModal = ({
  isOpen,
  onClose,
  groupId,
  members = [],
  prefill = null, // { senderId, receiverId, amount }
  onSettlementCreated
}) => {
  const [senderId, setSenderId] = useState('');
  const [receiverId, setReceiverId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('COMPLETED');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (prefill) {
        setSenderId(prefill.senderId || '');
        setReceiverId(prefill.receiverId || '');
        setAmount(prefill.amount ? String(prefill.amount) : '');
      } else {
        if (members.length >= 2) {
          setSenderId(members[0]?.user?.id || '');
          setReceiverId(members[1]?.user?.id || '');
        }
        setAmount('');
      }
      setNotes('');
      setStatus('COMPLETED');
      setError('');
    }
  }, [isOpen, prefill, members]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!senderId || !receiverId) {
      setError('Please select both a sender and a receiver.');
      return;
    }

    if (String(senderId) === String(receiverId)) {
      setError('Sender and receiver cannot be the same person.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Settlement amount must be greater than zero.');
      return;
    }

    setLoading(true);
    try {
      await settlementService.createSettlement(groupId, {
        sender_id: senderId,
        receiver_id: receiverId,
        amount: numAmount.toFixed(2),
        status,
        notes: notes.trim(),
      });

      if (onSettlementCreated) {
        onSettlementCreated();
      }
      onClose();
    } catch (err) {
      const errData = err.response?.data;
      const msg = errData?.detail || errData?.receiver_id?.[0] || errData?.sender_id?.[0] || errData?.amount?.[0] || 'Failed to record settlement.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="settle-up-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 overflow-y-auto"
        >
          {/* Backdrop */}
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
              className="pointer-events-auto w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 text-left align-middle shadow-2xl border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Record Settlement</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Log a payment or debt settlement between members</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {error && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl flex items-start space-x-2 text-rose-700 dark:text-rose-300 text-xs font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Paid By (Sender)</label>
                    <select
                      value={senderId}
                      onChange={(e) => setSenderId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-medium"
                    >
                      {members.map((m) => (
                        <option key={m.user.id} value={m.user.id}>
                          {m.user.name || m.user.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Received By (Receiver)</label>
                    <select
                      value={receiverId}
                      onChange={(e) => setReceiverId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-medium"
                    >
                      {members.map((m) => (
                        <option key={m.user.id} value={m.user.id}>
                          {m.user.name || m.user.email}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <Input
                  label="Notes (Optional)"
                  type="text"
                  placeholder="e.g. UPI Transfer, GPay, Cash"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />

                <div className="pt-2 flex items-center justify-end space-x-3">
                  <Button type="button" variant="outline" size="md" onClick={onClose} disabled={loading}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="md" isLoading={loading}>
                    Save Settlement
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

export default SettleUpModal;

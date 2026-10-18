import React, { useState, useEffect } from 'react';
import settlementService from '../../services/settlement.service';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import { Wallet, X, AlertCircle, ArrowRight } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

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

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
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
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
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
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-700 focus:border-emerald-600 focus:outline-none"
              >
                {members.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.first_name} {m.user.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Paid To (Receiver)</label>
              <select
                value={receiverId}
                onChange={(e) => setReceiverId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-700 focus:border-emerald-600 focus:outline-none"
              >
                {members.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.first_name} {m.user.last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Input
            label="Amount (₹)"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-700 focus:border-emerald-600 focus:outline-none"
            >
              <option value="COMPLETED">Completed (Immediate settlement)</option>
              <option value="PENDING">Pending Confirmation (Requires receiver approval)</option>
            </select>
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
      </div>
    </div>
  );
};

export default SettleUpModal;

import React, { useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import moneyAccountService from '../../services/moneyAccount.service';
import { formatCurrency } from '../../utils/formatters';

export const VoidTransactionModal = ({ isOpen, onClose, accountId, transaction, onTransactionVoided }) => {
  const [voidReason, setVoidReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!transaction) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!voidReason.trim()) {
      setError('A valid void reason is required.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const voidedTx = await moneyAccountService.voidTransaction(accountId, transaction.id, {
        void_reason: voidReason.trim(),
      });
      setVoidReason('');
      onTransactionVoided(voidedTx);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.void_reason?.[0] || err.message || 'Failed to void transaction.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Void Transaction">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
            {error}
          </div>
        )}

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
          <p className="font-bold">Target Transaction:</p>
          <p><span className="font-semibold">Type:</span> {transaction.transaction_type}</p>
          <p><span className="font-semibold">Description:</span> {transaction.description}</p>
          <p><span className="font-semibold">Amount:</span> {formatCurrency(transaction.amount)}</p>
          <p className="text-[11px] text-amber-700 pt-1">
            Note: Voiding will strike out this transaction and adjust the account balance. It will NOT be deleted from the audit history.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Voiding *</label>
          <textarea
            rows="2"
            placeholder="Explain why this transaction is being voided..."
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
            required
          />
        </div>

        <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={loading}>
            Confirm Void
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default VoidTransactionModal;

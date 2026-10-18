import React, { useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import moneyAccountService from '../../services/moneyAccount.service';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { FileText, Upload, Trash2, X, Download } from 'lucide-react';

export const ReceiptModal = ({ isOpen, onClose, accountId, transaction, isManager, onReceiptUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!transaction) return null;

  const receiptUrl = transaction.receipt_image_url || transaction.receipt_url;

  const handleFileReplace = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('File size exceeds maximum allowed limit of 5 MB.');
      return;
    }

    const validExts = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validExts.includes(file.type.toLowerCase())) {
      setError('Unsupported file type. Please upload JPG, PNG, or WEBP images.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const updatedTx = await moneyAccountService.replaceReceipt(accountId, transaction.id, file);
      onReceiptUpdated(updatedTx);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to replace receipt.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveReceipt = async () => {
    if (!window.confirm('Are you sure you want to remove this receipt? The transaction amount will remain unchanged.')) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const updatedTx = await moneyAccountService.removeReceipt(accountId, transaction.id);
      onReceiptUpdated(updatedTx);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to remove receipt.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Receipt / Proof Document" maxWidth="max-w-xl">
      <div className="space-y-4">
        {error && (
          <div className="p-3 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
            {error}
          </div>
        )}

        {/* Transaction Header Summary */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs space-y-1">
          <div className="flex justify-between items-center">
            <span className="font-bold text-slate-800 dark:text-slate-200">{transaction.description}</span>
            <span className="font-extrabold text-slate-900 dark:text-white text-sm">{formatCurrency(transaction.amount)}</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            Date: {formatDate(transaction.date)} | Type: {transaction.transaction_type}
          </p>
        </div>

        {/* Receipt Image Display */}
        <div className="relative border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center min-h-[250px] max-h-[450px]">
          {receiptUrl ? (
            <img
              src={receiptUrl}
              alt="Receipt proof"
              className="w-full h-full object-contain max-h-[450px]"
            />
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              No receipt image available.
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          {receiptUrl && (
            <a
              href={receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
            >
              <Download className="w-4 h-4 mr-1" />
              Open Full Image
            </a>
          )}

          <div className="flex items-center space-x-2 ml-auto">
            {isManager && !transaction.is_voided && (
              <>
                <label className="cursor-pointer">
                  <span className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    Replace Receipt
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    onChange={handleFileReplace}
                    className="hidden"
                    disabled={loading}
                  />
                </label>

                {receiptUrl && (
                  <Button variant="danger" size="sm" onClick={handleRemoveReceipt} loading={loading}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Remove
                  </Button>
                )}
              </>
            )}

            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ReceiptModal;

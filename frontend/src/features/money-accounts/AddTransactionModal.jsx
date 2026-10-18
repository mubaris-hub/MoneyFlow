import React, { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import moneyAccountService from '../../services/moneyAccount.service';
import { Upload, X, FileImage } from 'lucide-react';

export const AddTransactionModal = ({ isOpen, onClose, accountId, defaultType = 'EXPENSE', onTransactionAdded }) => {
  const [transactionType, setTransactionType] = useState(defaultType);
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    receipt_url: '',
    adjustment_direction: 'POSITIVE',
  });

  const [receiptFile, setReceiptFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setTransactionType(defaultType);
      setFormData({
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        notes: '',
        receipt_url: '',
        adjustment_direction: 'POSITIVE',
      });
      setReceiptFile(null);
      setPreviewUrl(null);
      setError(null);
    }
  }, [isOpen, defaultType]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size exceeds maximum allowed limit of 5 MB.');
      return;
    }

    // Validate extension
    const validExts = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validExts.includes(file.type.toLowerCase())) {
      setError('Unsupported file type. Please upload JPG, PNG, or WEBP images.');
      return;
    }

    setError(null);
    setReceiptFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveFile = () => {
    setReceiptFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let finalAmount = formData.amount;
      if (transactionType === 'ADJUSTMENT' && formData.adjustment_direction === 'NEGATIVE') {
        finalAmount = `-${formData.amount}`;
      }

      const payload = {
        transaction_type: transactionType,
        amount: finalAmount,
        description: formData.description,
        date: formData.date || undefined,
        notes: formData.notes,
        receipt_url: formData.receipt_url || undefined,
      };

      if (receiptFile) {
        payload.receipt_image = receiptFile;
      }

      const newTx = await moneyAccountService.createTransaction(accountId, payload);
      onTransactionAdded(newTx);
      onClose();
    } catch (err) {
      const data = err.response?.data;
      let msg = 'Failed to add transaction.';
      if (typeof data === 'object' && data !== null) {
        if (data.detail) msg = data.detail;
        else if (data.amount) msg = `Amount error: ${data.amount[0] || data.amount}`;
        else if (data.notes) msg = `Reason error: ${data.notes[0] || data.notes}`;
        else if (data.receipt_image) msg = `Receipt error: ${data.receipt_image[0] || data.receipt_image}`;
        else if (data.message) msg = data.message;
        else msg = JSON.stringify(data);
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (transactionType) {
      case 'DEPOSIT': return 'Add Deposit (Funds Received)';
      case 'EXPENSE': return 'Log Expense (Funds Spent)';
      case 'REFUND': return 'Return Money (Refund to Owner)';
      case 'ADJUSTMENT': return 'Balance Adjustment';
      default: return 'Add Transaction';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={getTitle()}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
            {error}
          </div>
        )}

        {/* Transaction Type Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Transaction Type</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { type: 'DEPOSIT', label: '+ Deposit' },
              { type: 'EXPENSE', label: '- Expense' },
              { type: 'REFUND', label: '↩ Refund' },
              { type: 'ADJUSTMENT', label: '± Adjustment' },
            ].map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => setTransactionType(item.type)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                  transactionType === item.type
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Amount Field */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Amount (₹) *</label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            name="amount"
            placeholder="0.00"
            value={formData.amount}
            onChange={handleChange}
            required
          />
        </div>

        {/* Adjustment Direction Toggle */}
        {transactionType === 'ADJUSTMENT' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Adjustment Direction</label>
            <div className="flex space-x-3">
              <label className="flex items-center text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="adjustment_direction"
                  value="POSITIVE"
                  checked={formData.adjustment_direction === 'POSITIVE'}
                  onChange={handleChange}
                  className="w-4 h-4 text-emerald-600"
                />
                <span className="ml-1.5">+ Increase Balance</span>
              </label>
              <label className="flex items-center text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="adjustment_direction"
                  value="NEGATIVE"
                  checked={formData.adjustment_direction === 'NEGATIVE'}
                  onChange={handleChange}
                  className="w-4 h-4 text-emerald-600"
                />
                <span className="ml-1.5">- Decrease Balance</span>
              </label>
            </div>
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Description *</label>
          <Input
            name="description"
            placeholder={
              transactionType === 'DEPOSIT'
                ? 'e.g. Initial fund received via bank transfer'
                : transactionType === 'EXPENSE'
                ? 'e.g. Grocery purchase receipt'
                : transactionType === 'REFUND'
                ? 'e.g. Returned unused balance to Rahul'
                : 'e.g. Reconciliation correction'
            }
            value={formData.description}
            onChange={handleChange}
            required
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Date</label>
          <Input type="date" name="date" value={formData.date} onChange={handleChange} required />
        </div>

        {/* Notes / Mandatory Reason for Adjustment */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {transactionType === 'ADJUSTMENT' ? 'Adjustment Reason (Mandatory) *' : 'Notes'}
          </label>
          <textarea
            name="notes"
            rows="2"
            placeholder={
              transactionType === 'ADJUSTMENT'
                ? 'Explain why this balance adjustment is being made...'
                : 'Additional details or memo...'
            }
            value={formData.notes}
            onChange={handleChange}
            required={transactionType === 'ADJUSTMENT'}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Receipt Image Upload (Optional) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Attach Receipt Image (Optional)</label>
          {!receiptFile ? (
            <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/30 transition-colors">
              <Upload className="w-5 h-5 text-slate-400 mb-1" />
              <span className="text-xs font-medium text-slate-600">Click to upload receipt image</span>
              <span className="text-[10px] text-slate-400">JPG, PNG, WEBP (Max 5 MB)</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/jpg"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          ) : (
            <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center space-x-3 overflow-hidden">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="w-10 h-10 object-cover rounded-lg border border-slate-200" />
                ) : (
                  <FileImage className="w-6 h-6 text-emerald-600" />
                )}
                <div className="overflow-hidden">
                  <p className="text-xs font-medium text-slate-800 truncate">{receiptFile.name}</p>
                  <p className="text-[10px] text-slate-400">{(receiptFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRemoveFile}
                className="p-1 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            Save Transaction
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddTransactionModal;

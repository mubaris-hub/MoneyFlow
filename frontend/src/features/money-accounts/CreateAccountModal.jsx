import React, { useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import moneyAccountService from '../../services/moneyAccount.service';

export const CreateAccountModal = ({ isOpen, onClose, onAccountCreated }) => {
  const [formData, setFormData] = useState({
    title: '',
    owner_name: '',
    owner_email: '',
    currency: 'INR',
    allow_overdraft: false,
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const newAccount = await moneyAccountService.createAccount(formData);
      setFormData({
        title: '',
        owner_name: '',
        owner_email: '',
        currency: 'INR',
        allow_overdraft: false,
        notes: '',
      });
      onAccountCreated(newAccount);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.message || err.message || 'Failed to create money account.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Money Account / Friend Ledger">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Account Title *</label>
          <Input
            name="title"
            placeholder="e.g. Rahul's Trip Fund, Personal Fund for Alex"
            value={formData.title}
            onChange={handleChange}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Friend's Name (Owner) *</label>
            <Input
              name="owner_name"
              placeholder="e.g. Rahul Sharma"
              value={formData.owner_name}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Friend's Email *</label>
            <Input
              type="email"
              name="owner_email"
              placeholder="e.g. rahul@example.com"
              value={formData.owner_email}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
            <select
              name="currency"
              value={formData.currency}
              onChange={handleChange}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>

          <div className="flex items-center pt-5">
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="allow_overdraft"
                checked={formData.allow_overdraft}
                onChange={handleChange}
                className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
              />
              <span className="ml-2 text-xs font-medium text-slate-700">Allow Overdraft</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Terms</label>
          <textarea
            name="notes"
            rows="2"
            placeholder="Optional agreement notes..."
            value={formData.notes}
            onChange={handleChange}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            Create Account
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateAccountModal;

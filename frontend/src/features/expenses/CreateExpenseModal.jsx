import React, { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import SplitSelector from './SplitSelector';
import expenseService from '../../services/expense.service';
import groupService from '../../services/group.service';
import useAuth from '../../hooks/useAuth';
import { Receipt, AlertCircle, Check } from 'lucide-react';

export const CreateExpenseModal = ({ isOpen, onClose, initialGroupId, onExpenseCreated }) => {
  const { user } = useAuth();

  const [groups, setGroups] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId || '');
  const [groupMembers, setGroupMembers] = useState([]);

  const [formData, setFormData] = useState({
    description: '',
    total_amount: '',
    category_id: '',
    paid_by_id: user?.id || '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [computedSplits, setComputedSplits] = useState([]);
  const [splitType, setSplitType] = useState('EQUAL');
  const [isSplitValid, setIsSplitValid] = useState(true);
  const [splitErrorMsg, setSplitErrorMsg] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch groups & categories on modal open
  useEffect(() => {
    if (isOpen) {
      expenseService.getCategories().then(cats => {
        setCategories(cats);
        if (cats.length > 0 && !formData.category_id) {
          setFormData(prev => ({ ...prev, category_id: cats[0].id }));
        }
      }).catch(console.error);

      groupService.getGroups().then(grps => {
        setGroups(grps);
        if (initialGroupId) {
          setSelectedGroupId(initialGroupId);
        } else if (grps.length > 0 && !selectedGroupId) {
          setSelectedGroupId(grps[0].id);
        }
      }).catch(console.error);
    }
  }, [isOpen, initialGroupId]);

  // Fetch members when selectedGroupId changes
  useEffect(() => {
    if (selectedGroupId) {
      groupService.getGroup(selectedGroupId).then(grp => {
        setGroupMembers(grp.members || []);
        if (grp.members && grp.members.length > 0) {
          // Default paid_by to current user if member, else first member
          const isUserMember = grp.members.some(m => m.user.id === user?.id);
          setFormData(prev => ({
            ...prev,
            paid_by_id: isUserMember ? user.id : grp.members[0].user.id
          }));
        }
      }).catch(console.error);
    }
  }, [selectedGroupId, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSplitsChange = (splits, isValid, errorMsg, mode) => {
    setComputedSplits(splits);
    setIsSplitValid(isValid);
    setSplitErrorMsg(errorMsg);
    setSplitType(mode);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.description.trim()) {
      setError('Description is required.');
      return;
    }

    if (!formData.total_amount || Number(formData.total_amount) <= 0) {
      setError('Total amount must be greater than zero.');
      return;
    }

    if (!selectedGroupId) {
      setError('Group selection is required.');
      return;
    }

    if (!isSplitValid) {
      setError(splitErrorMsg || 'Please fix expense split calculation errors.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        description: formData.description.trim(),
        total_amount: Number(formData.total_amount).toFixed(2),
        currency: 'INR',
        group_id: selectedGroupId,
        category_id: Number(formData.category_id),
        paid_by_id: formData.paid_by_id,
        split_type: splitType,
        date: formData.date,
        notes: formData.notes,
        splits: computedSplits
      };

      const newExpense = await expenseService.createExpense(payload);
      onExpenseCreated(newExpense);
      onClose();
    } catch (err) {
      const errData = err.response?.data;
      const msg = errData?.detail || errData?.splits?.[0] || errData?.total_amount?.[0] || 'Failed to create expense.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log New Expense" maxWidth="max-w-lg">
      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-700 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Input
              label="Expense Description"
              type="text"
              name="description"
              placeholder="e.g. Dinner or Groceries"
              icon={Receipt}
              value={formData.description}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <Input
              label="Amount (₹)"
              type="number"
              step="0.01"
              name="total_amount"
              placeholder="0.00"
              value={formData.total_amount}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Group Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Group <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full text-sm text-slate-900 bg-white border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:border-emerald-600 font-medium"
              required
            >
              {groups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Category
            </label>
            <select
              name="category_id"
              value={formData.category_id}
              onChange={handleChange}
              className="w-full text-sm text-slate-900 bg-white border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:border-emerald-600 font-medium"
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Paid By Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Paid By
            </label>
            <select
              name="paid_by_id"
              value={formData.paid_by_id}
              onChange={handleChange}
              className="w-full text-sm text-slate-900 bg-white border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:border-emerald-600 font-medium"
            >
              {groupMembers.map(m => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.first_name} {m.user.last_name} {m.user.id === user?.id ? '(You)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date Input */}
          <Input
            label="Date"
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
          />
        </div>

        {/* Dynamic Split Calculator */}
        {groupMembers.length > 0 && (
          <SplitSelector
            groupMembers={groupMembers}
            totalAmount={formData.total_amount}
            onChange={handleSplitsChange}
          />
        )}

        <div className="flex justify-end space-x-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading} disabled={!isSplitValid}>
            Save Expense
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateExpenseModal;

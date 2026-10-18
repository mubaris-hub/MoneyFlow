import React, { useState } from 'react';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import groupService from '../../services/group.service';
import { Users, AlertCircle } from 'lucide-react';

export const CreateGroupModal = ({ isOpen, onClose, onGroupCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    group_type: 'ROOMMATES',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const groupTypeOptions = [
    { value: 'ROOMMATES', label: 'Roommates' },
    { value: 'TRIP', label: 'Trip / Vacation' },
    { value: 'STUDENT_HOUSE', label: 'Student House' },
    { value: 'COUPLE', label: 'Couple' },
    { value: 'OTHER', label: 'Other' },
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Group name is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const group = await groupService.createGroup(formData);
      setFormData({ name: '', description: '', group_type: 'ROOMMATES' });
      onGroupCreated(group);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.name?.[0] || 'Failed to create group.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Group">
      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-700 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Group Name"
          type="text"
          name="name"
          placeholder="e.g. Apartment 402 or Goa Vacation"
          icon={Users}
          value={formData.name}
          onChange={handleChange}
          required
        />

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Group Type
          </label>
          <select
            name="group_type"
            value={formData.group_type}
            onChange={handleChange}
            className="w-full text-sm font-normal text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15"
          >
            {groupTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Description (Optional)
          </label>
          <textarea
            name="description"
            rows="3"
            placeholder="What is this group for?"
            value={formData.description}
            onChange={handleChange}
            className="w-full text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-3.5 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 placeholder:text-slate-400"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading}>
            Create Group
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateGroupModal;

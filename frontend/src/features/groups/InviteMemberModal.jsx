import React, { useState } from 'react';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import groupService from '../../services/group.service';
import { Mail, Copy, Check, AlertCircle, UserPlus } from 'lucide-react';

export const InviteMemberModal = ({ isOpen, onClose, group, onMemberAdded }) => {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);

  if (!group) return null;

  const handleCopyCode = () => {
    if (group.invite_code) {
      navigator.clipboard.writeText(group.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Please enter an email or username.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await groupService.addMember(group.id, identifier);
      setSuccess(res.message || 'Member added successfully!');
      setIdentifier('');
      if (onMemberAdded) onMemberAdded();
    } catch (err) {
      const errData = err.response?.data;
      const msg = errData?.detail || errData?.identifier?.[0] || 'Failed to add member.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Invite to ${group.name}`}>
      <div className="space-y-6">
        {/* Copy Invite Code Section */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Share Group Invite Code
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={group.invite_code || ''}
              className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-800 tracking-wider focus:outline-none"
            />
            <Button variant="secondary" size="md" onClick={handleCopyCode}>
              {copied ? <Check className="w-4 h-4 text-emerald-600 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="text-[11px] text-slate-500">
            Friends can join this group instantly using this invite code.
          </p>
        </div>

        {/* Divide Line */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-slate-400 font-semibold">Or Add Directly</span>
          </div>
        </div>

        {/* Add via Email/Username Form */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-700 text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-emerald-700 text-xs font-medium">
            <Check className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleAddMember} className="space-y-4">
          <Input
            label="Friend's Email or Username"
            type="text"
            placeholder="friend@example.com or username"
            icon={Mail}
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              if (error) setError('');
              if (success) setSuccess('');
            }}
          />

          <div className="flex justify-end space-x-3 pt-2">
            <Button variant="outline" onClick={onClose}>
              Done
            </Button>
            <Button type="submit" variant="primary" isLoading={loading}>
              <UserPlus className="w-4 h-4 mr-1.5" />
              Add Member
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default InviteMemberModal;

import React, { useState } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import moneyAccountService from '../../services/moneyAccount.service';
import { Copy, Check } from 'lucide-react';

export const InviteOwnerModal = ({ isOpen, onClose, account, onInviteSent }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [invitationToken, setInvitationToken] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!account) return null;

  const handleSendInvite = async () => {
    setError(null);
    setLoading(true);

    try {
      const data = await moneyAccountService.inviteOwner(account.id);
      setInvitationToken(data.token);
      onInviteSent(data);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to send invitation.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!invitationToken) return;
    const inviteUrl = `${window.location.origin}/money-accounts/invitation?token=${invitationToken}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Invite ${account.owner_name}`}>
      <div className="space-y-4">
        {error && (
          <div className="p-3 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
            {error}
          </div>
        )}

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 text-slate-700">
          <p><span className="font-semibold">Recipient Email:</span> {account.owner_email}</p>
          <p><span className="font-semibold">Current Account Status:</span> {account.status}</p>
          <p className="text-slate-500 pt-1">
            Sending an invitation creates a secure token linked to {account.owner_email}. When they log into MoneyFlow and accept, they will gain read-only access to this ledger.
          </p>
        </div>

        {!invitationToken ? (
          <div className="flex justify-end space-x-3 pt-2">
            <Button variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSendInvite} loading={loading}>
              Generate Secure Invitation
            </Button>
          </div>
        ) : (
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
              <p className="font-bold">Invitation Generated Successfully!</p>
              <p className="mt-1">Share this secure single-use invitation link with {account.owner_name}:</p>
            </div>

            <div className="flex items-center space-x-2">
              <Input
                readOnly
                value={`${window.location.origin}/money-accounts/invitation?token=${invitationToken}`}
                className="text-xs bg-slate-50 font-mono"
              />
              <Button variant="secondary" onClick={handleCopyLink}>
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default InviteOwnerModal;

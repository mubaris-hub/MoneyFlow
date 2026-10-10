import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import moneyAccountService from '../../services/moneyAccount.service';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Mail, CheckCircle, XCircle } from 'lucide-react';

export const InvitationRespondPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleRespond = async (action) => {
    if (!token) {
      setError('Invalid or missing invitation token.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const account = await moneyAccountService.respondInvitation(token, { action });
      if (action === 'ACCEPT') {
        setSuccessMsg('Invitation accepted successfully! Redirecting to account ledger...');
        setTimeout(() => navigate(`/money-accounts/${account.id}`), 1500);
      } else {
        setSuccessMsg('Invitation rejected.');
        setTimeout(() => navigate('/money-accounts'), 1500);
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.message || err.message || 'Failed to respond to invitation.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 text-center space-y-4 shadow-lg border border-slate-200">
        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
          <Mail className="w-6 h-6" />
        </div>

        <h2 className="text-xl font-bold text-slate-900">Money Account Invitation</h2>

        <p className="text-xs text-slate-500">
          You have received a custodial money account invitation. Logged in as{' '}
          <span className="font-semibold text-slate-800">{user?.email}</span>.
        </p>

        {error && (
          <div className="p-3 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="p-3 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-center gap-1.5">
            <CheckCircle className="w-4 h-4" />
            {successMsg}
          </div>
        )}

        {!successMsg && (
          <div className="flex justify-center space-x-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => handleRespond('REJECT')}
              loading={loading}
            >
              <XCircle className="w-4 h-4 mr-1 text-rose-500" />
              Reject
            </Button>
            <Button
              variant="primary"
              onClick={() => handleRespond('ACCEPT')}
              loading={loading}
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Accept Invitation
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default InvitationRespondPage;

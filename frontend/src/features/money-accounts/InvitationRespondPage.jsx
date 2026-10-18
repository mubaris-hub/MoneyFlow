import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import moneyAccountService from '../../services/moneyAccount.service';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Mail, CheckCircle, XCircle, AlertCircle, Clock, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';

export const InvitationRespondPage = () => {
  const [searchParams] = useSearchParams();
  const rawToken = searchParams.get('token');
  const accountId = searchParams.get('account_id');
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeToken, setActiveToken] = useState(rawToken || '');
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const fetchInvitationDetails = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let data = null;
      if (rawToken) {
        data = await moneyAccountService.getInvitationDetails(rawToken);
        setActiveToken(data.token || rawToken);
      } else if (accountId) {
        data = await moneyAccountService.getPendingInvitation(accountId);
        setActiveToken(data.token);
      } else {
        setError('No invitation token or account specified. Please click the link from your notification or invitation message.');
        setLoading(false);
        return;
      }
      setInvitation(data);
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.errors?.detail || err.message || 'Unable to retrieve invitation details.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [rawToken, accountId]);

  useEffect(() => {
    fetchInvitationDetails();
  }, [fetchInvitationDetails]);

  const handleRespond = async (action) => {
    const tokenToUse = activeToken || invitation?.token;
    if (!tokenToUse) {
      setError('Invalid or missing invitation token.');
      return;
    }

    setError(null);
    setActionLoading(true);

    try {
      const account = await moneyAccountService.respondInvitation(tokenToUse, { action });
      if (action === 'ACCEPT') {
        setSuccessMsg('Invitation accepted successfully! Redirecting to account ledger...');
        setTimeout(() => navigate(`/money-accounts/${account.id}`), 1200);
      } else {
        setSuccessMsg('Invitation rejected.');
        setTimeout(() => navigate('/money-accounts'), 1200);
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.errors?.detail || err.response?.data?.message || err.message || 'Failed to respond to invitation.';
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 space-y-3">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Validating invitation...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 text-center space-y-5 shadow-lg border border-slate-200 rounded-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center shadow-xs">
          <Mail className="w-6 h-6" />
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900">Friend Ledger Invitation</h2>
          <p className="text-xs text-slate-500">
            Custodial Money Account access on MoneyFlow.
          </p>
        </div>

        {error && (
          <div className="p-4 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl space-y-3">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
            <div className="pt-1">
              <Link to="/money-accounts">
                <Button variant="outline" size="sm" className="w-full">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  Back to Friend Ledgers
                </Button>
              </Link>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-4 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {!error && !successMsg && invitation && (
          <div className="space-y-4">
            {/* Account Preview Box */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-left space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ledger</span>
                  <p className="text-sm font-bold text-slate-900">{invitation.account?.title}</p>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">
                  {invitation.account?.currency || 'INR'}
                </span>
              </div>

              <div className="pt-1 border-t border-slate-200/60 text-xs text-slate-600 space-y-1">
                <p>
                  <span className="text-slate-400 font-medium">Invited by: </span>
                  <span className="font-semibold text-slate-800">
                    {invitation.sender?.name} ({invitation.sender?.email})
                  </span>
                </p>
                <p>
                  <span className="text-slate-400 font-medium">Recipient email: </span>
                  <span className="font-semibold text-slate-800">{invitation.recipient_email}</span>
                </p>
                {invitation.account?.notes && (
                  <p className="text-[11px] text-slate-500 italic mt-1">"{invitation.account.notes}"</p>
                )}
              </div>
            </div>

            {/* Status Checks */}
            {invitation.status === 'ACCEPTED' ? (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center justify-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>You have already accepted this invitation.</span>
                </div>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => navigate(`/money-accounts/${invitation.account.id}`)}
                >
                  <span>Open Ledger</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
            ) : invitation.status === 'EXPIRED' || invitation.is_expired ? (
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium flex items-center justify-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>This invitation has expired. Ask the manager to send a new one.</span>
                </div>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => navigate('/money-accounts')}
                >
                  <ArrowLeft className="w-4 h-4 mr-1.5" />
                  <span>Back to Friend Ledgers</span>
                </Button>
              </div>
            ) : invitation.status === 'REJECTED' ? (
              <div className="space-y-3">
                <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium flex items-center justify-center gap-1.5">
                  <XCircle className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>This invitation was rejected.</span>
                </div>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => navigate('/money-accounts')}
                >
                  <ArrowLeft className="w-4 h-4 mr-1.5" />
                  <span>Back to Friend Ledgers</span>
                </Button>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <p className="text-[11px] text-slate-500">
                  By accepting, you will gain read-only visibility into this ledger, tracking expenses and deposits logged by the manager.
                </p>
                <div className="flex justify-center space-x-3 pt-1">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => handleRespond('REJECT')}
                    loading={actionLoading}
                  >
                    <XCircle className="w-4 h-4 mr-1.5 text-rose-500" />
                    Decline
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={() => handleRespond('ACCEPT')}
                    loading={actionLoading}
                  >
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    Accept Invitation
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default InvitationRespondPage;

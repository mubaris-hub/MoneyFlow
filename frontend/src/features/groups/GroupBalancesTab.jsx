import React, { useState, useEffect, useCallback } from 'react';
import settlementService from '../../services/settlement.service';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import SmartSettleWidget from './SmartSettleWidget';
import SettlementHistoryFeed from './SettlementHistoryFeed';
import SettleUpModal from './SettleUpModal';
import { formatINR, getInitials } from '../../utils/formatters';
import { Wallet, ArrowDownRight, ArrowUpRight, Loader2, AlertCircle, Plus } from 'lucide-react';

export const GroupBalancesTab = ({ groupId, members = [], currentUserId }) => {
  const [summaryData, setSummaryData] = useState(null);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [prefill, setPrefill] = useState(null);

  const fetchData = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    setError('');
    try {
      const [summaryRes, settlementsRes] = await Promise.all([
        settlementService.getGroupBalancesSummary(groupId),
        settlementService.getGroupSettlements(groupId),
      ]);
      setSummaryData(summaryRes);
      setSettlements(settlementsRes || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load group balances.');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenSettleModal = (senderId = '', receiverId = '', amount = '') => {
    setPrefill({ senderId, receiverId, amount });
    setIsSettleModalOpen(true);
  };

  const handleStatusUpdate = async (settlementId, newStatus) => {
    try {
      await settlementService.updateSettlementStatus(settlementId, { status: newStatus });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update settlement status.');
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        <p className="text-xs text-slate-500 dark:text-slate-400">Calculating group balances & debts...</p>
      </div>
    );
  }

  if (error || !summaryData) {
    return (
      <Card className="py-8 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{error || 'Unable to load balances.'}</p>
        <Button variant="outline" size="sm" onClick={fetchData}>
          Try Again
        </Button>
      </Card>
    );
  }

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'GETS_BACK': return 'success';
      case 'OWES': return 'danger';
      default: return 'neutral';
    }
  };

  const formatStatusLabel = (status, balance) => {
    switch (status) {
      case 'GETS_BACK': return `Gets back ${formatINR(balance)}`;
      case 'OWES': return `Owes ${formatINR(Math.abs(balance))}`;
      default: return 'Settled';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Balance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between border border-slate-200/80 dark:border-slate-800 rounded-2xl">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Group Total Spent</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">{formatINR(summaryData.total_spent)}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border border-rose-100 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20 rounded-2xl">
          <div>
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">You Owe</p>
            <p className="text-xl font-extrabold text-rose-700 dark:text-rose-400 mt-0.5">{formatINR(summaryData.you_owe)}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400 flex items-center justify-center shrink-0">
            <ArrowDownRight className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20 rounded-2xl">
          <div>
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">You Are Owed</p>
            <p className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-0.5">{formatINR(summaryData.you_are_owed)}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Member Net Balances</h3>
        <Button variant="primary" size="sm" onClick={() => handleOpenSettleModal()}>
          <Plus className="w-4 h-4 mr-1.5" /> Record Settlement
        </Button>
      </div>

      {/* Member Net Balances Table */}
      <Card className="divide-y divide-slate-100 dark:divide-slate-800">
        {summaryData.member_balances.map((mb) => {
          const isSelf = String(mb.user.id) === String(currentUserId);

          return (
            <div key={mb.user.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center border border-slate-200 dark:border-slate-700">
                  {getInitials(mb.user.first_name, mb.user.last_name)}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {mb.user.first_name} {mb.user.last_name} {isSelf && '(You)'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Paid: {formatINR(mb.total_paid)} • Share: {formatINR(mb.total_share)}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <Badge variant={getStatusBadgeVariant(mb.status)}>
                  {formatStatusLabel(mb.status, mb.net_balance)}
                </Badge>
              </div>
            </div>
          );
        })}
      </Card>

      {/* Smart Settle Read-Only Suggestions */}
      <SmartSettleWidget
        suggestedSettlements={summaryData.suggested_settlements}
        onSettleClick={handleOpenSettleModal}
      />

      {/* Settlement History Feed */}
      <SettlementHistoryFeed
        settlements={settlements}
        currentUserId={currentUserId}
        onStatusUpdate={handleStatusUpdate}
      />

      {/* Settle Up Modal */}
      <SettleUpModal
        isOpen={isSettleModalOpen}
        onClose={() => setIsSettleModalOpen(false)}
        groupId={groupId}
        members={members}
        prefill={prefill}
        onSettlementCreated={fetchData}
      />
    </div>
  );
};

export default GroupBalancesTab;

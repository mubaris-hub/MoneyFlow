import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import groupService from '../../services/group.service';
import settlementService from '../../services/settlement.service';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Skeleton from '../../components/ui/Skeleton';
import SmartSettleWidget from '../groups/SmartSettleWidget';
import SettlementHistoryFeed from '../groups/SettlementHistoryFeed';
import SettleUpModal from '../groups/SettleUpModal';
import { formatINR, getInitials } from '../../utils/formatters';
import {
  HandCoins,
  Users,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  AlertCircle,
  RefreshCw,
  Plus,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';

export const SettlementsPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedGroupId = searchParams.get('groupId');

  // Groups list states
  const [groups, setGroups] = useState([]);
  const [groupsSummary, setGroupsSummary] = useState({}); // { [groupId]: summaryData }
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [groupsError, setGroupsError] = useState('');

  // Selected group states
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [groupDetails, setGroupDetails] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [settlements, setSettlements] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState('');

  // Settlement modal states
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [prefill, setPrefill] = useState(null);

  // Active summary derived from loaded details or cached group summary for instant UI transitions
  const activeSummary = summaryData || (selectedGroupId ? groupsSummary[selectedGroupId] : null);

  // Fetch all groups user belongs to
  const fetchGroups = useCallback(async () => {
    try {
      setLoadingGroups(true);
      setGroupsError('');
      const grps = await groupService.getGroups();
      setGroups(grps || []);

      if (grps && grps.length > 0) {
        // Choose requested group or first group
        const targetId = requestedGroupId && grps.some((g) => String(g.id) === String(requestedGroupId))
          ? requestedGroupId
          : grps[0].id;
        setSelectedGroupId(targetId);

        // Fetch summaries for each group in parallel to display individual group balance badges
        Promise.allSettled(
          grps.map(async (g) => {
            try {
              const summary = await settlementService.getGroupBalancesSummary(g.id);
              return { groupId: g.id, summary };
            } catch {
              return { groupId: g.id, summary: null };
            }
          })
        ).then((results) => {
          const summaryMap = {};
          results.forEach((res) => {
            if (res.status === 'fulfilled' && res.value?.summary) {
              summaryMap[res.value.groupId] = res.value.summary;
            }
          });
          setGroupsSummary(summaryMap);
        });
      } else {
        setSelectedGroupId(null);
      }
    } catch (err) {
      console.error('Failed to load groups:', err);
      setGroupsError('Unable to load your groups. Please refresh.');
    } finally {
      setLoadingGroups(false);
    }
  }, [requestedGroupId]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Fetch details and settlements for selected group
  const fetchSelectedGroupData = useCallback(async () => {
    if (!selectedGroupId) {
      setGroupDetails(null);
      setSummaryData(null);
      setSettlements([]);
      return;
    }

    try {
      setLoadingDetails(true);
      setDetailsError('');

      const [groupRes, summaryRes, settlementsRes] = await Promise.all([
        groupService.getGroup(selectedGroupId).catch(() => null),
        settlementService.getGroupBalancesSummary(selectedGroupId),
        settlementService.getGroupSettlements(selectedGroupId),
      ]);

      setGroupDetails(groupRes);
      setSummaryData(summaryRes);
      setSettlements(settlementsRes || []);

      // Update cached summary for this group
      if (summaryRes) {
        setGroupsSummary((prev) => ({ ...prev, [selectedGroupId]: summaryRes }));
      }
    } catch (err) {
      console.error('Failed to load settlement details for group:', err);
      setDetailsError(err.response?.data?.detail || 'Failed to load balances for this group.');
    } finally {
      setLoadingDetails(false);
    }
  }, [selectedGroupId]);

  useEffect(() => {
    fetchSelectedGroupData();
  }, [fetchSelectedGroupData]);

  const handleSelectGroup = (gId) => {
    setSelectedGroupId(gId);
    setSearchParams({ groupId: gId });
  };

  const handleOpenSettleModal = (senderId = '', receiverId = '', amount = '') => {
    setPrefill({ senderId, receiverId, amount });
    setIsSettleModalOpen(true);
  };

  const handleStatusUpdate = async (settlementId, newStatus) => {
    try {
      await settlementService.updateSettlementStatus(settlementId, { status: newStatus });
      fetchSelectedGroupData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update settlement status.');
    }
  };

  const formatBalanceBadge = (summary) => {
    if (!summary || !summary.my_balance) {
      return <Badge variant="neutral">Settled</Badge>;
    }
    const net = parseFloat(summary.my_balance.net_balance) || 0;
    if (net > 0) {
      return <Badge variant="success">Gets back {formatINR(net)}</Badge>;
    }
    if (net < 0) {
      return <Badge variant="danger">Owes {formatINR(Math.abs(net))}</Badge>;
    }
    return <Badge variant="neutral">Settled</Badge>;
  };

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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <HandCoins className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Group Settlements
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            View member balances, debt simplifications, and record payments or settlements.
          </p>
        </div>

        {selectedGroupId && (
          <Button
            variant="primary"
            onClick={() => handleOpenSettleModal()}
            className="shrink-0"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Record Settlement
          </Button>
        )}
      </div>

      {/* Loading Groups State */}
      {loadingGroups && (
        <div className="space-y-4">
          <Skeleton variant="text" className="w-48 h-5" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5"
              >
                <div className="flex justify-between items-center">
                  <Skeleton variant="text" className="w-28 h-4" />
                  <Skeleton variant="text" className="w-16 h-4" />
                </div>
                <Skeleton variant="text" className="w-36 h-3" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Loading Groups */}
      {groupsError && !loadingGroups && (
        <Card className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{groupsError}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchGroups}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Try Again
          </Button>
        </Card>
      )}

      {/* Empty State: No Groups */}
      {!loadingGroups && !groupsError && groups.length === 0 && (
        <Card className="py-16 text-center space-y-4 border border-slate-200/80 dark:border-slate-800">
          <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <Users className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No Groups Found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              You must belong to at least one group to track balances and settle debts.
            </p>
          </div>
          <Link to="/groups">
            <Button variant="primary">
              <Plus className="w-4 h-4 mr-1.5" /> Go to Groups
            </Button>
          </Link>
        </Card>
      )}

      {/* Groups Selector Cards Grid */}
      {!loadingGroups && groups.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Select a Group ({groups.length})
            </h2>
            <Link
              to="/groups"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center"
            >
              Manage Groups <ChevronRight className="w-3 h-3 ml-0.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {groups.map((grp) => {
              const isSelected = String(grp.id) === String(selectedGroupId);
              const summary = groupsSummary[grp.id];

              return (
                <div
                  key={grp.id}
                  onClick={() => handleSelectGroup(grp.id)}
                  className={`p-4 rounded-xl border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 shadow-xs ring-1 ring-emerald-500/30'
                      : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3
                        className={`text-sm font-bold truncate ${
                          isSelected
                            ? 'text-emerald-900 dark:text-emerald-300'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {grp.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {grp.members_count} {grp.members_count === 1 ? 'member' : 'members'}
                      </p>
                    </div>
                    {formatBalanceBadge(summary)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Group Settlement Details */}
      {selectedGroupId && (
        <div className="space-y-6 pt-2">
          {/* Details Loading State */}
          {loadingDetails && !activeSummary && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2"
                  >
                    <Skeleton variant="text" className="w-24 h-3.5" />
                    <Skeleton variant="text" className="w-32 h-6" />
                  </div>
                ))}
              </div>
              <Skeleton variant="card" className="w-full h-48" />
            </div>
          )}

          {/* Details Error State */}
          {detailsError && !loadingDetails && (
            <Card className="p-6 text-center space-y-3 border-rose-200 dark:border-rose-900/50">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{detailsError}</p>
              <Button variant="outline" size="sm" onClick={fetchSelectedGroupData}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry Loading
              </Button>
            </Card>
          )}

          {/* Details Content */}
          {!detailsError && activeSummary && (
            <div className={`space-y-6 transition-opacity duration-150 ${loadingDetails ? 'opacity-70' : 'opacity-100'}`}>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 flex items-center justify-between border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Group Total Spent</p>
                    <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                      {formatINR(activeSummary.total_spent)}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                    <Wallet className="w-5 h-5" />
                  </div>
                </Card>

                <Card className="p-4 flex items-center justify-between border border-rose-100 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20 rounded-2xl">
                  <div>
                    <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">You Owe</p>
                    <p className="text-xl font-extrabold text-rose-700 dark:text-rose-400 mt-0.5">
                      {formatINR(activeSummary.you_owe)}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <ArrowDownRight className="w-5 h-5" />
                  </div>
                </Card>

                <Card className="p-4 flex items-center justify-between border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20 rounded-2xl">
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">You Are Owed</p>
                    <p className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-0.5">
                      {formatINR(activeSummary.you_are_owed)}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                </Card>
              </div>

              {/* Smart Settle Suggested Settlements */}
              <SmartSettleWidget
                suggestedSettlements={activeSummary.suggested_settlements}
                onSettleClick={handleOpenSettleModal}
              />

              {/* Member Net Balances Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Member Balances Breakdown
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {activeSummary.member_balances?.length || 0} Members
                  </span>
                </div>

                <Card className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
                  {activeSummary.member_balances?.map((mb) => {
                    const isSelf = String(mb.user.id) === String(user?.id);

                    return (
                      <div key={mb.user.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0">
                            {getInitials(mb.user.first_name, mb.user.last_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {mb.user.first_name} {mb.user.last_name} {isSelf && '(You)'}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Paid: {formatINR(mb.total_paid)} • Share: {formatINR(mb.total_share)}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <Badge variant={getStatusBadgeVariant(mb.status)}>
                            {formatStatusLabel(mb.status, mb.net_balance)}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </Card>
              </div>

              {/* Settlement History Feed */}
              <SettlementHistoryFeed
                settlements={settlements}
                currentUserId={user?.id}
                onStatusUpdate={handleStatusUpdate}
              />
            </div>
          )}
        </div>
      )}

      {/* Settle Up / Record Payment Modal */}
      {selectedGroupId && (
        <SettleUpModal
          isOpen={isSettleModalOpen}
          onClose={() => setIsSettleModalOpen(false)}
          groupId={selectedGroupId}
          members={groupDetails?.members || []}
          prefill={prefill}
          onSettlementCreated={fetchSelectedGroupData}
        />
      )}
    </div>
  );
};

export default SettlementsPage;

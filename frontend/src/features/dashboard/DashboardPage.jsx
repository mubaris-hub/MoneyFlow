import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import reportService from '../../services/report.service';
import groupService from '../../services/group.service';
import expenseService from '../../services/expense.service';
import settlementService from '../../services/settlement.service';
import StatCard from '../../components/common/StatCard';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import CreateGroupModal from '../groups/CreateGroupModal';
import { formatINR } from '../../utils/formatters';
import {
  Wallet,
  ArrowDownLeft,
  Receipt,
  HandCoins,
  Users,
  ArrowUpRight,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

export const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [stats, setStats] = useState({
    netBalance: 0,
    moneyReceived: 0,
    receivedCount: 0,
    totalExpensesShare: 0,
    expensesCount: 0,
    pendingSettlementsAmount: 0,
    pendingSettlementsCount: 0,
    loading: true,
    error: null,
  });

  const fetchDashboardStats = useCallback(async () => {
    try {
      setStats((prev) => ({ ...prev, loading: true, error: null }));
      const report = await reportService.getDashboardReport();

      setStats({
        netBalance: parseFloat(report.available_balance) || 0,
        moneyReceived: parseFloat(report.money_received) || 0,
        receivedCount: report.received_count ?? 0,
        totalExpensesShare: parseFloat(report.total_expenses_share ?? report.personal_expenses_share) || 0,
        expensesCount: report.expenses_count ?? 0,
        pendingSettlementsAmount: parseFloat(report.pending_settlements_amount) || 0,
        pendingSettlementsCount: report.pending_settlements_count ?? 0,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.warn('Dashboard report endpoint error, falling back to direct services:', err);
      try {
        const [groups, expenses, directPayments] = await Promise.all([
          groupService.getGroups().catch(() => []),
          expenseService.getExpenses().catch(() => []),
          expenseService.getDirectPayments().catch(() => []),
        ]);

        let netBalanceSum = 0;
        let pendingSum = 0;
        let pendingCount = 0;
        let stReceivedSum = 0;
        let stReceivedCount = 0;

        if (groups && groups.length > 0) {
          const groupDetails = await Promise.all(
            groups.map(async (g) => {
              try {
                const [summary, settlements] = await Promise.all([
                  settlementService.getGroupBalancesSummary(g.id).catch(() => null),
                  settlementService.getGroupSettlements(g.id).catch(() => []),
                ]);
                return { summary, settlements };
              } catch {
                return { summary: null, settlements: [] };
              }
            })
          );

          groupDetails.forEach(({ summary, settlements }) => {
            if (summary?.my_balance?.net_balance) {
              const nb = parseFloat(summary.my_balance.net_balance) || 0;
              netBalanceSum += nb;
              if (nb < 0) {
                pendingSum += Math.abs(nb);
              }
            }
            if (settlements && Array.isArray(settlements)) {
              settlements.forEach((s) => {
                if (
                  s.status === 'PENDING' &&
                  (String(s.sender?.id) === String(user?.id) || String(s.receiver?.id) === String(user?.id))
                ) {
                  pendingCount += 1;
                }
                if (
                  s.status === 'COMPLETED' &&
                  String(s.receiver?.id) === String(user?.id)
                ) {
                  stReceivedSum += parseFloat(s.amount) || 0;
                  stReceivedCount += 1;
                }
              });
            }
          });
        }

        let dpReceivedSum = 0;
        let dpReceivedCount = 0;
        if (directPayments && Array.isArray(directPayments)) {
          directPayments.forEach((dp) => {
            if (user?.id && String(dp.receiver?.id) === String(user.id)) {
              dpReceivedSum += parseFloat(dp.amount) || 0;
              dpReceivedCount += 1;
            }
          });
        }

        let expenseShareSum = 0;
        let activeExpCount = 0;
        const expenseList = Array.isArray(expenses) ? expenses : [];
        expenseList.forEach((e) => {
          const share = parseFloat(e.my_share) || 0;
          if (share > 0) {
            expenseShareSum += share;
            activeExpCount += 1;
          }
        });

        setStats({
          netBalance: netBalanceSum,
          moneyReceived: dpReceivedSum + stReceivedSum,
          receivedCount: dpReceivedCount + stReceivedCount,
          totalExpensesShare: expenseShareSum,
          expensesCount: activeExpCount,
          pendingSettlementsAmount: pendingSum,
          pendingSettlementsCount: pendingCount,
          loading: false,
          error: null,
        });
      } catch (fallbackErr) {
        setStats((prev) => ({
          ...prev,
          loading: false,
          error: err.response?.data?.detail || 'Unable to connect to MoneyFlow API server.',
        }));
      }
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 rounded-2xl p-6 sm:p-8 text-white shadow-md shadow-emerald-600/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {getGreeting()}, {user?.first_name || 'Friend'} 👋
            </h1>
            <p className="text-sm text-emerald-100 font-medium">
              Your shared money overview at a glance.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2.5 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center space-x-2 cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>Create Group</span>
            </button>
            <Link to="/groups">
              <button className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold backdrop-blur-xs transition-colors flex items-center space-x-2">
                <span>View Groups</span>
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {stats.error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-rose-700 text-xs font-medium shadow-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{stats.error}</span>
          </div>
          <button
            onClick={fetchDashboardStats}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg font-bold transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard
          title="Available Balance"
          value={formatINR(stats.netBalance)}
          subtitle="Net balance across all groups"
          icon={Wallet}
          iconBg="bg-emerald-100 text-emerald-700"
          trend={
            <span className={`inline-flex items-center ${stats.netBalance > 0 ? 'text-emerald-600 font-semibold' : stats.netBalance < 0 ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}>
              <ArrowUpRight className="w-3.5 h-3.5 mr-1 text-slate-400" />
              {stats.netBalance > 0
                ? `Gets back ${formatINR(stats.netBalance)}`
                : stats.netBalance < 0
                ? `Owes ${formatINR(Math.abs(stats.netBalance))}`
                : 'Fully settled up'}
            </span>
          }
        />

        <StatCard
          title="Money Received"
          value={formatINR(stats.moneyReceived)}
          subtitle="Total repayments received"
          icon={ArrowDownLeft}
          iconBg="bg-teal-100 text-teal-700"
          trend={
            <span className="inline-flex items-center text-slate-500">
              {stats.receivedCount} direct transfers
            </span>
          }
        />

        <StatCard
          title="Total Expenses"
          value={formatINR(stats.totalExpensesShare)}
          subtitle="Your total shared share"
          icon={Receipt}
          iconBg="bg-sky-100 text-sky-700"
          trend={
            <span className="inline-flex items-center text-slate-500">
              {stats.expensesCount} active expenses
            </span>
          }
        />

        <StatCard
          title="Pending Settlements"
          value={formatINR(stats.pendingSettlementsAmount)}
          subtitle="Settlements to be cleared"
          icon={HandCoins}
          iconBg="bg-amber-100 text-amber-700"
          trend={
            <span className="inline-flex items-center text-slate-500">
              {stats.pendingSettlementsCount} pending requests
            </span>
          }
        />
      </div>

      {/* Overview Dashboard Shell & Next Steps Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Recent Activity</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Groups and shared expenses feed</p>
          </div>

          <div className="py-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <div className="max-w-sm mx-auto space-y-2">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Group & Settlement Engine is active!</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                You can create groups, log expenses with exact/equal/percentage splits, track member balances, and settle debts cleanly.
              </p>
              <div className="pt-2">
                <Link to="/groups">
                  <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors">
                    Go to Groups
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Account Overview</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Verified session details</p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800/80">
              <span className="text-slate-500 dark:text-slate-400 font-medium">User ID</span>
              <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px] truncate max-w-[150px]">{user?.id}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800/80">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Email</span>
              <span className="font-semibold text-slate-800 dark:text-white">{user?.email}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800/80">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Username</span>
              <span className="font-semibold text-slate-800 dark:text-white">{user?.username}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800/80">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Default Currency</span>
              <Badge variant="brand">{user?.default_currency || 'INR'}</Badge>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Auth Token</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">JWT Active</span>
            </div>
          </div>
        </Card>
      </div>

      <CreateGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onGroupCreated={(group) => navigate(`/groups/${group.id}`)}
      />
    </div>
  );
};

export default DashboardPage;

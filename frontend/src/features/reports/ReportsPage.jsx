import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Skeleton from '../../components/ui/Skeleton';
import { motion } from 'motion/react';
import reportService from '../../services/report.service';
import groupService from '../../services/group.service';
import moneyAccountService from '../../services/moneyAccount.service';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  BarChart3,
  PieChart as PieChartIcon,
  Users,
  BookOpen,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  Receipt,
  RotateCcw,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

export const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState('overview'); // overview, expenses, groups, money-accounts
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [dateRange, setDateRange] = useState('ALL'); // ALL, THIS_MONTH, LAST_MONTH, THIS_YEAR, CUSTOM
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Dropdown lists
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');

  // Report Data
  const [dashboardData, setDashboardData] = useState(null);
  const [expenseData, setExpenseData] = useState(null);
  const [groupData, setGroupData] = useState(null);
  const [moneyAccountData, setMoneyAccountData] = useState(null);

  // Fetch group and account options
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const grps = await groupService.getGroups();
        setGroups(grps || []);
        if (grps && grps.length > 0) {
          setSelectedGroupId(grps[0].id);
        }

        const accs = await moneyAccountService.listAccounts();
        setAccounts(accs || []);
      } catch (err) {
        console.error('Failed to fetch filter options:', err);
      }
    };
    fetchOptions();
  }, []);

  // Compute filter params
  const getFilterParams = () => {
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    return params;
  };

  const handleDateRangeChange = (range) => {
    setDateRange(range);
    const now = new Date();
    if (range === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (range === 'LAST_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    } else if (range === 'THIS_YEAR') {
      const start = new Date(now.getFullYear(), 0, 1);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (range === 'ALL') {
      setStartDate('');
      setEndDate('');
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = getFilterParams();

      if (activeTab === 'overview') {
        const data = await reportService.getDashboardReport(params);
        setDashboardData(data);
      } else if (activeTab === 'expenses') {
        const data = await reportService.getExpenseReport(params);
        setExpenseData(data);
      } else if (activeTab === 'groups') {
        if (selectedGroupId) {
          const data = await reportService.getGroupReport(selectedGroupId, params);
          setGroupData(data);
        }
      } else if (activeTab === 'money-accounts') {
        const accParams = { ...params };
        if (selectedAccountId) accParams.account_id = selectedAccountId;
        const data = await reportService.getMoneyAccountReport(accParams);
        setMoneyAccountData(data);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to load report analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [activeTab, startDate, endDate, selectedGroupId, selectedAccountId]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Reports & Analytics</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Visual insights, spending breakdowns and financial trends across your groups and ledgers.
          </p>
        </div>

        {/* Global Date Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => handleDateRangeChange(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg focus:outline-hidden shadow-xs"
          >
            <option value="ALL">All Time</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="LAST_MONTH">Last Month</option>
            <option value="THIS_YEAR">This Year</option>
            <option value="CUSTOM">Custom Range</option>
          </select>

          {dateRange === 'CUSTOM' && (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg"
              />
              <span className="text-xs text-slate-400 dark:text-slate-500">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg"
              />
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center space-x-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'overview'
              ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Overview
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'expenses'
              ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Expense Analytics
        </button>

        <button
          onClick={() => setActiveTab('groups')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'groups'
              ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Group Analytics
        </button>

        <button
          onClick={() => setActiveTab('money-accounts')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'money-accounts'
              ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Friend Ledgers
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
              >
                <Skeleton variant="text" className="w-20 h-3" />
                <Skeleton variant="text" className="w-28 h-6" />
                <Skeleton variant="text" className="w-32 h-3" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
              <Skeleton variant="text" className="w-40 h-5" />
              <Skeleton variant="card" className="w-full h-64" />
            </div>
            <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
              <Skeleton variant="text" className="w-40 h-5" />
              <Skeleton variant="card" className="w-full h-64" />
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs font-medium text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Tab 1: Overview */}
      {!loading && !error && activeTab === 'overview' && dashboardData && (
        <div className="space-y-6">
          {/* Key Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">My Personal Share</span>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
                {formatCurrency(dashboardData.personal_expenses_share)}
              </p>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">Assigned share in shared expenses</span>
            </Card>

            <Card className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Out of Pocket Paid</span>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
                {formatCurrency(dashboardData.total_paid_out_of_pocket)}
              </p>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">Total upfront payments made</span>
            </Card>

            <Card className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Managed Ledgers</span>
              <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-2">
                {dashboardData.friend_ledger_summary.managed_accounts_count} accounts
              </p>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
                Total Deposits: {formatCurrency(dashboardData.friend_ledger_summary.total_deposits)}
              </span>
            </Card>

            <Card className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ledger Active Balance</span>
              <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-2">
                {formatCurrency(dashboardData.friend_ledger_summary.total_balance)}
              </p>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">Remaining custodial funds</span>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Breakdown Donut */}
            <Card className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Spending Category Breakdown</h3>
              {dashboardData.category_breakdown.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">No category spending data for selected period.</div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dashboardData.category_breakdown}
                        dataKey="percentage"
                        nameKey="category_name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                      >
                        {dashboardData.category_breakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${value}%`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* Monthly Trend Bar Chart */}
            <Card className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Monthly Personal Expense Trend</h3>
              {dashboardData.monthly_trends.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">No monthly expense trends available.</div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardData.monthly_trends}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(val) => formatCurrency(val)} />
                      <Bar dataKey="personal_share" name="Personal Share" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Tab 2: Expense Analytics */}
      {!loading && !error && activeTab === 'expenses' && expenseData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">My Assigned Share</span>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(expenseData.total_user_share)}</p>
            </Card>

            <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">My Paid Expenses</span>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatCurrency(expenseData.total_user_paid)}</p>
            </Card>

            <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Group Volume</span>
              <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{formatCurrency(expenseData.total_group_volume)}</p>
            </Card>
          </div>

          {/* Top Spending Categories Table */}
          <Card className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Highest Spending Categories</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Transactions</th>
                    <th className="px-3 py-2">Share Amount</th>
                    <th className="px-3 py-2">Paid Amount</th>
                    <th className="px-3 py-2 text-right">Percentage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {expenseData.category_breakdown.map((cat) => (
                    <tr key={cat.category_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white">{cat.category_name}</td>
                      <td className="px-3 py-2.5">{cat.count}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-white">{formatCurrency(cat.user_share)}</td>
                      <td className="px-3 py-2.5 text-emerald-600 dark:text-emerald-400 font-semibold">{formatCurrency(cat.user_paid)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-indigo-600 dark:text-indigo-400">{cat.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 3: Group Analytics */}
      {!loading && !error && activeTab === 'groups' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Select Group:</span>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg shadow-xs"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          {groupData && (
            <div className="space-y-6">
              <Card className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{groupData.group_name}</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{groupData.member_count} members in group</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase block">Total Group Expenses</span>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(groupData.total_group_expenses)}</span>
                </div>
              </Card>

              {/* Member Contributions vs Shares Chart */}
              <Card className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Member Contributions vs Assigned Shares</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={groupData.member_stats}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(val) => formatCurrency(val)} />
                      <Legend />
                      <Bar dataKey="total_paid" name="Paid Out of Pocket" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="total_share" name="Assigned Share" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Friend Ledger Analytics */}
      {!loading && !error && activeTab === 'money-accounts' && moneyAccountData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Deposits</span>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatCurrency(moneyAccountData.total_deposits)}</p>
            </Card>

            <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Ledger Expenses</span>
              <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">{formatCurrency(moneyAccountData.total_expenses)}</p>
            </Card>

            <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Active Balance</span>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">{formatCurrency(moneyAccountData.total_balance)}</p>
            </Card>
          </div>

          {/* Accounts Summary Table */}
          <Card className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Ledger Account Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-3 py-2">Ledger Title</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Owner</th>
                    <th className="px-3 py-2">Deposits</th>
                    <th className="px-3 py-2">Expenses</th>
                    <th className="px-3 py-2 text-right">Remaining Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {moneyAccountData.account_summaries.map((acc) => (
                    <tr key={acc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white">{acc.title}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant={acc.role === 'MANAGER' ? 'primary' : 'warning'}>{acc.role}</Badge>
                      </td>
                      <td className="px-3 py-2.5">{acc.owner_name}</td>
                      <td className="px-3 py-2.5 text-emerald-600 dark:text-emerald-400 font-semibold">{formatCurrency(acc.total_deposits)}</td>
                      <td className="px-3 py-2.5 text-rose-600 dark:text-rose-400 font-semibold">{formatCurrency(acc.total_expenses)}</td>
                      <td className="px-3 py-2.5 text-right font-black text-slate-900 dark:text-white">{formatCurrency(acc.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;

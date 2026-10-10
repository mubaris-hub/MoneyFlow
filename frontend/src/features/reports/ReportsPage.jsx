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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reports & Analytics</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Visual insights, spending breakdowns and financial trends across your groups and ledgers.
          </p>
        </div>

        {/* Global Date Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => handleDateRangeChange(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg focus:outline-none shadow-xs"
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
                className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg"
              />
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 flex items-center space-x-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'overview'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Overview
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'expenses'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Expense Analytics
        </button>

        <button
          onClick={() => setActiveTab('groups')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'groups'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Group Analytics
        </button>

        <button
          onClick={() => setActiveTab('money-accounts')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'money-accounts'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Friend Ledgers
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-12 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium text-slate-500">Calculating analytics & aggregations...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Tab 1: Overview */}
      {!loading && !error && activeTab === 'overview' && dashboardData && (
        <div className="space-y-6">
          {/* Key Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 bg-white border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">My Personal Share</span>
              <p className="text-2xl font-extrabold text-slate-900 mt-2">
                {formatCurrency(dashboardData.personal_expenses_share)}
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">Assigned share in shared expenses</span>
            </Card>

            <Card className="p-5 bg-white border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Out of Pocket Paid</span>
              <p className="text-2xl font-extrabold text-emerald-600 mt-2">
                {formatCurrency(dashboardData.total_paid_out_of_pocket)}
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">Total upfront payments made</span>
            </Card>

            <Card className="p-5 bg-white border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Managed Ledgers</span>
              <p className="text-2xl font-extrabold text-indigo-600 mt-2">
                {dashboardData.friend_ledger_summary.managed_accounts_count} accounts
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Total Deposits: {formatCurrency(dashboardData.friend_ledger_summary.total_deposits)}
              </span>
            </Card>

            <Card className="p-5 bg-white border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ledger Active Balance</span>
              <p className="text-2xl font-extrabold text-amber-600 mt-2">
                {formatCurrency(dashboardData.friend_ledger_summary.total_balance)}
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">Remaining custodial funds</span>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Breakdown Donut */}
            <Card className="p-5 bg-white border border-slate-200 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Spending Category Breakdown</h3>
              {dashboardData.category_breakdown.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">No category spending data for selected period.</div>
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
            <Card className="p-5 bg-white border border-slate-200 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Monthly Personal Expense Trend</h3>
              {dashboardData.monthly_trends.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">No monthly expense trends available.</div>
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
            <Card className="p-4 bg-white border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase">My Assigned Share</span>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(expenseData.total_user_share)}</p>
            </Card>

            <Card className="p-4 bg-white border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase">My Paid Expenses</span>
              <p className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(expenseData.total_user_paid)}</p>
            </Card>

            <Card className="p-4 bg-white border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase">Total Group Volume</span>
              <p className="text-xl font-bold text-indigo-600 mt-1">{formatCurrency(expenseData.total_group_volume)}</p>
            </Card>
          </div>

          {/* Top Spending Categories Table */}
          <Card className="p-5 bg-white border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Highest Spending Categories</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Transactions</th>
                    <th className="px-3 py-2">Share Amount</th>
                    <th className="px-3 py-2">Paid Amount</th>
                    <th className="px-3 py-2 text-right">Percentage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenseData.category_breakdown.map((cat) => (
                    <tr key={cat.category_id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-bold text-slate-900">{cat.category_name}</td>
                      <td className="px-3 py-2.5">{cat.count}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900">{formatCurrency(cat.user_share)}</td>
                      <td className="px-3 py-2.5 text-emerald-600 font-semibold">{formatCurrency(cat.user_paid)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-indigo-600">{cat.percentage}%</td>
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
            <span className="text-xs font-semibold text-slate-600">Select Group:</span>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg shadow-xs"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          {groupData && (
            <div className="space-y-6">
              <Card className="p-5 bg-white border border-slate-200 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{groupData.group_name}</h3>
                  <span className="text-xs text-slate-500">{groupData.member_count} members in group</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-semibold uppercase block">Total Group Expenses</span>
                  <span className="text-2xl font-black text-emerald-600">{formatCurrency(groupData.total_group_expenses)}</span>
                </div>
              </Card>

              {/* Member Contributions vs Shares Chart */}
              <Card className="p-5 bg-white border border-slate-200 space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Member Contributions vs Assigned Shares</h3>
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
            <Card className="p-4 bg-white border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase">Total Deposits</span>
              <p className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(moneyAccountData.total_deposits)}</p>
            </Card>

            <Card className="p-4 bg-white border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase">Total Ledger Expenses</span>
              <p className="text-xl font-bold text-rose-600 mt-1">{formatCurrency(moneyAccountData.total_expenses)}</p>
            </Card>

            <Card className="p-4 bg-white border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase">Total Active Balance</span>
              <p className="text-xl font-bold text-amber-600 mt-1">{formatCurrency(moneyAccountData.total_balance)}</p>
            </Card>
          </div>

          {/* Accounts Summary Table */}
          <Card className="p-5 bg-white border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Ledger Account Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2">Ledger Title</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Owner</th>
                    <th className="px-3 py-2">Deposits</th>
                    <th className="px-3 py-2">Expenses</th>
                    <th className="px-3 py-2 text-right">Remaining Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {moneyAccountData.account_summaries.map((acc) => (
                    <tr key={acc.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-bold text-slate-900">{acc.title}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant={acc.role === 'MANAGER' ? 'primary' : 'warning'}>{acc.role}</Badge>
                      </td>
                      <td className="px-3 py-2.5">{acc.owner_name}</td>
                      <td className="px-3 py-2.5 text-emerald-600 font-semibold">{formatCurrency(acc.total_deposits)}</td>
                      <td className="px-3 py-2.5 text-rose-600 font-semibold">{formatCurrency(acc.total_expenses)}</td>
                      <td className="px-3 py-2.5 text-right font-black text-slate-900">{formatCurrency(acc.balance)}</td>
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

import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell
} from 'recharts';
import Card from '../../components/ui/Card';
import personalExpenseService from '../../services/personalExpense.service';
import { formatCurrency, formatINR } from '../../utils/formatters';
import { getCategoryIcon } from './categoryIcons';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  PieChart as PieIcon,
  BarChart3,
  Loader2,
  Sparkles
} from 'lucide-react';

export const PersonalAnalyticsSection = ({ refreshTrigger }) => {
  const [period, setPeriod] = useState('this_month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await personalExpenseService.getAnalytics({ period });
      setData(res);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period, refreshTrigger]);

  if (loading && !data) {
    return (
      <Card className="p-8 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
        <p className="text-xs text-slate-500 dark:text-slate-400">Loading personal financial analytics...</p>
      </Card>
    );
  }

  const dailyTrends = data?.daily_trends || [];
  const monthlyTrends = data?.monthly_trends || [];
  const categoryStats = data?.category_stats || [];
  const highestCategory = data?.highest_spending_category;

  const hasSpendingData = (data?.total_expense || 0) > 0 || (data?.total_income || 0) > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Filter & Overview Grid */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200/60 dark:border-emerald-800/60">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Personal Analytics & Trends</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Deep insights into your daily cash flow and category breakdown</p>
          </div>
        </div>

        {/* Period Selector Tabs */}
        <div className="inline-flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl self-start sm:self-auto text-xs font-semibold">
          {[
            { id: 'this_week', label: 'This Week' },
            { id: 'this_month', label: 'This Month' },
            { id: 'last_30_days', label: 'Last 30 Days' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPeriod(tab.id)}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                period === tab.id
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Period High-Level Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border border-slate-200/80 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Total Spent in Period</span>
          <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1 block">
            {formatINR(data?.total_expense || 0)}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">Outflow across selected timeframe</span>
        </Card>

        <Card className="p-4 border border-slate-200/80 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Total Earned / Received</span>
          <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block">
            {formatINR(data?.total_income || 0)}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">Inflow across selected timeframe</span>
        </Card>

        <Card className="p-4 border border-slate-200/80 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Net Savings Rate</span>
          <span className={`text-2xl font-extrabold mt-1 block ${
            (data?.net_savings || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}>
            {(data?.net_savings || 0) >= 0 ? '+' : ''}{formatINR(data?.net_savings || 0)}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {(data?.net_savings || 0) >= 0 ? 'Positive retained capital' : 'Net deficit for this period'}
          </span>
        </Card>
      </div>

      {/* Daily Spending Trend Chart */}
      <Card className="p-5 space-y-4 border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Daily Spending Activity</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Day-by-day expense timeline</p>
          </div>
          {highestCategory && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Highest: <strong className="text-slate-900 dark:text-white">{highestCategory.name}</strong> ({formatINR(highestCategory.amount)})
            </span>
          )}
        </div>

        {!hasSpendingData ? (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
            No transactions recorded in this period yet. Add expenses to visualize trends.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis dataKey="formatted_date" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} tickFormatter={(val) => `₹${val}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                  formatter={(value, name) => [`₹${Number(value).toFixed(2)}`, name === 'expense' ? 'Expense' : 'Income']}
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  stroke="#EF4444"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#expenseGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="#10B981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#incomeGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Two Column Grid: Category Breakdown & 6-Month Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <Card className="p-5 space-y-4 border border-slate-200/80 dark:border-slate-800">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <PieIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Spending by Category
            </h4>
            <span className="text-xs text-slate-400">{categoryStats.length} categories</span>
          </div>

          {categoryStats.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">No category data recorded for this period.</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {categoryStats.map((cat, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span style={{ color: cat.color }}>
                        {getCategoryIcon(cat.icon, 'w-4 h-4')}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{cat.name}</span>
                      <span className="text-[10px] text-slate-400">({cat.count} txs)</span>
                    </div>
                    <div className="flex items-center gap-2 font-bold">
                      <span className="text-slate-900 dark:text-white">{formatINR(cat.amount)}</span>
                      <span className="text-xs text-slate-400 w-10 text-right">{cat.percentage}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, cat.percentage)}%`,
                        backgroundColor: cat.color || '#10B981'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 6-Month Macro Trend */}
        <Card className="p-5 space-y-4 border border-slate-200/80 dark:border-slate-800">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              6-Month Financial Flow
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Expenses vs Income trend</p>
          </div>

          {monthlyTrends.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">No monthly history available yet.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="short_month" stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                    formatter={(value, name) => [`₹${Number(value).toFixed(2)}`, name === 'expense' ? 'Expenses' : 'Income']}
                  />
                  <Bar dataKey="expense" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default PersonalAnalyticsSection;


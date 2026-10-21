import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wallet,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Filter,
  Search,
  SlidersHorizontal,
  Target,
  BarChart3,
  ListOrdered,
  Clock,
  Trash2,
  Edit3,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  X,
  CreditCard
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Skeleton from '../../components/ui/Skeleton';
import personalExpenseService from '../../services/personalExpense.service';
import { formatCurrency, formatINR, formatDate } from '../../utils/formatters';
import { getCategoryIcon, getPaymentMethodIcon } from './categoryIcons';
import AddPersonalTransactionModal from './AddPersonalTransactionModal';
import EditPersonalTransactionModal from './EditPersonalTransactionModal';
import DeletePersonalTransactionModal from './DeletePersonalTransactionModal';
import PersonalBudgetModal from './PersonalBudgetModal';
import PersonalAnalyticsSection from './PersonalAnalyticsSection';

export const PersonalExpensesPage = () => {
  // Navigation / View Tabs
  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline' | 'analytics'

  // Summary & Categories
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Transactions list
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [isRefreshingTx, setIsRefreshingTx] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [transactionType, setTransactionType] = useState('ALL'); // ALL, EXPENSE, INCOME
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [dateFilterPreset, setDateFilterPreset] = useState('all'); // all, today, yesterday, this_week, this_month, custom
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [ordering, setOrdering] = useState('newest'); // newest, oldest, highest_amount, lowest_amount

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalType, setAddModalType] = useState('EXPENSE');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTxForEdit, setSelectedTxForEdit] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTxForDelete, setSelectedTxForDelete] = useState(null);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);

  // Refresh trigger for child sections
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Load Categories & Summary without flashing skeletons on background updates
  const fetchSummaryAndCategories = useCallback(async (isInitial = false) => {
    if (isInitial || !summary) {
      setLoadingSummary(true);
    }
    try {
      const [sumRes, catRes] = await Promise.all([
        personalExpenseService.getSummary(),
        personalExpenseService.getCategories(),
      ]);
      setSummary(sumRes);
      setCategories(catRes.results || catRes);
    } catch (err) {
      console.error('Failed to load summary or categories:', err);
    } finally {
      setLoadingSummary(false);
    }
  }, [summary]);

  useEffect(() => {
    fetchSummaryAndCategories(true);
  }, [refreshTrigger]);

  // Apply Date Filter Preset
  const handleApplyPreset = (preset) => {
    setDateFilterPreset(preset);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === 'today') {
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (preset === 'yesterday') {
      const yest = new Date(today);
      yest.setDate(today.getDate() - 1);
      const yestStr = yest.toISOString().split('T')[0];
      setDateFrom(yestStr);
      setDateTo(yestStr);
    } else if (preset === 'this_week') {
      const dayOfWeek = today.getDay();
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const startOfWeek = new Date(today.setDate(diff));
      setDateFrom(startOfWeek.toISOString().split('T')[0]);
      setDateTo(new Date().toISOString().split('T')[0]);
    } else if (preset === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateFrom(firstDay.toISOString().split('T')[0]);
      setDateTo(todayStr);
    } else if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    }
    setPage(1);
  };

  // Fetch Transactions with race-condition prevention & smooth updates
  useEffect(() => {
    let active = true;
    const execute = async () => {
      if (transactions.length === 0) {
        setLoadingTransactions(true);
      } else {
        setIsRefreshingTx(true);
      }
      try {
        const params = {
          page,
          page_size: pageSize,
          ordering,
        };

        if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
        if (transactionType !== 'ALL') params.type = transactionType;
        if (selectedCategory) params.category = selectedCategory;
        if (selectedPaymentMethod) params.payment_method = selectedPaymentMethod;
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;

        const res = await personalExpenseService.getTransactions(params);
        if (active) {
          setTransactions(res.results || res);
          setTotalCount(res.count !== undefined ? res.count : (res.results || res).length);
        }
      } catch (err) {
        if (active) {
          console.error('Failed to load personal transactions:', err);
        }
      } finally {
        if (active) {
          setLoadingTransactions(false);
          setIsRefreshingTx(false);
        }
      }
    };
    execute();
    return () => {
      active = false;
    };
  }, [
    page,
    ordering,
    debouncedSearch,
    transactionType,
    selectedCategory,
    selectedPaymentMethod,
    dateFrom,
    dateTo,
    refreshTrigger
  ]);

  const handleOpenAdd = (type = 'EXPENSE') => {
    setAddModalType(type);
    setIsAddModalOpen(true);
  };

  const handleTransactionSaved = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const resetAllFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setTransactionType('ALL');
    setSelectedCategory('');
    setSelectedPaymentMethod('');
    setDateFilterPreset('all');
    setDateFrom('');
    setDateTo('');
    setOrdering('newest');
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    debouncedSearch ||
    transactionType !== 'ALL' ||
    selectedCategory ||
    selectedPaymentMethod ||
    dateFrom ||
    dateTo ||
    ordering !== 'newest'
  );

  // Group transactions by date for the timeline
  const groupedTransactions = transactions.reduce((groups, tx) => {
    const d = tx.date;
    if (!groups[d]) {
      groups[d] = [];
    }
    groups[d].push(tx);
    return groups;
  }, {});

  const getDayHeading = (dateStr) => {
    const today = new Date().toISOString().split('T')[0];
    const yest = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (dateStr === today) return 'Today';
    if (dateStr === yest) return 'Yesterday';
    return formatDate(dateStr);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center shadow-xs">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                My Expenses
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Track your everyday spending, your way.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsBudgetModalOpen(true)}
            className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Target className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" />
            Monthly Budget
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleOpenAdd('INCOME')}
            className="text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
          >
            <ArrowUpRight className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            + Income
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenAdd('EXPENSE')}
            className="shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Expenses */}
        <Card className="p-4.5 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Today's Expenses
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          {loadingSummary ? (
            <Skeleton variant="text" className="w-28 h-8 mt-2" />
          ) : (
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1.5 tracking-tight">
              {formatINR(summary?.today_expenses || 0)}
            </p>
          )}
          <span className="text-[11px] text-slate-400 mt-1 block">Everyday out-of-pocket spending</span>
        </Card>

        {/* Card 2: This Month's Expenses */}
        <Card className="p-4.5 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              This Month's Spent
            </span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          {loadingSummary ? (
            <Skeleton variant="text" className="w-32 h-8 mt-2" />
          ) : (
            <div className="flex items-baseline justify-between mt-1.5">
              <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {formatINR(summary?.this_month_expenses || 0)}
              </p>
              {summary?.expense_percent_change !== null && summary?.expense_percent_change !== undefined && (
                <span className={`inline-flex items-center text-[11px] font-bold ${
                  summary.expense_percent_change > 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}>
                  {summary.expense_percent_change > 0 ? '↑' : '↓'} {Math.abs(summary.expense_percent_change)}% vs last mo
                </span>
              )}
            </div>
          )}
          <span className="text-[11px] text-slate-400 mt-1 block">
            {summary?.expenses_count || 0} personal transactions logged
          </span>
        </Card>

        {/* Card 3: Monthly Budget Remaining */}
        <Card className="p-4.5 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Budget Remaining
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
          </div>
          {loadingSummary ? (
            <Skeleton variant="text" className="w-28 h-8 mt-2" />
          ) : summary?.budget?.amount ? (
            <div>
              <p className={`text-2xl font-black mt-1.5 tracking-tight ${
                summary.budget.status === 'EXCEEDED' ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                {formatINR(summary.budget.remaining)}
              </p>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    summary.budget.status === 'EXCEEDED'
                      ? 'bg-rose-500'
                      : summary.budget.status === 'WARNING'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, summary.budget.percent_spent || 0)}%` }}
                />
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-2">
                No budget set
              </p>
              <button
                type="button"
                onClick={() => setIsBudgetModalOpen(true)}
                className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-semibold mt-1 inline-block"
              >
                + Set Monthly Target
              </button>
            </div>
          )}
          {summary?.budget?.amount && (
            <span className="text-[10px] text-slate-400 mt-1 block">
              Budget: {formatINR(summary.budget.amount)} ({summary.budget.percent_spent}% spent)
            </span>
          )}
        </Card>

        {/* Card 4: Total Income This Month & Net Cash Flow */}
        <Card className="p-4.5 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Income & Net Cash Flow
            </span>
            <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          {loadingSummary ? (
            <Skeleton variant="text" className="w-32 h-8 mt-2" />
          ) : (
            <div className="mt-1.5">
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                {formatINR(summary?.this_month_income || 0)}
              </p>
              <p className={`text-[11px] font-bold mt-1 ${
                (summary?.net_cash_flow || 0) >= 0 ? 'text-slate-700 dark:text-slate-300' : 'text-rose-500'
              }`}>
                Net Savings: {(summary?.net_cash_flow || 0) >= 0 ? '+' : ''}{formatINR(summary?.net_cash_flow || 0)}
              </p>
            </div>
          )}
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            {summary?.income_count || 0} income receipts
          </span>
        </Card>
      </div>

      {/* Main Feature Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
        <div className="flex space-x-1">
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`relative flex items-center gap-2 py-3 px-4 font-bold text-xs transition-colors cursor-pointer ${
              activeTab === 'timeline'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            <span>Transactions & Daily Timeline</span>
            {activeTab === 'timeline' && (
              <motion.div
                layoutId="personalExpenseActiveTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400"
                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`relative flex items-center gap-2 py-3 px-4 font-bold text-xs transition-colors cursor-pointer ${
              activeTab === 'analytics'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Analytics & Insights</span>
            {activeTab === 'analytics' && (
              <motion.div
                layoutId="personalExpenseActiveTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400"
                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              />
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setRefreshTrigger((p) => p + 1)}
          disabled={isRefreshingTx}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshingTx ? 'animate-spin text-emerald-600' : ''}`} />
        </button>
      </div>

      {/* TAB 1: Transactions & Timeline */}
      {activeTab === 'timeline' && (
        <motion.div
          key="timeline-tab"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16 }}
          className="space-y-4"
        >
          {/* Filters Bar Card */}
          <Card className="p-4 space-y-3.5 border border-slate-200/80 dark:border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search title, merchant, notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Type Filter */}
              <select
                value={transactionType}
                onChange={(e) => { setTransactionType(e.target.value); setPage(1); }}
                className="px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">All Types (Expenses & Income)</option>
                <option value="EXPENSE">Expenses Only (-)</option>
                <option value="INCOME">Income Only (+)</option>
              </select>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
                className="px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium focus:outline-none focus:border-emerald-500"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.category_type})
                  </option>
                ))}
              </select>

              {/* Ordering Filter */}
              <select
                value={ordering}
                onChange={(e) => { setOrdering(e.target.value); setPage(1); }}
                className="px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium focus:outline-none focus:border-emerald-500"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="highest_amount">Highest Amount</option>
                <option value="lowest_amount">Lowest Amount</option>
              </select>
            </div>

            {/* Quick Date Navigation Presets */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-slate-400 font-medium mr-1">Period:</span>
                {[
                  { id: 'all', label: 'All Time' },
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: 'this_week', label: 'This Week' },
                  { id: 'this_month', label: 'This Month' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleApplyPreset(p.id)}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      dateFilterPreset === p.id
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Custom Date Range & Reset */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">Custom:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setDateFilterPreset('custom'); setPage(1); }}
                  className="px-2 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setDateFilterPreset('custom'); setPage(1); }}
                  className="px-2 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
                />

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="ml-2 text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-0.5"
                  >
                    <X className="w-3.5 h-3.5" /> Clear
                  </button>
                )}
              </div>
            </div>
          </Card>

          {/* Timeline Content */}
          {loadingTransactions && transactions.length === 0 ? (
            <Card className="p-6 space-y-4 border border-slate-200/80 dark:border-slate-800">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <div className="flex items-center space-x-3 w-1/3">
                    <Skeleton variant="circle" className="w-10 h-10" />
                    <div className="space-y-1.5 w-full">
                      <Skeleton variant="text" className="w-3/4 h-4" />
                      <Skeleton variant="text" className="w-1/2 h-3" />
                    </div>
                  </div>
                  <Skeleton variant="text" className="w-24 h-4" />
                </div>
              ))}
            </Card>
          ) : transactions.length === 0 ? (
            <Card className="py-16 text-center space-y-3 border border-slate-200/80 dark:border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <Wallet className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {hasActiveFilters ? 'No transactions match your filters' : 'No personal transactions yet'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {hasActiveFilters
                  ? 'Try relaxing your search terms or clearing date filters.'
                  : 'Start recording your coffee, groceries, commute, or income to track your cash flow.'}
              </p>
              <div className="pt-2 flex items-center justify-center gap-2">
                {hasActiveFilters ? (
                  <Button variant="secondary" size="sm" onClick={resetAllFilters}>
                    Reset Filters
                  </Button>
                ) : (
                  <Button variant="primary" size="sm" onClick={() => handleOpenAdd('EXPENSE')}>
                    <Plus className="w-4 h-4 mr-1" /> Log First Expense
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <div className={`space-y-5 transition-opacity duration-150 ${isRefreshingTx ? 'opacity-65 pointer-events-none' : 'opacity-100'}`}>
              {Object.keys(groupedTransactions).map((dateKey) => {
                const dayTxs = groupedTransactions[dateKey];
                const dayTotalExpense = dayTxs
                  .filter((t) => t.transaction_type === 'EXPENSE')
                  .reduce((acc, t) => acc + parseFloat(t.amount || 0), 0);
                const dayTotalIncome = dayTxs
                  .filter((t) => t.transaction_type === 'INCOME')
                  .reduce((acc, t) => acc + parseFloat(t.amount || 0), 0);

                return (
                  <div key={dateKey} className="space-y-2">
                    {/* Date Section Header */}
                    <div className="flex items-center justify-between px-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                      <span>{getDayHeading(dateKey)}</span>
                      <div className="flex items-center gap-3 text-[11px]">
                        {dayTotalExpense > 0 && (
                          <span className="text-rose-600 dark:text-rose-400 font-semibold">
                            Spent: -{formatCurrency(dayTotalExpense)}
                          </span>
                        )}
                        {dayTotalIncome > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            Received: +{formatCurrency(dayTotalIncome)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Transactions Card Group */}
                    <Card className="divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden border border-slate-200/80 dark:border-slate-800 p-0">
                      {dayTxs.map((tx) => {
                        const isExpense = tx.transaction_type === 'EXPENSE';
                        const catDetail = tx.category_detail || {};

                        return (
                          <div
                            key={tx.id}
                            className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group"
                          >
                            {/* Left: Icon & Details */}
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                style={{ backgroundColor: `${catDetail.color || '#64748B'}15` }}
                                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-slate-200/50 dark:border-slate-700/50"
                              >
                                <span style={{ color: catDetail.color || '#64748B' }}>
                                  {getCategoryIcon(catDetail.icon, 'w-5 h-5')}
                                </span>
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                    {tx.title}
                                  </p>
                                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                    {getPaymentMethodIcon(tx.payment_method)}
                                    {tx.payment_method}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  <span>{tx.category_name || 'Uncategorized'}</span>
                                  {tx.time && (
                                    <>
                                      <span>•</span>
                                      <span className="flex items-center gap-0.5 text-[11px]">
                                        <Clock className="w-3 h-3" />
                                        {tx.time.slice(0, 5)}
                                      </span>
                                    </>
                                  )}
                                  {tx.notes && (
                                    <>
                                      <span className="hidden md:inline">•</span>
                                      <span className="hidden md:inline truncate max-w-xs text-slate-400">
                                        {tx.notes}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Right: Amount & Action Buttons */}
                            <div className="flex items-center gap-3 shrink-0">
                              <span className={`text-base font-extrabold tracking-tight ${
                                isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                              }`}>
                                {isExpense ? '-' : '+'}{formatCurrency(tx.amount)}
                              </span>

                              <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => { setSelectedTxForEdit(tx); setIsEditModalOpen(true); }}
                                  className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setSelectedTxForDelete(tx); setIsDeleteModalOpen(true); }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </Card>
                  </div>
                );
              })}

              {/* Pagination */}
              {totalCount > pageSize && (
                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 px-1">
                  <span>
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} transactions
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page * pageSize >= totalCount}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* TAB 2: Analytics & Insights */}
      {activeTab === 'analytics' && (
        <motion.div
          key="analytics-tab"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16 }}
        >
          <PersonalAnalyticsSection refreshTrigger={refreshTrigger} />
        </motion.div>
      )}

      {/* Modals */}
      <AddPersonalTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        initialType={addModalType}
        categories={categories}
        onTransactionSaved={handleTransactionSaved}
      />

      <EditPersonalTransactionModal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setSelectedTxForEdit(null); }}
        transaction={selectedTxForEdit}
        categories={categories}
        onTransactionUpdated={handleTransactionSaved}
      />

      <DeletePersonalTransactionModal
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setSelectedTxForDelete(null); }}
        transaction={selectedTxForDelete}
        onTransactionDeleted={handleTransactionSaved}
      />

      <PersonalBudgetModal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        categories={categories}
        onBudgetsUpdated={handleTransactionSaved}
      />
    </div>
  );
};

export default PersonalExpensesPage;


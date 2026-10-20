import React, { useState, useEffect, useCallback, useTransition } from 'react';
import transactionService from '../../services/transaction.service';
import groupService from '../../services/group.service';
import moneyAccountService from '../../services/moneyAccount.service';
import useAuth from '../../hooks/useAuth';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import Skeleton from '../../components/ui/Skeleton';
import TransactionDetailModal from './TransactionDetailModal';
import { formatCurrency, formatDate, getInitials, getTransactionAmountColor } from '../../utils/formatters';
import {
  ArrowRightLeft,
  Receipt,
  HandCoins,
  BookOpen,
  Search,
  Filter,
  RefreshCw,
  SlidersHorizontal,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Ban,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  CreditCard,
  DollarSign,
  AlertCircle,
  Eye,
  X
} from 'lucide-react';

export const TransactionsPage = () => {
  const { user } = useAuth();

  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter States
  const [search, setSearch] = useState('');
  const [transactionType, setTransactionType] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [groupId, setGroupId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [ordering, setOrdering] = useState('newest');

  // Pagination States
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Group & Ledger options
  const [availableGroups, setAvailableGroups] = useState([]);

  // Detail Modal
  const [selectedTx, setSelectedTx] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Load Filter Options (Groups and Ledgers)
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [grps, accs] = await Promise.allSettled([
          groupService.getGroups(),
          moneyAccountService.getAccounts()
        ]);
        const combined = [];
        if (grps.status === 'fulfilled' && Array.isArray(grps.value)) {
          grps.value.forEach(g => combined.push({ id: g.id, name: g.name, type: 'group' }));
        }
        if (accs.status === 'fulfilled' && Array.isArray(accs.value)) {
          accs.value.forEach(a => combined.push({ id: a.id, name: `Ledger: ${a.title}`, type: 'ledger' }));
        }
        setAvailableGroups(combined);
      } catch (err) {
        console.error('Failed to load filter options:', err);
      }
    };
    loadOptions();
  }, []);

  // Fetch Transactions
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        page_size: pageSize,
        ordering
      };

      if (search.trim()) params.search = search.trim();
      if (transactionType !== 'ALL') params.transaction_type = transactionType;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (groupId) params.group_id = groupId;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const data = await transactionService.getTransactions(params);
      setTransactions(data.transactions || []);
      setSummary(data.summary || null);
      setTotalPages(data.total_pages || 1);
      setTotalCount(data.count || 0);
    } catch (err) {
      console.error('Failed to load transactions:', err);
      setError('Unable to load transactions. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, ordering, search, transactionType, statusFilter, groupId, dateFrom, dateTo]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Handle Quick Date Presets
  const applyDatePreset = (preset) => {
    const today = new Date();
    if (preset === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateFrom(firstDay.toISOString().split('T')[0]);
      setDateTo(today.toISOString().split('T')[0]);
    } else if (preset === 'last_30_days') {
      const past30 = new Date();
      past30.setDate(today.getDate() - 30);
      setDateFrom(past30.toISOString().split('T')[0]);
      setDateTo(today.toISOString().split('T')[0]);
    } else if (preset === 'clear') {
      setDateFrom('');
      setDateTo('');
    }
    setPage(1);
  };

  const resetAllFilters = () => {
    setSearch('');
    setTransactionType('ALL');
    setStatusFilter('ALL');
    setGroupId('');
    setDateFrom('');
    setDateTo('');
    setOrdering('newest');
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    search.trim() ||
    transactionType !== 'ALL' ||
    statusFilter !== 'ALL' ||
    groupId ||
    dateFrom ||
    dateTo ||
    ordering !== 'newest'
  );

  const openTransactionDetail = (tx) => {
    setSelectedTx(tx);
    setIsDetailOpen(true);
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'EXPENSE':
        return <Receipt className="w-4 h-4 text-emerald-600" />;
      case 'DIRECT_PAYMENT':
        return <ArrowRightLeft className="w-4 h-4 text-sky-600" />;
      case 'SETTLEMENT':
        return <HandCoins className="w-4 h-4 text-amber-600" />;
      case 'FRIEND_LEDGER':
        return <BookOpen className="w-4 h-4 text-indigo-600" />;
      default:
        return <CreditCard className="w-4 h-4 text-slate-500" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"><CheckCircle2 className="w-2.5 h-2.5" /> Completed</span>;
      case 'PENDING':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"><Clock className="w-2.5 h-2.5" /> Pending</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"><XCircle className="w-2.5 h-2.5" /> Cancelled</span>;
      case 'VOIDED':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700"><Ban className="w-2.5 h-2.5" /> Voided</span>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <ArrowRightLeft className="w-7 h-7 text-emerald-600 dark:text-emerald-400" /> Transactions
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Complete transaction history across your groups, transfers, settlements, and friend ledgers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={fetchTransactions}
            className="flex items-center gap-1.5"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Analytics Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Volume</span>
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/60">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
              {formatCurrency(summary.total_volume, user?.default_currency || 'INR')}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{summary.total_count} transactions recorded</p>
          </Card>

          <Card className="p-4 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Group Expenses</span>
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/60">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-2">{summary.expenses_count}</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Split expenses across groups</p>
          </Card>

          <Card className="p-4 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Transfers & Settles</span>
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/60">
                <HandCoins className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
              {summary.direct_payments_count + summary.settlements_count}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              {summary.direct_payments_count} direct · {summary.settlements_count} settlements
            </p>
          </Card>

          <Card className="p-4 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Friend Ledgers</span>
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/60">
                <BookOpen className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-2">{summary.ledgers_count}</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Custodial transactions</p>
          </Card>
        </div>
      )}

      {/* Filter and Control Bar */}
      <Card className="p-5 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
        {/* Search & Main Row */}
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search description, members, or groups..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
            {/* Type Filter */}
            <select
              value={transactionType}
              onChange={(e) => { setTransactionType(e.target.value); setPage(1); }}
              className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:border-emerald-500"
            >
              <option value="ALL">All Types</option>
              <option value="EXPENSE">Group Expenses</option>
              <option value="DIRECT_PAYMENT">Direct Transfers</option>
              <option value="SETTLEMENT">Settlements</option>
              <option value="FRIEND_LEDGER">Friend Ledgers</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:border-emerald-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="VOIDED">Voided</option>
            </select>

            {/* Group Filter */}
            <select
              value={groupId}
              onChange={(e) => { setGroupId(e.target.value); setPage(1); }}
              className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:border-emerald-500 truncate"
            >
              <option value="">All Groups & Ledgers</option>
              {availableGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>

            {/* Sort Order */}
            <select
              value={ordering}
              onChange={(e) => { setOrdering(e.target.value); setPage(1); }}
              className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:border-emerald-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="highest_amount">Highest Amount</option>
              <option value="lowest_amount">Lowest Amount</option>
            </select>
          </div>
        </div>

        {/* Date Filters & Presets Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 dark:text-slate-500 font-medium">Quick Dates:</span>
            <button
              onClick={() => applyDatePreset('this_month')}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-colors cursor-pointer"
            >
              This Month
            </button>
            <button
              onClick={() => applyDatePreset('last_30_days')}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-colors cursor-pointer"
            >
              Last 30 Days
            </button>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => applyDatePreset('clear')}
                className="px-2.5 py-1 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium transition-colors cursor-pointer"
              >
                Clear Dates
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 dark:text-slate-500 font-medium">Custom Range:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs focus:outline-hidden focus:border-emerald-500"
            />
            <span className="text-slate-400 dark:text-slate-500">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          {hasActiveFilters && (
            <button
              onClick={resetAllFilters}
              className="ml-auto inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 font-medium cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Reset All Filters
            </button>
          )}
        </div>
      </Card>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchTransactions}>
            Try Again
          </Button>
        </div>
      )}

      {/* Transactions Table & Cards */}
      <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                <div className="flex items-center space-x-3 w-1/3">
                  <Skeleton variant="circle" className="w-9 h-9 shrink-0" />
                  <div className="space-y-1.5 w-full">
                    <Skeleton variant="text" className="w-3/4 h-3.5" />
                    <Skeleton variant="text" className="w-1/2 h-3" />
                  </div>
                </div>
                <Skeleton variant="text" className="w-24 h-4 hidden md:block" />
                <Skeleton variant="text" className="w-24 h-4 hidden md:block" />
                <Skeleton variant="text" className="w-20 h-4" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto">
              <ArrowRightLeft className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No transactions found</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {hasActiveFilters
                ? 'No transactions matched your current search and filter settings. Try relaxing your filters.'
                : 'You do not have any transactions recorded yet in your accessible groups or ledgers.'}
            </p>
            {hasActiveFilters && (
              <Button variant="secondary" size="sm" onClick={resetAllFilters} className="mt-2">
                Reset Filters
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm divide-y divide-slate-100 dark:divide-slate-800">
                <thead className="bg-slate-50/75 dark:bg-slate-800/80 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Transaction</th>
                    <th className="px-4 py-3.5">Group / Ledger</th>
                    <th className="px-4 py-3.5">Payer / Receiver</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Amount</th>
                    <th className="px-4 py-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      onClick={() => openTransactionDetail(tx)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    >
                      {/* Description & Type */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            {getTypeIcon(tx.transaction_type)}
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-xs group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                              {tx.description}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              <span>{formatDate(tx.date)}</span>
                              <span>·</span>
                              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{tx.type_label}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Group / Ledger */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <span className="font-medium truncate max-w-[160px]">
                            {tx.group?.name || 'Personal'}
                          </span>
                        </div>
                      </td>

                      {/* Payer / Receiver */}
                      <td className="px-4 py-4 text-xs text-slate-600 dark:text-slate-300">
                        {tx.transaction_type === 'EXPENSE' ? (
                          <div className="truncate max-w-[160px]">
                            <span className="font-semibold text-slate-900 dark:text-white">{tx.payer?.name}</span> paid
                          </div>
                        ) : tx.transaction_type === 'DIRECT_PAYMENT' || tx.transaction_type === 'SETTLEMENT' ? (
                          <div className="truncate max-w-[180px]">
                            <span className="font-semibold text-slate-900 dark:text-white">{tx.payer?.name}</span>
                            <span className="text-slate-400 mx-1">→</span>
                            <span className="font-semibold text-slate-900 dark:text-white">{tx.receiver?.name}</span>
                          </div>
                        ) : (
                          <div className="truncate max-w-[160px]">
                            <span className="font-semibold text-slate-900 dark:text-white">{tx.payer?.name}</span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        {getStatusBadge(tx.status)}
                      </td>

                      {/* Amount */}
                      <td className="px-5 py-4 text-right">
                        <span className={`text-sm font-bold ${getTransactionAmountColor(tx, 'text-slate-900 dark:text-white')}`}>
                          {formatCurrency(tx.amount, tx.currency)}
                        </span>
                        {tx.user_role && tx.user_role !== 'MEMBER' && (
                          <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                            {tx.user_role === 'PAID' && 'You Paid'}
                            {tx.user_role === 'PARTICIPANT' && 'You Split'}
                            {tx.user_role === 'SENDER' && 'You Sent'}
                            {tx.user_role === 'RECEIVER' && 'You Received'}
                          </p>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); openTransactionDetail(tx); }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  onClick={() => openTransactionDetail(tx)}
                  className="p-4 space-y-2.5 active:bg-slate-50 dark:active:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        {getTypeIcon(tx.transaction_type)}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {tx.description}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">{formatDate(tx.date)} · {tx.type_label}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${getTransactionAmountColor(tx, 'text-slate-900 dark:text-white')}`}>
                      {formatCurrency(tx.amount, tx.currency)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
                    <span className="truncate max-w-[180px] font-medium text-slate-700 dark:text-slate-300">
                      {tx.group?.name || 'Personal'}
                    </span>
                    <div>
                      {getStatusBadge(tx.status)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Footer */}
            <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
              <div>
                Showing <span className="font-semibold text-slate-900 dark:text-white">{(page - 1) * pageSize + 1}</span> to{' '}
                <span className="font-semibold text-slate-900 dark:text-white">{Math.min(page * pageSize, totalCount)}</span> of{' '}
                <span className="font-semibold text-slate-900 dark:text-white">{totalCount}</span> transactions
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="gap-1 px-2.5"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </Button>
                <span className="font-medium text-slate-700 dark:text-slate-300 px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="gap-1 px-2.5"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        transaction={selectedTx}
      />
    </div>
  );
};

export default TransactionsPage;

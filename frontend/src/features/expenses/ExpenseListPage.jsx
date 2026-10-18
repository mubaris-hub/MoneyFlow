import React, { useState, useEffect, useCallback } from 'react';
import expenseService from '../../services/expense.service';
import groupService from '../../services/group.service';
import useAuth from '../../hooks/useAuth';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import CreateExpenseModal from './CreateExpenseModal';
import ReceiptScanModal from './ReceiptScanModal';
import { getInitials, formatINR } from '../../utils/formatters';
import {
  Receipt,
  ScanLine,
  Plus,
  Search,
  Filter,
  Trash2,
  Calendar,
  User,
  Users,
  Tag,
  Loader2,
  AlertCircle
} from 'lucide-react';

export const ExpenseListPage = () => {
  const { user } = useAuth();

  const [expenses, setExpenses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);

  const fetchFilters = async () => {
    try {
      const [grps, cats] = await Promise.all([
        groupService.getGroups(),
        expenseService.getCategories()
      ]);
      setGroups(grps);
      setCategories(cats);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedGroup) params.group_id = selectedGroup;
      if (selectedCategory) params.category_id = selectedCategory;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const data = await expenseService.getExpenses(params);
      setExpenses(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedGroup, selectedCategory, searchQuery]);

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      await expenseService.deleteExpense(expenseId);
      setSelectedExpense(null);
      fetchExpenses();
    } catch (err) {
      alert('Failed to delete expense.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Expenses</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track and split expenses across your groups.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={() => setIsScanModalOpen(true)}>
            <ScanLine className="w-4 h-4 mr-1.5 text-emerald-600 dark:text-emerald-400" /> Scan Receipt
          </Button>
          <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Log Expense
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-600"
            />
          </div>

          {/* Group Filter Dropdown */}
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-emerald-600 font-medium"
          >
            <option value="">All Groups</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>

          {/* Category Filter Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-emerald-600 font-medium"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Expenses Feed */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading expenses...</p>
        </div>
      ) : expenses.length === 0 ? (
        <Card className="py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto">
            <Receipt className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No expenses recorded</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Log shared group expenses with equal, exact, percentage, or ratio splits.
            </p>
          </div>
          <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Log First Expense
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {expenses.map((expense) => {
            const isPayer = expense.paid_by?.id === user?.id;

            return (
              <Card
                key={expense.id}
                onClick={() => setSelectedExpense(expense)}
                className="cursor-pointer hover:border-emerald-500/50 hover:shadow-md transition-all duration-150 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3.5">
                    {/* Category Icon Pill */}
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0 border border-emerald-100 dark:border-emerald-800/60">
                      <Receipt className="w-5 h-5" />
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{expense.description}</h4>
                        <Badge variant="neutral">{expense.category?.name || 'General'}</Badge>
                      </div>

                      <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span>Paid by <strong className="text-slate-700 dark:text-slate-300">{isPayer ? 'You' : `${expense.paid_by?.first_name}`}</strong></span>
                        <span>•</span>
                        <span>{expense.date}</span>
                        <span>•</span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{expense.split_type} Split</span>
                      </div>
                    </div>
                  </div>

                  {/* Amounts */}
                  <div className="text-right space-y-0.5">
                    <p className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                      {formatINR(expense.total_amount)}
                    </p>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Your share: <span className="text-slate-800 dark:text-slate-200">{formatINR(expense.my_share)}</span>
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Expense Detail Modal */}
      {selectedExpense && (
        <Modal
          isOpen={!!selectedExpense}
          onClose={() => setSelectedExpense(null)}
          title={selectedExpense.description}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatINR(selectedExpense.total_amount)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Paid by {selectedExpense.paid_by?.first_name} {selectedExpense.paid_by?.last_name} on {selectedExpense.date}</p>
              </div>
              <Badge variant="brand">{selectedExpense.split_type} Split</Badge>
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Split Breakdown</h5>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto">
                {selectedExpense.splits?.map((s) => (
                  <div key={s.id} className="py-2 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-[10px] flex items-center justify-center">
                        {getInitials(s.user?.first_name, s.user?.last_name)}
                      </div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{s.user?.first_name} {s.user?.last_name}</span>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white">{formatINR(s.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => handleDeleteExpense(selectedExpense.id)}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center"
              >
                <Trash2 className="w-4 h-4 mr-1" /> Delete Expense
              </button>
              <Button variant="outline" onClick={() => setSelectedExpense(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Expense Modal */}
      <CreateExpenseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onExpenseCreated={() => {
          fetchExpenses();
        }}
      />

      {/* Receipt Scan Modal */}
      <ReceiptScanModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        onExpenseSaved={() => {
          fetchExpenses();
        }}
      />
    </div>
  );
};

export default ExpenseListPage;

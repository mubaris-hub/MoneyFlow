import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import useAuth from '../../hooks/useAuth';
import moneyAccountService from '../../services/moneyAccount.service';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import CreateAccountModal from './CreateAccountModal';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, Shield, Clock, BookOpen } from 'lucide-react';

export const MoneyAccountsListPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState([]);
  const [activeTab, setActiveTab] = useState('managed'); // 'managed' or 'owned'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await moneyAccountService.listAccounts();
      setAccounts(data);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to load money accounts.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const managedAccounts = accounts.filter(
    (acc) => acc.manager && acc.manager.id === user?.id
  );

  const ownedAccounts = accounts.filter(
    (acc) => (acc.owner && acc.owner.id === user?.id) || (acc.owner_email && acc.owner_email.toLowerCase() === user?.email?.toLowerCase())
  );

  const currentTabAccounts = activeTab === 'managed' ? managedAccounts : ownedAccounts;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">ACTIVE</Badge>;
      case 'INVITED':
        return <Badge variant="warning">INVITED</Badge>;
      case 'CLOSED':
        return <Badge variant="neutral">CLOSED</Badge>;
      default:
        return <Badge variant="neutral">DRAFT</Badge>;
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-emerald-600" />
            Friend Ledgers / Money Accounts
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track custodial funds, expenses, and returns held on behalf of friends.
          </p>
        </div>

        <Button variant="primary" onClick={() => setIsCreateModalOpen(true)} className="self-start sm:self-auto">
          <Plus className="w-4 h-4 mr-1.5" />
          Create Money Account
        </Button>
      </div>

      {/* Tabs Header */}
      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('managed')}
          className={`relative pb-3 px-4 text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'managed'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Accounts I Manage ({managedAccounts.length})</span>
          {activeTab === 'managed' && (
            <motion.div
              layoutId="moneyAccountActiveTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400"
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            />
          )}
        </button>

        <button
          onClick={() => setActiveTab('owned')}
          className={`relative pb-3 px-4 text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'owned'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Money Held For Me ({ownedAccounts.length})</span>
          {activeTab === 'owned' && (
            <motion.div
              layoutId="moneyAccountActiveTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400"
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            />
          )}
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="p-4 text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && currentTabAccounts.length === 0 && (
        <Card className="p-8 text-center space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 mx-auto flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">
            {activeTab === 'managed' ? 'No Managed Accounts Yet' : 'No Money Currently Held For You'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {activeTab === 'managed'
              ? 'Create a money account when a friend gives you funds to hold or manage on their behalf.'
              : 'When a friend logs custodial money they manage for you, it will appear here in read-only mode.'}
          </p>
          {activeTab === 'managed' && (
            <Button variant="primary" size="sm" onClick={() => setIsCreateModalOpen(true)} className="mt-2">
              <Plus className="w-4 h-4 mr-1" />
              Create First Account
            </Button>
          )}
        </Card>
      )}

      {/* Account Cards Grid */}
      {!loading && !error && currentTabAccounts.length > 0 && (
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {currentTabAccounts.map((account) => {
            const summary = account.balance_summary || {};
            const balance = summary.balance || '0.00';
            const totalDeposits = summary.total_deposits || '0.00';
            const totalExpenses = summary.total_expenses || '0.00';

            return (
              <Card
                key={account.id}
                onClick={() => navigate(`/money-accounts/${account.id}`)}
                className="p-5 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white truncate" title={account.title}>
                      {account.title}
                    </h3>
                    {getStatusBadge(account.status)}
                  </div>

                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-4">
                    {activeTab === 'managed' ? (
                      <>Owner: <span className="text-slate-800 dark:text-slate-200 font-semibold">{account.owner_name}</span> ({account.owner_email})</>
                    ) : (
                      <>Managed By: <span className="text-slate-800 dark:text-slate-200 font-semibold">{account.manager?.first_name || account.manager?.username}</span></>
                    )}
                  </p>

                  <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl mb-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Total Received</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalDeposits)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Total Spent</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(totalExpenses)}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium text-slate-400 block">Remaining Balance</span>
                    <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">{formatCurrency(balance)}</span>
                  </div>

                  <div className="p-2 text-slate-400 hover:text-emerald-600 rounded-lg">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                </div>
              </Card>
            );
          })}
        </motion.div>
      )}

      {/* Modal */}
      <CreateAccountModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onAccountCreated={(newAcc) => {
          fetchAccounts();
          navigate(`/money-accounts/${newAcc.id}`);
        }}
      />
    </div>
  );
};

export default MoneyAccountsListPage;

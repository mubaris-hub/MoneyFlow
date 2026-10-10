import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import moneyAccountService from '../../services/moneyAccount.service';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import AddTransactionModal from './AddTransactionModal';
import VoidTransactionModal from './VoidTransactionModal';
import InviteOwnerModal from './InviteOwnerModal';
import ReceiptModal from './ReceiptModal';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  ArrowLeft,
  Plus,
  Minus,
  RotateCcw,
  Sliders,
  Mail,
  Lock,
  FileText,
  Image as ImageIcon,
  Download
} from 'lucide-react';

export const MoneyAccountDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [filterType, setFilterType] = useState('');
  const [showVoided, setShowVoided] = useState(true);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addDefaultType, setAddDefaultType] = useState('EXPENSE');
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [selectedTxForVoid, setSelectedTxForVoid] = useState(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedTxForReceipt, setSelectedTxForReceipt] = useState(null);

  const [closing, setClosing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const params = {};
      if (filterType) params.transaction_type = filterType;
      if (!showVoided) params.include_voided = 'false';
      await moneyAccountService.exportLedger(id, params);
    } catch (err) {
      alert(err.response?.data?.detail || err.message || 'Failed to export CSV.');
    } finally {
      setExporting(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const accData = await moneyAccountService.getAccount(id);
      setAccount(accData);

      const params = {};
      if (filterType) params.transaction_type = filterType;
      if (!showVoided) params.is_voided = 'false';

      const txData = await moneyAccountService.listTransactions(id, params);
      setTransactions(txData);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to load account details.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, filterType, showVoided]);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-slate-100 rounded-lg animate-pulse" />
        <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <Button variant="secondary" size="sm" onClick={() => navigate('/money-accounts')}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Ledgers
        </Button>
        <div className="p-4 text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
          {error || 'Money account not found.'}
        </div>
      </div>
    );
  }

  const isManager = account.manager?.id === user?.id;
  const isOwner = (account.owner?.id === user?.id) || (account.owner_email?.toLowerCase() === user?.email?.toLowerCase());
  const isClosed = account.status === 'CLOSED';

  const summary = account.balance_summary || {};
  const balance = summary.balance || '0.00';
  const totalDeposits = summary.total_deposits || '0.00';
  const totalExpenses = summary.total_expenses || '0.00';
  const totalRefunds = summary.total_refunds || '0.00';

  const handleOpenAdd = (type) => {
    setAddDefaultType(type);
    setIsAddModalOpen(true);
  };

  const handleCloseAccount = async () => {
    if (!window.confirm('Are you sure you want to close this money account? Balance must be exactly ₹0.00.')) {
      return;
    }
    setClosing(true);
    try {
      await moneyAccountService.closeAccount(id);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || err.message || 'Failed to close account.');
    } finally {
      setClosing(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE': return <Badge variant="success">ACTIVE</Badge>;
      case 'INVITED': return <Badge variant="warning">INVITED</Badge>;
      case 'CLOSED': return <Badge variant="neutral">CLOSED</Badge>;
      default: return <Badge variant="neutral">DRAFT</Badge>;
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'DEPOSIT': return <Badge variant="success">+ DEPOSIT</Badge>;
      case 'EXPENSE': return <Badge variant="danger">- EXPENSE</Badge>;
      case 'REFUND': return <Badge variant="warning">↩ REFUND</Badge>;
      case 'ADJUSTMENT': return <Badge variant="neutral">± ADJUSTMENT</Badge>;
      default: return <Badge variant="neutral">{type}</Badge>;
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Button variant="secondary" size="sm" onClick={() => navigate('/money-accounts')}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Ledgers
        </Button>

        {isOwner && !isManager && (
          <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" />
            Owner Read-Only Portal
          </span>
        )}
      </div>

      {/* Account Info Header */}
      <Card className="p-5 sm:p-6 bg-white space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{account.title}</h1>
              {getStatusBadge(account.status)}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Managed by <span className="font-semibold text-slate-800">{account.manager?.first_name || account.manager?.username}</span> for{' '}
              <span className="font-semibold text-slate-800">{account.owner_name}</span> ({account.owner_email})
            </p>
          </div>

          {/* Action Buttons for Manager */}
          {isManager && !isClosed && (
            <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
              <Button size="sm" variant="primary" onClick={() => handleOpenAdd('DEPOSIT')}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Deposit
              </Button>
              <Button size="sm" variant="danger" onClick={() => handleOpenAdd('EXPENSE')}>
                <Minus className="w-3.5 h-3.5 mr-1" />
                Expense
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handleOpenAdd('REFUND')}>
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Return Money
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handleOpenAdd('ADJUSTMENT')}>
                <Sliders className="w-3.5 h-3.5 mr-1" />
                Adjustment
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setIsInviteModalOpen(true)}>
                <Mail className="w-3.5 h-3.5 mr-1" />
                Invite
              </Button>
              <Button size="sm" variant="secondary" onClick={handleCloseAccount} loading={closing}>
                Close
              </Button>
            </div>
          )}
        </div>

        {/* Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          <div className="p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-xl">
            <span className="text-[11px] font-semibold text-emerald-700 block">Total Money Received</span>
            <span className="text-base sm:text-xl font-bold text-emerald-800">{formatCurrency(totalDeposits)}</span>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-500 block">Total Spent</span>
            <span className="text-base sm:text-xl font-bold text-slate-800">{formatCurrency(totalExpenses)}</span>
          </div>

          <div className="p-3.5 bg-amber-50/60 border border-amber-100 rounded-xl">
            <span className="text-[11px] font-semibold text-amber-700 block">Total Returned to Owner</span>
            <span className="text-base sm:text-xl font-bold text-amber-800">{formatCurrency(totalRefunds)}</span>
          </div>

          <div className="p-3.5 bg-emerald-100/60 border border-emerald-300 rounded-xl">
            <span className="text-[11px] font-bold text-emerald-800 block">Remaining Balance</span>
            <span className="text-lg sm:text-2xl font-extrabold text-emerald-900">{formatCurrency(balance)}</span>
          </div>
        </div>
      </Card>

      {/* Ledger Table Section */}
      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            Transaction Ledger History
          </h2>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
            >
              <option value="">All Types</option>
              <option value="DEPOSIT">DEPOSIT</option>
              <option value="EXPENSE">EXPENSE</option>
              <option value="REFUND">REFUND</option>
              <option value="ADJUSTMENT">ADJUSTMENT</option>
            </select>

            <label className="inline-flex items-center text-xs font-medium text-slate-600 cursor-pointer mr-2">
              <input
                type="checkbox"
                checked={showVoided}
                onChange={(e) => setShowVoided(e.target.checked)}
                className="w-3.5 h-3.5 text-emerald-600 rounded"
              />
              <span className="ml-1">Show Voided</span>
            </label>

            <Button
              size="sm"
              variant="secondary"
              onClick={handleExportCsv}
              disabled={exporting}
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>
        </div>

        {/* Empty Transactions */}
        {transactions.length === 0 && (
          <div className="py-8 text-center text-slate-400 text-xs font-medium">
            No transactions recorded in this ledger yet.
          </div>
        )}

        {/* Transactions Table */}
        {transactions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Description</th>
                  <th className="px-3 py-2.5 text-center">Receipt</th>
                  <th className="px-3 py-2.5">Notes</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  {isManager && !isClosed && <th className="px-3 py-2.5 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => {
                  const hasReceipt = Boolean(tx.receipt_image_url || tx.receipt_url);

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-slate-50/60 transition-colors ${
                        tx.is_voided ? 'bg-slate-50/80 text-slate-400' : ''
                      }`}
                    >
                      <td className="px-3 py-3 whitespace-nowrap font-medium">{formatDate(tx.date)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {getTypeBadge(tx.transaction_type)}
                        {tx.is_voided && (
                          <span className="ml-1.5 inline-flex items-center text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                            VOIDED
                          </span>
                        )}
                      </td>
                      <td className={`px-3 py-3 font-medium ${tx.is_voided ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                        {tx.description}
                      </td>

                      {/* Receipt Column */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        {hasReceipt ? (
                          <button
                            onClick={() => {
                              setSelectedTxForReceipt(tx);
                              setIsReceiptModalOpen(true);
                            }}
                            className="inline-flex items-center px-2 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors"
                          >
                            <ImageIcon className="w-3.5 h-3.5 mr-1" />
                            Receipt
                          </button>
                        ) : (
                          <span className="text-slate-300 text-[11px]">-</span>
                        )}
                      </td>

                      <td className="px-3 py-3 text-slate-500 max-w-xs truncate" title={tx.notes}>
                        {tx.is_voided ? `Void reason: ${tx.void_reason}` : tx.notes || '-'}
                      </td>
                      <td className={`px-3 py-3 text-right font-bold whitespace-nowrap ${
                        tx.is_voided
                          ? 'line-through text-slate-400'
                          : tx.transaction_type === 'DEPOSIT' || (tx.transaction_type === 'ADJUSTMENT' && Number(tx.amount) > 0)
                          ? 'text-emerald-600'
                          : 'text-slate-800'
                      }`}>
                        {tx.transaction_type === 'DEPOSIT' ? '+' : tx.transaction_type === 'EXPENSE' || tx.transaction_type === 'REFUND' ? '-' : ''}
                        {formatCurrency(Math.abs(Number(tx.amount)))}
                      </td>

                      {isManager && !isClosed && (
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          {!tx.is_voided ? (
                            <button
                              onClick={() => {
                                setSelectedTxForVoid(tx);
                                setIsVoidModalOpen(true);
                              }}
                              className="text-rose-600 hover:text-rose-800 font-semibold hover:underline"
                            >
                              Void
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modals */}
      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        accountId={id}
        defaultType={addDefaultType}
        onTransactionAdded={() => fetchData()}
      />

      <VoidTransactionModal
        isOpen={isVoidModalOpen}
        onClose={() => setIsVoidModalOpen(false)}
        accountId={id}
        transaction={selectedTxForVoid}
        onTransactionVoided={() => fetchData()}
      />

      <InviteOwnerModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        account={account}
        onInviteSent={() => fetchData()}
      />

      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        accountId={id}
        transaction={selectedTxForReceipt}
        isManager={isManager}
        onReceiptUpdated={() => fetchData()}
      />
    </div>
  );
};

export default MoneyAccountDetailPage;

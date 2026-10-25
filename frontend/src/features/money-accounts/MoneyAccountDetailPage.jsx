import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import moneyAccountService from '../../services/moneyAccount.service';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import AddTransactionModal from './AddTransactionModal';
import VoidTransactionModal from './VoidTransactionModal';
import InviteOwnerModal from './InviteOwnerModal';
import ReceiptModal from './ReceiptModal';
import { formatCurrency, formatDate, getTransactionAmountColor, extractErrorMessage } from '../../utils/formatters';
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
  Download,
  Trash2,
  Archive,
  AlertCircle
} from 'lucide-react';

export const MoneyAccountDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

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
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [closing, setClosing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const params = {};
      if (filterType) params.transaction_type = filterType;
      if (!showVoided) params.include_voided = 'false';
      await moneyAccountService.exportLedger(id, params);
      toast.success('Ledger CSV exported successfully.');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to export CSV.'));
    } finally {
      setExporting(false);
    }
  };

  const fetchData = async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
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
      const errData = err.response?.data;
      const invPending = errData?.invitation_pending || errData?.errors?.invitation_pending;
      const invToken = errData?.invitation_token || errData?.errors?.invitation_token;
      if (err.response?.status === 403 && (invPending || invToken)) {
        if (invToken) {
          navigate(`/money-accounts/invitation?token=${encodeURIComponent(invToken)}`, { replace: true });
          return;
        }
        navigate(`/money-accounts/invitation?account_id=${encodeURIComponent(id)}`, { replace: true });
        return;
      }
      const msg = errData?.detail || errData?.errors?.detail || err.message || 'Failed to load account details.';
      setError(msg);
    } finally {
      if (showSkeleton) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);
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

  const handleConfirmClose = async () => {
    const numBalance = parseFloat(balance);
    if (!isNaN(numBalance) && Math.abs(numBalance) > 0.001) {
      toast.error(`Cannot close account: Remaining balance is ₹${balance}. Balance must be exactly ₹0.00.`);
      return;
    }
    setClosing(true);
    try {
      await moneyAccountService.closeAccount(id);
      toast.success('Money account closed successfully.');
      setIsCloseModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to close account.'));
    } finally {
      setClosing(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (transactions.length > 0) {
      toast.error(`Cannot delete account: Ledger contains ${transactions.length} transaction(s). Please close the account instead to preserve audit history.`);
      return;
    }
    setDeleting(true);
    try {
      await moneyAccountService.deleteAccount(id);
      toast.success('Money account deleted successfully.');
      setIsDeleteModalOpen(false);
      navigate('/money-accounts');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to delete account.'));
    } finally {
      setDeleting(false);
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
      {/* Account Info Header */}
      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{account.title}</h1>
              {getStatusBadge(account.status)}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Managed by <span className="font-semibold text-slate-800 dark:text-slate-200">{account.manager?.first_name || account.manager?.username}</span> for{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">{account.owner_name}</span> ({account.owner_email})
            </p>
          </div>

          {/* Action Buttons for Manager */}
          {isManager && (
            <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
              {!isClosed && (
                <>
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
                  <Button size="sm" variant="secondary" onClick={() => setIsCloseModalOpen(true)}>
                    <Archive className="w-3.5 h-3.5 mr-1" />
                    Close
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                className="hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400"
                onClick={() => setIsDeleteModalOpen(true)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete
              </Button>
            </div>
          )}
        </div>

        {/* Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800 rounded-xl">
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 block">Total Money Received</span>
            <span className="text-base sm:text-xl font-bold text-emerald-800 dark:text-emerald-300">{formatCurrency(totalDeposits)}</span>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Total Spent</span>
            <span className="text-base sm:text-xl font-bold text-slate-800 dark:text-slate-100">{formatCurrency(totalExpenses)}</span>
          </div>

          <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-800 rounded-xl">
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 block">Total Returned to Owner</span>
            <span className="text-base sm:text-xl font-bold text-amber-800 dark:text-amber-300">{formatCurrency(totalRefunds)}</span>
          </div>

          <div className="p-3.5 bg-emerald-100/60 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 rounded-xl">
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 block">Remaining Balance</span>
            <span className="text-lg sm:text-2xl font-extrabold text-emerald-900 dark:text-emerald-200">{formatCurrency(balance)}</span>
          </div>
        </div>
      </Card>

      {/* Ledger Table Section */}
      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Transaction Ledger History
          </h2>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none"
            >
              <option value="">All Types</option>
              <option value="DEPOSIT">DEPOSIT</option>
              <option value="EXPENSE">EXPENSE</option>
              <option value="REFUND">REFUND</option>
              <option value="ADJUSTMENT">ADJUSTMENT</option>
            </select>

            <label className="inline-flex items-center text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer mr-2">
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
          <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs font-medium">
            No transactions recorded in this ledger yet.
          </div>
        )}

        {/* Transactions Table */}
        {transactions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
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
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {transactions.map((tx) => {
                  const hasReceipt = Boolean(tx.receipt_image_url || tx.receipt_url);

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors ${
                        tx.is_voided ? 'bg-slate-50/80 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500' : ''
                      }`}
                    >
                      <td className="px-3 py-3 whitespace-nowrap font-medium">{formatDate(tx.date)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {getTypeBadge(tx.transaction_type)}
                        {tx.is_voided && (
                          <span className="ml-1.5 inline-flex items-center text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded">
                            VOIDED
                          </span>
                        )}
                      </td>
                      <td className={`px-3 py-3 font-medium ${tx.is_voided ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
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
                          <span className="text-slate-300 dark:text-slate-600 text-[11px]">-</span>
                        )}
                      </td>

                      <td className="px-3 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate" title={tx.notes}>
                        {tx.is_voided ? `Void reason: ${tx.void_reason}` : tx.notes || '-'}
                      </td>
                      <td className={`px-3 py-3 text-right font-bold whitespace-nowrap ${getTransactionAmountColor(tx, 'text-slate-800 dark:text-slate-200')}`}>
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
        onTransactionAdded={() => fetchData(false)}
      />

      <VoidTransactionModal
        isOpen={isVoidModalOpen}
        onClose={() => setIsVoidModalOpen(false)}
        accountId={id}
        transaction={selectedTxForVoid}
        onTransactionVoided={() => fetchData(false)}
      />

      <InviteOwnerModal
        isOpen={isInviteModalOpen}
        onClose={(wasInviteSent) => {
          setIsInviteModalOpen(false);
          if (wasInviteSent) {
            fetchData(false);
          }
        }}
        account={account}
        onInviteSent={() => {
          fetchData(false);
        }}
      />

      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        accountId={id}
        transaction={selectedTxForReceipt}
        isManager={isManager}
        onReceiptUpdated={() => fetchData(false)}
      />

      {/* Close Account Confirmation Modal */}
      <Modal
        isOpen={isCloseModalOpen}
        onClose={() => !closing && setIsCloseModalOpen(false)}
        title="Close Money Account"
      >
        <div className="space-y-4 text-left">
          {Math.abs(parseFloat(balance || 0)) > 0.001 ? (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Active Balance Detected ({formatCurrency(balance)})</span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                This money account cannot be closed while funds remain. The ledger balance must be exactly ₹0.00.
                Please log an Expense or Return Money (Refund) to settle the remaining balance before closing.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Are you sure you want to close <strong className="text-slate-900 dark:text-white font-semibold">"{account.title}"</strong>?
              </p>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                <p>• The balance is verified at ₹0.00.</p>
                <p>• Once closed, new transactions cannot be added.</p>
                <p>• All transaction history, receipts, and audit logs remain permanently accessible in read-only mode.</p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="secondary"
              size="sm"
              disabled={closing}
              onClick={() => setIsCloseModalOpen(false)}
            >
              Cancel
            </Button>
            {Math.abs(parseFloat(balance || 0)) <= 0.001 && (
              <Button
                variant="primary"
                size="sm"
                isLoading={closing}
                onClick={handleConfirmClose}
              >
                Confirm Close
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Delete Account Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !deleting && setIsDeleteModalOpen(false)}
        title="Delete Money Account"
      >
        <div className="space-y-4 text-left">
          {transactions.length > 0 ? (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-semibold text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Transactions Exist ({transactions.length} recorded)</span>
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-400">
                To maintain financial accounting rules and preserve audit history, money accounts with recorded transactions cannot be permanently deleted.
              </p>
              <p className="text-xs text-rose-700 dark:text-rose-400">
                If this ledger is finished, please <strong>Close</strong> the account instead once the balance is ₹0.00.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Are you sure you want to delete <strong className="text-slate-900 dark:text-white font-semibold">"{account.title}"</strong>?
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This account has no transactions and will be permanently removed. This action cannot be undone.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="secondary"
              size="sm"
              disabled={deleting}
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            {transactions.length === 0 && (
              <Button
                variant="danger"
                size="sm"
                isLoading={deleting}
                onClick={handleConfirmDelete}
              >
                Delete Account
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MoneyAccountDetailPage;

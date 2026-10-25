import React from 'react';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { formatCurrency, formatDate, getInitials } from '../../utils/formatters';
import { resolveApiUrl } from '../../services/api';
import {
  Receipt,
  ArrowRightLeft,
  HandCoins,
  BookOpen,
  Calendar,
  Users,
  User,
  Tag,
  Clock,
  FileText,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Ban
} from 'lucide-react';

export const TransactionDetailModal = ({ isOpen, onClose, transaction }) => {
  if (!transaction) return null;

  const getTypeBadge = (type) => {
    switch (type) {
      case 'EXPENSE':
        return <Badge variant="brand" className="gap-1.5"><Receipt className="w-3 h-3" /> Group Expense</Badge>;
      case 'DIRECT_PAYMENT':
        return <Badge variant="neutral" className="gap-1.5"><ArrowRightLeft className="w-3 h-3 text-sky-600" /> Direct Transfer</Badge>;
      case 'SETTLEMENT':
        return <Badge variant="warning" className="gap-1.5"><HandCoins className="w-3 h-3" /> Settlement</Badge>;
      case 'FRIEND_LEDGER':
        return <Badge variant="neutral" className="gap-1.5"><BookOpen className="w-3 h-3 text-emerald-600" /> Friend Ledger</Badge>;
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-3 h-3" /> Completed</span>;
      case 'PENDING':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"><Clock className="w-3 h-3" /> Pending Confirmation</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200"><XCircle className="w-3 h-3" /> Cancelled</span>;
      case 'VOIDED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-300"><Ban className="w-3 h-3" /> Voided</span>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transaction Details"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6 pt-1">
        {/* Header Hero Banner */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-2">
              {getTypeBadge(transaction.transaction_type)}
              {getStatusBadge(transaction.status)}
            </div>
            <span className="text-xs text-slate-400 font-mono tracking-wider">
              ID: {transaction.raw_id?.slice(0, 8)}...
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mt-4">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">Total Amount</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mt-1">
                {formatCurrency(transaction.amount, transaction.currency)}
              </h2>
            </div>
            {transaction.my_share && transaction.my_share !== '0.00' && (
              <div className="text-left sm:text-right bg-slate-800/80 rounded-xl px-3.5 py-2 border border-slate-700/60">
                <p className="text-[11px] text-slate-400 font-medium">Your Financial Impact</p>
                <p className="text-sm font-bold text-emerald-400">
                  {transaction.user_role === 'PAID' && 'You Paid Entire Amount'}
                  {transaction.user_role === 'SENDER' && 'You Sent Payment'}
                  {transaction.user_role === 'RECEIVER' && 'You Received Payment'}
                  {transaction.user_role === 'PARTICIPANT' && `Your Share: ${formatCurrency(transaction.my_share, transaction.currency)}`}
                  {transaction.user_role === 'MANAGER' && 'Managed by You'}
                  {transaction.user_role === 'OWNER' && 'Owned by You'}
                </p>
              </div>
            )}
          </div>

          <h3 className="text-base font-medium text-slate-200 mt-4 line-clamp-2">
            {transaction.description}
          </h3>
        </div>

        {/* Primary Meta Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/80 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
              <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Transaction Date</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatDate(transaction.date)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {transaction.group?.is_ledger ? 'Friend Ledger' : 'Group'}
              </p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {transaction.group?.name || 'Personal'}
              </p>
            </div>
          </div>

          {transaction.payer && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                {getInitials(transaction.payer.name)}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Paid / Sent By</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{transaction.payer.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{transaction.payer.email}</p>
              </div>
            </div>
          )}

          {transaction.receiver && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold text-xs shrink-0">
                {getInitials(transaction.receiver.name)}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Received By</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{transaction.receiver.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{transaction.receiver.email}</p>
              </div>
            </div>
          )}

          {transaction.category && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                <Tag className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Category</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{transaction.category.name}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
              <Clock className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Recorded At</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {new Date(transaction.created_at).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short'
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Expense Participants / Splits Breakdown */}
        {transaction.participants && transaction.participants.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Split Breakdown ({transaction.participants.length} Members)
            </h4>
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
              {transaction.participants.map((p, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs">
                      {getInitials(p.user?.name)}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">{p.user?.name}</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">{p.user?.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {formatCurrency(p.amount, transaction.currency)}
                    </p>
                    {p.percentage && (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{p.percentage}% share</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes / Remarks */}
        {transaction.notes && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <FileText className="w-4 h-4" /> Notes & Memo
            </h4>
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
              {transaction.notes}
            </div>
          </div>
        )}

        {/* Receipt Attachment */}
        {transaction.receipt_url && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Receipt className="w-4 h-4" /> Receipt Document
            </h4>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-semibold text-xs">
                  IMG
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">Attached Receipt</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Document verification verified</p>
                </div>
              </div>
              <a
                href={(() => {
                  const url = transaction.receipt_url;
                  if (!url) return '#';
                  if (url.startsWith('http://') || url.startsWith('https://')) return url;
                  const resolved = resolveApiUrl(url);
                  const token = localStorage.getItem('access_token');
                  return token && resolved.includes('/transactions/')
                    ? `${resolved}?token=${encodeURIComponent(token)}`
                    : resolved;
                })()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-xs"
              >
                View File <ExternalLink className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              </a>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default TransactionDetailModal;

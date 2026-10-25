import React, { useState, useEffect, useRef, useCallback } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import moneyAccountService from '../../services/moneyAccount.service';
import { formatCurrency, formatDate, getTransactionAmountColor } from '../../utils/formatters';
import { FileText, Upload, Trash2, ExternalLink, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';

export const ReceiptModal = ({ isOpen, onClose, accountId, transaction, isManager, onReceiptUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Image loading state
  const [imageBlobUrl, setImageBlobUrl] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(null);

  const activeBlobUrlRef = useRef(null);

  const hasReceipt = Boolean(
    transaction && (transaction.receipt_image_url || transaction.receipt_url)
  );

  const cleanupBlob = useCallback(() => {
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }
  }, []);

  const loadReceiptImage = useCallback(async () => {
    if (!transaction || !isOpen) return;

    cleanupBlob();
    setImageBlobUrl(null);
    setImageError(null);

    // If no receipt is attached to this transaction
    if (!transaction.receipt_image_url && !transaction.receipt_url) {
      setImageLoading(false);
      return;
    }

    // If transaction has an external URL and no uploaded backend file
    const rawUrl = transaction.receipt_url;
    const isExternalUrl =
      rawUrl &&
      (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) &&
      !rawUrl.includes('/transactions/') &&
      !transaction.receipt_image_url;

    if (isExternalUrl) {
      setImageBlobUrl(rawUrl);
      setImageLoading(false);
      return;
    }

    // Otherwise, fetch authenticated image binary from Django backend
    setImageLoading(true);
    try {
      const blob = await moneyAccountService.getReceiptBlob(accountId, transaction.id);
      const objectUrl = URL.createObjectURL(blob);
      activeBlobUrlRef.current = objectUrl;
      setImageBlobUrl(objectUrl);
    } catch (err) {
      const status = err.response?.status;
      if (status === 404) {
        setImageError('Receipt proof document not found on storage.');
      } else if (status === 403) {
        setImageError('You do not have permission to view receipts for this account.');
      } else {
        setImageError(err.response?.data?.detail || err.message || 'Failed to load receipt proof.');
      }
    } finally {
      setImageLoading(false);
    }
  }, [accountId, transaction, isOpen, cleanupBlob]);

  // Load/reload receipt whenever modal opens or active transaction changes
  useEffect(() => {
    if (isOpen && transaction) {
      loadReceiptImage();
    } else {
      cleanupBlob();
      setImageBlobUrl(null);
      setImageError(null);
      setError(null);
    }

    return () => {
      cleanupBlob();
    };
  }, [isOpen, transaction, loadReceiptImage, cleanupBlob]);

  if (!transaction) return null;

  const handleOpenFullImage = () => {
    try {
      // 1. If backend uploaded file exists, open direct authenticated URL with JWT token
      if (transaction.receipt_image_url || accountId) {
        const directUrl = moneyAccountService.getReceiptDirectUrl(accountId, transaction.id);
        if (directUrl) {
          window.open(directUrl, '_blank', 'noopener,noreferrer');
          return;
        }
      }

      // 2. If external HTTP/HTTPS URL
      if (
        transaction.receipt_url &&
        (transaction.receipt_url.startsWith('http://') || transaction.receipt_url.startsWith('https://'))
      ) {
        window.open(transaction.receipt_url, '_blank', 'noopener,noreferrer');
        return;
      }

      // 3. Fallback to loaded in-memory Blob URL
      if (imageBlobUrl) {
        window.open(imageBlobUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      setError('No valid receipt URL available to open.');
    } catch (err) {
      setError('Unable to open image in new tab.');
    }
  };

  const handleFileReplace = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('File size exceeds maximum allowed limit of 5 MB.');
      return;
    }

    const validExts = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validExts.includes(file.type.toLowerCase())) {
      setError('Unsupported file type. Please upload JPG, PNG, or WEBP images.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const updatedTx = await moneyAccountService.replaceReceipt(accountId, transaction.id, file);
      if (onReceiptUpdated) {
        onReceiptUpdated(updatedTx);
      }
      onClose();
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to replace receipt.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveReceipt = async () => {
    if (!window.confirm('Are you sure you want to remove this receipt? The transaction amount will remain unchanged.')) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const updatedTx = await moneyAccountService.removeReceipt(accountId, transaction.id);
      if (onReceiptUpdated) {
        onReceiptUpdated(updatedTx);
      }
      onClose();
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to remove receipt.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Receipt / Proof Document" maxWidth="max-w-xl">
      <div className="space-y-4">
        {error && (
          <div className="p-3 text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-lg">
            {error}
          </div>
        )}

        {/* Transaction Header Summary */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs space-y-1">
          <div className="flex justify-between items-center">
            <span className="font-bold text-slate-800 dark:text-slate-200">{transaction.description}</span>
            <span
              className={`font-extrabold text-sm ${getTransactionAmountColor(
                transaction,
                'text-slate-900 dark:text-white'
              )}`}
            >
              {transaction.transaction_type === 'DEPOSIT'
                ? '+'
                : transaction.transaction_type === 'EXPENSE' || transaction.transaction_type === 'REFUND'
                ? '-'
                : ''}
              {formatCurrency(Math.abs(Number(transaction.amount)))}
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            Date: {formatDate(transaction.date)} | Type: {transaction.transaction_type}
          </p>
        </div>

        {/* Receipt Image Display Area */}
        <div className="relative border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center min-h-[260px] max-h-[460px]">
          {imageLoading ? (
            <div className="flex flex-col items-center justify-center p-8 space-y-3">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              <span className="text-xs font-medium text-slate-400">Loading receipt preview...</span>
            </div>
          ) : imageError ? (
            <div className="p-8 text-center space-y-3 max-w-sm mx-auto">
              <div className="w-10 h-10 mx-auto rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <p className="text-xs text-rose-300 font-medium">{imageError}</p>
              <button
                type="button"
                onClick={loadReceiptImage}
                className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer underline underline-offset-2"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Try Again
              </button>
            </div>
          ) : imageBlobUrl ? (
            <img
              src={imageBlobUrl}
              alt="Receipt proof document"
              className="w-full h-full object-contain max-h-[460px]"
              onError={() => setImageError('Receipt image failed to render. File format may be unsupported.')}
            />
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              No receipt image attached to this transaction.
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          {hasReceipt && !imageError && (
            <button
              type="button"
              onClick={handleOpenFullImage}
              disabled={imageLoading}
              className="inline-flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 cursor-pointer transition-colors disabled:opacity-50"
            >
              <ExternalLink className="w-4 h-4 mr-1.5" />
              Open Full Image
            </button>
          )}

          <div className="flex items-center space-x-2 ml-auto">
            {isManager && !transaction.is_voided && (
              <>
                <label className="cursor-pointer">
                  <span className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    Replace Receipt
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    onChange={handleFileReplace}
                    className="hidden"
                    disabled={loading}
                  />
                </label>

                {hasReceipt && (
                  <Button variant="danger" size="sm" onClick={handleRemoveReceipt} loading={loading}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Remove
                  </Button>
                )}
              </>
            )}

            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ReceiptModal;

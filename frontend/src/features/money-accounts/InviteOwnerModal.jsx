import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import moneyAccountService from '../../services/moneyAccount.service';
import { Mail, AlertCircle, X } from 'lucide-react';

export const InviteOwnerModal = ({ isOpen, onClose, account, onInviteSent }) => {
  const [modalStep, setModalStep] = useState('FORM'); // 'FORM' | 'SUCCESS'
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [invitationToken, setInvitationToken] = useState(null);
  const [sentEmail, setSentEmail] = useState('');

  const shouldReduceMotion = useReducedMotion();

  // Reset or initialize state when modal opens
  useEffect(() => {
    if (isOpen) {
      if (modalStep !== 'SUCCESS') {
        setEmail(account?.owner_email || '');
        setEmailError(null);
        setError(null);
        setLoading(false);
      }
    } else {
      setModalStep('FORM');
      setEmail('');
      setEmailError(null);
      setError(null);
      setLoading(false);
      setInvitationToken(null);
      setSentEmail('');
    }
  }, [isOpen]);

  // Clean close handler
  const handleClose = useCallback(() => {
    const wasInviteSent = modalStep === 'SUCCESS' && Boolean(invitationToken);
    setModalStep('FORM');
    setInvitationToken(null);
    setSentEmail('');
    setError(null);
    setEmailError(null);
    setLoading(false);
    if (onClose) {
      onClose(wasInviteSent);
    }
  }, [modalStep, invitationToken, onClose]);

  // Handle Escape key navigation and body scroll locking
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleClose]);

  if (!account) return null;

  const handleSendInvite = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (loading) return;

    setError(null);
    setEmailError(null);

    // 1. Frontend email format validation
    const trimmedEmail = (email || '').trim();
    if (!trimmedEmail) {
      setEmailError('Please enter a recipient email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      // 2. Send email to backend for registered user check & invitation generation
      const data = await moneyAccountService.inviteOwner(account.id, {
        email: trimmedEmail,
      });

      // 3. Successful generation -> transition modal to simplified animated success view
      const token = data?.token;
      const confirmedEmail = data?.recipient_email || trimmedEmail;

      setInvitationToken(token);
      setSentEmail(confirmedEmail);
      setModalStep('SUCCESS');

      // Trigger callback without unmounting or resetting modal
      if (onInviteSent) {
        try {
          onInviteSent(data);
        } catch (callbackErr) {
          console.error('onInviteSent callback error:', callbackErr);
        }
      }
    } catch (err) {
      // 4. If email is unregistered or request fails, keep input modal open and show error
      const errorData = err.response?.data;
      const errorErrors = errorData?.errors;

      let msg =
        errorErrors?.detail ||
        errorErrors?.email ||
        (Array.isArray(errorErrors?.email) ? errorErrors.email[0] : null) ||
        errorData?.detail ||
        errorData?.email ||
        err.message ||
        'Unable to send invitation.';

      if (Array.isArray(msg) && msg.length > 0) {
        msg = msg[0];
      }

      setError(msg);
      setEmailError(msg);
      setModalStep('FORM');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            key="invite-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm cursor-pointer"
            aria-hidden="true"
          />

          {/* Dialog Container */}
          <div className="flex min-h-full items-center justify-center p-4 text-center pointer-events-none">
            <AnimatePresence mode="wait">
              {modalStep === 'FORM' ? (
                /* 1. Primary Invitation Form View */
                <motion.div
                  key="invite-form-dialog"
                  initial={
                    shouldReduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, scale: 0.95, y: 10 }
                  }
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{
                    duration: 0.22,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="invite-form-title"
                  className="pointer-events-auto relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-3xl p-6 sm:p-7 shadow-2xl text-left overflow-hidden z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Form Header */}
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
                    <h3
                      id="invite-form-title"
                      className="text-base sm:text-lg font-bold text-slate-900 dark:text-white"
                    >
                      Invite to {account.title || account.owner_name}
                    </h3>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      aria-label="Close dialog"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSendInvite} className="space-y-4">
                    {/* Error Notification Banner */}
                    {error && (
                      <div className="p-3 text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl space-y-1">
                        <div className="flex items-center font-bold text-rose-800 dark:text-rose-200 gap-1.5">
                          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                          <span>Unable to send invitation</span>
                        </div>
                        <p className="pl-5 text-rose-700 dark:text-rose-300">{error}</p>
                      </div>
                    )}

                    {/* Context Info Card */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs space-y-1 text-slate-700 dark:text-slate-300">
                      <p>
                        <span className="font-semibold text-slate-900 dark:text-white">Account:</span>{' '}
                        {account.title} ({account.currency})
                      </p>
                      <p>
                        <span className="font-semibold text-slate-900 dark:text-white">Account Status:</span>{' '}
                        <span className="font-mono uppercase">{account.status}</span>
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 pt-1 leading-relaxed">
                        Enter the email address of the registered MoneyFlow user you want to invite. When they accept, they will gain read-only visibility into this ledger.
                      </p>
                    </div>

                    {/* Recipient Email Input */}
                    <div>
                      <Input
                        label="Recipient Email Address"
                        type="email"
                        id="invite-recipient-email"
                        icon={Mail}
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (emailError) setEmailError(null);
                          if (error) setError(null);
                        }}
                        error={emailError}
                        placeholder="e.g. friend@example.com"
                        disabled={loading}
                        helperText="Must be an existing registered user on MoneyFlow."
                      />
                    </div>

                    {/* Modal Actions */}
                    <div className="flex justify-end space-x-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <Button
                        variant="secondary"
                        onClick={handleClose}
                        disabled={loading}
                        type="button"
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        type="submit"
                        loading={loading}
                        disabled={loading || !email.trim()}
                      >
                        Generate Secure Invitation
                      </Button>
                    </div>
                  </form>
                </motion.div>
              ) : (
                /* 2. Simplified Animated Invitation Success Popup */
                <motion.div
                  key="invite-success-dialog"
                  initial={
                    shouldReduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, scale: 0.92, y: 12 }
                  }
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{
                    duration: 0.28,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="success-popup-heading"
                  className="pointer-events-auto relative w-full max-w-sm sm:max-w-md bg-slate-900 border border-slate-800/90 text-white rounded-3xl p-6 sm:p-7 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden text-center z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Top Close 'X' Button */}
                  <button
                    type="button"
                    onClick={handleClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    aria-label="Close success popup"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  {/* Animated Circular Green Icon */}
                  <motion.div
                    initial={
                      shouldReduceMotion
                        ? { opacity: 1, scale: 1 }
                        : { scale: 0.5, opacity: 0 }
                    }
                    animate={{ scale: 1, opacity: 1 }}
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 360, damping: 22, delay: 0.08 }
                    }
                    className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/35 flex items-center justify-center mx-auto text-emerald-400 shadow-[0_0_28px_rgba(16,185,129,0.22)]"
                  >
                    {/* Self-Drawing SVG Animated Checkmark */}
                    <svg
                      className="w-10 h-10 text-emerald-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <motion.path
                        d="M5 13l4 4L19 7"
                        initial={shouldReduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={
                          shouldReduceMotion
                            ? { duration: 0 }
                            : { duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.22 }
                        }
                      />
                    </svg>
                  </motion.div>

                  {/* Heading & Description Entrance */}
                  <motion.div
                    initial={
                      shouldReduceMotion
                        ? { opacity: 1, y: 0 }
                        : { opacity: 0, y: 8 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { delay: 0.28, duration: 0.28, ease: 'easeOut' }
                    }
                    className="space-y-2 mt-5 mb-7"
                  >
                    <h3
                      id="success-popup-heading"
                      className="text-xl font-bold text-white tracking-tight"
                    >
                      Invitation Sent Successfully!
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed max-w-xs mx-auto">
                      Your invitation has been sent successfully.
                    </p>
                  </motion.div>

                  {/* Prominent Green Done Button */}
                  <motion.div
                    initial={
                      shouldReduceMotion
                        ? { opacity: 1, y: 0 }
                        : { opacity: 0, y: 6 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { delay: 0.36, duration: 0.24, ease: 'easeOut' }
                    }
                  >
                    <button
                      type="button"
                      onClick={handleClose}
                      className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-lg shadow-emerald-900/30 transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                    >
                      Done
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default InviteOwnerModal;

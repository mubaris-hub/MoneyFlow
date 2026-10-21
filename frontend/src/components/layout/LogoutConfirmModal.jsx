import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, X } from 'lucide-react';
import Button from '../ui/Button';
import { modalBackdropVariants, modalDialogVariants } from '../../utils/animations';

export const LogoutConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}) => {
  const cancelButtonRef = useRef(null);
  const modalRef = useRef(null);

  // Keyboard navigation & accessibility (Escape key and focus management)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isLoading) {
        e.preventDefault();
        onClose();
        return;
      }

      // Simple focus trap within dialog
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length > 0) {
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];

          if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Initial safe focus on the Cancel button
    const focusTimer = setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 40);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(focusTimer);
    };
  }, [isOpen, onClose, isLoading]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="logout-modal-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 overflow-y-auto"
        >
          {/* Semi-transparent Backdrop Overlay */}
          <motion.div
            variants={modalBackdropVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={isLoading ? undefined : onClose}
            aria-hidden="true"
          />

          {/* Centering Dialog Container */}
          <div className="flex min-h-full items-center justify-center p-4 text-center pointer-events-none">
            <motion.div
              ref={modalRef}
              variants={modalDialogVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              role="dialog"
              aria-modal="true"
              aria-labelledby="logout-dialog-title"
              aria-describedby="logout-dialog-description"
              className="pointer-events-auto w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 p-6 text-left align-middle shadow-2xl border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header with Logout Icon, Title, and Close Button */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40 flex items-center justify-center shrink-0 shadow-xs">
                    <LogOut className="w-5 h-5" />
                  </div>
                  <div>
                    <h3
                      id="logout-dialog-title"
                      className="text-lg font-bold text-slate-900 dark:text-white tracking-tight"
                    >
                      Confirm Logout
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Sign out of your active session
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                  aria-label="Close dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Message Body */}
              <div className="py-5">
                <p
                  id="logout-dialog-description"
                  className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal"
                >
                  Are you sure you want to log out of your MoneyFlow account?
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  ref={cancelButtonRef}
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={onClose}
                  disabled={isLoading}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  onClick={onConfirm}
                  isLoading={isLoading}
                  disabled={isLoading}
                  className="w-full sm:w-auto shadow-sm"
                >
                  Yes, Log Out
                </Button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LogoutConfirmModal;



import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { getInitials } from '../../utils/formatters';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  ArrowRightLeft,
  Users,
  Receipt,
  HandCoins,
  BarChart3,
  Settings,
  LogOut,
  Wallet,
  BookOpen,
  ChevronDown
} from 'lucide-react';
import LogoutConfirmModal from './LogoutConfirmModal';

export const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isGroupsOrSettlementsActive =
    location.pathname.startsWith('/groups') || location.pathname.startsWith('/settlements');

  const [isGroupsExpanded, setIsGroupsExpanded] = useState(() => isGroupsOrSettlementsActive);

  // Auto-expand if user navigates to /groups, /groups/:id, or /settlements directly or via external link
  useEffect(() => {
    if (isGroupsOrSettlementsActive) {
      setIsGroupsExpanded(true);
    }
  }, [isGroupsOrSettlementsActive]);

  const handleConfirmLogout = async () => {
    if (isLoggingOut) return;
    try {
      setIsLoggingOut(true);
      await logout();
      setIsLogoutModalOpen(false);
      if (onClose) onClose();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const primaryNavItems = [
    { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Personal Expenses', path: '/personal-expenses', icon: Wallet },
  ];

  const secondaryNavItems = [
    { name: 'Expenses', path: '/expenses', icon: Receipt },
    { name: 'Friend Ledgers', path: '/money-accounts', icon: BookOpen },
    { name: 'Transactions', path: '/transactions', icon: ArrowRightLeft },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const renderNavLink = (item) => {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.name}
        to={item.path}
        onClick={onClose}
        className={({ isActive }) =>
          `relative flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            isActive
              ? 'text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
          }`
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <motion.div
                layoutId="sidebarActivePill"
                className="absolute inset-0 bg-emerald-600 rounded-lg shadow-xs"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <div className="relative z-10 flex items-center space-x-3">
              <Icon className="w-4 h-4" />
              <span>{item.name}</span>
            </div>
          </>
        )}
      </NavLink>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs md:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col transition-all duration-200 ease-out md:translate-x-0 md:static ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="px-6 py-5 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/20">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">MoneyFlow</h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Know where your money goes.</p>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 px-4 py-6 overflow-y-auto space-y-1">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Main Menu</p>

          {/* Primary: Overview */}
          {primaryNavItems.map(renderNavLink)}

          {/* Expandable Parent Menu: Groups & Settlements */}
          <div className="space-y-1 pt-0.5">
            <button
              type="button"
              onClick={() => setIsGroupsExpanded((prev) => !prev)}
              aria-expanded={isGroupsExpanded}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                isGroupsOrSettlementsActive
                  ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Users
                  className={`w-4 h-4 ${
                    isGroupsOrSettlementsActive
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                />
                <span>Groups & Settlements</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  isGroupsExpanded
                    ? 'rotate-180 text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              />
            </button>

            {/* Child Submenu */}
            <AnimatePresence initial={false}>
              {isGroupsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden pl-3 pr-1 py-1 space-y-1 relative"
                >
                  <div className="absolute left-6 top-1 bottom-1 w-px bg-slate-200/70 dark:bg-slate-800" />

                  {/* Child 1: Groups */}
                  <NavLink
                    to="/groups"
                    onClick={onClose}
                    className={({ isActive }) => {
                      const isGroupsActive =
                        (isActive || location.pathname.startsWith('/groups')) &&
                        !location.pathname.startsWith('/settlements');
                      return `relative flex items-center justify-between pl-7 pr-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isGroupsActive
                          ? 'text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                      }`;
                    }}
                  >
                    {({ isActive }) => {
                      const isGroupsActive =
                        (isActive || location.pathname.startsWith('/groups')) &&
                        !location.pathname.startsWith('/settlements');
                      return (
                        <>
                          {isGroupsActive && (
                            <motion.div
                              layoutId="sidebarSubActivePill"
                              className="absolute inset-0 bg-emerald-600 rounded-lg shadow-xs"
                              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                            />
                          )}
                          <div className="relative z-10 flex items-center space-x-2.5">
                            <Users className="w-3.5 h-3.5" />
                            <span>Groups</span>
                          </div>
                        </>
                      );
                    }}
                  </NavLink>

                  {/* Child 2: Settlements */}
                  <NavLink
                    to="/settlements"
                    onClick={onClose}
                    className={({ isActive }) => {
                      const isSettlementsActive =
                        isActive || location.pathname.startsWith('/settlements');
                      return `relative flex items-center justify-between pl-7 pr-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isSettlementsActive
                          ? 'text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                      }`;
                    }}
                  >
                    {({ isActive }) => {
                      const isSettlementsActive =
                        isActive || location.pathname.startsWith('/settlements');
                      return (
                        <>
                          {isSettlementsActive && (
                            <motion.div
                              layoutId="sidebarSubActivePill"
                              className="absolute inset-0 bg-emerald-600 rounded-lg shadow-xs"
                              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                            />
                          )}
                          <div className="relative z-10 flex items-center space-x-2.5">
                            <HandCoins className="w-3.5 h-3.5" />
                            <span>Settlements</span>
                          </div>
                        </>
                      );
                    }}
                  </NavLink>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Secondary Items: Expenses, Friend Ledgers, Transactions, Reports, Settings */}
          {secondaryNavItems.map(renderNavLink)}
        </div>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                {getInitials(user?.first_name, user?.last_name)}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setIsLogoutModalOpen(true)}
              className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
              title="Logout"
              aria-label="Log out"
            >
              <LogOut className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </aside>

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => {
          if (!isLoggingOut) setIsLogoutModalOpen(false);
        }}
        onConfirm={handleConfirmLogout}
        isLoading={isLoggingOut}
      />
    </>
  );
};

export default Sidebar;

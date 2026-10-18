import React from 'react';
import useAuth from '../../hooks/useAuth';
import { getInitials } from '../../utils/formatters';
import { Search, Bell, Menu } from 'lucide-react';

import NotificationDropdown from '../notifications/NotificationDropdown';

export const Header = ({ onMenuClick }) => {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 py-3.5 flex items-center justify-between transition-colors duration-150">
      <div className="flex items-center space-x-3">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Overview</h2>
        </div>
      </div>

      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Search Bar Placeholder */}
        <div className="relative hidden sm:block w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search transactions, friends..."
            disabled
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-lg text-slate-400 dark:text-slate-500 cursor-not-allowed focus:outline-hidden"
          />
        </div>

        {/* Notifications Icon Component */}
        <NotificationDropdown />

        {/* User Avatar */}
        <div className="flex items-center space-x-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
            {getInitials(user?.first_name, user?.last_name)}
          </div>
          <span className="hidden lg:inline-block text-xs font-semibold text-slate-700 dark:text-slate-200">
            {user?.first_name}
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header;

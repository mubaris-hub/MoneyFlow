import React from 'react';
import useAuth from '../../hooks/useAuth';
import { getInitials } from '../../utils/formatters';
import { Search, Bell, Menu } from 'lucide-react';

export const Header = ({ onMenuClick }) => {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3.5 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Overview</h2>
        </div>
      </div>

      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Search Bar Placeholder */}
        <div className="relative hidden sm:block w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search transactions, friends..."
            disabled
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-100/80 border border-slate-200/80 rounded-lg text-slate-400 cursor-not-allowed focus:outline-none"
          />
        </div>

        {/* Notifications Icon */}
        <button
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg relative transition-colors"
          title="Notifications (Phase 2+)"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full" />
        </button>

        {/* User Avatar */}
        <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
            {getInitials(user?.first_name, user?.last_name)}
          </div>
          <span className="hidden lg:inline-block text-xs font-semibold text-slate-700">
            {user?.first_name}
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header;

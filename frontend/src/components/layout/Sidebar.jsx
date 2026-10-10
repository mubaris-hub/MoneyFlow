import React from 'react';
import { NavLink } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { getInitials } from '../../utils/formatters';
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
  BookOpen
} from 'lucide-react';

export const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();

  const navItems = [
    { name: 'Overview', path: '/dashboard', icon: LayoutDashboard, isReal: true },
    { name: 'Groups', path: '/groups', icon: Users, isReal: true },
    { name: 'Expenses', path: '/expenses', icon: Receipt, isReal: true },
    { name: 'Friend Ledgers', path: '/money-accounts', icon: BookOpen, isReal: true },
    { name: 'Transactions', path: '#', icon: ArrowRightLeft, isReal: false, badge: 'Soon' },
    { name: 'Settlements', path: '/groups', icon: HandCoins, isReal: true },
    { name: 'Reports', path: '/reports', icon: BarChart3, isReal: true },
    { name: 'Settings', path: '#', icon: Settings, isReal: false, badge: 'Soon' },
  ];


  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 md:static ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="px-6 py-5 border-b border-slate-800/80 flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/20">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">MoneyFlow</h1>
            <p className="text-[11px] text-slate-400 font-medium">Know where your money goes.</p>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 px-4 py-6 overflow-y-auto space-y-1">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Main Menu</p>
          {navItems.map((item) => {
            const Icon = item.icon;

            return item.isReal ? (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`
                }
              >
                <div className="flex items-center space-x-3">
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </div>
              </NavLink>
            ) : (
              <div
                key={item.name}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-500 cursor-not-allowed hover:bg-slate-800/30"
                title="Available in Phase 3+"
              >
                <div className="flex items-center space-x-3">
                  <Icon className="w-4 h-4 text-slate-500" />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-semibold">
                    {item.badge}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                {getInitials(user?.first_name, user?.last_name)}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

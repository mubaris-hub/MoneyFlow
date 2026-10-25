import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  Home,
  Wallet,
  BookOpen,
  ArrowLeftRight,
  Settings,
} from 'lucide-react';

const NAV_ITEMS = [
  {
    name: 'Home',
    to: '/dashboard',
    icon: Home,
    isActive: (pathname) => pathname === '/dashboard' || pathname === '/',
  },
  {
    name: 'Personal',
    to: '/personal-expenses',
    icon: Wallet,
    isActive: (pathname) => pathname.startsWith('/personal-expenses'),
  },
  {
    name: 'Friend Ledger',
    to: '/money-accounts',
    icon: BookOpen,
    isActive: (pathname) => pathname.startsWith('/money-accounts'),
  },
  {
    name: 'Transactions',
    to: '/transactions',
    icon: ArrowLeftRight,
    isActive: (pathname) => pathname.startsWith('/transactions'),
  },
  {
    name: 'Settings',
    to: '/settings',
    icon: Settings,
    isActive: (pathname) => pathname.startsWith('/settings'),
  },
];

export const MobileBottomNav = () => {
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 mx-auto z-30 md:hidden w-[calc(100%-2rem)] max-w-[360px] sm:max-w-[400px] p-1.5 rounded-[26px] bg-white/75 dark:bg-slate-900/70 supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-[#0f172a]/70 border border-slate-200/80 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.3)] transition-colors duration-150 select-none"
      style={{
        bottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        backdropFilter: 'blur(20px) saturate(160%)',
      }}
    >
      <div className="grid grid-cols-5 items-center justify-items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.isActive(location.pathname);

          return (
            <Link
              key={item.name}
              to={item.to}
              aria-label={item.name}
              title={item.name}
              aria-current={active ? 'page' : undefined}
              className="relative flex items-center justify-center w-full h-11 sm:h-12 rounded-[20px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 group"
            >
              {active && (
                <motion.div
                  layoutId="floatingNavActivePill"
                  className="absolute inset-0 rounded-[20px] bg-emerald-500/15 dark:bg-emerald-400/20 border border-emerald-500/30 dark:border-emerald-400/30 shadow-[0_0_12px_rgba(16,185,129,0.2)] dark:shadow-[0_0_16px_rgba(16,185,129,0.25)]"
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : {
                          duration: 0.26,
                          ease: [0.22, 1, 0.36, 1],
                        }
                  }
                />
              )}

              <Icon
                className={`w-5 h-5 relative z-10 transition-all duration-200 ${
                  active
                    ? 'text-emerald-600 dark:text-emerald-400 scale-105'
                    : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-200 group-hover:scale-105'
                }`}
                strokeWidth={active ? 2.25 : 1.85}
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;

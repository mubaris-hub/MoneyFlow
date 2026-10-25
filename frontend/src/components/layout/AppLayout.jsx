import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileBottomNav from './MobileBottomNav';
import ErrorBoundary from '../common/ErrorBoundary';
import { flowingPageVariants } from '../../utils/animations';

const SECTION_ROUTES = [
  (path) => path === '/' || path.startsWith('/dashboard'),
  (path) => path.startsWith('/personal-expenses'),
  (path) => path.startsWith('/money-accounts') || path.startsWith('/groups') || path.startsWith('/settlements'),
  (path) => path.startsWith('/transactions'),
  (path) => path.startsWith('/settings'),
];

const getSectionIndex = (pathname) => {
  return SECTION_ROUTES.findIndex((matches) => matches(pathname));
};

export const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const mainRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  // Track navigation direction between the 5 primary destinations
  const prevPathRef = useRef(location.pathname);
  const prevIdx = getSectionIndex(prevPathRef.current);
  const currIdx = getSectionIndex(location.pathname);

  let direction = 0;
  if (prevIdx !== -1 && currIdx !== -1 && prevIdx !== currIdx) {
    direction = currIdx > prevIdx ? 1 : -1;
  }

  if (prevPathRef.current !== location.pathname) {
    prevPathRef.current = location.pathname;
  }

  // Automatically close mobile sidebar on any route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Ensure body scroll is never left locked if layout unmounts
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Scroll to top of main content container on navigation
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex transition-colors duration-150">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onMenuClick={() => setSidebarOpen((prev) => !prev)}
          isMenuOpen={sidebarOpen}
        />
        <main ref={mainRef} className="flex-1 p-4 sm:p-6 lg:p-8 pb-[calc(6.25rem+env(safe-area-inset-bottom,0px))] md:pb-8 overflow-y-auto overflow-x-hidden">
          <div className="max-w-7xl mx-auto">
            {/* Immediate mount with subtle flowing horizontal transition */}
            <motion.div
              key={location.pathname}
              custom={direction}
              variants={shouldReduceMotion ? undefined : flowingPageVariants}
              initial={shouldReduceMotion ? { opacity: 0 } : 'initial'}
              animate={shouldReduceMotion ? { opacity: 1, transition: { duration: 0.15 } } : 'animate'}
              className="space-y-6"
            >
              <ErrorBoundary>
                <Suspense
                  fallback={
                    <div className="space-y-6 animate-pulse">
                      <div className="h-8 w-48 bg-slate-200/80 dark:bg-slate-800/80 rounded-lg" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="h-28 rounded-xl bg-slate-100 dark:bg-slate-800/40" />
                        ))}
                      </div>
                      <div className="h-64 rounded-xl bg-slate-100 dark:bg-slate-800/30" />
                    </div>
                  }
                >
                  <Outlet />
                </Suspense>
              </ErrorBoundary>
            </motion.div>
          </div>
        </main>
      </div>

      {/* Persistent Mobile Bottom Navigation Bar (md:hidden) */}
      <MobileBottomNav />
    </div>
  );
};

export default AppLayout;

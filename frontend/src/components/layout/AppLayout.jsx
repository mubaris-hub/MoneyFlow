import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import Sidebar from './Sidebar';
import Header from './Header';
import ErrorBoundary from '../common/ErrorBoundary';
import { pageTransitionVariants } from '../../utils/animations';

export const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const mainRef = useRef(null);

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
        <main ref={mainRef} className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* Immediate mount with subtle entrance animation */}
            <motion.div
              key={location.pathname}
              variants={pageTransitionVariants}
              initial="initial"
              animate="animate"
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
    </div>
  );
};

export default AppLayout;

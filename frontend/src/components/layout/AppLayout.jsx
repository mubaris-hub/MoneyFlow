import React, { useState, useRef, useEffect } from 'react';
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
        <Header onMenuClick={() => setSidebarOpen(true)} />
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
                <Outlet />
              </ErrorBoundary>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;

import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import AppLayout from './components/layout/AppLayout';

// Code-split pages for high-performance initial loading
const LoginPage = lazy(() => import('./features/auth/LoginPage'));
const RegisterPage = lazy(() => import('./features/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./features/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./features/auth/ResetPasswordPage'));
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'));
const GroupListPage = lazy(() => import('./features/groups/GroupListPage'));
const GroupDetailPage = lazy(() => import('./features/groups/GroupDetailPage'));
const ExpenseListPage = lazy(() => import('./features/expenses/ExpenseListPage'));
const PersonalExpensesPage = lazy(() => import('./features/personal-expenses/PersonalExpensesPage'));
const MoneyAccountsListPage = lazy(() => import('./features/money-accounts/MoneyAccountsListPage'));
const MoneyAccountDetailPage = lazy(() => import('./features/money-accounts/MoneyAccountDetailPage'));
const InvitationRespondPage = lazy(() => import('./features/money-accounts/InvitationRespondPage'));
const ReportsPage = lazy(() => import('./features/reports/ReportsPage'));
const TransactionsPage = lazy(() => import('./features/transactions/TransactionsPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const SettlementsPage = lazy(() => import('./features/settlements/SettlementsPage'));

// Sleek, layout-stable page fallback
const PageFallback = () => (
  <div className="space-y-6 animate-in fade-in duration-100">
    <div className="flex items-center justify-between pb-2">
      <div className="space-y-2">
        <div className="h-6 w-48 bg-slate-200/80 dark:bg-slate-800/80 rounded-lg animate-pulse" />
        <div className="h-3.5 w-64 bg-slate-100 dark:bg-slate-800/50 rounded animate-pulse" />
      </div>
      <div className="h-9 w-24 bg-slate-200/80 dark:bg-slate-800/80 rounded-lg animate-pulse" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-28 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 animate-pulse"
        />
      ))}
    </div>
    <div className="h-64 rounded-xl bg-slate-100 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-800 animate-pulse" />
  </div>
);

export const App = () => {
  return (
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <Router>
          <AuthProvider>
            <ToastProvider>
              <ErrorBoundary>
                <Suspense fallback={<PageFallback />}>
                  <Routes>
                  {/* Public Authentication Routes */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />

                  {/* Protected Application Routes */}
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <AppLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="groups" element={<GroupListPage />} />
                    <Route path="groups/:groupId" element={<GroupDetailPage />} />
                    <Route path="settlements" element={<SettlementsPage />} />
                    <Route path="personal-expenses" element={<PersonalExpensesPage />} />
                    <Route path="expenses" element={<ExpenseListPage />} />
                    <Route path="money-accounts" element={<MoneyAccountsListPage />} />
                    <Route path="money-accounts/:id" element={<MoneyAccountDetailPage />} />
                    <Route path="money-accounts/invitation" element={<InvitationRespondPage />} />
                    <Route path="transactions" element={<TransactionsPage />} />
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                  </Route>

                  {/* Fallback Catch-all Route */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </ToastProvider>
          </AuthProvider>
        </Router>
      </MotionConfig>
    </ThemeProvider>
  );
};

export default App;

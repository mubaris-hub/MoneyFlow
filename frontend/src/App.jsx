import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './features/auth/LoginPage';
import RegisterPage from './features/auth/RegisterPage';
import ForgotPasswordPage from './features/auth/ForgotPasswordPage';
import ResetPasswordPage from './features/auth/ResetPasswordPage';
import DashboardPage from './features/dashboard/DashboardPage';
import GroupListPage from './features/groups/GroupListPage';
import GroupDetailPage from './features/groups/GroupDetailPage';
import ExpenseListPage from './features/expenses/ExpenseListPage';
import MoneyAccountsListPage from './features/money-accounts/MoneyAccountsListPage';
import MoneyAccountDetailPage from './features/money-accounts/MoneyAccountDetailPage';
import InvitationRespondPage from './features/money-accounts/InvitationRespondPage';
import ReportsPage from './features/reports/ReportsPage';
import TransactionsPage from './features/transactions/TransactionsPage';
import SettingsPage from './features/settings/SettingsPage';
import SettlementsPage from './features/settlements/SettlementsPage';

export const App = () => {
  return (
    <ThemeProvider>
      <Router>
        <AuthProvider>
          <ToastProvider>
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
          </ToastProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
);
};

export default App;

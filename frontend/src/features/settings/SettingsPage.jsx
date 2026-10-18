import React, { useState, useEffect } from 'react';
import useAuth from '../../hooks/useAuth';
import useTheme from '../../hooks/useTheme';
import authService from '../../services/auth.service';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { getInitials, formatDate } from '../../utils/formatters';
import {
  User,
  Shield,
  Sliders,
  Bell,
  UserCheck,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Trash2,
  Copy,
  Check,
  Clock,
  Mail,
  Coins,
  Calendar,
  Lock,
  Save,
  AlertTriangle,
  Sun,
  Moon,
  Monitor,
  Palette
} from 'lucide-react';

export const SettingsPage = () => {
  const { user, updateUser, logout } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState('profile');

  // Feedback Messages
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Profile Form State
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [username, setUsername] = useState(user?.username || '');

  // Security Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Preferences Form State
  const [defaultCurrency, setDefaultCurrency] = useState(user?.default_currency || 'INR');
  const [dateFormat, setDateFormat] = useState(user?.date_format || 'YYYY-MM-DD');

  // Notifications Form State
  const [notifyInApp, setNotifyInApp] = useState(user?.notify_in_app ?? true);
  const [notifyEmail, setNotifyEmail] = useState(user?.notify_email ?? true);
  const [notifyOnExpenses, setNotifyOnExpenses] = useState(user?.notify_on_expenses ?? true);
  const [notifyOnSettlements, setNotifyOnSettlements] = useState(user?.notify_on_settlements ?? true);
  const [notifyOnFriendLedgers, setNotifyOnFriendLedgers] = useState(user?.notify_on_friend_ledgers ?? true);

  // Account Info & Deactivation State
  const [copiedId, setCopiedId] = useState(false);
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [deactivatePassword, setDeactivatePassword] = useState('');
  const [deactivateConfirmText, setDeactivateConfirmText] = useState('');
  const [deactivateError, setDeactivateError] = useState('');

  // Sync state when user object loads or updates
  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setUsername(user.username || '');
      setDefaultCurrency(user.default_currency || 'INR');
      setDateFormat(user.date_format || 'YYYY-MM-DD');
      setNotifyInApp(user.notify_in_app ?? true);
      setNotifyEmail(user.notify_email ?? true);
      setNotifyOnExpenses(user.notify_on_expenses ?? true);
      setNotifyOnSettlements(user.notify_on_settlements ?? true);
      setNotifyOnFriendLedgers(user.notify_on_friend_ledgers ?? true);
    }
  }, [user]);

  // Clear messages on tab change
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSuccessMsg('');
    setErrorMsg('');
    setFieldErrors({});
  };

  const copyUserId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  // Helper to extract errors from API
  const handleApiError = (err, defaultMessage) => {
    const data = err.response?.data;
    if (data && typeof data === 'object') {
      const fieldErr = {};
      Object.keys(data).forEach((key) => {
        const val = data[key];
        fieldErr[key] = Array.isArray(val) ? val[0] : val;
      });
      setFieldErrors(fieldErr);
      const firstVal = Object.values(fieldErr)[0];
      setErrorMsg(typeof firstVal === 'string' ? firstVal : defaultMessage);
    } else {
      setErrorMsg(defaultMessage);
    }
  };

  // 1. Save Profile
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg('');
    setErrorMsg('');
    setFieldErrors({});

    try {
      const res = await authService.updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: username.trim(),
      });
      if (res.user) {
        updateUser(res.user);
      }
      setSuccessMsg('Profile updated successfully!');
    } catch (err) {
      handleApiError(err, 'Failed to update profile. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg('');
    setErrorMsg('');
    setFieldErrors({});

    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match.');
      setFieldErrors({ confirm_password: 'Passwords do not match.' });
      setSubmitting(false);
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg('New password must be at least 8 characters long.');
      setFieldErrors({ new_password: 'Password must be at least 8 characters long.' });
      setSubmitting(false);
      return;
    }

    try {
      await authService.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setSuccessMsg('Password changed successfully! Keep your new credentials secure.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      handleApiError(err, 'Failed to change password. Please verify your current password.');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Save Preferences
  const handleSavePreferences = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg('');
    setErrorMsg('');
    setFieldErrors({});

    try {
      const res = await authService.updateProfile({
        default_currency: defaultCurrency,
        date_format: dateFormat,
      });
      if (res.user) {
        updateUser(res.user);
      }
      setSuccessMsg('Application preferences saved successfully!');
    } catch (err) {
      handleApiError(err, 'Failed to save preferences.');
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Save Notifications
  const handleSaveNotifications = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg('');
    setErrorMsg('');
    setFieldErrors({});

    try {
      const res = await authService.updateProfile({
        notify_in_app: notifyInApp,
        notify_email: notifyEmail,
        notify_on_expenses: notifyOnExpenses,
        notify_on_settlements: notifyOnSettlements,
        notify_on_friend_ledgers: notifyOnFriendLedgers,
      });
      if (res.user) {
        updateUser(res.user);
      }
      setSuccessMsg('Notification preferences updated successfully!');
    } catch (err) {
      handleApiError(err, 'Failed to update notification preferences.');
    } finally {
      setSubmitting(false);
    }
  };

  // 5. Deactivate Account
  const handleDeactivateAccount = async () => {
    if (deactivateConfirmText.trim().toUpperCase() !== 'DELETE') {
      setDeactivateError("Please type 'DELETE' to confirm deactivation.");
      return;
    }
    setSubmitting(true);
    setDeactivateError('');

    try {
      await authService.deactivateAccount({
        password: deactivatePassword,
        confirmation: 'DELETE',
      });
      logout();
    } catch (err) {
      const msg = err.response?.data?.password || err.response?.data?.detail || 'Incorrect password or deactivation failed.';
      setDeactivateError(Array.isArray(msg) ? msg[0] : msg);
      setSubmitting(false);
    }
  };

  const tabs = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'appearance', name: 'Appearance', icon: Palette },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'preferences', name: 'Preferences', icon: Sliders },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'account', name: 'Account', icon: UserCheck },
  ];

  const renderThemeSelector = () => {
    const themeOptions = [
      {
        id: 'light',
        label: 'Light',
        description: 'Clean and bright.',
        icon: Sun,
      },
      {
        id: 'dark',
        label: 'Dark',
        description: 'Easy on the eyes.',
        icon: Moon,
      },
      {
        id: 'system',
        label: 'System',
        description: 'Follow your device settings.',
        icon: Monitor,
      },
    ];

    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {themeOptions.map((opt) => {
          const isSelected = theme === opt.id;
          const Icon = opt.icon;
          return (
            <button
              type="button"
              key={opt.id}
              onClick={() => setTheme(opt.id)}
              className={`relative flex flex-col items-center text-center rounded-xl border p-5 transition-colors duration-150 cursor-pointer ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {/* Radio selection indicator positioned top-right */}
              <div className="absolute top-3.5 right-3.5">
                {isSelected ? (
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  </span>
                ) : (
                  <span className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-700 shrink-0" />
                )}
              </div>

              {/* Centered Theme Icon */}
              <div
                className={`p-3 rounded-xl border mb-3 transition-colors flex items-center justify-center ${
                  isSelected
                    ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-300/80 dark:border-emerald-700/80'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>

              {/* Centered Title & Description */}
              <div className="w-full">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {opt.label}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {opt.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
          <Sliders className="w-7 h-7 text-emerald-600 dark:text-emerald-400" /> Account Settings
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your personal profile, theme appearance, security credentials, preferences, and notifications.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-1 sm:space-x-4 overflow-x-auto pb-px">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 py-3 px-3.5 sm:px-4 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`} />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Global Alerts */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 flex items-center gap-3 animate-fade-in shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-sm font-medium">{successMsg}</p>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 flex items-center gap-3 animate-fade-in shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <p className="text-sm font-medium">{errorMsg}</p>
        </div>
      )}

      {/* TAB 1: PROFILE */}
      {activeTab === 'profile' && (
        <Card className="p-6 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xl shadow-xs border border-emerald-200 dark:border-emerald-800/80">
              {getInitials(user?.first_name, user?.last_name)}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{user?.first_name} {user?.last_name}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">@{user?.username}</p>
              <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                <Check className="w-3 h-3" /> Active User
              </span>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="mt-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">First Name</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
                {fieldErrors.first_name && (
                  <p className="text-xs text-rose-600 mt-1">{fieldErrors.first_name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
                {fieldErrors.last_name && (
                  <p className="text-xs text-rose-600 mt-1">{fieldErrors.last_name}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
              {fieldErrors.username && (
                <p className="text-xs text-rose-600 mt-1">{fieldErrors.username}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Registered Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                  <Mail className="w-3.5 h-3.5" /> Primary Email
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Your registered email address is used for authentication and password resets.</p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <Button type="submit" variant="primary" disabled={submitting} className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                {submitting ? 'Saving...' : 'Save Profile Changes'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* TAB 2: APPEARANCE */}
      {activeTab === 'appearance' && (
        <Card className="p-6 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Appearance</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Customize how MoneyFlow looks on your device.
              </p>
            </div>
          </div>

          <div>
            {renderThemeSelector()}
          </div>
        </Card>
      )}

      {/* TAB 3: SECURITY */}
      {activeTab === 'security' && (
        <Card className="p-6 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Change Password</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Update your account password with current-password verification.</p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 pr-10 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.current_password && (
                <p className="text-xs text-rose-600 mt-1">{fieldErrors.current_password}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 pr-10 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.new_password && (
                <p className="text-xs text-rose-600 mt-1">{fieldErrors.new_password}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 pr-10 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.confirm_password && (
                <p className="text-xs text-rose-600 mt-1">{fieldErrors.confirm_password}</p>
              )}
            </div>

            {/* Password Requirement Checklist */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1 text-xs text-slate-500 dark:text-slate-400">
              <p className="font-semibold text-slate-700 dark:text-slate-300">Security Guidelines:</p>
              <p className="flex items-center gap-1.5">
                <span className={newPassword.length >= 8 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}>•</span>
                Must be at least 8 characters long
              </p>
              <p className="flex items-center gap-1.5">
                <span className={newPassword && newPassword !== currentPassword ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}>•</span>
                Cannot be identical to your current password
              </p>
            </div>

            <div className="pt-2">
              <Button type="submit" variant="primary" disabled={submitting} className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                {submitting ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* TAB 4: PREFERENCES */}
      {activeTab === 'preferences' && (
        <div className="space-y-6">

          {/* Regional & Display Preferences Card */}
          <Card className="p-6 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Regional & Display Preferences</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Configure your default currency and date formatting.</p>
              </div>
            </div>

            <form onSubmit={handleSavePreferences} className="space-y-5 max-w-lg">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Default Currency</label>
                <select
                  value={defaultCurrency}
                  onChange={(e) => setDefaultCurrency(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="INR">INR — Indian Rupee (₹) [Default]</option>
                  <option value="USD">USD — US Dollar ($)</option>
                  <option value="EUR">EUR — Euro (€)</option>
                  <option value="GBP">GBP — British Pound (£)</option>
                  <option value="CAD">CAD — Canadian Dollar (CA$)</option>
                  <option value="AUD">AUD — Australian Dollar (A$)</option>
                  <option value="AED">AED — United Arab Emirates Dirham (AED)</option>
                  <option value="SGD">SGD — Singapore Dollar (S$)</option>
                </select>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Used as the default currency for new expenses, groups, and reports.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Date Display Format</label>
                <select
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-10-18) [Standard ISO]</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 18/10/2026)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 10/18/2026)</option>
                  <option value="DD-MMM-YYYY">DD-MMM-YYYY (e.g. 18-Oct-2026)</option>
                </select>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Controls how calendar dates are rendered in expense feeds and statements.</p>
              </div>

              <div className="pt-2">
                <Button type="submit" variant="primary" disabled={submitting} className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  {submitting ? 'Saving...' : 'Save Preferences'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* TAB 5: NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <Card className="p-6 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Notification Channels & Events</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Configure which notifications are delivered to your inbox and notification bell.</p>
            </div>
          </div>

          <form onSubmit={handleSaveNotifications} className="space-y-4 max-w-xl">
            {/* Delivery Channels */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Delivery Channels</h3>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">In-App Notifications</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Receive alerts in the MoneyFlow top header notification bell</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifyInApp}
                  onChange={(e) => setNotifyInApp(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Email Notifications</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Receive transactional emails and invitation links to {user?.email}</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>
            </div>

            {/* Notification Topics */}
            <div className="space-y-3 pt-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Activity Alerts</h3>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Group Expense Alerts</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Notify when someone logs or edits an expense in your groups</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifyOnExpenses}
                  onChange={(e) => setNotifyOnExpenses(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Settlements & Repayments</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Notify when settlements are requested, approved, or cancelled</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifyOnSettlements}
                  onChange={(e) => setNotifyOnSettlements(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Friend Ledgers</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Notify when deposits, expenses, or invitations occur in friend ledgers</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifyOnFriendLedgers}
                  onChange={(e) => setNotifyOnFriendLedgers(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" variant="primary" disabled={submitting} className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                {submitting ? 'Saving...' : 'Save Notification Preferences'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* TAB 6: ACCOUNT */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          {/* Account Metadata Card */}
          <Card className="p-6 border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> Account Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">User Identifier (UUID)</p>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <p className="font-mono text-xs text-slate-800 dark:text-slate-200 truncate">{user?.id}</p>
                  <button
                    onClick={copyUserId}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Copy UUID"
                  >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Member Since</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">{formatDate(user?.created_at)}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Active Session</p>
                <p className="font-semibold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Active on this browser
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Default Currency</p>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">{user?.default_currency || 'INR'}</p>
              </div>
            </div>

            {/* Logout Action */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">End Session</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Log out of your MoneyFlow account on this device.</p>
              </div>
              <Button variant="secondary" onClick={logout} className="gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30">
                <LogOut className="w-4 h-4" /> Log Out
              </Button>
            </div>
          </Card>

          {/* Danger Zone: Account Deactivation */}
          <Card className="p-6 border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20 shadow-xs space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">Danger Zone — Deactivate Account</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Deactivating your account disables your access to MoneyFlow. Your existing recorded transactions, group expense splits, and ledger audit records will be preserved for financial integrity.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsDeactivateModalOpen(true)}
                  className="mt-3 bg-white dark:bg-slate-900 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/40 gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Deactivate Account...
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Account Deactivation Modal */}
      <Modal
        isOpen={isDeactivateModalOpen}
        onClose={() => {
          setIsDeactivateModalOpen(false);
          setDeactivatePassword('');
          setDeactivateConfirmText('');
          setDeactivateError('');
        }}
        title="Confirm Account Deactivation"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 pt-1">
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/50 text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
            <strong>Warning:</strong> You will be logged out immediately and won't be able to log back in without administrator intervention.
          </div>

          {deactivateError && (
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{deactivateError}</p>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Confirm your password
            </label>
            <input
              type="password"
              value={deactivatePassword}
              onChange={(e) => setDeactivatePassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Type <strong className="text-rose-600 dark:text-rose-400">DELETE</strong> to confirm
            </label>
            <input
              type="text"
              value={deactivateConfirmText}
              onChange={(e) => setDeactivateConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-rose-500 font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="secondary"
              onClick={() => setIsDeactivateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={submitting || deactivateConfirmText.trim().toUpperCase() !== 'DELETE' || !deactivatePassword}
              onClick={handleDeactivateAccount}
              className="bg-rose-600 hover:bg-rose-700 border-rose-600 text-white"
            >
              {submitting ? 'Deactivating...' : 'Deactivate Account'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SettingsPage;

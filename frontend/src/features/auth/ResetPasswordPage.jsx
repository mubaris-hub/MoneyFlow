import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import authService from '../../services/auth.service';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { Wallet, Lock, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get('uid');
  const token = searchParams.get('token');

  const [formData, setFormData] = useState({
    new_password: '',
    confirm_password: '',
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!uid || !token) {
      setError('Invalid password reset link. Missing token or user identifier.');
      return;
    }

    if (formData.new_password !== formData.confirm_password) {
      const msg = 'Passwords do not match.';
      setError(msg);
      setFieldErrors({ confirm_password: msg });
      return;
    }

    if (formData.new_password.length < 8) {
      const msg = 'Password must be at least 8 characters long.';
      setError(msg);
      setFieldErrors({ new_password: msg });
      return;
    }

    setLoading(true);
    setError('');
    setFieldErrors({});

    try {
      const res = await authService.confirmPasswordReset({
        uid,
        token,
        new_password: formData.new_password,
        confirm_password: formData.confirm_password,
      });

      setSuccessMessage(res.message || 'Password has been reset successfully. You can now log in with your new password.');
    } catch (err) {
      const errData = err.response?.data;
      const fErrors = {};

      if (errData && typeof errData === 'object') {
        const errorsObj = errData.errors || errData;
        Object.keys(errorsObj).forEach((key) => {
          const val = errorsObj[key];
          const msg = Array.isArray(val) ? val[0] : val;
          if (key === 'new_password') fErrors.new_password = msg;
          else if (key === 'confirm_password') fErrors.confirm_password = msg;
        });

        const generalMsg = errData.detail || errData.non_field_errors?.[0] || Object.values(fErrors)[0] || 'Password reset failed. Please request a new reset link.';
        setError(generalMsg);
        setFieldErrors(fErrors);
      } else {
        setError('Password reset failed. Please request a new reset link.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <div className="inline-flex items-center justify-center p-3 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-600/20">
          <Wallet className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">MoneyFlow</h1>
        <p className="text-sm font-medium text-slate-500">Know where your money goes.</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="px-6 py-8 sm:px-10 border border-slate-200/80 shadow-sm rounded-2xl">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Set new password</h2>
            <p className="text-xs text-slate-500 mt-1">
              Please enter your new password below.
            </p>
          </div>

          {(!uid || !token) && !successMessage && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2.5 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Invalid or expired password reset link. Please request a new link.</span>
            </div>
          )}

          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2.5 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage ? (
            <div className="space-y-5">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-3 text-emerald-800 text-xs font-medium leading-relaxed">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-emerald-900 mb-1">Password reset complete</p>
                  <p>{successMessage}</p>
                </div>
              </div>

              <Link to="/login" className="block">
                <Button variant="primary" size="lg" className="w-full">
                  Back to Login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="New Password"
                type="password"
                name="new_password"
                placeholder="Minimum 8 characters"
                icon={Lock}
                value={formData.new_password}
                onChange={handleChange}
                error={fieldErrors.new_password}
                required
              />

              <Input
                label="Confirm Password"
                type="password"
                name="confirm_password"
                placeholder="Re-enter new password"
                icon={Lock}
                value={formData.confirm_password}
                onChange={handleChange}
                error={fieldErrors.confirm_password}
                required
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={loading}
                disabled={!uid || !token}
                className="w-full mt-2"
              >
                Reset Password
              </Button>

              <div className="pt-3 text-center">
                <Link to="/login" className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Login
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ResetPasswordPage;

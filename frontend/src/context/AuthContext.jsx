import React, { createContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/auth.service';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => authService.getStoredUser());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const initAuth = useCallback(async () => {
    const hasToken = authService.isAuthenticated();
    if (hasToken) {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch (err) {
        console.error('Failed to restore user session:', err);
        authService.logout();
        setUser(null);
      }
    } else {
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const extractFieldErrors = (err) => {
    const responseData = err.response?.data;
    if (!responseData || typeof responseData !== 'object') return {};

    const errorsObj = responseData.errors || responseData;
    if (!errorsObj || typeof errorsObj !== 'object' || Array.isArray(errorsObj)) return {};

    const fieldErrors = {};
    Object.keys(errorsObj).forEach((key) => {
      const val = errorsObj[key];
      if (Array.isArray(val) && val.length > 0) {
        fieldErrors[key] = val[0];
      } else if (typeof val === 'string') {
        fieldErrors[key] = val;
      }
    });

    return fieldErrors;
  };

  const extractErrorMessage = (err, defaultMsg) => {
    if (err.message === 'Network Error' || !err.response) {
      return 'Network Error: Cannot connect to MoneyFlow API server. Please check your network connection.';
    }

    const responseData = err.response?.data;
    if (!responseData) return defaultMsg;

    if (typeof responseData === 'string') return responseData;

    // Unwrap nested errors object if present from custom exception handler
    const errorsObj = responseData.errors || responseData;

    if (typeof errorsObj === 'string') return errorsObj;
    if (errorsObj.detail) {
      return Array.isArray(errorsObj.detail) ? errorsObj.detail[0] : errorsObj.detail;
    }

    // Pick first validation error key
    const firstKey = Object.keys(errorsObj)[0];
    if (firstKey) {
      const val = errorsObj[firstKey];
      const msg = Array.isArray(val) ? val[0] : val;
      return msg;
    }

    return defaultMsg;
  };

  const login = async (credentials) => {
    setError(null);
    try {
      const data = await authService.login(credentials);
      setUser(data.user);
      return data;
    } catch (err) {
      const fieldErrors = extractFieldErrors(err);
      const errorMessage = extractErrorMessage(err, 'Invalid email or password.');
      setError(errorMessage);
      const customErr = new Error(errorMessage);
      customErr.fieldErrors = fieldErrors;
      customErr.response = err.response;
      throw customErr;
    }
  };

  const register = async (userData) => {
    setError(null);
    try {
      const data = await authService.register(userData);
      setUser(data.user);
      return data;
    } catch (err) {
      const fieldErrors = extractFieldErrors(err);
      const errorMessage = extractErrorMessage(err, 'Registration failed. Please check your inputs.');
      setError(errorMessage);
      const customErr = new Error(errorMessage);
      customErr.fieldErrors = fieldErrors;
      customErr.response = err.response;
      throw customErr;
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setError(null);
  };

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

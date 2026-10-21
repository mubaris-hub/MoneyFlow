import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import Button from '../ui/Button';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-[50vh] p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 text-center shadow-lg space-y-4">
            <div className="w-14 h-14 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-500 dark:text-rose-400 flex items-center justify-center mx-auto ring-8 ring-rose-50/50 dark:ring-rose-950/20">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Something went wrong
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                This page encountered an unexpected issue while rendering. Your account and financial records remain safe.
              </p>
            </div>

            {process.env.NODE_ENV !== 'production' && this.state.error?.message && (
              <div className="p-3 text-left rounded-lg bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 overflow-x-auto text-[11px] font-mono text-rose-600 dark:text-rose-400">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2 justify-center">
              <Button
                variant="primary"
                onClick={this.handleReset}
                className="w-full sm:w-auto"
              >
                <RotateCcw className="w-4 h-4 mr-1.5" />
                Try Again
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  window.location.href = '/dashboard';
                }}
                className="w-full sm:w-auto"
              >
                <Home className="w-4 h-4 mr-1.5" />
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;


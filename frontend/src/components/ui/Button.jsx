import React from 'react';
import { Loader2 } from 'lucide-react';

export const Button = ({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  className = '',
  onClick,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed rounded-lg shadow-sm';

  const variants = {
    primary: 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-4 focus:ring-emerald-500/20 active:bg-emerald-800',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-800 focus:ring-4 focus:ring-slate-300/30',
    outline: 'border border-slate-300 hover:bg-slate-50 text-slate-700 focus:ring-4 focus:ring-slate-200/50',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-4 focus:ring-rose-500/20',
    ghost: 'hover:bg-slate-100 text-slate-600 hover:text-slate-900 shadow-none',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3 text-base',
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin text-current" />
          <span>Processing...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;

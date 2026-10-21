import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';

export const Button = React.forwardRef(({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loadingText,
  disabled = false,
  className = '',
  onClick,
  ...props
}, ref) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg shadow-xs cursor-pointer select-none';

  const variants = {
    primary: 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-4 focus:ring-emerald-500/20 active:bg-emerald-800',
    secondary: 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-transparent dark:border-slate-700 focus:ring-4 focus:ring-slate-300/30',
    outline: 'border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 focus:ring-4 focus:ring-slate-200/50',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-4 focus:ring-rose-500/20 active:bg-rose-800',
    ghost: 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 shadow-none',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };

  const isDisabled = disabled || isLoading;

  const handleClick = (e) => {
    if (isDisabled) {
      e.preventDefault();
      return;
    }
    if (onClick) onClick(e);
  };

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={isDisabled}
      onClick={handleClick}
      whileTap={isDisabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.08, ease: 'easeOut' }}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center justify-center">
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-current shrink-0" />
          <span>{loadingText || children || 'Processing...'}</span>
        </span>
      ) : (
        children
      )}
    </motion.button>
  );
});

Button.displayName = 'Button';

export default Button;

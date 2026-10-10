import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export const Input = React.forwardRef(({
  label,
  error,
  helperText,
  icon: Icon,
  type = 'text',
  className = '',
  id,
  isPasswordToggle = true,
  ...props
}, ref) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const [showPassword, setShowPassword] = useState(false);

  const isPasswordInput = type === 'password' && isPasswordToggle;
  const effectiveType = isPasswordInput ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
          {label}
        </label>
      )}
      <div className="relative rounded-lg">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          type={effectiveType}
          className={`w-full text-sm font-normal text-slate-900 bg-white border rounded-lg px-3.5 py-2.5 transition-all duration-150 placeholder:text-slate-400 focus:outline-none ${
            Icon ? 'pl-10' : ''
          } ${
            isPasswordInput ? 'pr-10' : ''
          } ${
            error
              ? 'border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10'
              : 'border-slate-300 hover:border-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15'
          } ${className}`}
          {...props}
        />
        {isPasswordInput && (
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center">
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="text-slate-400 hover:text-slate-600 focus:outline-none focus:text-slate-600 transition-colors p-1"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
      {!error && helperText && <p className="text-xs text-slate-500">{helperText}</p>}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;

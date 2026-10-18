import React from 'react';

export const Card = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl shadow-xs p-5 transition-all duration-150 hover:shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;

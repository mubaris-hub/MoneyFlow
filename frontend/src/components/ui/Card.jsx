import React from 'react';

export const Card = ({
  children,
  className = '',
  hover = false,
  ...props
}) => {
  const hoverStyles = hover
    ? 'motion-safe:hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
    : 'hover:border-slate-300/80 dark:hover:border-slate-700/60';

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl shadow-xs p-5 transition-all duration-200 ease-out ${hoverStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;

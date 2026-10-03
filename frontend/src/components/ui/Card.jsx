import React from 'react';

export const Card = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`bg-white border border-slate-200/90 rounded-xl shadow-xs p-5 transition-shadow duration-200 hover:shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;

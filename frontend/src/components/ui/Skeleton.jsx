import React from 'react';

export const Skeleton = ({
  className = '',
  variant = 'rounded', // 'rounded', 'circle', 'text', 'card'
  ...props
}) => {
  const variantStyles = {
    rounded: 'rounded-lg',
    circle: 'rounded-full',
    text: 'rounded h-4 w-full',
    card: 'rounded-xl h-32 w-full',
  };

  return (
    <div
      className={`bg-slate-200/70 dark:bg-slate-800/60 animate-shimmer ${variantStyles[variant] || 'rounded-lg'} ${className}`}
      {...props}
    />
  );
};

export default Skeleton;

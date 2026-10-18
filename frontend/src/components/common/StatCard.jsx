import React from 'react';
import Card from '../ui/Card';

export const StatCard = ({ title, value, icon: Icon, trend, subtitle, iconBg = 'bg-emerald-50 text-emerald-600' }) => {
  return (
    <Card hover={true} className="relative overflow-hidden border border-slate-200/80 dark:border-slate-800">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</h3>
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${iconBg}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center text-xs font-medium text-slate-500 dark:text-slate-400">
          {trend}
        </div>
      )}
    </Card>
  );
};

export default StatCard;

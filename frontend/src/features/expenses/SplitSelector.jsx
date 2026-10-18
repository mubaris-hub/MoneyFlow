import React, { useState, useEffect } from 'react';
import { calculateEqualSplits, calculatePercentageSplits, calculateSharesSplits } from '../../utils/math';
import { getInitials } from '../../utils/formatters';
import { Check, AlertCircle, Calculator } from 'lucide-react';

export const SplitSelector = ({ groupMembers = [], totalAmount = 0, onChange }) => {
  const [splitType, setSplitType] = useState('EQUAL'); // 'EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES'
  
  // Selection state for Equal split
  const [selectedUserIds, setSelectedUserIds] = useState(
    groupMembers.map(m => m.user.id)
  );

  // Input states
  const [exactAmounts, setExactAmounts] = useState({});
  const [percentages, setPercentages] = useState({});
  const [shares, setShares] = useState({});

  useEffect(() => {
    // Re-initialize selections if group members change
    if (groupMembers.length > 0 && selectedUserIds.length === 0) {
      setSelectedUserIds(groupMembers.map(m => m.user.id));
    }
  }, [groupMembers]);

  // Compute splits & validation status
  useEffect(() => {
    const total = Number(totalAmount) || 0;
    let computedSplits = [];
    let isValid = true;
    let errorMsg = '';

    if (splitType === 'EQUAL') {
      const activeMembers = groupMembers.filter(m => selectedUserIds.includes(m.user.id));
      if (activeMembers.length === 0) {
        isValid = false;
        errorMsg = 'Select at least one participant for equal split.';
      } else {
        computedSplits = calculateEqualSplits(total, activeMembers.map(m => ({ user_id: m.user.id })));
      }
    } else if (splitType === 'EXACT') {
      let sum = 0;
      computedSplits = groupMembers.map(m => {
        const amt = Number(exactAmounts[m.user.id]) || 0;
        sum += amt;
        return {
          user_id: m.user.id,
          amount: amt.toFixed(2),
          percentage: null,
          shares: null
        };
      });

      const diff = Math.abs(total - sum);
      if (diff > 0.009) {
        isValid = false;
        errorMsg = `Sum of exact amounts (₹${sum.toFixed(2)}) does not match expense total (₹${total.toFixed(2)}).`;
      }
    } else if (splitType === 'PERCENTAGE') {
      let sumPct = 0;
      const inputPcts = groupMembers.map(m => {
        const pct = Number(percentages[m.user.id]) || 0;
        sumPct += pct;
        return { user_id: m.user.id, percentage: pct };
      });

      const pctDiff = Math.abs(100 - sumPct);
      if (pctDiff > 0.01) {
        isValid = false;
        errorMsg = `Sum of percentages (${sumPct.toFixed(2)}%) must equal 100.00%.`;
      } else {
        computedSplits = calculatePercentageSplits(total, inputPcts);
      }
    } else if (splitType === 'SHARES') {
      const inputShares = groupMembers.map(m => {
        const sh = Math.max(1, Number(shares[m.user.id]) || 1);
        return { user_id: m.user.id, shares: sh };
      });

      computedSplits = calculateSharesSplits(total, inputShares);
    }

    onChange(computedSplits, isValid, errorMsg, splitType);
  }, [splitType, selectedUserIds, exactAmounts, percentages, shares, totalAmount, groupMembers]);

  const toggleUserSelection = (userId) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="space-y-4 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/50">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center">
          <Calculator className="w-4 h-4 mr-1.5 text-emerald-600 dark:text-emerald-400" />
          Expense Splitting Mode
        </label>
      </div>

      {/* Split Type Selector Tabs */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400">
        <button
          type="button"
          onClick={() => setSplitType('EQUAL')}
          className={`py-1.5 rounded-md transition-all cursor-pointer ${
            splitType === 'EQUAL' ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-xs' : 'hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Equal (=)
        </button>

        <button
          type="button"
          onClick={() => setSplitType('EXACT')}
          className={`py-1.5 rounded-md transition-all cursor-pointer ${
            splitType === 'EXACT' ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-xs' : 'hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Exact (₹)
        </button>

        <button
          type="button"
          onClick={() => setSplitType('PERCENTAGE')}
          className={`py-1.5 rounded-md transition-all cursor-pointer ${
            splitType === 'PERCENTAGE' ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-xs' : 'hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Percentage (%)
        </button>

        <button
          type="button"
          onClick={() => setSplitType('SHARES')}
          className={`py-1.5 rounded-md transition-all cursor-pointer ${
            splitType === 'SHARES' ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-xs' : 'hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Shares (Ratio)
        </button>
      </div>

      {/* Participant List Input Fields */}
      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {groupMembers.map((m) => {
          const u = m.user;
          const isSelected = selectedUserIds.includes(u.id);

          return (
            <div
              key={u.id}
              className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-lg text-xs"
            >
              <div className="flex items-center space-x-2.5">
                {splitType === 'EQUAL' && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleUserSelection(u.id)}
                    className="rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                )}
                <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center text-[10px]">
                  {getInitials(u.first_name, u.last_name)}
                </div>
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-100">{u.first_name} {u.last_name}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">{u.email}</p>
                </div>
              </div>

              {/* Mode-specific input controls */}
              <div className="flex items-center space-x-2">
                {splitType === 'EQUAL' && (
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    {isSelected ? `₹${((totalAmount || 0) / (selectedUserIds.length || 1)).toFixed(2)}` : '₹0.00'}
                  </span>
                )}

                {splitType === 'EXACT' && (
                  <div className="relative w-24">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-semibold">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={exactAmounts[u.id] || ''}
                      onChange={(e) => setExactAmounts({ ...exactAmounts, [u.id]: e.target.value })}
                      className="w-full pl-6 pr-2 py-1 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                )}

                {splitType === 'PERCENTAGE' && (
                  <div className="relative w-20">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={percentages[u.id] || ''}
                      onChange={(e) => setPercentages({ ...percentages, [u.id]: e.target.value })}
                      className="w-full pr-6 pl-2 py-1 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded focus:outline-none focus:border-emerald-600 text-right"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-semibold">%</span>
                  </div>
                )}

                {splitType === 'SHARES' && (
                  <div className="w-20">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="1"
                      value={shares[u.id] || 1}
                      onChange={(e) => setShares({ ...shares, [u.id]: e.target.value })}
                      className="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded focus:outline-none focus:border-emerald-600 text-center font-bold"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SplitSelector;

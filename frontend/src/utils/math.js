/**
 * Client-side calculation helpers for Expense Splitting Engine
 */

export const calculateEqualSplits = (totalAmount, participants) => {
  const total = Number(totalAmount) || 0;
  const n = participants.length;
  if (n === 0 || total <= 0) return [];

  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / n);
  const remainderCents = totalCents % n;

  return participants.map((p, index) => {
    const userCents = baseCents + (index < remainderCents ? 1 : 0);
    return {
      user_id: p.user_id || p.id,
      amount: (userCents / 100).toFixed(2),
      percentage: null,
      shares: null
    };
  });
};

export const calculatePercentageSplits = (totalAmount, participantPcts) => {
  const total = Number(totalAmount) || 0;
  const totalCents = Math.round(total * 100);

  const rawAllocations = participantPcts.map(p => {
    const pct = Number(p.percentage) || 0;
    const cents = Math.floor((totalCents * pct) / 100);
    return { user_id: p.user_id || p.id, percentage: pct, cents };
  });

  const allocatedSum = rawAllocations.reduce((acc, curr) => acc + curr.cents, 0);
  const remainderCents = totalCents - allocatedSum;

  // Sort by percentage descending to distribute remainder cents
  const sorted = [...rawAllocations].sort((a, b) => b.percentage - a.percentage);
  for (let i = 0; i < remainderCents; i++) {
    sorted[i].cents += 1;
  }

  return participantPcts.map(p => {
    const alloc = rawAllocations.find(a => a.user_id === (p.user_id || p.id));
    return {
      user_id: p.user_id || p.id,
      amount: (alloc.cents / 100).toFixed(2),
      percentage: alloc.percentage.toFixed(2),
      shares: null
    };
  });
};

export const calculateSharesSplits = (totalAmount, participantShares) => {
  const total = Number(totalAmount) || 0;
  const totalCents = Math.round(total * 100);
  const totalShares = participantShares.reduce((acc, curr) => acc + (Number(curr.shares) || 1), 0);

  if (totalShares <= 0) return [];

  const rawAllocations = participantShares.map(p => {
    const sh = Math.max(1, Number(p.shares) || 1);
    const cents = Math.floor((totalCents * sh) / totalShares);
    return { user_id: p.user_id || p.id, shares: sh, cents };
  });

  const allocatedSum = rawAllocations.reduce((acc, curr) => acc + curr.cents, 0);
  const remainderCents = totalCents - allocatedSum;

  const sorted = [...rawAllocations].sort((a, b) => b.shares - a.shares);
  for (let i = 0; i < remainderCents; i++) {
    sorted[i].cents += 1;
  }

  return participantShares.map(p => {
    const alloc = rawAllocations.find(a => a.user_id === (p.user_id || p.id));
    return {
      user_id: p.user_id || p.id,
      amount: (alloc.cents / 100).toFixed(2),
      percentage: null,
      shares: alloc.shares
    };
  });
};

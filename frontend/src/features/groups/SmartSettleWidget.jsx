import React from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { formatINR, getInitials } from '../../utils/formatters';

export const SmartSettleWidget = ({
  suggestedSettlements = [],
  onSettleClick
}) => {
  if (suggestedSettlements.length === 0) {
    return (
      <Card className="p-5 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 border border-emerald-100/80 rounded-2xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">All debts are settled!</h4>
            <p className="text-xs text-slate-500">No member owes money in this group currently.</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 border border-slate-200/90 rounded-2xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-slate-900">Suggested Settlements (Smart Settle)</h3>
        </div>
        <Badge variant="brand">{suggestedSettlements.length} Transfers</Badge>
      </div>

      <div className="space-y-3">
        {suggestedSettlements.map((s, idx) => (
          <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200/70 rounded-xl flex items-center justify-between hover:bg-slate-100/60 transition-colors">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-800">{s.sender?.first_name} {s.sender?.last_name}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-bold text-slate-800">{s.receiver?.first_name} {s.receiver?.last_name}</span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <span className="text-sm font-extrabold text-emerald-700">{formatINR(s.amount)}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSettleClick(s.sender_id, s.receiver_id, s.amount)}
              >
                Settle Up
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default SmartSettleWidget;

import React from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { formatINR } from '../../utils/formatters';
import { CheckCircle2, XCircle, Clock, ArrowRight } from 'lucide-react';

export const SettlementHistoryFeed = ({
  settlements = [],
  currentUserId,
  onStatusUpdate
}) => {
  if (settlements.length === 0) {
    return (
      <Card className="py-8 text-center text-xs text-slate-500">
        No settlement history recorded for this group yet.
      </Card>
    );
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success" className="flex items-center"><CheckCircle2 className="w-3 h-3 mr-1" /> Completed</Badge>;
      case 'PENDING':
        return <Badge variant="warning" className="flex items-center"><Clock className="w-3 h-3 mr-1" /> Pending Approval</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger" className="flex items-center"><XCircle className="w-3 h-3 mr-1" /> Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <Card className="p-5 border border-slate-200/90 rounded-2xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-900">Settlement History</h3>
        <span className="text-xs text-slate-500">{settlements.length} Records</span>
      </div>

      <div className="divide-y divide-slate-100">
        {settlements.map((s) => {
          const isReceiver = String(s.receiver?.id) === String(currentUserId);
          const isSender = String(s.sender?.id) === String(currentUserId);
          const isPending = s.status === 'PENDING';

          return (
            <div key={s.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-900">{s.sender?.first_name} {s.sender?.last_name}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-bold text-slate-900">{s.receiver?.first_name} {s.receiver?.last_name}</span>
                  {getStatusBadge(s.status)}
                </div>
                <p className="text-[11px] text-slate-500">
                  {s.date} {s.notes && `• Note: ${s.notes}`}
                </p>
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <span className="text-sm font-extrabold text-slate-900">{formatINR(s.amount)}</span>

                {isPending && (isReceiver || isSender) && (
                  <div className="flex items-center space-x-1.5">
                    {isReceiver && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onStatusUpdate(s.id, 'COMPLETED')}
                      >
                        Confirm Received
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onStatusUpdate(s.id, 'CANCELLED')}
                    >
                      Cancel / Reject
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default SettlementHistoryFeed;

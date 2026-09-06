import React from 'react';

interface StatusChipProps {
  status: string;
  type?: 'event' | 'payment';
}

export const StatusChip: React.FC<StatusChipProps> = ({ status, type = 'event' }) => {
  const normalized = (status || '').toUpperCase();

  const styles: Record<string, string> = {
    // Event Statuses
    OPEN: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    NEARLY_FULL: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    FULL: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    CLOSED: 'bg-slate-500/10 text-slate-400 border-slate-500/30',

    // Payment Statuses
    VERIFIED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    APPROVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    PENDING_VERIFICATION: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    AWAITING_PAYMENT: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    ON_HOLD: 'bg-amber-500/15 text-amber-300 border-amber-500/40 font-bold',
    HELD: 'bg-amber-500/15 text-amber-300 border-amber-500/40 font-bold',
    REJECTED: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  };


  const currentStyle = styles[normalized] || 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  const label = normalized.replace(/_/g, ' ');

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${currentStyle}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5"></span>
      {label}
    </span>
  );
};

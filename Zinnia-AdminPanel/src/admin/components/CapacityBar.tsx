import React from 'react';
import { EventStatus, CapacityUnit } from '../types';

interface CapacityBarProps {
  registered: number;
  capacity: number | null;
  percentage: number;
  status: EventStatus;
  capacityUnit: CapacityUnit;
}

export const CapacityBar: React.FC<CapacityBarProps> = ({
  registered,
  capacity,
  percentage,
  status,
  capacityUnit,
}) => {
  const getBarColor = () => {
    if (status === 'CLOSED') return 'bg-slate-600';
    if (status === 'FULL') return 'bg-rose-500';
    if (status === 'NEARLY_FULL') return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const clampedPercentage = Math.min(100, Math.max(0, percentage));

  return (
    <div className="w-full space-y-1.5">
      <div className="flex justify-between items-center text-xs">
        <span className="font-semibold text-slate-300">
          {registered} {capacity !== null ? `/ ${capacity}` : ''} {capacityUnit}
        </span>
        <span className="font-bold text-slate-400">
          {capacity !== null ? `${clampedPercentage}%` : 'Unlimited'}
        </span>
      </div>
      <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
        <div
          className={`h-full ${getBarColor()} transition-all duration-500 rounded-full`}
          style={{ width: capacity !== null ? `${clampedPercentage}%` : '100%' }}
        />
      </div>
    </div>
  );
};

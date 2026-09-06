import React from 'react';
import { TrendPoint } from '../types';

interface TrendChartProps {
  trend: TrendPoint[];
}

export const TrendChart: React.FC<TrendChartProps> = ({ trend = [] }) => {
  if (!trend || trend.length === 0) {
    return (
      <div className="h-48 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center text-slate-500 text-sm">
        No registration trend data recorded yet.
      </div>
    );
  }

  const maxVal = Math.max(...trend.map((t) => t.count), 5);
  const chartHeight = 160;
  const chartWidth = 500;

  const points = trend.map((t, idx) => {
    const x = (idx / Math.max(1, trend.length - 1)) * (chartWidth - 40) + 20;
    const y = chartHeight - (t.count / maxVal) * (chartHeight - 40) - 20;
    return { x, y, date: t.date, count: t.count };
  });

  const pathD = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${chartHeight - 10} L ${points[0].x} ${chartHeight - 10} Z`;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Registration Velocity Trend</h3>
        <span className="text-xs text-slate-400 font-medium">Daily Teams Registered</span>
      </div>
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-44 overflow-visible">
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1="10" y1={chartHeight - 20} x2={chartWidth - 10} y2={chartHeight - 20} stroke="#334155" strokeWidth="1" />
          <line x1="10" y1="20" x2={chartWidth - 10} y2="20" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />

          {/* Fill Area */}
          <path d={areaD} fill="url(#trendGradient)" />

          {/* Stroke Line */}
          <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Points */}
          {points.map((pt, i) => (
            <g key={i} className="group cursor-pointer">
              <circle cx={pt.x} cy={pt.y} r="4" fill="#818cf8" stroke="#1e1b4b" strokeWidth="2" />
              <title>{`${pt.date}: ${pt.count} teams`}</title>
            </g>
          ))}
        </svg>
      </div>
      <div className="flex justify-between text-xs text-slate-400 border-t border-slate-800 pt-2 font-mono">
        <span>{trend[0]?.date || 'Start'}</span>
        <span>{trend[trend.length - 1]?.date || 'Today'}</span>
      </div>
    </div>
  );
};

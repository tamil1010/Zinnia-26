import React from 'react';
import { useAdminQuery } from '../hooks/useAdminQuery';
import { DashboardData } from '../types';
import { StatTile } from '../components/StatTile';
import { CapacityBar } from '../components/CapacityBar';
import { StatusChip } from '../components/StatusChip';
import { AttentionStrip } from '../components/AttentionStrip';
import { TrendChart } from '../components/TrendChart';
import { Users, CheckCircle2, Clock, IndianRupee, CalendarCheck, Utensils, Building2, Activity, RefreshCw } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { data: response, loading, error, refetch } = useAdminQuery<{ success: boolean; data: DashboardData }>('/api/admin/dashboard', {
    pollingInterval: 30000,
  });

  const dashboardData = response?.data;

  if (loading && !dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-400">Loading Symposium Telemetry...</p>
        </div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/30 p-6 rounded-xl space-y-3 text-rose-400">
        <h3 className="font-bold text-lg">Dashboard Loading Failed</h3>
        <p className="text-sm">{error || 'Could not load aggregate telemetry data.'}</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium inline-flex items-center space-x-2"
        >
          <RefreshCw size={16} />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const { totals, revenue, capacity = [], trend = [], colleges = [], attention, food, recent = [] } = dashboardData;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Symposium Dashboard</h1>
          <p className="text-xs text-slate-400 font-medium">Real-time registration telemetry &amp; capacity oversight</p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold rounded-xl transition flex items-center space-x-2 w-fit"
        >
          <RefreshCw size={14} />
          <span>Refresh Live Data</span>
        </button>
      </div>

      {/* Attention Strip */}
      <AttentionStrip attention={attention} />

      {/* Stat Tiles Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatTile
          title="Total Participants"
          value={totals?.participants}
          icon={Users}
          color="indigo"
        />
        <StatTile
          title="Approved Payments"
          value={totals?.approved_payments}
          icon={CheckCircle2}
          color="emerald"
        />
        <StatTile
          title="Pending Verification"
          value={totals?.pending_payments}
          icon={Clock}
          color="amber"
        />
        <StatTile
          title="Total Revenue"
          value={totals?.revenue !== null && totals?.revenue !== undefined ? `₹${totals.revenue.toLocaleString('en-IN')}` : 'Restricted'}
          icon={IndianRupee}
          color="cyan"
        />
        <StatTile
          title="Event Registrations"
          value={totals?.total_event_registrations}
          icon={CalendarCheck}
          color="purple"
        />
        <StatTile
          title="Awaiting Acceptance"
          value={totals?.teams_awaiting_acceptance}
          icon={Users}
          color="rose"
        />
      </div>

      {/* Event Capacity Board */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wider">Event Capacity Board</h2>
            <p className="text-xs text-slate-400">Events sorted by fullness percentage</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {capacity.map((evt) => (
            <div key={evt.event_id} className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs text-indigo-400 font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                      #{evt.code}
                    </span>
                    <h3 className="font-bold text-white text-sm truncate max-w-[160px]">{evt.event_name}</h3>
                  </div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">{evt.category}</span>
                </div>
                <StatusChip status={evt.status} type="event" />
              </div>

              <CapacityBar
                registered={evt.registered_count}
                capacity={evt.capacity}
                percentage={evt.percentage}
                status={evt.status}
                capacityUnit={evt.capacity_unit}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Middle Row: Trend Chart & Food Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TrendChart trend={trend} />
        </div>

        {/* Food Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Food Catering Summary</h3>
            <Utensils size={18} className="text-slate-400" />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <span className="text-sm text-slate-300 font-medium">Vegetarian</span>
              <span className="text-base font-bold text-emerald-400">{food?.veg || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <span className="text-sm text-slate-300 font-medium">Non-Vegetarian</span>
              <span className="text-base font-bold text-rose-400">{food?.non_veg || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
              <span className="text-sm text-indigo-300 font-bold">Total Catering Count</span>
              <span className="text-lg font-black text-indigo-400">{food?.total || 0}</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 text-center">
            Updated in real-time upon team verification.
          </div>
        </div>
      </div>

      {/* Bottom Row: Top Colleges & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Colleges */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Top 10 Colleges</h3>
            <Building2 size={18} className="text-slate-400" />
          </div>
          <div className="divide-y divide-slate-800/80 max-h-72 overflow-y-auto">
            {colleges.map((c, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-sm">
                <span className="text-slate-300 font-medium truncate max-w-[280px]">{idx + 1}. {c.college}</span>
                <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  {c.team_count} Teams
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Audit Log */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Recent Administrative Activity</h3>
            <Activity size={18} className="text-slate-400" />
          </div>
          <div className="space-y-2.5 max-h-72 overflow-y-auto">
            {recent.map((act) => (
              <div key={act.id} className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">{act.admin_username} ({act.admin_role})</span>
                  <span className="text-slate-500 font-mono">{new Date(act.created_at).toLocaleTimeString()}</span>
                </div>
                <div className="text-indigo-400 font-mono font-semibold">{act.action}</div>
                {act.reason && <div className="text-slate-400 text-[11px]">Reason: {act.reason}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

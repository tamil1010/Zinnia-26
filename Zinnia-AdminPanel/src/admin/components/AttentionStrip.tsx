import React from 'react';
import { AttentionItem } from '../types';
import { AlertTriangle, CheckCircle2, Clock, Flame, Users, Calendar } from 'lucide-react';

interface AttentionStripProps {
  attention: AttentionItem;
}

export const AttentionStrip: React.FC<AttentionStripProps> = ({ attention }) => {
  const {
    pending_over_24h = 0,
    events_over_90_percent = 0,
    teams_awaiting = 0,
    held_registrations = 0,
    events_closing_48h = 0,
  } = attention || {};

  const totalAttentionCount =
    pending_over_24h +
    events_over_90_percent +
    teams_awaiting +
    held_registrations +
    events_closing_48h;

  if (totalAttentionCount === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center space-x-3 text-slate-400">
        <CheckCircle2 className="text-emerald-400 shrink-0" size={20} />
        <span className="text-sm font-medium">All systems operational. No items requiring immediate attention.</span>
      </div>
    );
  }

  return (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center space-x-2 text-amber-400">
        <AlertTriangle size={18} />
        <h3 className="text-sm font-bold uppercase tracking-wider">Attention Required ({totalAttentionCount})</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {pending_over_24h > 0 && (
          <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg flex items-center space-x-3">
            <Clock className="text-amber-400 shrink-0" size={18} />
            <div>
              <div className="text-sm font-bold text-white">{pending_over_24h}</div>
              <div className="text-xs text-slate-400">Payments &gt; 24h</div>
            </div>
          </div>
        )}

        {events_over_90_percent > 0 && (
          <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg flex items-center space-x-3">
            <Flame className="text-rose-400 shrink-0" size={18} />
            <div>
              <div className="text-sm font-bold text-white">{events_over_90_percent}</div>
              <div className="text-xs text-slate-400">Events &gt; 90% Full</div>
            </div>
          </div>
        )}

        {teams_awaiting > 0 && (
          <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg flex items-center space-x-3">
            <Users className="text-indigo-400 shrink-0" size={18} />
            <div>
              <div className="text-sm font-bold text-white">{teams_awaiting}</div>
              <div className="text-xs text-slate-400">Awaiting Acceptance</div>
            </div>
          </div>
        )}

        {held_registrations > 0 && (
          <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg flex items-center space-x-3">
            <AlertTriangle className="text-cyan-400 shrink-0" size={18} />
            <div>
              <div className="text-sm font-bold text-white">{held_registrations}</div>
              <div className="text-xs text-slate-400">Held Registrations</div>
            </div>
          </div>
        )}

        {events_closing_48h > 0 && (
          <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg flex items-center space-x-3">
            <Calendar className="text-purple-400 shrink-0" size={18} />
            <div>
              <div className="text-sm font-bold text-white">{events_closing_48h}</div>
              <div className="text-xs text-slate-400">Closing in 48h</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

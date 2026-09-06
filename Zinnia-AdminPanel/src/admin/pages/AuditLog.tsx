import React, { useState } from 'react';
import { useAdminQuery } from '../hooks/useAdminQuery';
import { AuditLogItem } from '../types';
import { ShieldCheck, Search, RefreshCw } from 'lucide-react';

export const AuditLog: React.FC = () => {
  const { data: response, loading, refetch } = useAdminQuery<{ success: boolean; logs: AuditLogItem[] }>('/api/admin/audit');
  const logs = response?.logs || [];

  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredLogs = logs.filter((log) => {
    const term = searchTerm.toLowerCase();
    return (
      log.admin_username.toLowerCase().includes(term) ||
      log.action.toLowerCase().includes(term) ||
      (log.target_id && log.target_id.toLowerCase().includes(term)) ||
      (log.reason && log.reason.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Administrative Audit Log</h1>
          <p className="text-xs text-slate-400 font-medium">Immutable audit trail of all mutating administrative operations</p>
        </div>

        <button
          onClick={() => refetch()}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold rounded-xl transition flex items-center space-x-2 w-fit"
        >
          <RefreshCw size={14} />
          <span>Refresh Audit Trail</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="relative max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
          <Search size={18} />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter by admin, action, target ID, or reason..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
        />
      </div>

      {/* Audit Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {loading && logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">Loading audit log entries...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <ShieldCheck size={36} className="mx-auto text-slate-600" />
            <div className="font-semibold text-slate-400">No audit log records match search filter.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-xs text-slate-400 uppercase font-semibold">
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Admin Operator</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Target Type / ID</th>
                  <th className="p-4">Reason / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredLogs.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-4 font-mono text-xs text-slate-400 whitespace-nowrap">
                      {new Date(item.created_at).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-white text-xs">{item.admin_username}</div>
                      <div className="text-[10px] text-amber-400 font-mono font-semibold">{item.admin_role || 'SUPER_ADMIN'}</div>
                    </td>
                    <td className="p-4 font-mono text-xs text-indigo-400 font-bold">
                      {item.action}
                    </td>
                    <td className="p-4 text-xs font-mono text-slate-300">
                      {item.target_type ? `${item.target_type}: ` : ''}
                      <span className="text-emerald-400">{item.target_id || 'N/A'}</span>
                    </td>
                    <td className="p-4 text-xs text-slate-300">
                      {item.reason || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

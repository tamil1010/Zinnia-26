import React, { useState, useEffect } from 'react';
import { useAdminQuery } from '../hooks/useAdminQuery';
import { adminFetch } from '../auth/adminFetch';
import { Settings as SettingsIcon, Save, CheckCircle2, AlertCircle } from 'lucide-react';

export const Settings: React.FC = () => {
  const { data: response, loading, refetch } = useAdminQuery<{ success: boolean; settings: Record<string, any> }>('/api/admin/settings');
  const settingsMap = response?.settings || {};

  const [formState, setFormState] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (response?.settings) {
      setFormState(response.settings);
    }
  }, [response]);

  const handleChange = (key: string, val: any) => {
    setFormState(prev => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setNotice(null);

    try {
      const res = await adminFetch<{ success: boolean; message: string }>('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify(formState),
      });

      setNotice({ type: 'success', message: res.message || 'Settings saved successfully.' });
      refetch();
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'Failed to save settings.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !response) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-3xl">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">System Operational Settings</h1>
        <p className="text-xs text-slate-400 font-medium">Configure global registration parameters, fee structures, and deadlines</p>
      </div>

      {notice && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm ${
            notice.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
          }`}
        >
          <div className="flex items-center space-x-2">
            {notice.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span>{notice.message}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-xs font-bold underline">Dismiss</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-sm">
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-4">
          <SettingsIcon className="text-indigo-400" size={20} />
          <h2 className="text-base font-bold text-white uppercase tracking-wider">Parameters</h2>
        </div>

        <div className="space-y-4 text-sm">
          {/* Registration Fee */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Registration Fee Per Head (₹)</label>
            <input
              type="number"
              value={formState.registration_fee ?? 250}
              onChange={(e) => handleChange('registration_fee', parseInt(e.target.value, 10))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* Default Registration Closing Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Default Registration Deadline</label>
            <input
              type="text"
              value={formState.default_reg_closes_at ?? '2026-09-15T23:59:59Z'}
              onChange={(e) => handleChange('default_reg_closes_at', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white font-mono focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* Short Film Closing Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Short Film Deadline</label>
            <input
              type="text"
              value={formState.short_film_closes_at ?? '2026-09-14T23:59:59Z'}
              onChange={(e) => handleChange('short_film_closes_at', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white font-mono focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* Team Acceptance Timeout */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Team Acceptance Timeout (Hours)</label>
            <input
              type="number"
              value={formState.team_accept_timeout_h ?? 24}
              onChange={(e) => handleChange('team_accept_timeout_h', parseInt(e.target.value, 10))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500 transition"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl shadow transition flex items-center space-x-2 disabled:opacity-50"
          >
            <Save size={18} />
            <span>{submitting ? 'Saving...' : 'Save System Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

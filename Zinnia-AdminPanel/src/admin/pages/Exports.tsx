import React, { useState } from 'react';
import { useDownload } from '../hooks/useDownload';
import { useAdminQuery } from '../hooks/useAdminQuery';
import { FileSpreadsheet, Download, ShieldCheck, CheckCircle, RefreshCw } from 'lucide-react';

export const Exports: React.FC = () => {
  const [selectedPreset, setSelectedPreset] = useState<string>('FULL');
  const { downloadFile, downloading, error } = useDownload();

  const { data: previewRes, loading: previewLoading } = useAdminQuery<{
    success: boolean;
    preset: string;
    estimated_rows: { teams: number; participants: number };
  }>(`/api/admin/export/preview?preset=${selectedPreset}`);

  const handleDownload = async () => {
    await downloadFile(`/api/admin/export/download?preset=${selectedPreset}`, `Zinnia2026_Export_${selectedPreset}.xlsx`);
  };

  const presets = [
    { id: 'FULL', label: 'Full Symposium Workbook', desc: 'All participants, teams, catering, payments, and event sheets (Role Dependent).' },
    { id: 'CATERING', label: 'Catering & Dining Hall List', desc: 'Veg & Non-Veg food preferences, claim status, and attendee details.' },
    { id: 'TREASURY', label: 'Treasury & Payment Verification', desc: 'Verified and pending payment logs, expected vs submitted amounts.' },
    { id: 'COORDINATOR', label: 'Event Roster', desc: 'Registered participants and teams for assigned events.' },
  ];

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Excel Workbook Generator</h1>
        <p className="text-xs text-slate-400 font-medium">Server-side generated openpyxl reports with role-based sheet filtering</p>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm">
          Export failed: {error}
        </div>
      )}

      {/* Preset Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {presets.map((p) => (
          <div
            key={p.id}
            onClick={() => setSelectedPreset(p.id)}
            className={`p-5 rounded-xl border cursor-pointer transition flex flex-col justify-between space-y-3 ${
              selectedPreset === p.id
                ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-md'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className={selectedPreset === p.id ? 'text-indigo-400' : 'text-slate-500'} size={22} />
                <h3 className="font-bold text-sm text-white">{p.label}</h3>
              </div>
              {selectedPreset === p.id && <CheckCircle className="text-indigo-400" size={18} />}
            </div>
            <p className="text-xs text-slate-400">{p.desc}</p>
          </div>
        ))}
      </div>

      {/* Preview & Action Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Server Export Preview</h3>
          <ShieldCheck size={18} className="text-indigo-400" />
        </div>

        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-950 border border-slate-800 rounded-lg text-sm">
          <div>
            <div className="text-xs text-slate-500">Estimated Participant Rows</div>
            <div className="text-lg font-bold text-white">
              {previewLoading ? '...' : previewRes?.estimated_rows?.participants || 0}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Estimated Team Rows</div>
            <div className="text-lg font-bold text-white">
              {previewLoading ? '...' : previewRes?.estimated_rows?.teams || 0}
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-400 space-y-1">
          <p>• Excel files include auto-filters, frozen headers, and formatted widths.</p>
          <p>• Phone numbers are preserved as text to retain <span className="font-mono text-amber-400">+91</span> and leading zeroes.</p>
          <p>• Download creates an administrative audit log entry automatically.</p>
        </div>

        <button
          onClick={handleDownload}
          disabled={downloading}
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/20 transition flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          {downloading ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              <span>Generating Excel Workbook on Server...</span>
            </>
          ) : (
            <>
              <Download size={18} />
              <span>Download Excel Report ({selectedPreset})</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

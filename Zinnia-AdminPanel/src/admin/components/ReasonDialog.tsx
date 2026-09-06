import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';

interface ReasonDialogProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  cannedReasons?: string[];
  onConfirm: (reason: string) => void;
  onClose: () => void;
  loading?: boolean;
}

export const ReasonDialog: React.FC<ReasonDialogProps> = ({
  isOpen,
  title,
  subtitle,
  cannedReasons = [
    'Reference not found in statement',
    'Amount short',
    'Screenshot unreadable',
    'Duplicate payment',
  ],
  onConfirm,
  onClose,
  loading = false,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = selectedReason === 'CUSTOM' ? customReason.trim() : (selectedReason || customReason.trim());
    
    if (!finalReason) {
      setError('Please select or enter a valid reason.');
      return;
    }

    setError(null);
    onConfirm(finalReason);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X size={20} />
          </button>
        </div>

        {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Select Preset Reason</label>
            <div className="space-y-2">
              {cannedReasons.map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition text-sm font-medium ${
                    selectedReason === reason
                      ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300'
                      : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="reasonPreset"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={() => {
                      setSelectedReason(reason);
                      setError(null);
                    }}
                    className="sr-only"
                  />
                  <span>{reason}</span>
                </label>
              ))}

              <label
                className={`flex items-center p-3 rounded-lg border cursor-pointer transition text-sm font-medium ${
                  selectedReason === 'CUSTOM'
                    ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300'
                    : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="reasonPreset"
                  value="CUSTOM"
                  checked={selectedReason === 'CUSTOM'}
                  onChange={() => {
                    setSelectedReason('CUSTOM');
                    setError(null);
                  }}
                  className="sr-only"
                />
                <span>Custom / Other Reason...</span>
              </label>
            </div>
          </div>

          {(selectedReason === 'CUSTOM' || (!selectedReason && customReason)) && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Custom Reason Detail</label>
              <textarea
                value={customReason}
                onChange={(e) => {
                  setCustomReason(e.target.value);
                  setError(null);
                }}
                placeholder="Type specific administrative reason here..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          )}

          {error && (
            <div className="flex items-center space-x-2 text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold rounded-lg shadow transition flex items-center space-x-2 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Confirm Action'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

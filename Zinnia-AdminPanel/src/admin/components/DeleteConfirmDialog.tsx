import React, { useEffect } from 'react';
import { PaymentRecord } from '../types';
import { X, Trash2, AlertTriangle } from 'lucide-react';

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  payment: PaymentRecord | null;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  isOpen,
  payment,
  onConfirm,
  onClose,
  loading = false,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        if (!loading) onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onConfirm, onClose]);

  if (!isOpen || !payment) return null;

  const team = payment.teams || {
    team_id: payment.team_id,
    team_name: `Team ${payment.team_id}`,
    college: 'N/A',
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-rose-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5 text-rose-400">
            <Trash2 size={24} className="shrink-0" />
            <h3 className="text-lg font-bold text-white uppercase tracking-wide">Confirm Delete Registration</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Question Text */}
        <p className="text-sm text-slate-300 leading-relaxed font-sans">
          Are you sure you want to permanently delete registration for <strong className="text-white font-mono">{payment.team_id}</strong>?
        </p>

        {/* Team & Payment Summary Card */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5 font-mono text-xs">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <span className="text-slate-500 font-sans">Team Name:</span>
            <span className="font-bold text-white text-sm">{team.team_name}</span>
          </div>

          {payment.lead_name && (
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-sans">Team Lead:</span>
              <span className="text-slate-300 font-semibold">{payment.lead_name}</span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-sans">Transaction UTR:</span>
            <span className="text-amber-400 font-bold">{payment.utr_number || 'N/A'}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-sans">Status:</span>
            <span className="text-rose-400 font-bold uppercase">{payment.payment_status}</span>
          </div>
        </div>

        {/* Critical Danger Alert Callout */}
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-[11px] text-rose-300 flex items-start space-x-2">
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-rose-400" />
          <span>
            <strong>Warning:</strong> Deleting will permanently remove all member records, payment logs, and event registrations for this squad across all database tables. This action cannot be undone.
          </span>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-sm font-semibold rounded-xl shadow-lg transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span>Deleting...</span>
            ) : (
              <>
                <Trash2 size={18} />
                <span>Delete Registration</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

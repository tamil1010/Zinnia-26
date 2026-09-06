import React, { useEffect } from 'react';
import { PaymentRecord } from '../types';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';

interface ApproveConfirmDialogProps {
  isOpen: boolean;
  payment: PaymentRecord | null;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
}

export const ApproveConfirmDialog: React.FC<ApproveConfirmDialogProps> = ({
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5 text-emerald-400">
            <CheckCircle2 size={24} className="shrink-0" />
            <h3 className="text-lg font-bold text-white uppercase tracking-wide">Confirm Payment Approval</h3>
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
          Are you sure you want to verify and approve payment for <strong className="text-white font-mono">{payment.team_id}</strong>?
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
            <span className="text-emerald-400 font-bold">{payment.utr_number || 'N/A'}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-sans">Fee Paid:</span>
            <span className="text-amber-400 font-bold">₹{payment.submitted_amount || payment.expected_amount || 250}</span>
          </div>

          {payment.payer_upi_id && (
            <div className="flex justify-between items-center pt-1 border-t border-slate-800/60">
              <span className="text-slate-500 font-sans">Payer UPI ID:</span>
              <span className="text-cyan-400 font-semibold">{payment.payer_upi_id}</span>
            </div>
          )}
        </div>

        {/* Informational Callout */}
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-[11px] text-emerald-300 flex items-start space-x-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-emerald-400" />
          <span>
            Approving will promote this squad to official symposium records and immediately dispatch QR entry passes to all registered member emails.
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
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-lg transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span>Verifying...</span>
            ) : (
              <>
                <CheckCircle2 size={18} />
                <span>Okay / Approve</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

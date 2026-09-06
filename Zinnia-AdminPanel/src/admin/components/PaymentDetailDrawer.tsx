import React, { useEffect } from 'react';
import { PaymentRecord } from '../types';
import { StatusChip } from './StatusChip';
import { X, CheckCircle2, XCircle, Trash2, PauseCircle, FileImage, ShieldAlert, ArrowLeft, ArrowRight } from 'lucide-react';

interface PaymentDetailDrawerProps {
  payment: PaymentRecord | null;
  onClose: () => void;
  onApprove: (teamId: string) => void;
  onReject: (teamId: string) => void;
  onHold?: (teamId: string) => void;
  onDelete?: (teamId: string) => void;
  onNext?: () => void;
  onPrev?: () => void;
}

export const PaymentDetailDrawer: React.FC<PaymentDetailDrawerProps> = ({
  payment,
  onClose,
  onApprove,
  onReject,
  onHold,
  onDelete,
  onNext,
  onPrev,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!payment) return;

      // Don't trigger shortcuts if user is typing in an input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'j' || e.key === 'J') {
        if (onNext) onNext();
      } else if (e.key === 'k' || e.key === 'K') {
        if (onPrev) onPrev();
      } else if (e.key === 'a' || e.key === 'A') {
        if (payment.payment_status === 'PENDING_VERIFICATION' || payment.payment_status === 'ON_HOLD') {
          onApprove(payment.team_id);
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (payment.payment_status === 'PENDING_VERIFICATION' || payment.payment_status === 'ON_HOLD') {
          onReject(payment.team_id);
        }
      } else if (e.key === 'h' || e.key === 'H') {
        if (onHold) {
          onHold(payment.team_id);
        }
      } else if (e.key === 'd' || e.key === 'D') {
        if (onDelete) {
          onDelete(payment.team_id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [payment, onClose, onApprove, onReject, onHold, onDelete, onNext, onPrev]);

  if (!payment) return null;

  const team = payment.teams || {
    team_id: payment.team_id,
    team_name: `Team ${payment.team_id}`,
    college: 'N/A',
    department: 'N/A',
    year: 'N/A',
    member_count: 1,
  };

  const isPending = payment.payment_status === 'PENDING_VERIFICATION' || payment.payment_status === 'AWAITING_PAYMENT' || payment.payment_status === 'ON_HOLD';

  return (
    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex justify-end">
      <div className="bg-slate-900 border-l border-slate-800 w-full max-w-xl h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-250">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                {payment.team_id}
              </span>
              <StatusChip status={payment.payment_status} type="payment" />
            </div>
            <h2 className="text-lg font-bold text-white mt-1">{team.team_name}</h2>
          </div>
          <div className="flex items-center space-x-2">
            {onDelete && (
              <button
                onClick={() => onDelete(payment.team_id)}
                title="Delete Registration (D)"
                className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-lg transition"
              >
                <Trash2 size={18} />
              </button>
            )}
            {onPrev && (
              <button
                onClick={onPrev}
                title="Previous Payment (K)"
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            {onNext && (
              <button
                onClick={onNext}
                title="Next Payment (J)"
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
              >
                <ArrowRight size={18} />
              </button>
            )}
            <button
              onClick={onClose}
              title="Close Drawer (Esc)"
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Flags Banner */}
          {payment.computed_flags && payment.computed_flags.length > 0 && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 space-y-2">
              <div className="flex items-center space-x-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                <ShieldAlert size={16} />
                <span>Verification Warning Flags ({payment.computed_flags.length})</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {payment.computed_flags.map((flag) => (
                  <span
                    key={flag}
                    className="px-2.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold rounded-lg"
                  >
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Team Lead Contact Info */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Team Lead Contact Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-mono">
              <div>
                <div className="text-[11px] text-slate-500 font-sans font-medium">Team Lead Name</div>
                <div className="font-bold text-white text-base">{payment.lead_name || team.team_name}</div>
              </div>
              {payment.lead_email && (
                <div>
                  <div className="text-[11px] text-slate-500 font-sans font-medium">Email Address</div>
                  <div className="font-semibold text-indigo-400 text-xs break-all">{payment.lead_email}</div>
                </div>
              )}
              {payment.lead_phone && (
                <div>
                  <div className="text-[11px] text-slate-500 font-sans font-medium">Mobile Number</div>
                  <div className="font-semibold text-amber-400 text-xs">{payment.lead_phone}</div>
                </div>
              )}
            </div>
          </div>

          {/* Participant / College Info */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">College & Squad Summary</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-slate-500">College</div>
                <div className="font-medium text-white">{team.college}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Department / Year</div>
                <div className="font-medium text-white">{team.department} ({team.year})</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Team Size</div>
                <div className="font-medium text-white">{payment.members?.length || team.member_count} Member(s)</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Attempt No</div>
                <div className="font-medium text-amber-400">Attempt #{payment.attempt_no || 1}</div>
              </div>
            </div>
          </div>

          {/* Registered Events */}
          {payment.registered_events && payment.registered_events.length > 0 && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Selected Symposium Events ({payment.registered_events.length})</h3>
              <div className="flex flex-wrap gap-2 pt-1 font-mono">
                {payment.registered_events.map((evId) => (
                  <span
                    key={evId}
                    className="px-3 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 text-xs font-bold rounded-lg uppercase"
                  >
                    {evId}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Squad Members List */}
          {payment.members && payment.members.length > 0 && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Squad Members ({payment.members.length})</h3>
              <div className="space-y-2 font-mono text-xs">
                {payment.members.map((m, idx) => (
                  <div key={idx} className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-white font-bold text-sm">{m.name}</span>
                        {m.is_leader && (
                          <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-bold rounded">LEADER</span>
                        )}
                      </div>
                      {m.email && <div className="text-slate-400 text-[11px] mt-0.5">{m.email}</div>}
                      {m.phone && <div className="text-slate-400 text-[11px]">{m.phone}</div>}
                    </div>
                    {m.food_preference && (
                      <span className={`px-2 py-1 text-[10px] font-bold rounded self-start sm:self-center border ${
                        m.food_preference === 'NON_VEG' 
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' 
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {m.food_preference === 'NON_VEG' ? 'NON-VEG' : 'VEG'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment & UTR Details */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payment Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-slate-500">Transaction Reference / UTR</div>
                <div className="font-mono text-emerald-400 font-bold tracking-wide">
                  {payment.utr_number || 'Not Submitted'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Submitted / Expected Fee</div>
                <div className="font-bold text-white">
                  ₹{payment.submitted_amount || 0} / <span className="text-slate-400">₹{payment.expected_amount || 0}</span>
                </div>
              </div>
              {payment.payer_upi_id && (
                <div className="col-span-2 bg-slate-900 border border-slate-800 p-2.5 rounded-lg flex items-center justify-between">
                  <span className="text-xs text-slate-400">Sender / Payer UPI ID:</span>
                  <span className="font-mono text-xs font-bold text-cyan-400">{payment.payer_upi_id}</span>
                </div>
              )}
              {payment.rejection_reason && (
                <div className="col-span-2 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-amber-300 text-xs">
                  <span className="font-bold">Hold / Rejection Note:</span> {payment.rejection_reason}
                </div>
              )}
            </div>
          </div>

          {/* Screenshot Area */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payment Proof Screenshot</h3>
              <FileImage size={16} className="text-slate-500" />
            </div>
            {payment.screenshot_url ? (
              <div className="rounded-lg overflow-hidden border border-slate-800 max-h-64 flex items-center justify-center bg-black">
                <img
                  src={payment.screenshot_url}
                  alt="Payment Proof"
                  className="max-h-64 object-contain"
                />
              </div>
            ) : (
              <div className="p-8 border border-dashed border-slate-800 rounded-lg text-center space-y-2 bg-slate-900/40">
                <FileImage size={32} className="mx-auto text-slate-600" />
                <div className="text-sm font-semibold text-slate-400">No screenshot submitted</div>
                <p className="text-xs text-slate-500">Participant verified via transaction reference (UTR).</p>
              </div>
            )}
          </div>
        </div>

        {/* Drawer Action Bar */}
        <div className="p-5 border-t border-slate-800 bg-slate-950 flex items-center justify-between space-x-3">
          <div className="text-xs text-slate-500 font-mono hidden sm:block">
            {isPending ? 'Shortcuts: A Approve | H Hold | R Reject | D Delete' : 'Shortcuts: D Delete'}
          </div>
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            {onDelete && (
              <button
                onClick={() => onDelete(payment.team_id)}
                className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-400 border border-rose-800/60 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1"
                title="Delete Registration (D)"
              >
                <Trash2 size={15} />
                <span>Delete</span>
              </button>
            )}
            {onHold && isPending && (
              <button
                onClick={() => onHold(payment.team_id)}
                className="px-3.5 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1.5"
                title="Put on Hold & Notify Participant (H)"
              >
                <PauseCircle size={16} />
                <span>Hold (H)</span>
              </button>
            )}
            {isPending && (
              <>
                <button
                  onClick={() => onReject(payment.team_id)}
                  className="px-3.5 py-2.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/40 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1.5"
                >
                  <XCircle size={16} />
                  <span>Reject (R)</span>
                </button>
                <button
                  onClick={() => onApprove(payment.team_id)}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition flex items-center justify-center space-x-1.5"
                >
                  <CheckCircle2 size={16} />
                  <span>Approve (A)</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};



import React, { useState } from 'react';
import { useAdminQuery } from '../hooks/useAdminQuery';
import { PaymentRecord, AdminError } from '../types';
import { adminFetch } from '../auth/adminFetch';
import { StatusChip } from '../components/StatusChip';
import { PaymentDetailDrawer } from '../components/PaymentDetailDrawer';
import { ReasonDialog } from '../components/ReasonDialog';
import { ApproveConfirmDialog } from '../components/ApproveConfirmDialog';
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog';
import { CreditCard, CheckCircle2, Trash2, CheckSquare, Square, RefreshCw, AlertCircle } from 'lucide-react';

export const Payments: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PENDING_VERIFICATION' | 'ON_HOLD' | 'REJECTED' | 'VERIFIED' | 'ALL'>('PENDING_VERIFICATION');

  const { data: response, loading, error, refetch } = useAdminQuery<{ success: boolean; payments: PaymentRecord[] }>(
    `/api/admin/payments?status=${activeTab}`
  );
  const payments = response?.payments || [];

  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [approvingPayment, setApprovingPayment] = useState<PaymentRecord | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<PaymentRecord | null>(null);
  const [rejectingTeamId, setRejectingTeamId] = useState<string | null>(null);
  const [holdingTeamId, setHoldingTeamId] = useState<string | null>(null);
  const [selectedForBulk, setSelectedForBulk] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleApprovePrompt = (teamIdOrRecord: string | PaymentRecord) => {
    if (typeof teamIdOrRecord === 'string') {
      const rec = payments.find(p => p.team_id === teamIdOrRecord) || { team_id: teamIdOrRecord, payment_status: 'PENDING_VERIFICATION' } as PaymentRecord;
      setApprovingPayment(rec);
    } else {
      setApprovingPayment(teamIdOrRecord);
    }
  };

  const handleConfirmApprove = async () => {
    if (!approvingPayment) return;
    const targetTeamId = approvingPayment.team_id;
    setSubmitting(true);
    setActionNotice(null);

    try {
      const res = await adminFetch<{ success: boolean; message: string }>('/api/admin/payments/verify', {
        method: 'POST',
        body: JSON.stringify({ team_id: targetTeamId }),
      });

      setActionNotice({ type: 'success', message: res.message || `Team ${targetTeamId} verified successfully.` });
      setApprovingPayment(null);
      setSelectedPayment(null);
      refetch();
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Payment approval failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleHoldPrompt = (teamId: string) => {
    setHoldingTeamId(teamId);
  };

  const handleConfirmHold = async (reason: string) => {
    if (!holdingTeamId) return;
    setSubmitting(true);
    setActionNotice(null);

    try {
      const res = await adminFetch<{ success: boolean; message: string }>('/api/admin/payments/hold', {
        method: 'POST',
        body: JSON.stringify({ team_id: holdingTeamId, reason }),
      });

      setActionNotice({ type: 'success', message: res.message || `Team ${holdingTeamId} payment placed ON HOLD. Correction notice emailed.` });
      setHoldingTeamId(null);
      setSelectedPayment(null);
      refetch();
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Failed to place payment on hold.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePrompt = (teamIdOrRecord: string | PaymentRecord) => {
    if (typeof teamIdOrRecord === 'string') {
      const rec = payments.find(p => p.team_id === teamIdOrRecord) || { team_id: teamIdOrRecord, payment_status: 'PENDING_VERIFICATION' } as PaymentRecord;
      setDeletingPayment(rec);
    } else {
      setDeletingPayment(teamIdOrRecord);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingPayment) return;
    const targetTeamId = deletingPayment.team_id;
    setSubmitting(true);
    setActionNotice(null);

    try {
      const res = await adminFetch<{ success: boolean; message: string }>('/api/admin/payments/delete', {
        method: 'POST',
        body: JSON.stringify({ team_id: targetTeamId }),
      });

      setActionNotice({ type: 'success', message: res.message || `Registration for team ${targetTeamId} deleted.` });
      setDeletingPayment(null);
      setSelectedPayment(null);
      refetch();
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Deletion failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectPrompt = (teamId: string) => {
    setRejectingTeamId(teamId);
  };

  const handleConfirmReject = async (reason: string) => {
    if (!rejectingTeamId) return;
    setSubmitting(true);
    setActionNotice(null);

    try {
      const res = await adminFetch<{ success: boolean; message: string }>('/api/admin/payments/reject', {
        method: 'POST',
        body: JSON.stringify({ team_id: rejectingTeamId, reason }),
      });

      setActionNotice({ type: 'success', message: res.message || `Team ${rejectingTeamId} rejected.` });
      setRejectingTeamId(null);
      setSelectedPayment(null);
      refetch();
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Payment rejection failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSelectBulk = (p: PaymentRecord) => {
    // Only payments with NO FLAGS can be selected for bulk approval
    if (p.computed_flags && p.computed_flags.length > 0) {
      setActionNotice({ type: 'error', message: 'Flagged payments cannot be selected for bulk verification.' });
      return;
    }

    if (selectedForBulk.includes(p.team_id)) {
      setSelectedForBulk(selectedForBulk.filter(id => id !== p.team_id));
    } else {
      setSelectedForBulk([...selectedForBulk, p.team_id]);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedForBulk.length === 0) return;
    setSubmitting(true);
    setActionNotice(null);

    try {
      const res = await adminFetch<{ success: boolean; message: string }>('/api/admin/payments/bulk-verify', {
        method: 'POST',
        body: JSON.stringify({ team_ids: selectedForBulk }),
      });

      setActionNotice({ type: 'success', message: res.message });
      setSelectedForBulk([]);
      refetch();
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Bulk verification failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Keyboard navigation for detail drawer (J = Next, K = Prev)
  const handleNextDrawer = () => {
    if (!selectedPayment) return;
    const currentIndex = payments.findIndex(p => p.team_id === selectedPayment.team_id);
    if (currentIndex >= 0 && currentIndex < payments.length - 1) {
      setSelectedPayment(payments[currentIndex + 1]);
    }
  };

  const handlePrevDrawer = () => {
    if (!selectedPayment) return;
    const currentIndex = payments.findIndex(p => p.team_id === selectedPayment.team_id);
    if (currentIndex > 0) {
      setSelectedPayment(payments[currentIndex - 1]);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Payment Verification Queue</h1>
          <p className="text-xs text-slate-400 font-medium">Verify transaction references, inspect warnings, approve passes, hold for corrections, or remove records</p>
        </div>

        <div className="flex items-center space-x-3">
          {selectedForBulk.length > 0 && (
            <button
              onClick={handleBulkApprove}
              disabled={submitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center space-x-2"
            >
              <CheckCircle2 size={16} />
              <span>Bulk Verify ({selectedForBulk.length})</span>
            </button>
          )}
          <button
            onClick={() => refetch()}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold rounded-xl transition flex items-center space-x-2"
          >
            <RefreshCw size={14} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Action Notice */}
      {actionNotice && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm ${
            actionNotice.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
          }`}
        >
          <div className="flex items-center space-x-2">
            {actionNotice.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span>{actionNotice.message}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-xs font-bold underline">Dismiss</button>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 overflow-x-auto">
        {[
          { key: 'PENDING_VERIFICATION', label: 'Pending Queue' },
          { key: 'ON_HOLD', label: 'On Hold' },
          { key: 'REJECTED', label: 'Rejected' },
          { key: 'VERIFIED', label: 'Approved' },
          { key: 'ALL', label: 'All Payments' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key as any);
              setSelectedForBulk([]);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === tab.key
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Payment Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {loading && payments.length === 0 ? (
          <div className="p-12 text-center text-slate-400">Loading payment records...</div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <CreditCard size={36} className="mx-auto text-slate-600" />
            <div className="font-semibold text-slate-400">No payment records found in this view.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-xs text-slate-400 uppercase font-semibold">
                  <th className="p-4 w-10 text-center">Bulk</th>
                  <th className="p-4">Team ID / Name</th>
                  <th className="p-4">College</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Transaction UTR</th>
                  <th className="p-4">Attempt</th>
                  <th className="p-4">Flags</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center w-16">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {payments.map((p) => {
                  const isFlagged = p.computed_flags && p.computed_flags.length > 0;
                  const isChecked = selectedForBulk.includes(p.team_id);
                  const isPending = p.payment_status === 'PENDING_VERIFICATION' || p.payment_status === 'AWAITING_PAYMENT' || p.payment_status === 'ON_HOLD';

                  return (
                    <tr
                      key={p.team_id}
                      onClick={() => setSelectedPayment(p)}
                      className="hover:bg-slate-800/50 cursor-pointer transition"
                    >
                      {/* Checkbox for Bulk Approval */}
                      <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                        {isPending && (
                          <button
                            onClick={() => toggleSelectBulk(p)}
                            disabled={isFlagged}
                            title={isFlagged ? 'Flagged payments cannot be bulk approved' : 'Select for bulk approval'}
                            className={`p-1 rounded transition ${
                              isFlagged ? 'opacity-30 cursor-not-allowed text-slate-600' : 'text-indigo-400 hover:text-indigo-300'
                            }`}
                          >
                            {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                          </button>
                        )}
                      </td>

                      {/* Team ID & Name */}
                      <td className="p-4">
                        <div className="font-mono text-xs font-bold text-indigo-400">{p.team_id}</div>
                        <div className="font-bold text-white text-sm">{p.teams?.team_name || `Team ${p.team_id}`}</div>
                        {p.lead_name && (
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-[170px]" title={`${p.lead_name} ${p.lead_email ? `<${p.lead_email}>` : ''}`}>
                            Lead: <span className="text-slate-300 font-semibold">{p.lead_name}</span>
                          </div>
                        )}
                      </td>

                      {/* College */}
                      <td className="p-4 text-slate-300 text-xs truncate max-w-[180px]">
                        {p.teams?.college || 'N/A'}
                      </td>

                      {/* Amount */}
                      <td className="p-4">
                        <div className="font-bold text-white text-sm">₹{p.submitted_amount || 0}</div>
                        <div className="text-[10px] text-slate-500">Exp: ₹{p.expected_amount || 0}</div>
                      </td>

                      {/* UTR & Payer UPI */}
                      <td className="p-4">
                        <div className="font-mono text-xs text-emerald-400 font-semibold">{p.utr_number || '—'}</div>
                        {p.payer_upi_id && (
                          <div className="font-mono text-[10px] text-cyan-400 font-medium truncate max-w-[140px]" title={p.payer_upi_id}>
                            UPI: {p.payer_upi_id}
                          </div>
                        )}
                      </td>

                      {/* Attempt */}
                      <td className="p-4 text-xs font-semibold text-amber-400">
                        #{p.attempt_no || 1}
                      </td>

                      {/* Flags */}
                      <td className="p-4">
                        {isFlagged ? (
                          <div className="flex flex-wrap gap-1">
                            {p.computed_flags!.map(flag => (
                              <span key={flag} className="px-1.5 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold rounded">
                                {flag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-medium">Clean</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-4 text-center">
                        <StatusChip status={p.payment_status} type="payment" />
                      </td>

                      {/* Action Column: Delete Button */}
                      <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDeletePrompt(p)}
                          title="Delete Registration"
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer */}
      <PaymentDetailDrawer
        payment={selectedPayment}
        onClose={() => setSelectedPayment(null)}
        onApprove={handleApprovePrompt}
        onReject={handleRejectPrompt}
        onHold={handleHoldPrompt}
        onDelete={handleDeletePrompt}
        onNext={handleNextDrawer}
        onPrev={handlePrevDrawer}
      />

      {/* Approval Confirmation Dialog */}
      <ApproveConfirmDialog
        isOpen={!!approvingPayment}
        payment={approvingPayment}
        onConfirm={handleConfirmApprove}
        onClose={() => setApprovingPayment(null)}
        loading={submitting}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={!!deletingPayment}
        payment={deletingPayment}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingPayment(null)}
        loading={submitting}
      />

      {/* Reason Dialog for Hold */}
      <ReasonDialog
        isOpen={!!holdingTeamId}
        title={`Place Payment ON HOLD for ${holdingTeamId}`}
        subtitle="This will send an email notification asking the participant to submit their correct transaction/UPI ID and payment screenshot."
        cannedReasons={[
          'Transaction ID / UPI ID is not correct',
          'Payment proof screenshot missing or unreadable',
          'Transaction reference not found in bank statement',
          'Submitted fee amount mismatch',
        ]}
        onConfirm={handleConfirmHold}
        onClose={() => setHoldingTeamId(null)}
        loading={submitting}
      />

      {/* Reason Dialog for Rejection */}
      <ReasonDialog
        isOpen={!!rejectingTeamId}
        title={`Reject Payment for ${rejectingTeamId}`}
        subtitle="Rejecting this payment will notify all members via email and revert confirmed seats to HELD status."
        cannedReasons={[
          'Reference not found in statement',
          'Amount short',
          'Screenshot unreadable',
          'Duplicate payment',
        ]}
        onConfirm={handleConfirmReject}
        onClose={() => setRejectingTeamId(null)}
        loading={submitting}
      />
    </div>
  );
};



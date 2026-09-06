import React, { useState } from 'react';
import { useAdminQuery } from '../hooks/useAdminQuery';
import { EventCount, AdminError, PaymentRecord } from '../types';
import { adminFetch } from '../auth/adminFetch';
import { StatusChip } from '../components/StatusChip';
import { CapacityBar } from '../components/CapacityBar';
import { ReasonDialog } from '../components/ReasonDialog';
import { PaymentDetailDrawer } from '../components/PaymentDetailDrawer';
import {
  CalendarCheck,
  Lock,
  ToggleLeft,
  ToggleRight,
  Edit3,
  AlertCircle,
  Info,
  RefreshCw,
  Users,
  Search,
  Download,
  Filter,
  Layers,
  ChevronDown,
  Building,
  Mail,
  Phone,
  Tag
} from 'lucide-react';

interface ParticipantRecord {
  team_id: string;
  team_name: string;
  college: string;
  department: string;
  year: string;
  leader_name: string;
  leader_email: string;
  leader_phone: string;
  registered_events: string[];
  registered_event_names: string[];
  members: any[];
  member_count: number;
  payment_status: string;
  utr_number?: string | null;
  submitted_amount?: number | null;
  created_at?: string;
}

export const Events: React.FC = () => {
  const [viewMode, setViewMode] = useState<'ROSTER' | 'CAPACITY'>('ROSTER');
  const [selectedEventFilter, setSelectedEventFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantRecord | null>(null);

  // Fetch events capacity & grid
  const {
    data: eventsResponse,
    loading: eventsLoading,
    refetch: refetchEvents
  } = useAdminQuery<{ success: boolean; events: EventCount[] }>('/api/admin/events');
  const events = eventsResponse?.events || [];

  // Fetch participants (filtered by event)
  const {
    data: participantsResponse,
    loading: participantsLoading,
    refetch: refetchParticipants
  } = useAdminQuery<{ success: boolean; count: number; participants: ParticipantRecord[] }>(
    `/api/admin/event-participants?event_id=${selectedEventFilter}`
  );
  const rawParticipants = participantsResponse?.participants || [];

  // Event toggle & capacity states
  const [selectedEventForClose, setSelectedEventForClose] = useState<EventCount | null>(null);
  const [editingCapacityEvent, setEditingCapacityEvent] = useState<EventCount | null>(null);
  const [newCapacity, setNewCapacity] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [overfillWarning, setOverfillWarning] = useState<{ event: EventCount; message: string } | null>(null);

  // Search filter for participant table
  const filteredParticipants = rawParticipants.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.team_id.toLowerCase().includes(q) ||
      p.team_name.toLowerCase().includes(q) ||
      p.leader_name.toLowerCase().includes(q) ||
      p.leader_email.toLowerCase().includes(q) ||
      p.college.toLowerCase().includes(q) ||
      p.department.toLowerCase().includes(q) ||
      p.registered_event_names.some((e) => e.toLowerCase().includes(q))
    );
  });

  // Selected event metadata
  const currentEventMeta = events.find((e) => e.event_id === selectedEventFilter);

  const handleToggleOpen = (evt: EventCount) => {
    setActionError(null);
    if (evt.registration_open) {
      setSelectedEventForClose(evt);
    } else {
      executeEventUpdate(evt.event_id, { registration_open: true });
    }
  };

  const handleConfirmClose = (reason: string) => {
    if (!selectedEventForClose) return;
    executeEventUpdate(selectedEventForClose.event_id, {
      registration_open: false,
      close_reason: reason,
    });
    setSelectedEventForClose(null);
  };

  const handleSaveCapacity = (evt: EventCount) => {
    setActionError(null);
    const capNum = newCapacity.trim() === '' ? null : parseInt(newCapacity, 10);
    executeEventUpdate(evt.event_id, { capacity: capNum });
    setEditingCapacityEvent(null);
  };

  const executeEventUpdate = async (eventId: string, payload: any) => {
    setSubmitting(true);
    setActionError(null);

    try {
      await adminFetch(`/api/admin/events/${eventId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setOverfillWarning(null);
      refetchEvents();
    } catch (err: any) {
      if (err instanceof AdminError && err.errorCode === 'WOULD_OVERFILL') {
        const target = events.find((e) => e.event_id === eventId);
        if (target) {
          setOverfillWarning({ event: target, message: err.message });
        }
      } else {
        setActionError(err.message || 'Failed to update event.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredParticipants.length === 0) return;

    const headers = ['Team ID', 'Team Name', 'Lead Name', 'Email', 'Phone', 'College', 'Department', 'Year', 'Registered Events', 'Status'];
    const rows = filteredParticipants.map((p) => [
      `"${p.team_id}"`,
      `"${p.team_name}"`,
      `"${p.leader_name}"`,
      `"${p.leader_email}"`,
      `"${p.leader_phone}"`,
      `"${p.college}"`,
      `"${p.department}"`,
      `"${p.year}"`,
      `"${p.registered_event_names.join(', ')}"`,
      `"${p.payment_status}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `participants_${selectedEventFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Convert ParticipantRecord to PaymentRecord format for drawer
  const getDrawerPaymentRecord = (p: ParticipantRecord | null): PaymentRecord | null => {
    if (!p) return null;
    return {
      team_id: p.team_id,
      payment_status: p.payment_status,
      utr_number: p.utr_number,
      submitted_amount: p.submitted_amount,
      created_at: p.created_at,
      lead_name: p.leader_name,
      lead_email: p.leader_email,
      lead_phone: p.leader_phone,
      teams: {
        team_id: p.team_id,
        team_name: p.team_name,
        college: p.college,
        department: p.department,
        year: p.year,
        member_count: p.member_count
      },
      members: p.members,
      registered_events: p.registered_events
    };
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Bar with Navigation Tabs and Event Selector Dropdown */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl backdrop-blur-md">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
              <CalendarCheck size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Event Registers &amp; Capacity Control</h1>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Filter participant lists by Technical &amp; Non-Technical events or manage seat limits
              </p>
            </div>
          </div>

          {/* View Mode Toggle Switch */}
          <div className="flex items-center space-x-2 mt-4">
            <button
              onClick={() => setViewMode('ROSTER')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                viewMode === 'ROSTER'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Users size={15} />
              <span>Participant Register</span>
            </button>
            <button
              onClick={() => setViewMode('CAPACITY')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                viewMode === 'CAPACITY'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Layers size={15} />
              <span>Event Capacity Grid</span>
            </button>
          </div>
        </div>

        {/* RIGHT CORNER LIST BOX DROPDOWN FILTER FOR ALL TECH & NON-TECH EVENTS */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 self-start lg:self-center">
          <div className="space-y-1">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-400 flex items-center space-x-1.5">
              <Filter size={12} />
              <span>Event Register List Box:</span>
            </label>
            <div className="relative">
              <select
                id="event-select-dropdown"
                value={selectedEventFilter}
                onChange={(e) => setSelectedEventFilter(e.target.value)}
                className="w-full sm:w-[280px] bg-slate-950 border-2 border-indigo-500/60 hover:border-indigo-400 text-white text-xs font-bold rounded-xl px-4 py-2.5 shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none pr-10"
              >
                <option value="all">🌟 ALL EVENTS (Tech &amp; Non-Tech)</option>
                <optgroup label="💻 TECHNICAL EVENTS">
                  <option value="debugging">#01 — DEBUGGING</option>
                  <option value="the-last-signal">#02 — THE LAST SIGNAL</option>
                  <option value="lost-at-sql">#03 — LOST AT SQL</option>
                  <option value="gadget-codes">#04 — GADGET CODES</option>
                  <option value="paper-presentation">#05 — PAPER PRESENTATION</option>
                </optgroup>
                <optgroup label="🎭 NON-TECHNICAL EVENTS">
                  <option value="borderland-at-gcee">#06 — BORDERLAND AT GCEE</option>
                  <option value="think-strike-and-win">#07 — THINK, STRIKE AND WIN</option>
                  <option value="plot-twist">#08 — PLOT TWIST</option>
                  <option value="short-flim">#09 — SHORT FILM</option>
                </optgroup>
              </select>
              <ChevronDown size={16} className="absolute right-3 top-3 text-indigo-400 pointer-events-none" />
            </div>
          </div>

          <button
            onClick={() => {
              refetchEvents();
              refetchParticipants();
            }}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl transition flex items-center space-x-2"
            title="Refresh Data"
          >
            <RefreshCw size={15} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Action Error Banner */}
      {actionError && (
        <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl flex items-center justify-between text-rose-400 text-sm">
          <div className="flex items-center space-x-2">
            <AlertCircle size={20} className="shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-xs font-bold underline">Dismiss</button>
        </div>
      )}

      {/* Overfill Warning Banner */}
      {overfillWarning && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl space-y-3 text-amber-300 text-sm">
          <div className="flex items-center space-x-2 font-bold">
            <AlertCircle size={20} className="text-amber-400" />
            <span>Warning: Over-Capacity Reopening</span>
          </div>
          <p>{overfillWarning.message}</p>
          <div className="flex items-center space-x-3 pt-1">
            <button
              onClick={() => executeEventUpdate(overfillWarning.event.event_id, { registration_open: true, force_reopen: true })}
              disabled={submitting}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg transition"
            >
              Confirm Reopen
            </button>
            <button
              onClick={() => setOverfillWarning(null)}
              className="px-4 py-2 bg-slate-800 text-slate-300 font-medium text-xs rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* VIEW MODE 1: PARTICIPANT REGISTER VIEW */}
      {viewMode === 'ROSTER' && (
        <div className="space-y-4">
          {/* Selected Event Summary Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-400 font-mono text-xs font-bold">
                {selectedEventFilter === 'all'
                  ? 'ALL'
                  : currentEventMeta
                  ? `#${currentEventMeta.code}`
                  : selectedEventFilter.toUpperCase()}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-bold text-white uppercase tracking-wide">
                    {selectedEventFilter === 'all'
                      ? 'All Registered Participants'
                      : currentEventMeta?.event_name || selectedEventFilter.replace(/-/g, ' ')}
                  </h2>
                  {currentEventMeta && (
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {currentEventMeta.category}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Showing <strong className="text-indigo-400 font-mono">{filteredParticipants.length}</strong> participants registered for this event
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Quick Search Box */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search participant, email, college..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 rounded-xl pl-9 pr-4 py-2 w-64 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Export CSV Button */}
              <button
                onClick={handleExportCSV}
                disabled={filteredParticipants.length === 0}
                className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 disabled:opacity-50"
              >
                <Download size={14} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Participant Register Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            {participantsLoading ? (
              <div className="flex items-center justify-center min-h-[300px]">
                <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
              </div>
            ) : filteredParticipants.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-2">
                <Users size={36} className="mx-auto text-slate-600" />
                <p className="font-bold text-sm text-slate-400">No participants found for this event filter.</p>
                <p className="text-xs">Try selecting another event from the top right dropdown or adjust your search.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] text-slate-400 uppercase font-bold tracking-wider">
                      <th className="p-4">Team / Participant ID</th>
                      <th className="p-4">Lead Participant</th>
                      <th className="p-4">Institution / Dept</th>
                      <th className="p-4">Registered Events</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredParticipants.map((p) => {
                      return (
                        <tr key={p.team_id} className="hover:bg-slate-800/40 transition">
                          {/* Team / Participant ID */}
                          <td className="p-4">
                            <div className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20 w-fit">
                              {p.team_id}
                            </div>
                            <div className="font-bold text-white text-xs mt-1">{p.team_name}</div>
                            <div className="text-[11px] text-slate-500 font-medium">
                              {p.member_count} {p.member_count === 1 ? 'Participant' : 'Members'}
                            </div>
                          </td>

                          {/* Lead Participant */}
                          <td className="p-4">
                            <div className="font-bold text-white text-xs flex items-center space-x-1.5">
                              <span>{p.leader_name}</span>
                              <span className="bg-amber-500/10 text-amber-400 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold">
                                LEAD
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center space-x-1 mt-0.5">
                              <Mail size={11} className="text-slate-500 shrink-0" />
                              <span className="truncate max-w-[180px]">{p.leader_email}</span>
                            </div>
                            {p.leader_phone && (
                              <div className="text-[11px] text-slate-400 flex items-center space-x-1 mt-0.5">
                                <Phone size={11} className="text-slate-500 shrink-0" />
                                <span>{p.leader_phone}</span>
                              </div>
                            )}
                          </td>

                          {/* Institution & Dept */}
                          <td className="p-4">
                            <div className="text-xs font-bold text-slate-200 flex items-center space-x-1">
                              <Building size={12} className="text-indigo-400 shrink-0" />
                              <span>{p.college}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {p.department} ({p.year} Year)
                            </div>
                          </td>

                          {/* Registered Events Badges */}
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {p.registered_event_names.map((evName, idx) => {
                                const evId = p.registered_events[idx] || '';
                                const isMatched = selectedEventFilter !== 'all' && evId.includes(selectedEventFilter);
                                return (
                                  <span
                                    key={idx}
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                      isMatched
                                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm font-extrabold'
                                        : 'bg-slate-800 text-slate-300 border-slate-700'
                                    }`}
                                  >
                                    {evName}
                                  </span>
                                );
                              })}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="p-4 text-center">
                            <StatusChip status={p.payment_status} type="payment" />
                          </td>

                          {/* Actions */}
                          <td className="p-4 text-right">
                            <button
                              onClick={() => setSelectedParticipant(p)}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 text-xs font-bold rounded-lg border border-slate-700 transition"
                            >
                              View Details
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
        </div>
      )}

      {/* VIEW MODE 2: CAPACITY & GRID CONTROL */}
      {viewMode === 'CAPACITY' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Event Seat Capacity Grid</h2>
              <p className="text-xs text-slate-400">Configure max seats and toggle registration status per event</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-xs text-slate-400 uppercase font-semibold">
                  <th className="p-4">Code / Name</th>
                  <th className="p-4">Category</th>
                  <th className="p-4 w-56">Registration Progress</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Open / Close</th>
                  <th className="p-4 text-right">Capacity Settings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {events.map((evt) => {
                  const isPaper = evt.event_id === 'paper-presentation' || evt.code === '05';

                  return (
                    <tr key={evt.event_id} className="hover:bg-slate-800/40 transition">
                      {/* Code & Name */}
                      <td className="p-4">
                        <div className="flex items-center space-x-2.5">
                          <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                            #{evt.code}
                          </span>
                          <div>
                            <div className="font-bold text-white flex items-center space-x-1.5">
                              <span>{evt.event_name}</span>
                              {isPaper && (
                                <span title="Fixed capacity at 24">
                                  <Lock size={14} className="text-amber-400" />
                                </span>
                              )}
                            </div>
                            {isPaper && (
                              <div className="text-[11px] text-amber-400/90 font-medium mt-0.5 flex items-center space-x-1">
                                <Info size={12} />
                                <span>Fixed at 24 (2 panels of twelve 15-min slots)</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="p-4 text-slate-400 text-xs font-medium uppercase">{evt.category}</td>

                      {/* Progress Bar */}
                      <td className="p-4">
                        <CapacityBar
                          registered={evt.registered_count}
                          capacity={evt.capacity}
                          percentage={evt.percentage}
                          status={evt.status}
                          capacityUnit={evt.capacity_unit}
                        />
                      </td>

                      {/* Status Badge */}
                      <td className="p-4 text-center">
                        <StatusChip status={evt.status} type="event" />
                      </td>

                      {/* Open/Close Switch */}
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleToggleOpen(evt)}
                          disabled={submitting}
                          className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                            evt.registration_open
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {evt.registration_open ? (
                            <>
                              <ToggleRight size={18} className="text-emerald-400" />
                              <span>OPEN</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft size={18} className="text-slate-500" />
                              <span>CLOSED</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Capacity Editing */}
                      <td className="p-4 text-right">
                        {isPaper ? (
                          <span className="text-xs font-mono text-slate-400 font-bold bg-slate-800 px-2.5 py-1 rounded">
                            24 (Read-Only)
                          </span>
                        ) : editingCapacityEvent?.event_id === evt.event_id ? (
                          <div className="flex items-center justify-end space-x-2">
                            <input
                              type="number"
                              value={newCapacity}
                              onChange={(e) => setNewCapacity(e.target.value)}
                              placeholder="Unlimited"
                              className="w-24 bg-slate-950 border border-indigo-500 rounded px-2 py-1 text-xs text-white focus:outline-none"
                            />
                            <button
                              onClick={() => handleSaveCapacity(evt)}
                              className="px-2.5 py-1 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-500"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingCapacityEvent(null)}
                              className="px-2 py-1 bg-slate-800 text-slate-400 text-xs rounded hover:bg-slate-700"
                            >
                              X
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingCapacityEvent(evt);
                              setNewCapacity(evt.capacity !== null ? String(evt.capacity) : '');
                            }}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg inline-flex items-center space-x-1.5 transition border border-slate-700"
                          >
                            <Edit3 size={14} />
                            <span>{evt.capacity !== null ? `${evt.capacity} seats` : 'Unlimited'}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Participant Detail Drawer */}
      <PaymentDetailDrawer
        payment={getDrawerPaymentRecord(selectedParticipant)}
        onClose={() => setSelectedParticipant(null)}
        onApprove={() => {}}
        onReject={() => {}}
      />

      {/* Reason Dialog for Closing */}
      <ReasonDialog
        isOpen={!!selectedEventForClose}
        title={`Close Registration: ${selectedEventForClose?.event_name}`}
        subtitle="Closing this event will prevent any further participant seat claims."
        cannedReasons={[
          'Event full',
          'Registration deadline passed',
          'Venue capacity constraint',
          'Schedule conflict',
        ]}
        onConfirm={handleConfirmClose}
        onClose={() => setSelectedEventForClose(null)}
        loading={submitting}
      />
    </div>
  );
};

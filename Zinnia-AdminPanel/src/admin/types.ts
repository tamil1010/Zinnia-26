export type AdminRole = 'SUPER_ADMIN' | 'TREASURER' | 'GATE_ADMIN' | 'FOOD_ADMIN' | 'EVENT_COORDINATOR';

export interface AdminUser {
  id: string;
  username: string;
  name: string;
  role: AdminRole;
  allowed_events: string[];
}

export type CapacityUnit = 'TEAMS' | 'HEADS';
export type EventStatus = 'OPEN' | 'NEARLY_FULL' | 'FULL' | 'CLOSED';

export interface EventCount {
  event_id: string;
  code: string;
  event_name: string;
  category: string;
  capacity: number | null;
  held_seats: number;
  capacity_unit: CapacityUnit;
  registered_count: number;
  remaining_seats: number | null;
  percentage: number;
  registration_open: boolean;
  registration_closes_at?: string | null;
  status: EventStatus;
}

export interface PaymentTeamDetail {
  team_id: string;
  team_name: string;
  college: string;
  department: string;
  year: string;
  member_count: number;
}

export interface TeamMember {
  name: string;
  email?: string;
  phone?: string;
  is_leader?: boolean;
  food_preference?: 'VEG' | 'NON_VEG' | string;
}

export interface PaymentRecord {
  team_id: string;
  payment_status: 'AWAITING_PAYMENT' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'ON_HOLD' | 'HELD' | string;
  utr_number?: string | null;

  payer_upi_id?: string | null;
  submitted_amount?: number | null;
  expected_amount?: number;
  rejection_reason?: string | null;
  created_at?: string;
  updated_at?: string;
  attempt_no?: number;
  computed_flags?: string[];
  screenshot_url?: string | null;
  teams?: PaymentTeamDetail;
  members?: TeamMember[];
  registered_events?: string[];
  lead_name?: string;
  lead_email?: string;
  lead_phone?: string;
}

export interface AttentionItem {
  pending_over_24h: number;
  events_over_90_percent: number;
  teams_awaiting: number;
  held_registrations: number;
  events_closing_48h: number;
}

export interface DashboardTotals {
  participants: number;
  approved_payments: number;
  pending_payments: number;
  rejected_payments: number;
  revenue: number | null;
  total_event_registrations: number;
  teams_awaiting_acceptance: number;
}

export interface TrendPoint {
  date: string;
  count: number;
}

export interface CollegeStat {
  college: string;
  team_count: number;
}

export interface AuditLogItem {
  id: string;
  admin_username: string;
  admin_role: string;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  reason?: string | null;
  created_at: string;
  detail?: any;
}

export interface FoodBreakdown {
  veg: number;
  non_veg: number;
  total: number;
}

export interface DashboardData {
  generated_at: string;
  totals: DashboardTotals;
  revenue: {
    total: number | null;
    approved_count: number;
    pending_count: number;
    rejected_count: number;
  };
  capacity: EventCount[];
  trend: TrendPoint[];
  colleges: CollegeStat[];
  attention: AttentionItem;
  food: FoodBreakdown;
  recent: AuditLogItem[];
}

export class AdminError extends Error {
  errorCode?: string;

  constructor(message: string, errorCode?: string) {
    super(message);
    this.name = 'AdminError';
    this.errorCode = errorCode;
  }
}

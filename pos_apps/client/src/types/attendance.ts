export type AttendanceStatus = 'ON_TIME' | 'LATE' | 'EARLY_LEAVE';

export interface AttendanceConfig {
  standardClockIn?: string; // e.g. "08:00"
  standardClockOut?: string; // e.g. "17:00"
  lateToleranceMinutes?: number; // e.g. 15
}

export interface StaffAttendanceItem {
  id: string;
  name: string;
  role: string;
  userCode?: string | null;
  hasPin: boolean;
  currentAttendance?: {
    id: string;
    clockIn: string;
    clockOut: string | null;
    durationMinutes: number | null;
    lateMinutes: number | null;
    status: AttendanceStatus;
    notes: string | null;
    isClockedIn: boolean;
  } | null;
}

export interface TodayAttendanceResponse {
  workDate: string;
  timezone: string;
  attendanceConfig?: AttendanceConfig | null;
  staff: StaffAttendanceItem[];
  attendances: AttendanceRecord[];
}

export interface AttendanceRecord {
  id: string;
  tenantId: string;
  outletId: string;
  userId: string;
  workDate: string;
  clockIn: string;
  clockOut: string | null;
  durationMinutes: number | null;
  lateMinutes: number | null;
  status: AttendanceStatus;
  notes: string | null;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    role: string;
    userCode?: string | null;
  };
  outlet?: {
    id: string;
    name: string;
    timezone?: string;
  };
}

export interface AttendanceReportSummary {
  totalRecords: number;
  onTimeCount: number;
  lateCount: number;
  earlyLeaveCount: number;
  totalWorkingHours: number;
  avgLateMinutes: number;
}

export interface AttendanceReportResponse {
  data: AttendanceRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: AttendanceReportSummary;
}

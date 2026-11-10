export type UserRole = 'super_admin' | 'manager' | 'employee';
export type UserStatus = 'active' | 'inactive' | 'archived';

export interface User {
  id: string;
  employeeCode: string; // EMP-000001, immutable, unique
  username: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  email: string;
  mobile: string;
  department: string;
  avatarUrl?: string;
  active: boolean; // true if status === 'active'
  designatedManagerId?: string;
  fallbackManagerId?: string;
  createdAt: string;
  archivedAt?: string;
  archivedBy?: string;
  lastLoginAt?: string;
}

export type ShiftMode = 'morning' | 'evening' | 'both' | 'rotating' | 'custom';

export interface EmployeeProfile {
  employeeId: string;
  nationalId: string;
  birthDate: string; // YYYY-MM-DD
  landline?: string;
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
  bankAccount: string; // e.g. 1234-5678-9012-3456
  iban: string; // e.g. IR120120000000000000000000
  hireDate: string;
  status: 'active' | 'suspended' | 'on_leave';
  notes?: string;

  // Custom shift & schedule settings configured by manager/admin per employee
  shiftMode: ShiftMode;
  customShiftStart?: string; // e.g. '08:00'
  customShiftEnd?: string; // e.g. '14:00'
  customShiftDurationMinutes?: number; // e.g. 360
  allowedLatenessMinutes?: number; // e.g. 15
  earlyDepartureGraceMinutes?: number; // e.g. 10
  weeklyOffDays: number[]; // 0=Saturday (شنبه), 1=Sunday .. 5=Thursday (پنج‌شنبه), 6=Friday (جمعه)
}

export interface ShiftTemplate {
  id: string;
  name: string;
  code: string;
  startTime: string; // '08:00'
  endTime: string; // '14:00'
  scheduledDurationMinutes: number;
  breakDurationMinutes: number;
  isPaidBreak: boolean;
  allowedLatenessMinutes: number;
  earlyDepartureGraceMinutes: number;
  overtimeEligibility: boolean;
  crossMidnight: boolean;
  color: string;
  description?: string;
}

export interface WorkSchedule {
  id: string;
  employeeId: string;
  dateString: string; // 'YYYY-MM-DD' (Tehran calendar day)
  shiftTemplateId: string;
  customStartTime?: string;
  customEndTime?: string;
  isRestDay?: boolean;
  isHoliday?: boolean;
}

export interface LabHoliday {
  id: string;
  dateString: string; // 'YYYY-MM-DD'
  title: string;
  isOfficial: boolean; // Official calendar holiday vs Lab emergency / custom closure
  appliesToAll?: boolean;
  notes?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface GPSPolicy {
  id: string;
  employeeId: string; // or 'default'
  required: boolean;
  targetLat: number;
  targetLng: number;
  allowedRadiusMeters: number;
  allowExceptionRequest: boolean;
  poorAccuracyThresholdMeters: number; // e.g. 50m
  policyVersion: number;
  effectiveDate: string;
  exceptionManagerId?: string;
}

export type LocationResult =
  | 'verified'
  | 'out_of_bounds'
  | 'accuracy_too_low'
  | 'gps_disabled'
  | 'gps_optional_exempt'
  | 'override_approved';

export interface AttendanceEvent {
  id: string;
  employeeId: string;
  eventType: 'check_in' | 'check_out';
  serverTimestamp: string; // UTC ISO string authoritative
  scheduleId?: string;
  locationResult: LocationResult;
  coords?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  distanceMeters?: number;
  policyVersion: number;
  deviceInfo?: string;
  eventSource: 'personal_device' | 'laboratory_terminal';
  exceptionId?: string;
  notes?: string;
}

export interface AttendanceSession {
  id: string;
  employeeId: string;
  dateString: string;
  shiftType?: 'morning' | 'evening' | 'custom' | 'rotating';
  checkInEventId: string;
  checkOutEventId?: string;
  checkInTime: string;
  checkOutTime?: string;
  rawDurationMinutes?: number;
  calculatedWorkMinutes?: number;
  latenessMinutes: number;
  earlyDepartureMinutes: number;
  approvedOvertimeMinutes: number;
  hourlyLeaveCoveredMinutes?: number;
  status: 'open' | 'closed' | 'incomplete_missing_checkout' | 'corrected';
}

export interface AttendanceCorrectionRequest {
  id: string;
  employeeId: string;
  dateString: string;
  targetEventType: 'check_in' | 'check_out' | 'both';
  requestedCheckInTime?: string;
  requestedCheckOutTime?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  assignedApproverId: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export type TaskStatus =
  | 'new'
  | 'in_progress'
  | 'completion_reported'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'overdue'
  | 'cancelled';

export interface TaskHistoryEntry {
  timestamp: string;
  actorId: string;
  actorName: string;
  action: string;
  note?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  creatorId: string;
  creatorName: string;
  assigneeId: string;
  assigneeName: string;
  mandatory: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  status: TaskStatus;
  designatedApproverId: string;
  completionReportedAt?: string;
  completionNotes?: string;
  approvalDecisionAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  history: TaskHistoryEntry[];
  createdAt: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: 'annual' | 'medical' | 'hourly' | 'emergency';
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isPartialDay?: boolean;
  startTime?: string; // e.g. '10:00'
  endTime?: string; // e.g. '12:30'
  durationMinutes?: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  assignedApproverId: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface MissionRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  destination: string;
  purpose: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  status: 'pending' | 'approved' | 'rejected';
  assignedApproverId: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface GPSExceptionRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  eventType: 'check_in' | 'check_out';
  coords?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  distanceMeters?: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  assignedApproverId: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  recipientId: string;
  type:
    | 'task_assigned'
    | 'task_deadline'
    | 'task_overdue'
    | 'task_approval'
    | 'leave_decision'
    | 'mission_decision'
    | 'correction_decision'
    | 'checkout_reminder'
    | 'schedule_change'
    | 'approval_required'
    | 'birthday_reminder'
    | 'birthday_greeting';
  title: string;
  message: string;
  read: boolean;
  referenceId?: string;
  referenceType?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  category:
    | 'auth'
    | 'attendance'
    | 'task'
    | 'leave'
    | 'schedule'
    | 'policy'
    | 'profile'
    | 'export'
    | 'center_settings'
    | 'employee_mgmt';
  affectedRecordId?: string;
  details: string;
  serverTimestamp: string;
  ipAddress?: string;
}

export interface CenterSettings {
  centerName: string;
  logoUrl: string;
  licenseNumber: string;
  address: string;
  city: string;
  province: string;
  phoneMain: string;
  phoneSecondary?: string;
  email: string;
  website?: string;
  gpsLat: number;
  gpsLng: number;
  allowedRadiusMeters: number;
  timeZone: string;
  workingDays: number[]; // 0=Sat, ..., 6=Fri
  defaultWorkStart: string; // e.g. '07:30'
  defaultWorkEnd: string; // e.g. '15:30'
  defaultLatenessToleranceMinutes: number;
  defaultOvertimeAutoApprove: boolean;
  updatedAt: string;
  updatedBy?: string;
}

// Backward-compatibility alias
export interface SystemSettings extends CenterSettings {
  orgName: string;
  orgTimezone: string;
  defaultLat: number;
  defaultLng: number;
  defaultRadiusMeters: number;
  contactPhone: string;
  contactAddress: string;
}

export interface CalculationBreakdown {
  scheduledMinutes: number;
  actualDurationMinutes: number;
  latenessMinutes: number;
  earlyDepartureMinutes: number;
  approvedOvertimeMinutes: number;
  netWorkMinutes: number;
  breakDeductionMinutes: number;
  hourlyLeaveMinutes: number;
  isAbsent: boolean;
  isRestDay: boolean;
  isLabHoliday: boolean;
  hasLeave: boolean;
  hasMission: boolean;
  statusDescription: string;
}

export interface BirthdayGreetingInfo {
  isBirthdayToday: boolean;
  isBirthdayYesterday: boolean;
  daysUntilBirthday?: number;
  employeeName: string;
  birthJalaliDateStr: string;
  greetingMessage?: string;
}

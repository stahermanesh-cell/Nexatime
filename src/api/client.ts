import {
  AttendanceEvent,
  AttendanceSession,
  AuditLog,
  EmployeeProfile,
  GPSPolicy,
  LeaveRequest,
  MissionRequest,
  ShiftTemplate,
  SystemSettings,
  CenterSettings,
  TaskItem,
  User,
  WorkSchedule,
  LabHoliday
} from '../types';

let currentAuthToken = localStorage.getItem('toranj_auth_token') || '';
let currentUserId = localStorage.getItem('toranj_user_id') || '';

export function setAuthSession(token: string, userId: string) {
  currentAuthToken = token;
  currentUserId = userId;
  localStorage.setItem('toranj_auth_token', token);
  localStorage.setItem('toranj_user_id', userId);
}

export function clearAuthSession() {
  currentAuthToken = '';
  currentUserId = '';
  localStorage.removeItem('toranj_auth_token');
  localStorage.removeItem('toranj_user_id');
}

export function getActiveUserId(): string {
  return currentUserId;
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  // Authoritative server-side Bearer token (no spoofable custom identity headers)
  if (currentAuthToken) {
    headers.set('Authorization', `Bearer ${currentAuthToken}`);
  }

  const res = await fetch(endpoint, {
    ...options,
    credentials: 'same-origin', // Pass HttpOnly session cookies
    headers
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'خطای نامشخص رخ داده است.' }));
    throw new Error(errorData.error || `خطا در ارتباط با سرور (${res.status})`);
  }

  return res.json();
}

export const api = {
  // Auth
  login: (username: string, password?: string) =>
    apiFetch<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),
  getMe: () => apiFetch<{ user: User }>('/api/auth/me'),
  logout: () => apiFetch<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch<{ success: boolean; message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    }),
  resetEmployeePassword: (employeeId: string, newPassword: string) =>
    apiFetch<{ success: boolean; message: string }>('/api/auth/reset-password-admin', {
      method: 'POST',
      body: JSON.stringify({ employeeId, newPassword })
    }),
  impersonateUser: (userId: string) =>
    apiFetch<{ token: string; user: User }>('/api/auth/impersonate', {
      method: 'POST',
      body: JSON.stringify({ userId })
    }),

  // Center / Organization Settings
  getCenterSettings: () => apiFetch<CenterSettings>('/api/center-settings'),
  updateCenterSettings: (data: Partial<CenterSettings>) =>
    apiFetch<CenterSettings>('/api/center-settings', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  // Employee Management (RBAC)
  getEmployees: (params?: { status?: string; department?: string; role?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.department) q.set('department', params.department);
    if (params?.role) q.set('role', params.role);
    if (params?.search) q.set('search', params.search);
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return apiFetch<User[]>(`/api/employees${queryStr}`);
  },
  createEmployee: (data: {
    username: string;
    fullName: string;
    role: string;
    department: string;
    mobile: string;
    email?: string;
    password?: string;
    nationalId?: string;
    birthDate?: string;
    bankAccount?: string;
    iban?: string;
    shiftMode?: string;
    weeklyOffDays?: number[];
    allowedLatenessMinutes?: number;
  }) => apiFetch<{ user: User; profile: EmployeeProfile }>('/api/employees', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateEmployee: (id: string, data: Partial<User>) =>
    apiFetch<User>(`/api/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  setEmployeeStatus: (id: string, status: 'active' | 'inactive', reason?: string) =>
    apiFetch<{ success: boolean; user: User }>(`/api/employees/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, reason })
    }),
  archiveEmployee: (id: string, reason?: string) =>
    apiFetch<{ success: boolean; user: User }>(`/api/employees/${id}/archive`, {
      method: 'PUT',
      body: JSON.stringify({ reason })
    }),

  // Legacy Users list
  getUsers: () => apiFetch<User[]>('/api/users'),
  createUser: (data: Partial<User> & { nationalId?: string; birthDate?: string }) =>
    apiFetch<User>('/api/users', { method: 'POST', body: JSON.stringify(data) }),
  getProfile: (employeeId: string) =>
    apiFetch<{ user: User; profile: EmployeeProfile }>(`/api/employees/${employeeId}/profile`),
  updateProfile: (employeeId: string, data: Partial<EmployeeProfile>) =>
    apiFetch<EmployeeProfile>(`/api/employees/${employeeId}/profile`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  // Attendance
  getAttendanceStatus: () =>
    apiFetch<{
      openSession?: AttendanceSession;
      schedule?: WorkSchedule;
      shift?: ShiftTemplate;
      todayEvents: AttendanceEvent[];
      gpsPolicy: GPSPolicy;
      serverTime: string;
    }>('/api/attendance/status'),
  checkIn: (data: {
    coords?: { latitude: number; longitude: number; accuracy: number };
    deviceInfo?: string;
    notes?: string;
    overrideExceptionId?: string;
  }) =>
    apiFetch<{
      success: boolean;
      message: string;
      event: AttendanceEvent;
      session: AttendanceSession;
      shiftDetails?: any;
      birthdayGreeting?: string | null;
    }>('/api/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  checkOut: (data: {
    coords?: { latitude: number; longitude: number; accuracy: number };
    deviceInfo?: string;
    notes?: string;
    overrideExceptionId?: string;
  }) =>
    apiFetch<{
      success: boolean;
      message: string;
      event: AttendanceEvent;
      session: AttendanceSession;
      pendingMandatoryTasksWarning?: string;
    }>('/api/attendance/check-out', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getAttendanceHistory: (params?: { employeeId?: string; startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return apiFetch<any[]>(`/api/attendance/history${query ? `?${query}` : ''}`);
  },
  getCorrections: () => apiFetch<any[]>('/api/attendance/corrections'),
  submitCorrection: (data: {
    dateString: string;
    targetEventType: string;
    requestedCheckInTime?: string;
    requestedCheckOutTime?: string;
    reason: string;
  }) =>
    apiFetch('/api/attendance/corrections', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  reviewCorrection: (id: string, decision: 'approved' | 'rejected', rejectionReason?: string) =>
    apiFetch(`/api/attendance/corrections/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify({ decision, rejectionReason })
    }),

  // GPS Policies
  getGPSPolicies: () => apiFetch<GPSPolicy[]>('/api/gps/policies'),
  updateGPSPolicy: (employeeId: string, data: Partial<GPSPolicy>) =>
    apiFetch<GPSPolicy>(`/api/gps/policies/${employeeId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  submitGPSException: (data: {
    eventType: string;
    coords?: { latitude: number; longitude: number; accuracy: number };
    distanceMeters?: number;
    reason: string;
  }) =>
    apiFetch('/api/gps/exceptions', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Shifts & Schedules
  getShifts: () => apiFetch<ShiftTemplate[]>('/api/shifts'),
  createShift: (data: Partial<ShiftTemplate>) =>
    apiFetch<ShiftTemplate>('/api/shifts', { method: 'POST', body: JSON.stringify(data) }),
  getSchedules: (params?: { employeeId?: string; startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return apiFetch<WorkSchedule[]>(`/api/schedules${query ? `?${query}` : ''}`);
  },
  assignSchedule: (data: {
    employeeId: string;
    dateString: string;
    shiftTemplateId: string;
    customStartTime?: string;
    customEndTime?: string;
    isRestDay?: boolean;
    isHoliday?: boolean;
  }) => apiFetch('/api/schedules', { method: 'POST', body: JSON.stringify(data) }),

  // Tasks
  getTasks: (params?: { assigneeId?: string; status?: string; mandatory?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.assigneeId) query.set('assigneeId', params.assigneeId);
    if (params?.status) query.set('status', params.status);
    if (params?.mandatory !== undefined) query.set('mandatory', String(params.mandatory));
    return apiFetch<TaskItem[]>(`/api/tasks${query.toString() ? `?${query.toString()}` : ''}`);
  },
  createTask: (data: Partial<TaskItem>) =>
    apiFetch<TaskItem>('/api/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTaskProgress: (id: string, status: string, note?: string) =>
    apiFetch<TaskItem>(`/api/tasks/${id}/progress`, {
      method: 'PUT',
      body: JSON.stringify({ status, note })
    }),
  reportTaskCompletion: (id: string, notes?: string) =>
    apiFetch<TaskItem>(`/api/tasks/${id}/report-completion`, {
      method: 'PUT',
      body: JSON.stringify({ notes })
    }),
  reviewTaskCompletion: (id: string, decision: 'approved' | 'rejected', reason?: string) =>
    apiFetch<TaskItem>(`/api/tasks/${id}/approval`, {
      method: 'PUT',
      body: JSON.stringify({ decision, reason })
    }),

  // Approval Inbox
  getApprovalInbox: () =>
    apiFetch<{
      pendingTasks: TaskItem[];
      pendingLeaves: LeaveRequest[];
      pendingMissions: MissionRequest[];
      pendingCorrections: any[];
      pendingGpsExceptions: any[];
      totalCount: number;
    }>('/api/inbox/approvals'),

  // Leave & Missions
  getLeaves: () => apiFetch<LeaveRequest[]>('/api/leave'),
  submitLeave: (data: Partial<LeaveRequest>) =>
    apiFetch<LeaveRequest>('/api/leave', { method: 'POST', body: JSON.stringify(data) }),
  reviewLeave: (id: string, decision: 'approved' | 'rejected', rejectionReason?: string) =>
    apiFetch<LeaveRequest>(`/api/leave/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify({ decision, rejectionReason })
    }),
  getMissions: () => apiFetch<MissionRequest[]>('/api/missions'),
  submitMission: (data: Partial<MissionRequest>) =>
    apiFetch<MissionRequest>('/api/missions', { method: 'POST', body: JSON.stringify(data) }),
  reviewMission: (id: string, decision: 'approved' | 'rejected', rejectionReason?: string) =>
    apiFetch<MissionRequest>(`/api/missions/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify({ decision, rejectionReason })
    }),

  // Notifications
  getNotifications: () => apiFetch<any[]>('/api/notifications'),
  markNotificationRead: (id: string) =>
    apiFetch(`/api/notifications/${id}/read`, { method: 'PUT' }),

  // Dashboard & Reports
  getDashboardSummary: () => apiFetch<any>('/api/dashboard/summary'),
  getPayrollReport: (month?: string) => apiFetch<any[]>(`/api/reports/payroll${month ? `?month=${month}` : ''}`),
  getAuditLogs: () => apiFetch<AuditLog[]>('/api/audit-logs'),

  // Settings
  getSettings: () => apiFetch<SystemSettings>('/api/settings'),
  updateSettings: (data: Partial<SystemSettings>) =>
    apiFetch<SystemSettings>('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Birthdays
  getBirthdaysStatus: () =>
    apiFetch<{
      employeeGreeting: {
        isBirthday: boolean;
        isToday: boolean;
        isYesterday: boolean;
        message: string;
      } | null;
      managerReminders: Array<{
        employeeId: string;
        employeeName: string;
        department: string;
        birthDate: string;
        type: 'in_two_days' | 'today' | 'yesterday';
        daysLeft: number;
        message: string;
      }>;
    }>('/api/birthdays/status'),

  // Holidays
  getHolidays: () => apiFetch<LabHoliday[]>('/api/holidays'),
  createHoliday: (data: Partial<LabHoliday>) =>
    apiFetch<LabHoliday>('/api/holidays', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  deleteHoliday: (id: string) =>
    apiFetch<{ success: boolean; message: string }>(`/api/holidays/${id}`, {
      method: 'DELETE'
    }),

  // Acceptance Test Suite
  runAllTests: () =>
    apiFetch<{
      success: boolean;
      passedAll: boolean;
      totalTests: number;
      passedCount: number;
      results: { testNumber: number; title: string; passed: boolean; message: string }[];
    }>('/api/test-runner/run-all')
};

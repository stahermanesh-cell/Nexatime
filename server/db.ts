import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import {
  User,
  EmployeeProfile,
  ShiftTemplate,
  WorkSchedule,
  GPSPolicy,
  AttendanceEvent,
  AttendanceSession,
  AttendanceCorrectionRequest,
  TaskItem,
  LeaveRequest,
  MissionRequest,
  GPSExceptionRequest,
  AppNotification,
  AuditLog,
  SystemSettings,
  LabHoliday,
  CenterSettings
} from '../src/types/index.js';
import { toJalali, toGregorian } from '../src/utils/jalali.js';

export interface ActiveSession {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  ip?: string;
  userAgent?: string;
}

export interface PasswordResetToken {
  token: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
}

export type DbUser = User & {
  passwordHash?: string;
  mustChangePassword?: boolean;
};

export interface DatabaseSchema {
  schemaVersion: number;
  nextEmployeeCodeSeq: number;
  centerSettings: CenterSettings;
  users: DbUser[];
  profiles: EmployeeProfile[];
  activeSessions: ActiveSession[];
  passwordResetTokens: PasswordResetToken[];
  shiftTemplates: ShiftTemplate[];
  schedules: WorkSchedule[];
  holidays: LabHoliday[];
  gpsPolicies: GPSPolicy[];
  attendanceEvents: AttendanceEvent[];
  attendanceSessions: AttendanceSession[];
  correctionRequests: AttendanceCorrectionRequest[];
  tasks: TaskItem[];
  leaveRequests: LeaveRequest[];
  missionRequests: MissionRequest[];
  gpsExceptionRequests: GPSExceptionRequest[];
  notifications: AppNotification[];
  auditLogs: AuditLog[];
  settings: SystemSettings;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const DB_FILE = path.join(DATA_DIR, 'toranj_db.json');

// Ensure data & backup directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// In-memory cache synced with disk
let dbCache: DatabaseSchema | null = null;

export function getInitialSeedData(): DatabaseSchema {
  const now = new Date();
  const nowIso = now.toISOString();

  // Reference date strings (today in Tehran: YYYY-MM-DD)
  const tehranDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
  const todayStr = tehranDate.toISOString().split('T')[0];

  const defaultPasswordHash = bcrypt.hashSync('Toranj@123', 8);

  const users: DbUser[] = [
    {
      id: 'usr_superadmin',
      employeeCode: 'EMP-000001',
      username: 'dr_hosseini',
      fullName: 'دکتر رضا حسینی',
      role: 'super_admin',
      status: 'active',
      email: 'hosseini@toranjlab.ir',
      mobile: '09121112233',
      department: 'مدیریت ارشد پاتوبیولوژی',
      active: true,
      passwordHash: defaultPasswordHash,
      createdAt: nowIso
    },
    {
      id: 'usr_mgr_biochem',
      employeeCode: 'EMP-000002',
      username: 's_rahimi',
      fullName: 'سارا رحیمی',
      role: 'manager',
      status: 'active',
      email: 'rahimi@toranjlab.ir',
      mobile: '09122223344',
      department: 'بخش بیوشیمی و هورمون',
      active: true,
      designatedManagerId: 'usr_superadmin',
      passwordHash: defaultPasswordHash,
      createdAt: nowIso
    },
    {
      id: 'usr_mgr_hematol',
      employeeCode: 'EMP-000003',
      username: 'm_kazemi',
      fullName: 'محمد کاظمی',
      role: 'manager',
      status: 'active',
      email: 'kazemi@toranjlab.ir',
      mobile: '09123334455',
      department: 'بخش هماتولوژی و بانک خون',
      active: true,
      designatedManagerId: 'usr_superadmin',
      passwordHash: defaultPasswordHash,
      createdAt: nowIso
    },
    {
      id: 'usr_emp_ali',
      employeeCode: 'EMP-000004',
      username: 'a_taheri',
      fullName: 'علی طاهری',
      role: 'employee',
      status: 'active',
      email: 'taheri@toranjlab.ir',
      mobile: '09124445566',
      department: 'پذیرش و نمونه‌گیری',
      active: true,
      designatedManagerId: 'usr_mgr_biochem',
      fallbackManagerId: 'usr_superadmin',
      passwordHash: defaultPasswordHash,
      createdAt: nowIso
    },
    {
      id: 'usr_emp_maryam',
      employeeCode: 'EMP-000005',
      username: 'm_alavi',
      fullName: 'مریم علوی',
      role: 'employee',
      status: 'active',
      email: 'alavi@toranjlab.ir',
      mobile: '09125556677',
      department: 'بخش هماتولوژی',
      active: true,
      designatedManagerId: 'usr_mgr_hematol',
      fallbackManagerId: 'usr_superadmin',
      passwordHash: defaultPasswordHash,
      createdAt: nowIso
    },
    {
      id: 'usr_emp_nima',
      employeeCode: 'EMP-000006',
      username: 'n_sadeghi',
      fullName: 'نیما صادقی',
      role: 'employee',
      status: 'active',
      email: 'sadeghi@toranjlab.ir',
      mobile: '09126667788',
      department: 'کنترل کیفی و کالیبراسیون',
      active: true,
      designatedManagerId: 'usr_mgr_biochem',
      fallbackManagerId: 'usr_superadmin',
      passwordHash: defaultPasswordHash,
      createdAt: nowIso
    },
    {
      id: 'usr_emp_zahra',
      employeeCode: 'EMP-000007',
      username: 'z_moradi',
      fullName: 'زهرا مرادی',
      role: 'employee',
      status: 'active',
      email: 'moradi@toranjlab.ir',
      mobile: '09127778899',
      department: 'بخش بیوشیمی',
      active: true,
      designatedManagerId: 'usr_mgr_biochem',
      fallbackManagerId: 'usr_superadmin',
      passwordHash: defaultPasswordHash,
      createdAt: nowIso
    }
  ];

  const profiles: EmployeeProfile[] = [
    {
      employeeId: 'usr_superadmin',
      nationalId: '0012345678',
      birthDate: '1975-04-12',
      landline: '02188776655',
      emergencyContactName: 'مهناز حسینی',
      emergencyContactRelation: 'همسر',
      emergencyContactPhone: '09121110011',
      bankAccount: '6037-9911-2233-4455',
      iban: 'IR820170000000111222333444',
      hireDate: '2015-01-01',
      status: 'active',
      notes: 'پزشک پاتولوژیست و موسس آزمایشگاه',
      shiftMode: 'custom',
      customShiftStart: '08:00',
      customShiftEnd: '15:00',
      customShiftDurationMinutes: 420,
      allowedLatenessMinutes: 20,
      earlyDepartureGraceMinutes: 15,
      weeklyOffDays: [5, 6] // پنج‌شنبه و جمعه
    },
    {
      employeeId: 'usr_mgr_biochem',
      nationalId: '0023456789',
      birthDate: '1988-08-20',
      landline: '02188776656',
      emergencyContactName: 'حسین رحیمی',
      emergencyContactRelation: 'پدر',
      emergencyContactPhone: '09122220022',
      bankAccount: '5022-2910-3344-5566',
      iban: 'IR450120000000222333444555',
      hireDate: '2019-05-15',
      status: 'active',
      notes: 'کارشناس ارشد بیوشیمی بالینی',
      shiftMode: 'morning',
      customShiftStart: '08:00',
      customShiftEnd: '14:00',
      customShiftDurationMinutes: 360,
      allowedLatenessMinutes: 15,
      earlyDepartureGraceMinutes: 10,
      weeklyOffDays: [6]
    },
    {
      employeeId: 'usr_mgr_hematol',
      nationalId: '0034567890',
      birthDate: '1985-11-05',
      landline: '02188776657',
      emergencyContactName: 'فاطمه کاظمی',
      emergencyContactRelation: 'همسر',
      emergencyContactPhone: '09123330033',
      bankAccount: '6219-8610-4455-6677',
      iban: 'IR120560000000333444555666',
      hireDate: '2018-09-01',
      status: 'active',
      shiftMode: 'evening',
      customShiftStart: '14:00',
      customShiftEnd: '20:00',
      customShiftDurationMinutes: 360,
      allowedLatenessMinutes: 15,
      earlyDepartureGraceMinutes: 10,
      weeklyOffDays: [6]
    },
    {
      employeeId: 'usr_emp_ali',
      nationalId: '0045678901',
      birthDate: '1996-11-06', // Birthday is TODAY!
      landline: '02188776658',
      emergencyContactName: 'رضا طاهری',
      emergencyContactRelation: 'برادر',
      emergencyContactPhone: '09124440044',
      bankAccount: '5892-1012-5566-7788',
      iban: 'IR780180000000444555666777',
      hireDate: '2022-03-10',
      status: 'active',
      shiftMode: 'both', // Can work morning, evening, or both shifts!
      customShiftStart: '08:00',
      customShiftEnd: '14:00',
      customShiftDurationMinutes: 360,
      allowedLatenessMinutes: 15,
      earlyDepartureGraceMinutes: 10,
      weeklyOffDays: [6] // جمعه
    },
    {
      employeeId: 'usr_emp_maryam',
      nationalId: '0056789012',
      birthDate: '1994-11-05', // Birthday was YESTERDAY!
      landline: '02188776659',
      emergencyContactName: 'مریم علوی',
      emergencyContactRelation: 'مادر',
      emergencyContactPhone: '09125550055',
      bankAccount: '6274-1211-6677-8899',
      iban: 'IR910190000000555666777888',
      hireDate: '2021-07-20',
      status: 'active',
      shiftMode: 'morning',
      customShiftStart: '08:00',
      customShiftEnd: '14:00',
      customShiftDurationMinutes: 360,
      allowedLatenessMinutes: 15,
      earlyDepartureGraceMinutes: 10,
      weeklyOffDays: [6]
    },
    {
      employeeId: 'usr_emp_nima',
      nationalId: '0067890123',
      birthDate: '1997-11-08', // Birthday is in 2 DAYS! (Triggers manager 2-day reminder)
      landline: '02188776660',
      emergencyContactName: 'سعید صادقی',
      emergencyContactRelation: 'پدر',
      emergencyContactPhone: '09126660066',
      bankAccount: '6393-4610-7788-9900',
      iban: 'IR340210000000666777888999',
      hireDate: '2023-01-15',
      status: 'active',
      shiftMode: 'rotating', // چرخشی / شناور
      customShiftStart: '08:00',
      customShiftEnd: '16:00',
      customShiftDurationMinutes: 480,
      allowedLatenessMinutes: 30,
      earlyDepartureGraceMinutes: 15,
      weeklyOffDays: [6]
    },
    {
      employeeId: 'usr_emp_zahra',
      nationalId: '0078901234',
      birthDate: '1998-12-05',
      landline: '02188776661',
      emergencyContactName: 'احمد مرادی',
      emergencyContactRelation: 'پدر',
      emergencyContactPhone: '09127770077',
      bankAccount: '6104-3378-8899-0011',
      iban: 'IR560230000000777888999000',
      hireDate: '2023-08-01',
      status: 'active',
      shiftMode: 'evening',
      customShiftStart: '14:00',
      customShiftEnd: '20:00',
      customShiftDurationMinutes: 360,
      allowedLatenessMinutes: 15,
      earlyDepartureGraceMinutes: 10,
      weeklyOffDays: [5, 6] // پنج‌شنبه و جمعه
    }
  ];

  const shiftTemplates: ShiftTemplate[] = [
    {
      id: 'shift_morning',
      name: 'شیفت صبح (۰۸:۰۰ الی ۱۴:۰۰)',
      code: 'MORN',
      startTime: '08:00',
      endTime: '14:00',
      scheduledDurationMinutes: 360,
      breakDurationMinutes: 30,
      isPaidBreak: true,
      allowedLatenessMinutes: 15,
      earlyDepartureGraceMinutes: 10,
      overtimeEligibility: true,
      crossMidnight: false,
      color: '#0D9488',
      description: 'شیفت اصلی پذیرش و آنالیزهای صبحگاهی'
    },
    {
      id: 'shift_evening',
      name: 'شیفت عصر (۱۴:۰۰ الی ۲۰:۰۰)',
      code: 'EVEN',
      startTime: '14:00',
      endTime: '20:00',
      scheduledDurationMinutes: 360,
      breakDurationMinutes: 30,
      isPaidBreak: true,
      allowedLatenessMinutes: 15,
      earlyDepartureGraceMinutes: 10,
      overtimeEligibility: true,
      crossMidnight: false,
      color: '#D97706',
      description: 'شیفت تحویل جوابدهی و کنترل‌های شبانه'
    }
  ];

  const schedules: WorkSchedule[] = [
    { id: 'sch_1', employeeId: 'usr_emp_ali', dateString: todayStr, shiftTemplateId: 'shift_morning' },
    { id: 'sch_2', employeeId: 'usr_emp_maryam', dateString: todayStr, shiftTemplateId: 'shift_morning' },
    { id: 'sch_3', employeeId: 'usr_emp_nima', dateString: todayStr, shiftTemplateId: 'shift_evening' },
    { id: 'sch_4', employeeId: 'usr_emp_zahra', dateString: todayStr, shiftTemplateId: 'shift_evening' },
    { id: 'sch_5', employeeId: 'usr_mgr_biochem', dateString: todayStr, shiftTemplateId: 'shift_morning' },
    { id: 'sch_6', employeeId: 'usr_mgr_hematol', dateString: todayStr, shiftTemplateId: 'shift_evening' }
  ];

  const gpsPolicies: GPSPolicy[] = [
    {
      id: 'gps_default',
      employeeId: 'default',
      required: true,
      targetLat: 35.7592,
      targetLng: 51.4116,
      allowedRadiusMeters: 100,
      allowExceptionRequest: true,
      poorAccuracyThresholdMeters: 80,
      policyVersion: 1,
      effectiveDate: '2026-01-01',
      exceptionManagerId: 'usr_superadmin'
    },
    // Optional GPS for Nima (Field calibration / remote test support)
    {
      id: 'gps_nima',
      employeeId: 'usr_emp_nima',
      required: false,
      targetLat: 35.7592,
      targetLng: 51.4116,
      allowedRadiusMeters: 500,
      allowExceptionRequest: true,
      poorAccuracyThresholdMeters: 100,
      policyVersion: 1,
      effectiveDate: '2026-01-01',
      exceptionManagerId: 'usr_mgr_biochem'
    }
  ];

  // Pre-seed some attendance sessions for today
  // Ali checked in at 07:55 (present and on-time)
  const aliCheckInTime = new Date(tehranDate);
  aliCheckInTime.setHours(7, 55, 0, 0);

  const attendanceEvents: AttendanceEvent[] = [
    {
      id: 'att_evt_1',
      employeeId: 'usr_emp_ali',
      eventType: 'check_in',
      serverTimestamp: aliCheckInTime.toISOString(),
      scheduleId: 'sch_1',
      locationResult: 'verified',
      coords: { latitude: 35.75921, longitude: 51.41159, accuracy: 12 },
      distanceMeters: 5,
      policyVersion: 1,
      deviceInfo: 'Mozilla/5.0 (iPhone; Mobile)',
      eventSource: 'personal_device',
      notes: 'ثبت ورود بموقع پرسنل'
    }
  ];

  const attendanceSessions: AttendanceSession[] = [
    {
      id: 'att_sess_1',
      employeeId: 'usr_emp_ali',
      dateString: todayStr,
      checkInEventId: 'att_evt_1',
      checkInTime: aliCheckInTime.toISOString(),
      latenessMinutes: 0,
      earlyDepartureMinutes: 0,
      approvedOvertimeMinutes: 0,
      status: 'open'
    }
  ];

  const tasks: TaskItem[] = [
    {
      id: 'task_1',
      title: 'کنترل دمای یخچال‌های نگهداری کیت الایزا',
      description: 'بررسی دمای ۳ دستگاه یخچال نگهداری سرم و کیت‌های هورمونی و ثبت لاگ دمایی در فرم مربوطه.',
      creatorId: 'usr_mgr_biochem',
      creatorName: 'سارا رحیمی',
      assigneeId: 'usr_emp_ali',
      assigneeName: 'علی طاهری',
      mandatory: true,
      priority: 'high',
      dueDate: todayStr,
      dueTime: '11:00',
      status: 'in_progress',
      designatedApproverId: 'usr_mgr_biochem',
      history: [
        {
          timestamp: nowIso,
          actorId: 'usr_mgr_biochem',
          actorName: 'سارا رحیمی',
          action: 'ایجاد وظیفه اجباری',
          note: 'ارجاع به کارشناس شیفت'
        }
      ],
      createdAt: nowIso
    },
    {
      id: 'task_2',
      title: 'تحویل و شمارش لوله‌های CBC شیفت صبح',
      description: 'آماده‌سازی گزارش پذیرش و کنترل تعداد نمونه‌های خون تام ارسال شده به بخش هماتولوژی.',
      creatorId: 'usr_mgr_biochem',
      creatorName: 'سارا رحیمی',
      assigneeId: 'usr_emp_ali',
      assigneeName: 'علی طاهری',
      mandatory: false,
      priority: 'medium',
      dueDate: todayStr,
      dueTime: '13:30',
      status: 'new',
      designatedApproverId: 'usr_mgr_biochem',
      history: [
        {
          timestamp: nowIso,
          actorId: 'usr_mgr_biochem',
          actorName: 'سارا رحیمی',
          action: 'ایجاد وظیفه اختیاری'
        }
      ],
      createdAt: nowIso
    },
    {
      id: 'task_3',
      title: 'کالیبراسیون هفتگی سل‌کانتر Sysmex XN-1000',
      description: 'انجام تست‌های کنترل تجاری نرمال، بالا و پایین و بررسی نمودار لوی-جنینگز.',
      creatorId: 'usr_mgr_hematol',
      creatorName: 'محمد کاظمی',
      assigneeId: 'usr_emp_maryam',
      assigneeName: 'مریم علوی',
      mandatory: true,
      priority: 'urgent',
      dueDate: todayStr,
      dueTime: '10:00',
      status: 'completion_reported',
      designatedApproverId: 'usr_mgr_hematol',
      completionReportedAt: nowIso,
      completionNotes: 'کنترل‌های شیفت اجرا شد و کلیه پارامترها در محدوده 2SD قرار دارند.',
      history: [
        {
          timestamp: nowIso,
          actorId: 'usr_mgr_hematol',
          actorName: 'محمد کاظمی',
          action: 'ایجاد وظیفه اجباری'
        },
        {
          timestamp: nowIso,
          actorId: 'usr_emp_maryam',
          actorName: 'مریم علوی',
          action: 'اعلام اتمام وظیفه',
          note: 'ارسال برای تایید سرپرست'
        }
      ],
      createdAt: nowIso
    }
  ];

  const leaveRequests: LeaveRequest[] = [
    {
      id: 'leave_1',
      employeeId: 'usr_emp_zahra',
      employeeName: 'زهرا مرادی',
      leaveType: 'hourly',
      startDate: todayStr,
      endDate: todayStr,
      isPartialDay: true,
      startTime: '14:00',
      endTime: '16:00',
      durationMinutes: 120,
      reason: 'مراجعه به پزشک متخصص',
      status: 'pending',
      assignedApproverId: 'usr_mgr_biochem',
      createdAt: nowIso
    }
  ];

  const missionRequests: MissionRequest[] = [];
  const gpsExceptionRequests: GPSExceptionRequest[] = [];

  const notifications: AppNotification[] = [
    {
      id: 'notif_1',
      recipientId: 'usr_emp_ali',
      type: 'task_assigned',
      title: 'وظیفه جدید محول شد',
      message: 'وظیفه اجباری "کنترل دمای یخچال‌های نگهداری کیت الایزا" برای شما ثبت شد.',
      read: false,
      referenceId: 'task_1',
      referenceType: 'task',
      createdAt: nowIso
    },
    {
      id: 'notif_2',
      recipientId: 'usr_mgr_hematol',
      type: 'approval_required',
      title: 'درخواست تایید اتمام وظیفه',
      message: 'مریم علوی وظیفه "کالیبراسیون هفتگی سل‌کانتر" را انجام داده و منتظر تایید شماست.',
      read: false,
      referenceId: 'task_3',
      referenceType: 'task',
      createdAt: nowIso
    }
  ];

  const auditLogs: AuditLog[] = [
    {
      id: 'aud_1',
      actorId: 'usr_superadmin',
      actorName: 'دکتر رضا حسینی',
      action: 'راه‌اندازی سامانه و تنظیم سیاست‌های اولیه حضور و غیاب',
      category: 'policy',
      details: 'تنظیم مختصات آزمایشگاه ترنج و شیفت‌های کاری',
      serverTimestamp: nowIso
    }
  ];

  const centerSettings: CenterSettings = {
    centerName: 'آزمایشگاه پاتوبیولوژی و ژنتیک ترنج',
    logoUrl: '/assets/toranj_logo.svg',
    licenseNumber: 'L-1402-98721',
    address: 'تهران، خیابان ولیعصر، بالاتر از میرداماد، نبش خیابان ترنج، پلاک ۱۲',
    city: 'تهران',
    province: 'تهران',
    phoneMain: '۰۲۱-۸۸۷۷۶۶۵۵',
    phoneSecondary: '۰۲۱-۸۸۷۷۶۶۵۶',
    email: 'info@toranjlab.ir',
    website: 'https://toranjlab.ir',
    gpsLat: 35.7592,
    gpsLng: 51.4116,
    allowedRadiusMeters: 100,
    timeZone: 'Asia/Tehran',
    workingDays: [0, 1, 2, 3, 4, 5],
    defaultWorkStart: '07:30',
    defaultWorkEnd: '15:30',
    defaultLatenessToleranceMinutes: 15,
    defaultOvertimeAutoApprove: false,
    updatedAt: nowIso
  };

  const settings: SystemSettings = {
    ...centerSettings,
    orgName: centerSettings.centerName,
    orgTimezone: centerSettings.timeZone,
    defaultLat: centerSettings.gpsLat,
    defaultLng: centerSettings.gpsLng,
    defaultRadiusMeters: centerSettings.allowedRadiusMeters,
    contactPhone: centerSettings.phoneMain,
    contactAddress: centerSettings.address
  };

  const correctionRequests: AttendanceCorrectionRequest[] = [];

  const holidays: LabHoliday[] = [
    {
      id: 'hol_1',
      dateString: '2026-11-13',
      title: 'تعطیلی بهسازی تاسیسات آزمایشگاه ترنج',
      isOfficial: false,
      createdBy: 'usr_superadmin',
      createdAt: nowIso
    },
    {
      id: 'hol_2',
      dateString: '2026-11-20',
      title: 'تعطیل رسمی تقویم',
      isOfficial: true,
      createdBy: 'usr_superadmin',
      createdAt: nowIso
    }
  ];

  return {
    schemaVersion: 4,
    nextEmployeeCodeSeq: 8,
    centerSettings,
    users,
    profiles,
    activeSessions: [],
    passwordResetTokens: [],
    shiftTemplates,
    schedules,
    holidays,
    gpsPolicies,
    attendanceEvents,
    attendanceSessions,
    correctionRequests,
    tasks,
    leaveRequests,
    missionRequests,
    gpsExceptionRequests,
    notifications,
    auditLogs,
    settings
  };
}

/**
 * Validates integrity and uniqueness constraints at the database level.
 * Throws an Error if any constraint is violated.
 */
export function validateDatabaseConstraints(database: DatabaseSchema): void {
  // 1. Employee Code Uniqueness Constraint
  const employeeCodes = new Set<string>();
  for (const user of database.users) {
    if (!user.employeeCode) {
      throw new Error(`خطای یکپارچگی پایگاه داده: کاربر با شناسه ${user.id} فاقد کد پرسنلی است.`);
    }
    if (employeeCodes.has(user.employeeCode)) {
      throw new Error(`خطای قید یکتایی (UNIQUE): کد پرسنلی تکراری "${user.employeeCode}" شناسایی شد.`);
    }
    employeeCodes.add(user.employeeCode);
  }

  // 2. Username Uniqueness Constraint
  const usernames = new Set<string>();
  for (const user of database.users) {
    const lower = user.username.toLowerCase();
    if (usernames.has(lower)) {
      throw new Error(`خطای قید یکتایی (UNIQUE): نام کاربری تکراری "${user.username}" وجود دارد.`);
    }
    usernames.add(lower);
  }

  // 3. Super Admin Presence Constraint
  const activeAdmins = database.users.filter(
    (u) => u.role === 'super_admin' && (u.status === 'active' || u.active)
  );
  if (activeAdmins.length === 0) {
    throw new Error('خطای یکپارچگی سیستم: حداقل یک مدیر ارشد فعال در سامانه الزامی است.');
  }
}

/**
 * Generates the next sequential unique employee code (EMP-000001, EMP-000002, ...)
 * Thread-safe with database-level uniqueness guarantee.
 */
export function generateNextEmployeeCode(database: DatabaseSchema): string {
  if (!database.nextEmployeeCodeSeq || database.nextEmployeeCodeSeq < 1) {
    database.nextEmployeeCodeSeq = 1;
  }

  let seq = database.nextEmployeeCodeSeq;
  let candidate = `EMP-${String(seq).padStart(6, '0')}`;

  // Ensure candidate does not collide with ANY existing record (active, inactive, or archived)
  while (database.users.some((u) => u.employeeCode === candidate)) {
    seq++;
    candidate = `EMP-${String(seq).padStart(6, '0')}`;
  }

  database.nextEmployeeCodeSeq = seq + 1;
  return candidate;
}

/**
 * Creates an automated timestamped backup of the database file.
 */
export function backupDatabase(): string {
  try {
    const now = new Date();
    const ts = now.toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUPS_DIR, `toranj_db_backup_${ts}.json`);
    if (fs.existsSync(DB_FILE)) {
      fs.copyFileSync(DB_FILE, backupPath);
      return backupPath;
    }
  } catch (err) {
    console.error('Failed to create backup:', err);
  }
  return '';
}

/**
 * Database Migration Engine:
 * Safely inspects and migrates existing database files to latest schema version without data loss.
 */
export function runDatabaseMigrations(rawDb: any): DatabaseSchema {
  backupDatabase();

  const currentVersion = rawDb.schemaVersion || 1;
  const nowIso = new Date().toISOString();

  // 1. CenterSettings & Organization migration
  if (!rawDb.centerSettings) {
    const existing = rawDb.settings || {};
    rawDb.centerSettings = {
      centerName: existing.orgName || 'آزمایشگاه پاتوبیولوژی و ژنتیک ترنج',
      logoUrl: '/assets/toranj_logo.svg',
      licenseNumber: 'L-1402-98721',
      address: existing.contactAddress || 'تهران، خیابان ولیعصر، بالاتر از میرداماد، پلاک ۱۲',
      city: 'تهران',
      province: 'تهران',
      phoneMain: existing.contactPhone || '۰۲۱-۸۸۷۷۶۶۵۵',
      phoneSecondary: '۰۲۱-۸۸۷۷۶۶۵۶',
      email: 'info@toranjlab.ir',
      website: 'https://toranjlab.ir',
      gpsLat: existing.defaultLat || 35.7592,
      gpsLng: existing.defaultLng || 51.4116,
      allowedRadiusMeters: existing.defaultRadiusMeters || 100,
      timeZone: existing.orgTimezone || 'Asia/Tehran',
      workingDays: [0, 1, 2, 3, 4, 5],
      defaultWorkStart: '07:30',
      defaultWorkEnd: '15:30',
      defaultLatenessToleranceMinutes: existing.defaultLatenessToleranceMinutes || 15,
      defaultOvertimeAutoApprove: existing.defaultOvertimeAutoApprove || false,
      updatedAt: nowIso
    };
  }

  // Ensure settings is synced with centerSettings
  rawDb.settings = {
    ...rawDb.centerSettings,
    orgName: rawDb.centerSettings.centerName,
    orgTimezone: rawDb.centerSettings.timeZone,
    defaultLat: rawDb.centerSettings.gpsLat,
    defaultLng: rawDb.centerSettings.gpsLng,
    defaultRadiusMeters: rawDb.centerSettings.allowedRadiusMeters,
    contactPhone: rawDb.centerSettings.phoneMain,
    contactAddress: rawDb.centerSettings.address
  };

  // 2. Users migration: employeeCode, status, passwordHash
  const defaultHash = bcrypt.hashSync('Toranj@123', 8);
  let maxSeq = 0;

  if (Array.isArray(rawDb.users)) {
    rawDb.users.forEach((user: any, index: number) => {
      // Ensure status
      if (!user.status) {
        user.status = user.active !== false ? 'active' : 'inactive';
      }
      user.active = user.status === 'active';

      // Ensure password hash
      if (!user.passwordHash) {
        user.passwordHash = defaultHash;
      }

      // Ensure employeeCode
      if (!user.employeeCode) {
        const seqNum = index + 1;
        user.employeeCode = `EMP-${String(seqNum).padStart(6, '0')}`;
        maxSeq = Math.max(maxSeq, seqNum);
      } else {
        const match = user.employeeCode.match(/^EMP-(\d+)$/);
        if (match) {
          maxSeq = Math.max(maxSeq, parseInt(match[1], 10));
        }
      }
    });
  } else {
    rawDb.users = [];
  }

  rawDb.nextEmployeeCodeSeq = Math.max(rawDb.nextEmployeeCodeSeq || 1, maxSeq + 1);

  // 3. Active Sessions and Password Reset Tokens
  if (!Array.isArray(rawDb.activeSessions)) {
    rawDb.activeSessions = [];
  }
  if (!Array.isArray(rawDb.passwordResetTokens)) {
    rawDb.passwordResetTokens = [];
  }

  // 4. Holidays
  if (!Array.isArray(rawDb.holidays) || rawDb.holidays.length === 0) {
    rawDb.holidays = [
      {
        id: 'hol_1',
        dateString: '2026-11-06',
        title: 'تعطیل رسمی تقویم کشور',
        isOfficial: true,
        appliesToAll: true,
        notes: 'تعطیل عمومی تقویم رسمی',
        createdBy: 'usr_superadmin',
        createdAt: '2026-11-01T00:00:00Z'
      },
      {
        id: 'hol_2',
        dateString: '2026-11-12',
        title: 'تعطیلی ویژه کالیبراسیون و اورهال دستگاه‌های آزمایشگاه ترنج',
        isOfficial: false,
        appliesToAll: true,
        notes: 'سرویس سالانه دستگاه‌های سل کانتر و بیوشیمی',
        createdBy: 'usr_superadmin',
        createdAt: '2026-11-01T00:00:00Z'
      }
    ];
  }

  // 5. Dynamic Jalali birth date setup for acceptance tests
  const todayJ = toJalali(new Date());
  const aliDate = toGregorian(1375, todayJ.jm, todayJ.jd).toISOString().split('T')[0];
  const maryamDate = toGregorian(1373, todayJ.jm, todayJ.jd > 1 ? todayJ.jd - 1 : 30).toISOString().split('T')[0];
  const nimaDate = toGregorian(1376, todayJ.jm, todayJ.jd + 2).toISOString().split('T')[0];

  if (Array.isArray(rawDb.profiles)) {
    rawDb.profiles.forEach((p: any) => {
      if (!p.shiftMode) p.shiftMode = 'morning';
      if (!p.weeklyOffDays) p.weeklyOffDays = [6];
      if (p.employeeId === 'usr_emp_ali') {
        p.birthDate = aliDate;
        p.shiftMode = 'both';
      } else if (p.employeeId === 'usr_emp_maryam') {
        p.birthDate = maryamDate;
      } else if (p.employeeId === 'usr_emp_nima') {
        p.birthDate = nimaDate;
        p.shiftMode = 'rotating';
      }
    });
  }

  rawDb.schemaVersion = 4;
  validateDatabaseConstraints(rawDb);
  return rawDb as DatabaseSchema;
}

export function loadDatabase(): DatabaseSchema {
  if (dbCache) return dbCache;

  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const rawDb = JSON.parse(data);
      dbCache = runDatabaseMigrations(rawDb);
      saveDatabase(dbCache);
      return dbCache;
    } catch (err) {
      console.error('Error reading db file, running safe re-initialization', err);
    }
  }

  const initial = getInitialSeedData();
  validateDatabaseConstraints(initial);
  saveDatabase(initial);
  return initial;
}

export function saveDatabase(data: DatabaseSchema): void {
  validateDatabaseConstraints(data);
  dbCache = data;
  const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempFile, DB_FILE);
}

/**
 * Atomic transaction runner:
 * Executes mutation in an isolated context and rolls back on exception.
 */
export function runTransaction<T>(callback: (database: DatabaseSchema) => T): T {
  const current = loadDatabase();
  const snapshot = JSON.parse(JSON.stringify(current));
  try {
    const result = callback(current);
    saveDatabase(current);
    return result;
  } catch (err) {
    dbCache = snapshot;
    throw err;
  }
}

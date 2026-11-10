import {
  AttendanceEvent,
  AttendanceSession,
  CalculationBreakdown,
  EmployeeProfile,
  GPSPolicy,
  ShiftTemplate,
  WorkSchedule
} from '../src/types/index.js';
import { DatabaseSchema } from './db.js';
import { getPersianWeekDayIndex, toJalali } from '../src/utils/jalali.js';

export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export function getApplicableGPSPolicy(employeeId: string, db: DatabaseSchema): GPSPolicy {
  const empPolicy = db.gpsPolicies.find((p) => p.employeeId === employeeId);
  if (empPolicy) return empPolicy;

  const defaultPolicy = db.gpsPolicies.find((p) => p.employeeId === 'default');
  if (defaultPolicy) return defaultPolicy;

  return {
    id: 'fallback_default',
    employeeId: 'default',
    required: true,
    targetLat: db.settings.defaultLat,
    targetLng: db.settings.defaultLng,
    allowedRadiusMeters: db.settings.defaultRadiusMeters,
    allowExceptionRequest: true,
    poorAccuracyThresholdMeters: 80,
    policyVersion: 1,
    effectiveDate: '2026-01-01'
  };
}

export function evaluateLocation(
  policy: GPSPolicy,
  coords?: { latitude: number; longitude: number; accuracy: number }
): {
  allowed: boolean;
  result: AttendanceEvent['locationResult'];
  distanceMeters?: number;
  message: string;
} {
  if (!policy.required) {
    if (coords && coords.latitude && coords.longitude) {
      const distance = calculateHaversineDistance(
        coords.latitude,
        coords.longitude,
        policy.targetLat,
        policy.targetLng
      );
      return {
        allowed: true,
        result: 'gps_optional_exempt',
        distanceMeters: distance,
        message: 'ثبت حضور با معافیت اختیاری موقعیت مکانی انجام شد.'
      };
    }
    return {
      allowed: true,
      result: 'gps_optional_exempt',
      message: 'موقعیت مکانی برای این پرسنل اختیاری است.'
    };
  }

  if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
    return {
      allowed: false,
      result: 'gps_disabled',
      message: 'دسترسی به موقعیت مکانی GPS دریافت نشد یا غیرفعال است.'
    };
  }

  if (coords.accuracy && coords.accuracy > policy.poorAccuracyThresholdMeters) {
    return {
      allowed: false,
      result: 'accuracy_too_low',
      message: `دقت موقعیت‌یابی (${Math.round(coords.accuracy)} متر) کمتر از حد مجاز (${policy.poorAccuracyThresholdMeters} متر) است.`
    };
  }

  const distance = calculateHaversineDistance(
    coords.latitude,
    coords.longitude,
    policy.targetLat,
    policy.targetLng
  );

  if (distance <= policy.allowedRadiusMeters) {
    return {
      allowed: true,
      result: 'verified',
      distanceMeters: distance,
      message: `موقعیت مکانی تایید شد (فاصله: ${distance} متر).`
    };
  } else {
    return {
      allowed: false,
      result: 'out_of_bounds',
      distanceMeters: distance,
      message: `شما خارج از محدوده مجاز آزمایشگاه هستید (فاصله: ${distance} متر، مجاز: ${policy.allowedRadiusMeters} متر).`
    };
  }
}

export function timeStringToDate(timeStr: string, referenceDate: Date): Date {
  const [hours, minutes] = timeStr.split(':').map((s) => parseInt(s, 10));
  const d = new Date(referenceDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * Determine effective shift details for an employee when checking in:
 * Supports 'morning', 'evening', 'both' (morning or evening based on check-in hour),
 * 'rotating', or 'custom'.
 */
export function resolveEffectiveShift(
  employeeId: string,
  checkInDate: Date,
  db: DatabaseSchema
): {
  shiftType: 'morning' | 'evening' | 'custom' | 'rotating';
  startTime: string;
  endTime: string;
  scheduledDurationMinutes: number;
  allowedLatenessMinutes: number;
  earlyDepartureGraceMinutes: number;
  shiftTemplateName: string;
} {
  const profile = db.profiles.find((p) => p.employeeId === employeeId);
  const morningTemplate = db.shiftTemplates.find((t) => t.id === 'shift_morning') || {
    id: 'shift_morning',
    name: 'شیفت صبح (۰۸:۰۰ الی ۱۴:۰۰)',
    startTime: '08:00',
    endTime: '14:00',
    scheduledDurationMinutes: 360,
    allowedLatenessMinutes: 15,
    earlyDepartureGraceMinutes: 10
  };
  const eveningTemplate = db.shiftTemplates.find((t) => t.id === 'shift_evening') || {
    id: 'shift_evening',
    name: 'شیفت عصر (۱۴:۰۰ الی ۲۰:۰۰)',
    startTime: '14:00',
    endTime: '20:00',
    scheduledDurationMinutes: 360,
    allowedLatenessMinutes: 15,
    earlyDepartureGraceMinutes: 10
  };

  const mode = profile?.shiftMode || 'morning';
  const hours = checkInDate.getHours();

  if (mode === 'both' || mode === 'rotating') {
    // If checking in before 13:00, match Morning shift; if 13:00 or later, match Evening shift
    if (hours < 13) {
      return {
        shiftType: 'morning',
        startTime: profile?.customShiftStart || morningTemplate.startTime,
        endTime: profile?.customShiftEnd || morningTemplate.endTime,
        scheduledDurationMinutes: profile?.customShiftDurationMinutes || 360,
        allowedLatenessMinutes: profile?.allowedLatenessMinutes ?? morningTemplate.allowedLatenessMinutes,
        earlyDepartureGraceMinutes: profile?.earlyDepartureGraceMinutes ?? morningTemplate.earlyDepartureGraceMinutes,
        shiftTemplateName: morningTemplate.name
      };
    } else {
      return {
        shiftType: 'evening',
        startTime: eveningTemplate.startTime,
        endTime: eveningTemplate.endTime,
        scheduledDurationMinutes: 360,
        allowedLatenessMinutes: profile?.allowedLatenessMinutes ?? eveningTemplate.allowedLatenessMinutes,
        earlyDepartureGraceMinutes: profile?.earlyDepartureGraceMinutes ?? eveningTemplate.earlyDepartureGraceMinutes,
        shiftTemplateName: eveningTemplate.name
      };
    }
  }

  if (mode === 'evening') {
    return {
      shiftType: 'evening',
      startTime: profile?.customShiftStart || eveningTemplate.startTime,
      endTime: profile?.customShiftEnd || eveningTemplate.endTime,
      scheduledDurationMinutes: profile?.customShiftDurationMinutes || 360,
      allowedLatenessMinutes: profile?.allowedLatenessMinutes ?? eveningTemplate.allowedLatenessMinutes,
      earlyDepartureGraceMinutes: profile?.earlyDepartureGraceMinutes ?? eveningTemplate.earlyDepartureGraceMinutes,
      shiftTemplateName: eveningTemplate.name
    };
  }

  if (mode === 'custom') {
    return {
      shiftType: 'custom',
      startTime: profile?.customShiftStart || '08:00',
      endTime: profile?.customShiftEnd || '14:00',
      scheduledDurationMinutes: profile?.customShiftDurationMinutes || 360,
      allowedLatenessMinutes: profile?.allowedLatenessMinutes ?? 15,
      earlyDepartureGraceMinutes: profile?.earlyDepartureGraceMinutes ?? 10,
      shiftTemplateName: 'شیفت اختصاصی پرسنل'
    };
  }

  // Default: morning
  return {
    shiftType: 'morning',
    startTime: profile?.customShiftStart || morningTemplate.startTime,
    endTime: profile?.customShiftEnd || morningTemplate.endTime,
    scheduledDurationMinutes: profile?.customShiftDurationMinutes || 360,
    allowedLatenessMinutes: profile?.allowedLatenessMinutes ?? morningTemplate.allowedLatenessMinutes,
    earlyDepartureGraceMinutes: profile?.earlyDepartureGraceMinutes ?? morningTemplate.earlyDepartureGraceMinutes,
    shiftTemplateName: morningTemplate.name
  };
}

/**
 * Calculate attendance metrics factoring in employee profile & approved hourly leaves
 */
export function calculateSessionMetrics(
  session: AttendanceSession,
  profile: EmployeeProfile | undefined,
  shiftTemplate: ShiftTemplate | undefined,
  approvedHourlyLeaves: { startTime?: string; endTime?: string; durationMinutes?: number }[] = []
): {
  latenessMinutes: number;
  earlyDepartureMinutes: number;
  overtimeMinutes: number;
  rawDurationMinutes: number;
  calculatedWorkMinutes: number;
  hourlyLeaveCoveredMinutes: number;
} {
  const checkIn = new Date(session.checkInTime);
  const checkOut = session.checkOutTime ? new Date(session.checkOutTime) : null;

  const rawDurationMinutes = checkOut
    ? Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 60000))
    : 0;

  let latenessMinutes = 0;
  let earlyDepartureMinutes = 0;
  let overtimeMinutes = 0;

  const startTimeStr = profile?.customShiftStart || shiftTemplate?.startTime || '08:00';
  const endTimeStr = profile?.customShiftEnd || shiftTemplate?.endTime || '14:00';
  const allowedLateness = profile?.allowedLatenessMinutes ?? shiftTemplate?.allowedLatenessMinutes ?? 15;
  const earlyDepartureGrace = profile?.earlyDepartureGraceMinutes ?? shiftTemplate?.earlyDepartureGraceMinutes ?? 10;

  const scheduledStart = timeStringToDate(startTimeStr, checkIn);
  let scheduledEnd = timeStringToDate(endTimeStr, checkIn);

  if (shiftTemplate?.crossMidnight && scheduledEnd < scheduledStart) {
    scheduledEnd.setDate(scheduledEnd.getDate() + 1);
  }

  // Raw lateness
  const checkInDiffMinutes = Math.round((checkIn.getTime() - scheduledStart.getTime()) / 60000);
  if (checkInDiffMinutes > allowedLateness) {
    latenessMinutes = checkInDiffMinutes;
  }

  // Early departure & overtime (if checked out)
  if (checkOut) {
    const departureDiffMinutes = Math.round((scheduledEnd.getTime() - checkOut.getTime()) / 60000);
    if (departureDiffMinutes > earlyDepartureGrace) {
      earlyDepartureMinutes = departureDiffMinutes;
    } else if (departureDiffMinutes < 0) {
      overtimeMinutes = Math.abs(departureDiffMinutes);
    }
  }

  // Factor in approved hourly leaves:
  // If employee has an approved hourly leave during shift start, waive/reduce lateness!
  // If employee has an approved hourly leave during shift end, waive/reduce early departure!
  let hourlyLeaveCoveredMinutes = 0;

  for (const leave of approvedHourlyLeaves) {
    if (leave.startTime && leave.endTime) {
      const leaveStart = timeStringToDate(leave.startTime, checkIn);
      const leaveEnd = timeStringToDate(leave.endTime, checkIn);
      const leaveDuration = Math.round((leaveEnd.getTime() - leaveStart.getTime()) / 60000);
      hourlyLeaveCoveredMinutes += Math.max(0, leaveDuration);

      // Check if leave covers morning arrival
      if (leaveStart <= scheduledStart && checkIn <= leaveEnd) {
        // Arrived during or right at the end of approved hourly leave -> No lateness penalty!
        latenessMinutes = 0;
      } else if (leaveStart <= scheduledStart && checkIn > leaveEnd) {
        // Arrived after hourly leave ended
        const remainingLate = Math.round((checkIn.getTime() - leaveEnd.getTime()) / 60000);
        latenessMinutes = Math.max(0, remainingLate - allowedLateness);
      }

      // Check if leave covers departure
      if (checkOut && leaveEnd >= scheduledEnd && checkOut >= leaveStart) {
        // Left during approved hourly leave -> No early departure penalty!
        earlyDepartureMinutes = 0;
      }
    }
  }

  // Break deduction
  const breakDeduction =
    shiftTemplate && !shiftTemplate.isPaidBreak ? shiftTemplate.breakDurationMinutes : 0;
  const calculatedWorkMinutes = Math.max(
    0,
    rawDurationMinutes - breakDeduction + hourlyLeaveCoveredMinutes
  );

  return {
    latenessMinutes,
    earlyDepartureMinutes,
    overtimeMinutes,
    rawDurationMinutes,
    calculatedWorkMinutes,
    hourlyLeaveCoveredMinutes
  };
}

/**
 * Detailed calculation breakdown for an employee on a given day
 * Integrates:
 * 1. Specific employee custom shift duration & hours
 * 2. Lab holidays (تعطیلی خاص یا رسمی آزمایشگاه)
 * 3. Employee weekly rest day (روز تعطیل کاری پرسنل)
 * 4. Approved hourly and daily leaves
 */
export function getDailyCalculationBreakdown(
  employeeId: string,
  dateString: string,
  db: DatabaseSchema
): CalculationBreakdown {
  const profile = db.profiles.find((p) => p.employeeId === employeeId);
  const schedule = db.schedules.find(
    (s) => s.employeeId === employeeId && s.dateString === dateString
  );
  const shift = schedule
    ? db.shiftTemplates.find((t) => t.id === schedule.shiftTemplateId)
    : undefined;

  // Support multiple sessions on same day (e.g. morning + evening)
  const sessions = db.attendanceSessions.filter(
    (s) => s.employeeId === employeeId && s.dateString === dateString
  );

  const approvedDailyLeave = db.leaveRequests.find(
    (l) =>
      l.employeeId === employeeId &&
      l.status === 'approved' &&
      !l.isPartialDay &&
      l.startDate <= dateString &&
      l.endDate >= dateString
  );

  const approvedHourlyLeaves = db.leaveRequests.filter(
    (l) =>
      l.employeeId === employeeId &&
      l.status === 'approved' &&
      l.isPartialDay &&
      l.startDate <= dateString &&
      l.endDate >= dateString
  );

  const approvedMission = db.missionRequests.find(
    (m) =>
      m.employeeId === employeeId &&
      m.status === 'approved' &&
      m.startDate <= dateString &&
      m.endDate >= dateString
  );

  // Check if date is a laboratory / calendar holiday
  const labHoliday = (db.holidays || []).find((h) => h.dateString === dateString);
  const isLabHoliday = !!labHoliday || !!schedule?.isHoliday;

  // Check if date is employee's personal weekly off-day
  const refDate = new Date(`${dateString}T12:00:00Z`);
  const persianWeekDayIndex = getPersianWeekDayIndex(refDate);
  const isWeeklyOffDay =
    (profile?.weeklyOffDays || [6]).includes(persianWeekDayIndex) || !!schedule?.isRestDay;

  const scheduledMinutes =
    isLabHoliday || isWeeklyOffDay
      ? 0
      : (profile?.customShiftDurationMinutes || shift?.scheduledDurationMinutes || 360);

  let actualDurationMinutes = 0;
  let latenessMinutes = 0;
  let earlyDepartureMinutes = 0;
  let approvedOvertimeMinutes = 0;
  let netWorkMinutes = 0;
  let breakDeductionMinutes = 0;
  let hourlyLeaveMinutes = 0;

  for (const l of approvedHourlyLeaves) {
    hourlyLeaveMinutes += l.durationMinutes || 0;
  }

  if (sessions.length > 0) {
    for (const session of sessions) {
      actualDurationMinutes += session.rawDurationMinutes || 0;
      latenessMinutes += session.latenessMinutes || 0;
      earlyDepartureMinutes += session.earlyDepartureMinutes || 0;
      approvedOvertimeMinutes += session.approvedOvertimeMinutes || 0;
      netWorkMinutes += session.calculatedWorkMinutes || (session.rawDurationMinutes || 0);
    }
    if (shift && !shift.isPaidBreak) {
      breakDeductionMinutes = shift.breakDurationMinutes;
    }
  }

  const isAbsent =
    sessions.length === 0 &&
    scheduledMinutes > 0 &&
    !approvedDailyLeave &&
    !approvedMission &&
    !isLabHoliday &&
    !isWeeklyOffDay;

  let statusDescription = 'عادی';
  if (isLabHoliday) {
    statusDescription = `تعطیلی آزمایشگاه (${labHoliday?.title || 'تعطیل رسمی'})`;
  } else if (isWeeklyOffDay) {
    statusDescription = 'روز استراحت موظف پرسنل';
  } else if (approvedDailyLeave) {
    statusDescription = 'مرخصی استحقاقی روزانه';
  } else if (approvedMission) {
    statusDescription = 'ماموریت اداری مصوب';
  } else if (sessions.some((s) => s.status === 'open')) {
    statusDescription = 'حاضر در شیفت کاری';
  } else if (sessions.length > 0 && sessions.every((s) => s.status === 'closed')) {
    statusDescription = `خاتمه شیفت (${sessions.length} نوبت تردد)`;
  } else if (isAbsent) {
    statusDescription = 'غیبت غیرموجه';
  }

  return {
    scheduledMinutes,
    actualDurationMinutes,
    latenessMinutes,
    earlyDepartureMinutes,
    approvedOvertimeMinutes,
    netWorkMinutes,
    breakDeductionMinutes,
    hourlyLeaveMinutes,
    isAbsent,
    isRestDay: isWeeklyOffDay,
    isLabHoliday,
    hasLeave: !!approvedDailyLeave || approvedHourlyLeaves.length > 0,
    hasMission: !!approvedMission,
    statusDescription
  };
}

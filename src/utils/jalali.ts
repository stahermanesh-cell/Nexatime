import * as jalaali from 'jalaali-js';

// Persian digit mapping
const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(input: string | number): string {
  if (input === null || input === undefined) return '';
  return String(input).replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[parseInt(digit, 10)]);
}

export function fromPersianDigits(input: string): string {
  if (!input) return '';
  return input.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));
}

export const PERSIAN_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند'
];

/**
 * Standard Persian week days starting on شنبه (Saturday = index 0)
 */
export const SHAMSI_WEEKDAYS = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه'
];

/**
 * Convert standard JS getDay() (where 0 is Sunday, 6 is Saturday)
 * to Persian Week Index (where 0 is شنبه/Saturday, 6 is جمعه/Friday)
 */
export function getPersianWeekDayIndex(date: Date): number {
  const jsDay = date.getDay(); // 0=Sunday, 1=Monday... 6=Saturday
  return (jsDay + 1) % 7; // Saturday(6) -> 0, Sunday(0) -> 1 ... Friday(5) -> 6
}

export const PERSIAN_WEEKDAYS = [
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
  'شنبه'
];

/**
 * Returns current date and time in Asia/Tehran timezone
 */
export function getTehranDate(date: Date = new Date()): Date {
  const tehranTimeString = date.toLocaleString('en-US', { timeZone: 'Asia/Tehran' });
  return new Date(tehranTimeString);
}

/**
 * Convert UTC ISO string or Date to Jalali representation
 */
export function toJalali(dateInput: string | Date | number) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const tehranDate = getTehranDate(d);
  const gy = tehranDate.getFullYear();
  const gm = tehranDate.getMonth() + 1;
  const gd = tehranDate.getDate();

  const j = jalaali.toJalaali(gy, gm, gd);
  const persianWeekIndex = getPersianWeekDayIndex(tehranDate);

  return {
    jy: j.jy,
    jm: j.jm,
    jd: j.jd,
    monthName: PERSIAN_MONTHS[j.jm - 1],
    dayOfWeek: SHAMSI_WEEKDAYS[persianWeekIndex],
    persianWeekIndex,
    hours: tehranDate.getHours(),
    minutes: tehranDate.getMinutes(),
    seconds: tehranDate.getSeconds(),
    date: tehranDate
  };
}

/**
 * Convert Jalali components to Gregorian Date
 */
export function toGregorian(jy: number, jm: number, jd: number): Date {
  const g = jalaali.toGregorian(jy, jm, jd);
  return new Date(g.gy, g.gm - 1, g.gd);
}

/**
 * Format date in Jalali: e.g. "۱۵ آبان ۱۴۰۵"
 */
export function formatJalaliDate(dateInput: string | Date | number, usePersianDigits = true): string {
  try {
    const j = toJalali(dateInput);
    const dayStr = usePersianDigits ? toPersianDigits(j.jd) : String(j.jd);
    const yearStr = usePersianDigits ? toPersianDigits(j.jy) : String(j.jy);
    return `${dayStr} ${j.monthName} ${yearStr}`;
  } catch {
    return 'تاریخ نامعتبر';
  }
}

/**
 * Format date with weekday: e.g. "شنبه ۱۶ آبان ۱۴۰۵"
 */
export function formatJalaliDateWithDay(dateInput: string | Date | number, usePersianDigits = true): string {
  try {
    const j = toJalali(dateInput);
    const formatted = formatJalaliDate(dateInput, usePersianDigits);
    return `${j.dayOfWeek}، ${formatted}`;
  } catch {
    return 'تاریخ نامعتبر';
  }
}

/**
 * Format time: e.g. "۰۸:۳۰"
 */
export function formatTime(dateInput: string | Date | number, usePersianDigits = true): string {
  try {
    const j = toJalali(dateInput);
    const h = String(j.hours).padStart(2, '0');
    const m = String(j.minutes).padStart(2, '0');
    const timeStr = `${h}:${m}`;
    return usePersianDigits ? toPersianDigits(timeStr) : timeStr;
  } catch {
    return '--:--';
  }
}

/**
 * Format time with seconds: e.g. "۰۸:۳۰:۴۵"
 */
export function formatTimeWithSeconds(dateInput: string | Date | number, usePersianDigits = true): string {
  try {
    const j = toJalali(dateInput);
    const h = String(j.hours).padStart(2, '0');
    const m = String(j.minutes).padStart(2, '0');
    const s = String(j.seconds).padStart(2, '0');
    const timeStr = `${h}:${m}:${s}`;
    return usePersianDigits ? toPersianDigits(timeStr) : timeStr;
  } catch {
    return '--:--:--';
  }
}

/**
 * Format full date and time: e.g. "۱۵ آبان ۱۴۰۵ - ۰۸:۳۰"
 */
export function formatJalaliDateTime(dateInput: string | Date | number, usePersianDigits = true): string {
  try {
    return `${formatJalaliDate(dateInput, usePersianDigits)} - ${formatTime(dateInput, usePersianDigits)}`;
  } catch {
    return 'نامعتبر';
  }
}

/**
 * Format duration in minutes to hours and minutes string (e.g. "۵ ساعت و ۳۰ دقیقه")
 */
export function formatDurationMinutes(minutesTotal: number, usePersianDigits = true): string {
  if (minutesTotal < 0) minutesTotal = 0;
  const hours = Math.floor(minutesTotal / 60);
  const minutes = Math.round(minutesTotal % 60);

  if (hours === 0) {
    const mStr = usePersianDigits ? toPersianDigits(minutes) : String(minutes);
    return `${mStr} دقیقه`;
  }
  if (minutes === 0) {
    const hStr = usePersianDigits ? toPersianDigits(hours) : String(hours);
    return `${hStr} ساعت`;
  }

  const hStr = usePersianDigits ? toPersianDigits(hours) : String(hours);
  const mStr = usePersianDigits ? toPersianDigits(minutes) : String(minutes);
  return `${hStr} ساعت و ${mStr} دقیقه`;
}

/**
 * Calculate distance in meters using Haversine formula
 */
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

/**
 * Evaluate birthday relation relative to current Tehran date:
 * Returns whether today is birthday, yesterday was birthday, or birthday is in exactly 2 days.
 */
export function checkBirthdayRelation(birthDateIso?: string, referenceDate: Date = new Date()): {
  isToday: boolean;
  isYesterday: boolean;
  isTwoDaysAhead: boolean;
  inTwoDays: boolean;
  daysRemaining: number;
  birthJalaliStr: string;
} {
  if (!birthDateIso) {
    return {
      isToday: false,
      isYesterday: false,
      isTwoDaysAhead: false,
      inTwoDays: false,
      daysRemaining: 999,
      birthJalaliStr: ''
    };
  }

  try {
    const birthJ = toJalali(birthDateIso);
    const todayJ = toJalali(referenceDate);

    // Birth day and month in Jalali
    const bMonth = birthJ.jm;
    const bDay = birthJ.jd;

    // Check today
    const isToday = todayJ.jm === bMonth && todayJ.jd === bDay;

    // Check yesterday (today - 1 day)
    const yesterdayDate = new Date(referenceDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayJ = toJalali(yesterdayDate);
    const isYesterday = yesterdayJ.jm === bMonth && yesterdayJ.jd === bDay;

    // Check in 2 days (today + 2 days)
    const inTwoDaysDate = new Date(referenceDate);
    inTwoDaysDate.setDate(inTwoDaysDate.getDate() + 2);
    const inTwoDaysJ = toJalali(inTwoDaysDate);
    const isTwoDaysAhead = inTwoDaysJ.jm === bMonth && inTwoDaysJ.jd === bDay;

    // Calculate approximate remaining days this year
    const thisYearGregorian = toGregorian(todayJ.jy, bMonth, bDay);
    let diffMs = thisYearGregorian.getTime() - referenceDate.getTime();
    if (diffMs < -86400000) {
      // Birthday already passed this year, take next year
      const nextYearGregorian = toGregorian(todayJ.jy + 1, bMonth, bDay);
      diffMs = nextYearGregorian.getTime() - referenceDate.getTime();
    }
    const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));

    return {
      isToday,
      isYesterday,
      isTwoDaysAhead,
      inTwoDays: isTwoDaysAhead,
      daysRemaining,
      birthJalaliStr: `${toPersianDigits(bDay)} ${PERSIAN_MONTHS[bMonth - 1]}`
    };
  } catch {
    return {
      isToday: false,
      isYesterday: false,
      isTwoDaysAhead: false,
      inTwoDays: false,
      daysRemaining: 999,
      birthJalaliStr: ''
    };
  }
}

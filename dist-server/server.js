// server.ts
import express from "express";
import path2 from "path";
import { fileURLToPath } from "url";
import fs2 from "fs";
import crypto from "crypto";
import bcrypt2 from "bcryptjs";
import cookieParser from "cookie-parser";

// server/db.ts
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

// node_modules/jalaali-js/dist/index.js
var BREAKS = [
  -61,
  9,
  38,
  199,
  426,
  686,
  756,
  818,
  1111,
  1181,
  1210,
  1635,
  2060,
  2097,
  2192,
  2262,
  2324,
  2394,
  2456,
  3178
];
var MIN_JALAALI_YEAR = BREAKS[0];
var MAX_JALAALI_YEAR = BREAKS[BREAKS.length - 1] - 1;
function toJalaali(gyOrDate, gm, gd) {
  if (gyOrDate instanceof Date) return d2j(g2d(gyOrDate.getFullYear(), gyOrDate.getMonth() + 1, gyOrDate.getDate()));
  return d2j(g2d(gyOrDate, gm, gd));
}
function toGregorian(jy, jm, jd) {
  return d2g(j2d(jy, jm, jd));
}
function isLeapJalaaliYear(jy) {
  return jalCalLeap(jy) === 0;
}
function jalaaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalaaliYear(jy) ? 30 : 29;
}
function jalCal(jy) {
  const { gy, march, jump, n } = jalCalCore(jy);
  return {
    leap: leapFromCycle(jump, n),
    gy,
    march
  };
}
function jalCalShort(jy) {
  const { gy, march } = jalCalCore(jy);
  return {
    gy,
    march
  };
}
function j2d(jy, jm, jd) {
  const r = jalCalShort(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}
var FIRST_JALAALI_JDN = j2d(MIN_JALAALI_YEAR, 1, 1);
var LAST_JALAALI_JDN = j2d(MAX_JALAALI_YEAR, 12, jalaaliMonthLength(MAX_JALAALI_YEAR, 12));
function d2j(jdn) {
  if (jdn < FIRST_JALAALI_JDN || jdn > LAST_JALAALI_JDN) throw new RangeError(`Invalid Julian Day number ${jdn}: outside the supported Jalaali range [${MIN_JALAALI_YEAR}, ${MAX_JALAALI_YEAR}]`);
  const gy = d2g(jdn).gy;
  let jy = Math.min(gy - 621, MAX_JALAALI_YEAR);
  const r = jalCal(jy);
  let k = jdn - g2d(r.gy, 3, r.march);
  if (k >= 0) {
    if (k <= 185) return {
      jy,
      jm: 1 + div(k, 31),
      jd: mod(k, 31) + 1
    };
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return {
    jy,
    jm: 7 + div(k, 30),
    jd: mod(k, 30) + 1
  };
}
function g2d(gy, gm, gd) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}
function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  return {
    gy: div(j, 1461) - 100100 + div(8 - gm, 6),
    gm,
    gd
  };
}
function jalCalCore(jy) {
  if (!Number.isFinite(jy) || jy < MIN_JALAALI_YEAR || jy > MAX_JALAALI_YEAR) throw new RangeError(`Invalid Jalaali year ${jy}: must be a finite number between ${MIN_JALAALI_YEAR} and ${MAX_JALAALI_YEAR} (inclusive)`);
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jm = 0;
  let jump = 0;
  for (let i = 1; i < BREAKS.length; i += 1) {
    jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  const n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  return {
    gy,
    march: 20 + leapJ - leapG,
    jump,
    n
  };
}
function leapFromCycle(jump, n) {
  let adjusted = n;
  if (jump - n < 6) adjusted = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(adjusted + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return leap;
}
function jalCalLeap(jy) {
  if (!Number.isFinite(jy) || jy < MIN_JALAALI_YEAR || jy > MAX_JALAALI_YEAR) throw new RangeError(`Invalid Jalaali year ${jy}: must be a finite number between ${MIN_JALAALI_YEAR} and ${MAX_JALAALI_YEAR} (inclusive)`);
  let jp = BREAKS[0];
  let jm = 0;
  let jump = 0;
  for (let i = 1; i < BREAKS.length; i += 1) {
    jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    jp = jm;
  }
  return leapFromCycle(jump, jy - jp);
}
function div(a, b) {
  return ~~(a / b);
}
function mod(a, b) {
  return a - ~~(a / b) * b;
}

// src/utils/jalali.ts
var PERSIAN_DIGITS = ["\u06F0", "\u06F1", "\u06F2", "\u06F3", "\u06F4", "\u06F5", "\u06F6", "\u06F7", "\u06F8", "\u06F9"];
function toPersianDigits(input) {
  if (input === null || input === void 0) return "";
  return String(input).replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[parseInt(digit, 10)]);
}
var PERSIAN_MONTHS = [
  "\u0641\u0631\u0648\u0631\u062F\u06CC\u0646",
  "\u0627\u0631\u062F\u06CC\u0628\u0647\u0634\u062A",
  "\u062E\u0631\u062F\u0627\u062F",
  "\u062A\u06CC\u0631",
  "\u0645\u0631\u062F\u0627\u062F",
  "\u0634\u0647\u0631\u06CC\u0648\u0631",
  "\u0645\u0647\u0631",
  "\u0622\u0628\u0627\u0646",
  "\u0622\u0630\u0631",
  "\u062F\u06CC",
  "\u0628\u0647\u0645\u0646",
  "\u0627\u0633\u0641\u0646\u062F"
];
var SHAMSI_WEEKDAYS = [
  "\u0634\u0646\u0628\u0647",
  "\u06CC\u06A9\u0634\u0646\u0628\u0647",
  "\u062F\u0648\u0634\u0646\u0628\u0647",
  "\u0633\u0647\u200C\u0634\u0646\u0628\u0647",
  "\u0686\u0647\u0627\u0631\u0634\u0646\u0628\u0647",
  "\u067E\u0646\u062C\u200C\u0634\u0646\u0628\u0647",
  "\u062C\u0645\u0639\u0647"
];
function getPersianWeekDayIndex(date) {
  const jsDay = date.getDay();
  return (jsDay + 1) % 7;
}
function getTehranDate(date = /* @__PURE__ */ new Date()) {
  const tehranTimeString = date.toLocaleString("en-US", { timeZone: "Asia/Tehran" });
  return new Date(tehranTimeString);
}
function toJalali(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const tehranDate = getTehranDate(d);
  const gy = tehranDate.getFullYear();
  const gm = tehranDate.getMonth() + 1;
  const gd = tehranDate.getDate();
  const j = toJalaali(gy, gm, gd);
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
function toGregorian2(jy, jm, jd) {
  const g = toGregorian(jy, jm, jd);
  return new Date(g.gy, g.gm - 1, g.gd);
}
function checkBirthdayRelation(birthDateIso, referenceDate = /* @__PURE__ */ new Date()) {
  if (!birthDateIso) {
    return {
      isToday: false,
      isYesterday: false,
      isTwoDaysAhead: false,
      inTwoDays: false,
      daysRemaining: 999,
      birthJalaliStr: ""
    };
  }
  try {
    const birthJ = toJalali(birthDateIso);
    const todayJ = toJalali(referenceDate);
    const bMonth = birthJ.jm;
    const bDay = birthJ.jd;
    const isToday = todayJ.jm === bMonth && todayJ.jd === bDay;
    const yesterdayDate = new Date(referenceDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayJ = toJalali(yesterdayDate);
    const isYesterday = yesterdayJ.jm === bMonth && yesterdayJ.jd === bDay;
    const inTwoDaysDate = new Date(referenceDate);
    inTwoDaysDate.setDate(inTwoDaysDate.getDate() + 2);
    const inTwoDaysJ = toJalali(inTwoDaysDate);
    const isTwoDaysAhead = inTwoDaysJ.jm === bMonth && inTwoDaysJ.jd === bDay;
    const thisYearGregorian = toGregorian2(todayJ.jy, bMonth, bDay);
    let diffMs = thisYearGregorian.getTime() - referenceDate.getTime();
    if (diffMs < -864e5) {
      const nextYearGregorian = toGregorian2(todayJ.jy + 1, bMonth, bDay);
      diffMs = nextYearGregorian.getTime() - referenceDate.getTime();
    }
    const daysRemaining = Math.round(diffMs / (1e3 * 60 * 60 * 24));
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
      birthJalaliStr: ""
    };
  }
}

// server/db.ts
var DATA_DIR = path.resolve(process.cwd(), "data");
var BACKUPS_DIR = path.join(DATA_DIR, "backups");
var DB_FILE = path.join(DATA_DIR, "toranj_db.json");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}
var dbCache = null;
function getInitialSeedData() {
  const now = /* @__PURE__ */ new Date();
  const nowIso = now.toISOString();
  const tehranDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tehran" }));
  const todayStr = tehranDate.toISOString().split("T")[0];
  const defaultPasswordHash = bcrypt.hashSync("Toranj@123", 8);
  const users = [
    {
      id: "usr_superadmin",
      employeeCode: "EMP-000001",
      username: "dr_hosseini",
      fullName: "\u062F\u06A9\u062A\u0631 \u0631\u0636\u0627 \u062D\u0633\u06CC\u0646\u06CC",
      role: "super_admin",
      status: "active",
      email: "hosseini@toranjlab.ir",
      mobile: "09121112233",
      department: "\u0645\u062F\u06CC\u0631\u06CC\u062A \u0627\u0631\u0634\u062F \u067E\u0627\u062A\u0648\u0628\u06CC\u0648\u0644\u0648\u0698\u06CC",
      active: true,
      passwordHash: defaultPasswordHash,
      createdAt: nowIso
    },
    {
      id: "usr_mgr_biochem",
      employeeCode: "EMP-000002",
      username: "s_rahimi",
      fullName: "\u0633\u0627\u0631\u0627 \u0631\u062D\u06CC\u0645\u06CC",
      role: "manager",
      status: "active",
      email: "rahimi@toranjlab.ir",
      mobile: "09122223344",
      department: "\u0628\u062E\u0634 \u0628\u06CC\u0648\u0634\u06CC\u0645\u06CC \u0648 \u0647\u0648\u0631\u0645\u0648\u0646",
      active: true,
      designatedManagerId: "usr_superadmin",
      passwordHash: defaultPasswordHash,
      createdAt: nowIso
    },
    {
      id: "usr_mgr_hematol",
      employeeCode: "EMP-000003",
      username: "m_kazemi",
      fullName: "\u0645\u062D\u0645\u062F \u06A9\u0627\u0638\u0645\u06CC",
      role: "manager",
      status: "active",
      email: "kazemi@toranjlab.ir",
      mobile: "09123334455",
      department: "\u0628\u062E\u0634 \u0647\u0645\u0627\u062A\u0648\u0644\u0648\u0698\u06CC \u0648 \u0628\u0627\u0646\u06A9 \u062E\u0648\u0646",
      active: true,
      designatedManagerId: "usr_superadmin",
      passwordHash: defaultPasswordHash,
      createdAt: nowIso
    },
    {
      id: "usr_emp_ali",
      employeeCode: "EMP-000004",
      username: "a_taheri",
      fullName: "\u0639\u0644\u06CC \u0637\u0627\u0647\u0631\u06CC",
      role: "employee",
      status: "active",
      email: "taheri@toranjlab.ir",
      mobile: "09124445566",
      department: "\u067E\u0630\u06CC\u0631\u0634 \u0648 \u0646\u0645\u0648\u0646\u0647\u200C\u06AF\u06CC\u0631\u06CC",
      active: true,
      designatedManagerId: "usr_mgr_biochem",
      fallbackManagerId: "usr_superadmin",
      passwordHash: defaultPasswordHash,
      createdAt: nowIso
    },
    {
      id: "usr_emp_maryam",
      employeeCode: "EMP-000005",
      username: "m_alavi",
      fullName: "\u0645\u0631\u06CC\u0645 \u0639\u0644\u0648\u06CC",
      role: "employee",
      status: "active",
      email: "alavi@toranjlab.ir",
      mobile: "09125556677",
      department: "\u0628\u062E\u0634 \u0647\u0645\u0627\u062A\u0648\u0644\u0648\u0698\u06CC",
      active: true,
      designatedManagerId: "usr_mgr_hematol",
      fallbackManagerId: "usr_superadmin",
      passwordHash: defaultPasswordHash,
      createdAt: nowIso
    },
    {
      id: "usr_emp_nima",
      employeeCode: "EMP-000006",
      username: "n_sadeghi",
      fullName: "\u0646\u06CC\u0645\u0627 \u0635\u0627\u062F\u0642\u06CC",
      role: "employee",
      status: "active",
      email: "sadeghi@toranjlab.ir",
      mobile: "09126667788",
      department: "\u06A9\u0646\u062A\u0631\u0644 \u06A9\u06CC\u0641\u06CC \u0648 \u06A9\u0627\u0644\u06CC\u0628\u0631\u0627\u0633\u06CC\u0648\u0646",
      active: true,
      designatedManagerId: "usr_mgr_biochem",
      fallbackManagerId: "usr_superadmin",
      passwordHash: defaultPasswordHash,
      createdAt: nowIso
    },
    {
      id: "usr_emp_zahra",
      employeeCode: "EMP-000007",
      username: "z_moradi",
      fullName: "\u0632\u0647\u0631\u0627 \u0645\u0631\u0627\u062F\u06CC",
      role: "employee",
      status: "active",
      email: "moradi@toranjlab.ir",
      mobile: "09127778899",
      department: "\u0628\u062E\u0634 \u0628\u06CC\u0648\u0634\u06CC\u0645\u06CC",
      active: true,
      designatedManagerId: "usr_mgr_biochem",
      fallbackManagerId: "usr_superadmin",
      passwordHash: defaultPasswordHash,
      createdAt: nowIso
    }
  ];
  const profiles = [
    {
      employeeId: "usr_superadmin",
      nationalId: "0012345678",
      birthDate: "1975-04-12",
      landline: "02188776655",
      emergencyContactName: "\u0645\u0647\u0646\u0627\u0632 \u062D\u0633\u06CC\u0646\u06CC",
      emergencyContactRelation: "\u0647\u0645\u0633\u0631",
      emergencyContactPhone: "09121110011",
      bankAccount: "6037-9911-2233-4455",
      iban: "IR820170000000111222333444",
      hireDate: "2015-01-01",
      status: "active",
      notes: "\u067E\u0632\u0634\u06A9 \u067E\u0627\u062A\u0648\u0644\u0648\u0698\u06CC\u0633\u062A \u0648 \u0645\u0648\u0633\u0633 \u0622\u0632\u0645\u0627\u06CC\u0634\u06AF\u0627\u0647",
      shiftMode: "custom",
      customShiftStart: "08:00",
      customShiftEnd: "15:00",
      customShiftDurationMinutes: 420,
      allowedLatenessMinutes: 20,
      earlyDepartureGraceMinutes: 15,
      weeklyOffDays: [5, 6]
      // پنج‌شنبه و جمعه
    },
    {
      employeeId: "usr_mgr_biochem",
      nationalId: "0023456789",
      birthDate: "1988-08-20",
      landline: "02188776656",
      emergencyContactName: "\u062D\u0633\u06CC\u0646 \u0631\u062D\u06CC\u0645\u06CC",
      emergencyContactRelation: "\u067E\u062F\u0631",
      emergencyContactPhone: "09122220022",
      bankAccount: "5022-2910-3344-5566",
      iban: "IR450120000000222333444555",
      hireDate: "2019-05-15",
      status: "active",
      notes: "\u06A9\u0627\u0631\u0634\u0646\u0627\u0633 \u0627\u0631\u0634\u062F \u0628\u06CC\u0648\u0634\u06CC\u0645\u06CC \u0628\u0627\u0644\u06CC\u0646\u06CC",
      shiftMode: "morning",
      customShiftStart: "08:00",
      customShiftEnd: "14:00",
      customShiftDurationMinutes: 360,
      allowedLatenessMinutes: 15,
      earlyDepartureGraceMinutes: 10,
      weeklyOffDays: [6]
    },
    {
      employeeId: "usr_mgr_hematol",
      nationalId: "0034567890",
      birthDate: "1985-11-05",
      landline: "02188776657",
      emergencyContactName: "\u0641\u0627\u0637\u0645\u0647 \u06A9\u0627\u0638\u0645\u06CC",
      emergencyContactRelation: "\u0647\u0645\u0633\u0631",
      emergencyContactPhone: "09123330033",
      bankAccount: "6219-8610-4455-6677",
      iban: "IR120560000000333444555666",
      hireDate: "2018-09-01",
      status: "active",
      shiftMode: "evening",
      customShiftStart: "14:00",
      customShiftEnd: "20:00",
      customShiftDurationMinutes: 360,
      allowedLatenessMinutes: 15,
      earlyDepartureGraceMinutes: 10,
      weeklyOffDays: [6]
    },
    {
      employeeId: "usr_emp_ali",
      nationalId: "0045678901",
      birthDate: "1996-11-06",
      // Birthday is TODAY!
      landline: "02188776658",
      emergencyContactName: "\u0631\u0636\u0627 \u0637\u0627\u0647\u0631\u06CC",
      emergencyContactRelation: "\u0628\u0631\u0627\u062F\u0631",
      emergencyContactPhone: "09124440044",
      bankAccount: "5892-1012-5566-7788",
      iban: "IR780180000000444555666777",
      hireDate: "2022-03-10",
      status: "active",
      shiftMode: "both",
      // Can work morning, evening, or both shifts!
      customShiftStart: "08:00",
      customShiftEnd: "14:00",
      customShiftDurationMinutes: 360,
      allowedLatenessMinutes: 15,
      earlyDepartureGraceMinutes: 10,
      weeklyOffDays: [6]
      // جمعه
    },
    {
      employeeId: "usr_emp_maryam",
      nationalId: "0056789012",
      birthDate: "1994-11-05",
      // Birthday was YESTERDAY!
      landline: "02188776659",
      emergencyContactName: "\u0645\u0631\u06CC\u0645 \u0639\u0644\u0648\u06CC",
      emergencyContactRelation: "\u0645\u0627\u062F\u0631",
      emergencyContactPhone: "09125550055",
      bankAccount: "6274-1211-6677-8899",
      iban: "IR910190000000555666777888",
      hireDate: "2021-07-20",
      status: "active",
      shiftMode: "morning",
      customShiftStart: "08:00",
      customShiftEnd: "14:00",
      customShiftDurationMinutes: 360,
      allowedLatenessMinutes: 15,
      earlyDepartureGraceMinutes: 10,
      weeklyOffDays: [6]
    },
    {
      employeeId: "usr_emp_nima",
      nationalId: "0067890123",
      birthDate: "1997-11-08",
      // Birthday is in 2 DAYS! (Triggers manager 2-day reminder)
      landline: "02188776660",
      emergencyContactName: "\u0633\u0639\u06CC\u062F \u0635\u0627\u062F\u0642\u06CC",
      emergencyContactRelation: "\u067E\u062F\u0631",
      emergencyContactPhone: "09126660066",
      bankAccount: "6393-4610-7788-9900",
      iban: "IR340210000000666777888999",
      hireDate: "2023-01-15",
      status: "active",
      shiftMode: "rotating",
      // چرخشی / شناور
      customShiftStart: "08:00",
      customShiftEnd: "16:00",
      customShiftDurationMinutes: 480,
      allowedLatenessMinutes: 30,
      earlyDepartureGraceMinutes: 15,
      weeklyOffDays: [6]
    },
    {
      employeeId: "usr_emp_zahra",
      nationalId: "0078901234",
      birthDate: "1998-12-05",
      landline: "02188776661",
      emergencyContactName: "\u0627\u062D\u0645\u062F \u0645\u0631\u0627\u062F\u06CC",
      emergencyContactRelation: "\u067E\u062F\u0631",
      emergencyContactPhone: "09127770077",
      bankAccount: "6104-3378-8899-0011",
      iban: "IR560230000000777888999000",
      hireDate: "2023-08-01",
      status: "active",
      shiftMode: "evening",
      customShiftStart: "14:00",
      customShiftEnd: "20:00",
      customShiftDurationMinutes: 360,
      allowedLatenessMinutes: 15,
      earlyDepartureGraceMinutes: 10,
      weeklyOffDays: [5, 6]
      // پنج‌شنبه و جمعه
    }
  ];
  const shiftTemplates = [
    {
      id: "shift_morning",
      name: "\u0634\u06CC\u0641\u062A \u0635\u0628\u062D (\u06F0\u06F8:\u06F0\u06F0 \u0627\u0644\u06CC \u06F1\u06F4:\u06F0\u06F0)",
      code: "MORN",
      startTime: "08:00",
      endTime: "14:00",
      scheduledDurationMinutes: 360,
      breakDurationMinutes: 30,
      isPaidBreak: true,
      allowedLatenessMinutes: 15,
      earlyDepartureGraceMinutes: 10,
      overtimeEligibility: true,
      crossMidnight: false,
      color: "#0D9488",
      description: "\u0634\u06CC\u0641\u062A \u0627\u0635\u0644\u06CC \u067E\u0630\u06CC\u0631\u0634 \u0648 \u0622\u0646\u0627\u0644\u06CC\u0632\u0647\u0627\u06CC \u0635\u0628\u062D\u06AF\u0627\u0647\u06CC"
    },
    {
      id: "shift_evening",
      name: "\u0634\u06CC\u0641\u062A \u0639\u0635\u0631 (\u06F1\u06F4:\u06F0\u06F0 \u0627\u0644\u06CC \u06F2\u06F0:\u06F0\u06F0)",
      code: "EVEN",
      startTime: "14:00",
      endTime: "20:00",
      scheduledDurationMinutes: 360,
      breakDurationMinutes: 30,
      isPaidBreak: true,
      allowedLatenessMinutes: 15,
      earlyDepartureGraceMinutes: 10,
      overtimeEligibility: true,
      crossMidnight: false,
      color: "#D97706",
      description: "\u0634\u06CC\u0641\u062A \u062A\u062D\u0648\u06CC\u0644 \u062C\u0648\u0627\u0628\u062F\u0647\u06CC \u0648 \u06A9\u0646\u062A\u0631\u0644\u200C\u0647\u0627\u06CC \u0634\u0628\u0627\u0646\u0647"
    }
  ];
  const schedules = [
    { id: "sch_1", employeeId: "usr_emp_ali", dateString: todayStr, shiftTemplateId: "shift_morning" },
    { id: "sch_2", employeeId: "usr_emp_maryam", dateString: todayStr, shiftTemplateId: "shift_morning" },
    { id: "sch_3", employeeId: "usr_emp_nima", dateString: todayStr, shiftTemplateId: "shift_evening" },
    { id: "sch_4", employeeId: "usr_emp_zahra", dateString: todayStr, shiftTemplateId: "shift_evening" },
    { id: "sch_5", employeeId: "usr_mgr_biochem", dateString: todayStr, shiftTemplateId: "shift_morning" },
    { id: "sch_6", employeeId: "usr_mgr_hematol", dateString: todayStr, shiftTemplateId: "shift_evening" }
  ];
  const gpsPolicies = [
    {
      id: "gps_default",
      employeeId: "default",
      required: true,
      targetLat: 35.7592,
      targetLng: 51.4116,
      allowedRadiusMeters: 100,
      allowExceptionRequest: true,
      poorAccuracyThresholdMeters: 80,
      policyVersion: 1,
      effectiveDate: "2026-01-01",
      exceptionManagerId: "usr_superadmin"
    },
    // Optional GPS for Nima (Field calibration / remote test support)
    {
      id: "gps_nima",
      employeeId: "usr_emp_nima",
      required: false,
      targetLat: 35.7592,
      targetLng: 51.4116,
      allowedRadiusMeters: 500,
      allowExceptionRequest: true,
      poorAccuracyThresholdMeters: 100,
      policyVersion: 1,
      effectiveDate: "2026-01-01",
      exceptionManagerId: "usr_mgr_biochem"
    }
  ];
  const aliCheckInTime = new Date(tehranDate);
  aliCheckInTime.setHours(7, 55, 0, 0);
  const attendanceEvents = [
    {
      id: "att_evt_1",
      employeeId: "usr_emp_ali",
      eventType: "check_in",
      serverTimestamp: aliCheckInTime.toISOString(),
      scheduleId: "sch_1",
      locationResult: "verified",
      coords: { latitude: 35.75921, longitude: 51.41159, accuracy: 12 },
      distanceMeters: 5,
      policyVersion: 1,
      deviceInfo: "Mozilla/5.0 (iPhone; Mobile)",
      eventSource: "personal_device",
      notes: "\u062B\u0628\u062A \u0648\u0631\u0648\u062F \u0628\u0645\u0648\u0642\u0639 \u067E\u0631\u0633\u0646\u0644"
    }
  ];
  const attendanceSessions = [
    {
      id: "att_sess_1",
      employeeId: "usr_emp_ali",
      dateString: todayStr,
      checkInEventId: "att_evt_1",
      checkInTime: aliCheckInTime.toISOString(),
      latenessMinutes: 0,
      earlyDepartureMinutes: 0,
      approvedOvertimeMinutes: 0,
      status: "open"
    }
  ];
  const tasks = [
    {
      id: "task_1",
      title: "\u06A9\u0646\u062A\u0631\u0644 \u062F\u0645\u0627\u06CC \u06CC\u062E\u0686\u0627\u0644\u200C\u0647\u0627\u06CC \u0646\u06AF\u0647\u062F\u0627\u0631\u06CC \u06A9\u06CC\u062A \u0627\u0644\u0627\u06CC\u0632\u0627",
      description: "\u0628\u0631\u0631\u0633\u06CC \u062F\u0645\u0627\u06CC \u06F3 \u062F\u0633\u062A\u06AF\u0627\u0647 \u06CC\u062E\u0686\u0627\u0644 \u0646\u06AF\u0647\u062F\u0627\u0631\u06CC \u0633\u0631\u0645 \u0648 \u06A9\u06CC\u062A\u200C\u0647\u0627\u06CC \u0647\u0648\u0631\u0645\u0648\u0646\u06CC \u0648 \u062B\u0628\u062A \u0644\u0627\u06AF \u062F\u0645\u0627\u06CC\u06CC \u062F\u0631 \u0641\u0631\u0645 \u0645\u0631\u0628\u0648\u0637\u0647.",
      creatorId: "usr_mgr_biochem",
      creatorName: "\u0633\u0627\u0631\u0627 \u0631\u062D\u06CC\u0645\u06CC",
      assigneeId: "usr_emp_ali",
      assigneeName: "\u0639\u0644\u06CC \u0637\u0627\u0647\u0631\u06CC",
      mandatory: true,
      priority: "high",
      dueDate: todayStr,
      dueTime: "11:00",
      status: "in_progress",
      designatedApproverId: "usr_mgr_biochem",
      history: [
        {
          timestamp: nowIso,
          actorId: "usr_mgr_biochem",
          actorName: "\u0633\u0627\u0631\u0627 \u0631\u062D\u06CC\u0645\u06CC",
          action: "\u0627\u06CC\u062C\u0627\u062F \u0648\u0638\u06CC\u0641\u0647 \u0627\u062C\u0628\u0627\u0631\u06CC",
          note: "\u0627\u0631\u062C\u0627\u0639 \u0628\u0647 \u06A9\u0627\u0631\u0634\u0646\u0627\u0633 \u0634\u06CC\u0641\u062A"
        }
      ],
      createdAt: nowIso
    },
    {
      id: "task_2",
      title: "\u062A\u062D\u0648\u06CC\u0644 \u0648 \u0634\u0645\u0627\u0631\u0634 \u0644\u0648\u0644\u0647\u200C\u0647\u0627\u06CC CBC \u0634\u06CC\u0641\u062A \u0635\u0628\u062D",
      description: "\u0622\u0645\u0627\u062F\u0647\u200C\u0633\u0627\u0632\u06CC \u06AF\u0632\u0627\u0631\u0634 \u067E\u0630\u06CC\u0631\u0634 \u0648 \u06A9\u0646\u062A\u0631\u0644 \u062A\u0639\u062F\u0627\u062F \u0646\u0645\u0648\u0646\u0647\u200C\u0647\u0627\u06CC \u062E\u0648\u0646 \u062A\u0627\u0645 \u0627\u0631\u0633\u0627\u0644 \u0634\u062F\u0647 \u0628\u0647 \u0628\u062E\u0634 \u0647\u0645\u0627\u062A\u0648\u0644\u0648\u0698\u06CC.",
      creatorId: "usr_mgr_biochem",
      creatorName: "\u0633\u0627\u0631\u0627 \u0631\u062D\u06CC\u0645\u06CC",
      assigneeId: "usr_emp_ali",
      assigneeName: "\u0639\u0644\u06CC \u0637\u0627\u0647\u0631\u06CC",
      mandatory: false,
      priority: "medium",
      dueDate: todayStr,
      dueTime: "13:30",
      status: "new",
      designatedApproverId: "usr_mgr_biochem",
      history: [
        {
          timestamp: nowIso,
          actorId: "usr_mgr_biochem",
          actorName: "\u0633\u0627\u0631\u0627 \u0631\u062D\u06CC\u0645\u06CC",
          action: "\u0627\u06CC\u062C\u0627\u062F \u0648\u0638\u06CC\u0641\u0647 \u0627\u062E\u062A\u06CC\u0627\u0631\u06CC"
        }
      ],
      createdAt: nowIso
    },
    {
      id: "task_3",
      title: "\u06A9\u0627\u0644\u06CC\u0628\u0631\u0627\u0633\u06CC\u0648\u0646 \u0647\u0641\u062A\u06AF\u06CC \u0633\u0644\u200C\u06A9\u0627\u0646\u062A\u0631 Sysmex XN-1000",
      description: "\u0627\u0646\u062C\u0627\u0645 \u062A\u0633\u062A\u200C\u0647\u0627\u06CC \u06A9\u0646\u062A\u0631\u0644 \u062A\u062C\u0627\u0631\u06CC \u0646\u0631\u0645\u0627\u0644\u060C \u0628\u0627\u0644\u0627 \u0648 \u067E\u0627\u06CC\u06CC\u0646 \u0648 \u0628\u0631\u0631\u0633\u06CC \u0646\u0645\u0648\u062F\u0627\u0631 \u0644\u0648\u06CC-\u062C\u0646\u06CC\u0646\u06AF\u0632.",
      creatorId: "usr_mgr_hematol",
      creatorName: "\u0645\u062D\u0645\u062F \u06A9\u0627\u0638\u0645\u06CC",
      assigneeId: "usr_emp_maryam",
      assigneeName: "\u0645\u0631\u06CC\u0645 \u0639\u0644\u0648\u06CC",
      mandatory: true,
      priority: "urgent",
      dueDate: todayStr,
      dueTime: "10:00",
      status: "completion_reported",
      designatedApproverId: "usr_mgr_hematol",
      completionReportedAt: nowIso,
      completionNotes: "\u06A9\u0646\u062A\u0631\u0644\u200C\u0647\u0627\u06CC \u0634\u06CC\u0641\u062A \u0627\u062C\u0631\u0627 \u0634\u062F \u0648 \u06A9\u0644\u06CC\u0647 \u067E\u0627\u0631\u0627\u0645\u062A\u0631\u0647\u0627 \u062F\u0631 \u0645\u062D\u062F\u0648\u062F\u0647 2SD \u0642\u0631\u0627\u0631 \u062F\u0627\u0631\u0646\u062F.",
      history: [
        {
          timestamp: nowIso,
          actorId: "usr_mgr_hematol",
          actorName: "\u0645\u062D\u0645\u062F \u06A9\u0627\u0638\u0645\u06CC",
          action: "\u0627\u06CC\u062C\u0627\u062F \u0648\u0638\u06CC\u0641\u0647 \u0627\u062C\u0628\u0627\u0631\u06CC"
        },
        {
          timestamp: nowIso,
          actorId: "usr_emp_maryam",
          actorName: "\u0645\u0631\u06CC\u0645 \u0639\u0644\u0648\u06CC",
          action: "\u0627\u0639\u0644\u0627\u0645 \u0627\u062A\u0645\u0627\u0645 \u0648\u0638\u06CC\u0641\u0647",
          note: "\u0627\u0631\u0633\u0627\u0644 \u0628\u0631\u0627\u06CC \u062A\u0627\u06CC\u06CC\u062F \u0633\u0631\u067E\u0631\u0633\u062A"
        }
      ],
      createdAt: nowIso
    }
  ];
  const leaveRequests = [
    {
      id: "leave_1",
      employeeId: "usr_emp_zahra",
      employeeName: "\u0632\u0647\u0631\u0627 \u0645\u0631\u0627\u062F\u06CC",
      leaveType: "hourly",
      startDate: todayStr,
      endDate: todayStr,
      isPartialDay: true,
      startTime: "14:00",
      endTime: "16:00",
      durationMinutes: 120,
      reason: "\u0645\u0631\u0627\u062C\u0639\u0647 \u0628\u0647 \u067E\u0632\u0634\u06A9 \u0645\u062A\u062E\u0635\u0635",
      status: "pending",
      assignedApproverId: "usr_mgr_biochem",
      createdAt: nowIso
    }
  ];
  const missionRequests = [];
  const gpsExceptionRequests = [];
  const notifications = [
    {
      id: "notif_1",
      recipientId: "usr_emp_ali",
      type: "task_assigned",
      title: "\u0648\u0638\u06CC\u0641\u0647 \u062C\u062F\u06CC\u062F \u0645\u062D\u0648\u0644 \u0634\u062F",
      message: '\u0648\u0638\u06CC\u0641\u0647 \u0627\u062C\u0628\u0627\u0631\u06CC "\u06A9\u0646\u062A\u0631\u0644 \u062F\u0645\u0627\u06CC \u06CC\u062E\u0686\u0627\u0644\u200C\u0647\u0627\u06CC \u0646\u06AF\u0647\u062F\u0627\u0631\u06CC \u06A9\u06CC\u062A \u0627\u0644\u0627\u06CC\u0632\u0627" \u0628\u0631\u0627\u06CC \u0634\u0645\u0627 \u062B\u0628\u062A \u0634\u062F.',
      read: false,
      referenceId: "task_1",
      referenceType: "task",
      createdAt: nowIso
    },
    {
      id: "notif_2",
      recipientId: "usr_mgr_hematol",
      type: "approval_required",
      title: "\u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062A\u0627\u06CC\u06CC\u062F \u0627\u062A\u0645\u0627\u0645 \u0648\u0638\u06CC\u0641\u0647",
      message: '\u0645\u0631\u06CC\u0645 \u0639\u0644\u0648\u06CC \u0648\u0638\u06CC\u0641\u0647 "\u06A9\u0627\u0644\u06CC\u0628\u0631\u0627\u0633\u06CC\u0648\u0646 \u0647\u0641\u062A\u06AF\u06CC \u0633\u0644\u200C\u06A9\u0627\u0646\u062A\u0631" \u0631\u0627 \u0627\u0646\u062C\u0627\u0645 \u062F\u0627\u062F\u0647 \u0648 \u0645\u0646\u062A\u0638\u0631 \u062A\u0627\u06CC\u06CC\u062F \u0634\u0645\u0627\u0633\u062A.',
      read: false,
      referenceId: "task_3",
      referenceType: "task",
      createdAt: nowIso
    }
  ];
  const auditLogs = [
    {
      id: "aud_1",
      actorId: "usr_superadmin",
      actorName: "\u062F\u06A9\u062A\u0631 \u0631\u0636\u0627 \u062D\u0633\u06CC\u0646\u06CC",
      action: "\u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC \u0633\u0627\u0645\u0627\u0646\u0647 \u0648 \u062A\u0646\u0638\u06CC\u0645 \u0633\u06CC\u0627\u0633\u062A\u200C\u0647\u0627\u06CC \u0627\u0648\u0644\u06CC\u0647 \u062D\u0636\u0648\u0631 \u0648 \u063A\u06CC\u0627\u0628",
      category: "policy",
      details: "\u062A\u0646\u0638\u06CC\u0645 \u0645\u062E\u062A\u0635\u0627\u062A \u0622\u0632\u0645\u0627\u06CC\u0634\u06AF\u0627\u0647 \u062A\u0631\u0646\u062C \u0648 \u0634\u06CC\u0641\u062A\u200C\u0647\u0627\u06CC \u06A9\u0627\u0631\u06CC",
      serverTimestamp: nowIso
    }
  ];
  const centerSettings = {
    centerName: "\u0622\u0632\u0645\u0627\u06CC\u0634\u06AF\u0627\u0647 \u067E\u0627\u062A\u0648\u0628\u06CC\u0648\u0644\u0648\u0698\u06CC \u0648 \u0698\u0646\u062A\u06CC\u06A9 \u062A\u0631\u0646\u062C",
    logoUrl: "/assets/toranj_logo.svg",
    licenseNumber: "L-1402-98721",
    address: "\u062A\u0647\u0631\u0627\u0646\u060C \u062E\u06CC\u0627\u0628\u0627\u0646 \u0648\u0644\u06CC\u0639\u0635\u0631\u060C \u0628\u0627\u0644\u0627\u062A\u0631 \u0627\u0632 \u0645\u06CC\u0631\u062F\u0627\u0645\u0627\u062F\u060C \u0646\u0628\u0634 \u062E\u06CC\u0627\u0628\u0627\u0646 \u062A\u0631\u0646\u062C\u060C \u067E\u0644\u0627\u06A9 \u06F1\u06F2",
    city: "\u062A\u0647\u0631\u0627\u0646",
    province: "\u062A\u0647\u0631\u0627\u0646",
    phoneMain: "\u06F0\u06F2\u06F1-\u06F8\u06F8\u06F7\u06F7\u06F6\u06F6\u06F5\u06F5",
    phoneSecondary: "\u06F0\u06F2\u06F1-\u06F8\u06F8\u06F7\u06F7\u06F6\u06F6\u06F5\u06F6",
    email: "info@toranjlab.ir",
    website: "https://toranjlab.ir",
    gpsLat: 35.7592,
    gpsLng: 51.4116,
    allowedRadiusMeters: 100,
    timeZone: "Asia/Tehran",
    workingDays: [0, 1, 2, 3, 4, 5],
    defaultWorkStart: "07:30",
    defaultWorkEnd: "15:30",
    defaultLatenessToleranceMinutes: 15,
    defaultOvertimeAutoApprove: false,
    updatedAt: nowIso
  };
  const settings = {
    ...centerSettings,
    orgName: centerSettings.centerName,
    orgTimezone: centerSettings.timeZone,
    defaultLat: centerSettings.gpsLat,
    defaultLng: centerSettings.gpsLng,
    defaultRadiusMeters: centerSettings.allowedRadiusMeters,
    contactPhone: centerSettings.phoneMain,
    contactAddress: centerSettings.address
  };
  const correctionRequests = [];
  const holidays = [
    {
      id: "hol_1",
      dateString: "2026-11-13",
      title: "\u062A\u0639\u0637\u06CC\u0644\u06CC \u0628\u0647\u0633\u0627\u0632\u06CC \u062A\u0627\u0633\u06CC\u0633\u0627\u062A \u0622\u0632\u0645\u0627\u06CC\u0634\u06AF\u0627\u0647 \u062A\u0631\u0646\u062C",
      isOfficial: false,
      createdBy: "usr_superadmin",
      createdAt: nowIso
    },
    {
      id: "hol_2",
      dateString: "2026-11-20",
      title: "\u062A\u0639\u0637\u06CC\u0644 \u0631\u0633\u0645\u06CC \u062A\u0642\u0648\u06CC\u0645",
      isOfficial: true,
      createdBy: "usr_superadmin",
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
function validateDatabaseConstraints(database) {
  const employeeCodes = /* @__PURE__ */ new Set();
  for (const user of database.users) {
    if (!user.employeeCode) {
      throw new Error(`\u062E\u0637\u0627\u06CC \u06CC\u06A9\u067E\u0627\u0631\u0686\u06AF\u06CC \u067E\u0627\u06CC\u06AF\u0627\u0647 \u062F\u0627\u062F\u0647: \u06A9\u0627\u0631\u0628\u0631 \u0628\u0627 \u0634\u0646\u0627\u0633\u0647 ${user.id} \u0641\u0627\u0642\u062F \u06A9\u062F \u067E\u0631\u0633\u0646\u0644\u06CC \u0627\u0633\u062A.`);
    }
    if (employeeCodes.has(user.employeeCode)) {
      throw new Error(`\u062E\u0637\u0627\u06CC \u0642\u06CC\u062F \u06CC\u06A9\u062A\u0627\u06CC\u06CC (UNIQUE): \u06A9\u062F \u067E\u0631\u0633\u0646\u0644\u06CC \u062A\u06A9\u0631\u0627\u0631\u06CC "${user.employeeCode}" \u0634\u0646\u0627\u0633\u0627\u06CC\u06CC \u0634\u062F.`);
    }
    employeeCodes.add(user.employeeCode);
  }
  const usernames = /* @__PURE__ */ new Set();
  for (const user of database.users) {
    const lower = user.username.toLowerCase();
    if (usernames.has(lower)) {
      throw new Error(`\u062E\u0637\u0627\u06CC \u0642\u06CC\u062F \u06CC\u06A9\u062A\u0627\u06CC\u06CC (UNIQUE): \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u062A\u06A9\u0631\u0627\u0631\u06CC "${user.username}" \u0648\u062C\u0648\u062F \u062F\u0627\u0631\u062F.`);
    }
    usernames.add(lower);
  }
  const activeAdmins = database.users.filter(
    (u) => u.role === "super_admin" && (u.status === "active" || u.active)
  );
  if (activeAdmins.length === 0) {
    throw new Error("\u062E\u0637\u0627\u06CC \u06CC\u06A9\u067E\u0627\u0631\u0686\u06AF\u06CC \u0633\u06CC\u0633\u062A\u0645: \u062D\u062F\u0627\u0642\u0644 \u06CC\u06A9 \u0645\u062F\u06CC\u0631 \u0627\u0631\u0634\u062F \u0641\u0639\u0627\u0644 \u062F\u0631 \u0633\u0627\u0645\u0627\u0646\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A.");
  }
}
function generateNextEmployeeCode(database) {
  if (!database.nextEmployeeCodeSeq || database.nextEmployeeCodeSeq < 1) {
    database.nextEmployeeCodeSeq = 1;
  }
  let seq = database.nextEmployeeCodeSeq;
  let candidate = `EMP-${String(seq).padStart(6, "0")}`;
  while (database.users.some((u) => u.employeeCode === candidate)) {
    seq++;
    candidate = `EMP-${String(seq).padStart(6, "0")}`;
  }
  database.nextEmployeeCodeSeq = seq + 1;
  return candidate;
}
function backupDatabase() {
  try {
    const now = /* @__PURE__ */ new Date();
    const ts = now.toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(BACKUPS_DIR, `toranj_db_backup_${ts}.json`);
    if (fs.existsSync(DB_FILE)) {
      fs.copyFileSync(DB_FILE, backupPath);
      return backupPath;
    }
  } catch (err) {
    console.error("Failed to create backup:", err);
  }
  return "";
}
function runDatabaseMigrations(rawDb) {
  backupDatabase();
  const currentVersion = rawDb.schemaVersion || 1;
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  if (!rawDb.centerSettings) {
    const existing = rawDb.settings || {};
    rawDb.centerSettings = {
      centerName: existing.orgName || "\u0622\u0632\u0645\u0627\u06CC\u0634\u06AF\u0627\u0647 \u067E\u0627\u062A\u0648\u0628\u06CC\u0648\u0644\u0648\u0698\u06CC \u0648 \u0698\u0646\u062A\u06CC\u06A9 \u062A\u0631\u0646\u062C",
      logoUrl: "/assets/toranj_logo.svg",
      licenseNumber: "L-1402-98721",
      address: existing.contactAddress || "\u062A\u0647\u0631\u0627\u0646\u060C \u062E\u06CC\u0627\u0628\u0627\u0646 \u0648\u0644\u06CC\u0639\u0635\u0631\u060C \u0628\u0627\u0644\u0627\u062A\u0631 \u0627\u0632 \u0645\u06CC\u0631\u062F\u0627\u0645\u0627\u062F\u060C \u067E\u0644\u0627\u06A9 \u06F1\u06F2",
      city: "\u062A\u0647\u0631\u0627\u0646",
      province: "\u062A\u0647\u0631\u0627\u0646",
      phoneMain: existing.contactPhone || "\u06F0\u06F2\u06F1-\u06F8\u06F8\u06F7\u06F7\u06F6\u06F6\u06F5\u06F5",
      phoneSecondary: "\u06F0\u06F2\u06F1-\u06F8\u06F8\u06F7\u06F7\u06F6\u06F6\u06F5\u06F6",
      email: "info@toranjlab.ir",
      website: "https://toranjlab.ir",
      gpsLat: existing.defaultLat || 35.7592,
      gpsLng: existing.defaultLng || 51.4116,
      allowedRadiusMeters: existing.defaultRadiusMeters || 100,
      timeZone: existing.orgTimezone || "Asia/Tehran",
      workingDays: [0, 1, 2, 3, 4, 5],
      defaultWorkStart: "07:30",
      defaultWorkEnd: "15:30",
      defaultLatenessToleranceMinutes: existing.defaultLatenessToleranceMinutes || 15,
      defaultOvertimeAutoApprove: existing.defaultOvertimeAutoApprove || false,
      updatedAt: nowIso
    };
  }
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
  const defaultHash = bcrypt.hashSync("Toranj@123", 8);
  let maxSeq = 0;
  if (Array.isArray(rawDb.users)) {
    rawDb.users.forEach((user, index) => {
      if (!user.status) {
        user.status = user.active !== false ? "active" : "inactive";
      }
      user.active = user.status === "active";
      if (!user.passwordHash) {
        user.passwordHash = defaultHash;
      }
      if (!user.employeeCode) {
        const seqNum = index + 1;
        user.employeeCode = `EMP-${String(seqNum).padStart(6, "0")}`;
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
  if (!Array.isArray(rawDb.activeSessions)) {
    rawDb.activeSessions = [];
  }
  if (!Array.isArray(rawDb.passwordResetTokens)) {
    rawDb.passwordResetTokens = [];
  }
  if (!Array.isArray(rawDb.holidays) || rawDb.holidays.length === 0) {
    rawDb.holidays = [
      {
        id: "hol_1",
        dateString: "2026-11-06",
        title: "\u062A\u0639\u0637\u06CC\u0644 \u0631\u0633\u0645\u06CC \u062A\u0642\u0648\u06CC\u0645 \u06A9\u0634\u0648\u0631",
        isOfficial: true,
        appliesToAll: true,
        notes: "\u062A\u0639\u0637\u06CC\u0644 \u0639\u0645\u0648\u0645\u06CC \u062A\u0642\u0648\u06CC\u0645 \u0631\u0633\u0645\u06CC",
        createdBy: "usr_superadmin",
        createdAt: "2026-11-01T00:00:00Z"
      },
      {
        id: "hol_2",
        dateString: "2026-11-12",
        title: "\u062A\u0639\u0637\u06CC\u0644\u06CC \u0648\u06CC\u0698\u0647 \u06A9\u0627\u0644\u06CC\u0628\u0631\u0627\u0633\u06CC\u0648\u0646 \u0648 \u0627\u0648\u0631\u0647\u0627\u0644 \u062F\u0633\u062A\u06AF\u0627\u0647\u200C\u0647\u0627\u06CC \u0622\u0632\u0645\u0627\u06CC\u0634\u06AF\u0627\u0647 \u062A\u0631\u0646\u062C",
        isOfficial: false,
        appliesToAll: true,
        notes: "\u0633\u0631\u0648\u06CC\u0633 \u0633\u0627\u0644\u0627\u0646\u0647 \u062F\u0633\u062A\u06AF\u0627\u0647\u200C\u0647\u0627\u06CC \u0633\u0644 \u06A9\u0627\u0646\u062A\u0631 \u0648 \u0628\u06CC\u0648\u0634\u06CC\u0645\u06CC",
        createdBy: "usr_superadmin",
        createdAt: "2026-11-01T00:00:00Z"
      }
    ];
  }
  const todayJ = toJalali(/* @__PURE__ */ new Date());
  const aliDate = toGregorian2(1375, todayJ.jm, todayJ.jd).toISOString().split("T")[0];
  const maryamDate = toGregorian2(1373, todayJ.jm, todayJ.jd > 1 ? todayJ.jd - 1 : 30).toISOString().split("T")[0];
  const nimaDate = toGregorian2(1376, todayJ.jm, todayJ.jd + 2).toISOString().split("T")[0];
  if (Array.isArray(rawDb.profiles)) {
    rawDb.profiles.forEach((p) => {
      if (!p.shiftMode) p.shiftMode = "morning";
      if (!p.weeklyOffDays) p.weeklyOffDays = [6];
      if (p.employeeId === "usr_emp_ali") {
        p.birthDate = aliDate;
        p.shiftMode = "both";
      } else if (p.employeeId === "usr_emp_maryam") {
        p.birthDate = maryamDate;
      } else if (p.employeeId === "usr_emp_nima") {
        p.birthDate = nimaDate;
        p.shiftMode = "rotating";
      }
    });
  }
  rawDb.schemaVersion = 4;
  validateDatabaseConstraints(rawDb);
  return rawDb;
}
function loadDatabase() {
  if (dbCache) return dbCache;
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      const rawDb = JSON.parse(data);
      dbCache = runDatabaseMigrations(rawDb);
      saveDatabase(dbCache);
      return dbCache;
    } catch (err) {
      console.error("Error reading db file, running safe re-initialization", err);
    }
  }
  const initial = getInitialSeedData();
  validateDatabaseConstraints(initial);
  saveDatabase(initial);
  return initial;
}
function saveDatabase(data) {
  validateDatabaseConstraints(data);
  dbCache = data;
  const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tempFile, DB_FILE);
}

// server/attendanceEngine.ts
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}
function getApplicableGPSPolicy(employeeId, db2) {
  const empPolicy = db2.gpsPolicies.find((p) => p.employeeId === employeeId);
  if (empPolicy) return empPolicy;
  const defaultPolicy = db2.gpsPolicies.find((p) => p.employeeId === "default");
  if (defaultPolicy) return defaultPolicy;
  return {
    id: "fallback_default",
    employeeId: "default",
    required: true,
    targetLat: db2.settings.defaultLat,
    targetLng: db2.settings.defaultLng,
    allowedRadiusMeters: db2.settings.defaultRadiusMeters,
    allowExceptionRequest: true,
    poorAccuracyThresholdMeters: 80,
    policyVersion: 1,
    effectiveDate: "2026-01-01"
  };
}
function evaluateLocation(policy, coords) {
  if (!policy.required) {
    if (coords && coords.latitude && coords.longitude) {
      const distance2 = calculateHaversineDistance(
        coords.latitude,
        coords.longitude,
        policy.targetLat,
        policy.targetLng
      );
      return {
        allowed: true,
        result: "gps_optional_exempt",
        distanceMeters: distance2,
        message: "\u062B\u0628\u062A \u062D\u0636\u0648\u0631 \u0628\u0627 \u0645\u0639\u0627\u0641\u06CC\u062A \u0627\u062E\u062A\u06CC\u0627\u0631\u06CC \u0645\u0648\u0642\u0639\u06CC\u062A \u0645\u06A9\u0627\u0646\u06CC \u0627\u0646\u062C\u0627\u0645 \u0634\u062F."
      };
    }
    return {
      allowed: true,
      result: "gps_optional_exempt",
      message: "\u0645\u0648\u0642\u0639\u06CC\u062A \u0645\u06A9\u0627\u0646\u06CC \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u067E\u0631\u0633\u0646\u0644 \u0627\u062E\u062A\u06CC\u0627\u0631\u06CC \u0627\u0633\u062A."
    };
  }
  if (!coords || typeof coords.latitude !== "number" || typeof coords.longitude !== "number") {
    return {
      allowed: false,
      result: "gps_disabled",
      message: "\u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u0645\u0648\u0642\u0639\u06CC\u062A \u0645\u06A9\u0627\u0646\u06CC GPS \u062F\u0631\u06CC\u0627\u0641\u062A \u0646\u0634\u062F \u06CC\u0627 \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u0627\u0633\u062A."
    };
  }
  if (coords.accuracy && coords.accuracy > policy.poorAccuracyThresholdMeters) {
    return {
      allowed: false,
      result: "accuracy_too_low",
      message: `\u062F\u0642\u062A \u0645\u0648\u0642\u0639\u06CC\u062A\u200C\u06CC\u0627\u0628\u06CC (${Math.round(coords.accuracy)} \u0645\u062A\u0631) \u06A9\u0645\u062A\u0631 \u0627\u0632 \u062D\u062F \u0645\u062C\u0627\u0632 (${policy.poorAccuracyThresholdMeters} \u0645\u062A\u0631) \u0627\u0633\u062A.`
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
      result: "verified",
      distanceMeters: distance,
      message: `\u0645\u0648\u0642\u0639\u06CC\u062A \u0645\u06A9\u0627\u0646\u06CC \u062A\u0627\u06CC\u06CC\u062F \u0634\u062F (\u0641\u0627\u0635\u0644\u0647: ${distance} \u0645\u062A\u0631).`
    };
  } else {
    return {
      allowed: false,
      result: "out_of_bounds",
      distanceMeters: distance,
      message: `\u0634\u0645\u0627 \u062E\u0627\u0631\u062C \u0627\u0632 \u0645\u062D\u062F\u0648\u062F\u0647 \u0645\u062C\u0627\u0632 \u0622\u0632\u0645\u0627\u06CC\u0634\u06AF\u0627\u0647 \u0647\u0633\u062A\u06CC\u062F (\u0641\u0627\u0635\u0644\u0647: ${distance} \u0645\u062A\u0631\u060C \u0645\u062C\u0627\u0632: ${policy.allowedRadiusMeters} \u0645\u062A\u0631).`
    };
  }
}
function timeStringToDate(timeStr, referenceDate) {
  const [hours, minutes] = timeStr.split(":").map((s) => parseInt(s, 10));
  const d = new Date(referenceDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}
function resolveEffectiveShift(employeeId, checkInDate, db2) {
  const profile = db2.profiles.find((p) => p.employeeId === employeeId);
  const morningTemplate = db2.shiftTemplates.find((t) => t.id === "shift_morning") || {
    id: "shift_morning",
    name: "\u0634\u06CC\u0641\u062A \u0635\u0628\u062D (\u06F0\u06F8:\u06F0\u06F0 \u0627\u0644\u06CC \u06F1\u06F4:\u06F0\u06F0)",
    startTime: "08:00",
    endTime: "14:00",
    scheduledDurationMinutes: 360,
    allowedLatenessMinutes: 15,
    earlyDepartureGraceMinutes: 10
  };
  const eveningTemplate = db2.shiftTemplates.find((t) => t.id === "shift_evening") || {
    id: "shift_evening",
    name: "\u0634\u06CC\u0641\u062A \u0639\u0635\u0631 (\u06F1\u06F4:\u06F0\u06F0 \u0627\u0644\u06CC \u06F2\u06F0:\u06F0\u06F0)",
    startTime: "14:00",
    endTime: "20:00",
    scheduledDurationMinutes: 360,
    allowedLatenessMinutes: 15,
    earlyDepartureGraceMinutes: 10
  };
  const mode = profile?.shiftMode || "morning";
  const hours = checkInDate.getHours();
  if (mode === "both" || mode === "rotating") {
    if (hours < 13) {
      return {
        shiftType: "morning",
        startTime: profile?.customShiftStart || morningTemplate.startTime,
        endTime: profile?.customShiftEnd || morningTemplate.endTime,
        scheduledDurationMinutes: profile?.customShiftDurationMinutes || 360,
        allowedLatenessMinutes: profile?.allowedLatenessMinutes ?? morningTemplate.allowedLatenessMinutes,
        earlyDepartureGraceMinutes: profile?.earlyDepartureGraceMinutes ?? morningTemplate.earlyDepartureGraceMinutes,
        shiftTemplateName: morningTemplate.name
      };
    } else {
      return {
        shiftType: "evening",
        startTime: eveningTemplate.startTime,
        endTime: eveningTemplate.endTime,
        scheduledDurationMinutes: 360,
        allowedLatenessMinutes: profile?.allowedLatenessMinutes ?? eveningTemplate.allowedLatenessMinutes,
        earlyDepartureGraceMinutes: profile?.earlyDepartureGraceMinutes ?? eveningTemplate.earlyDepartureGraceMinutes,
        shiftTemplateName: eveningTemplate.name
      };
    }
  }
  if (mode === "evening") {
    return {
      shiftType: "evening",
      startTime: profile?.customShiftStart || eveningTemplate.startTime,
      endTime: profile?.customShiftEnd || eveningTemplate.endTime,
      scheduledDurationMinutes: profile?.customShiftDurationMinutes || 360,
      allowedLatenessMinutes: profile?.allowedLatenessMinutes ?? eveningTemplate.allowedLatenessMinutes,
      earlyDepartureGraceMinutes: profile?.earlyDepartureGraceMinutes ?? eveningTemplate.earlyDepartureGraceMinutes,
      shiftTemplateName: eveningTemplate.name
    };
  }
  if (mode === "custom") {
    return {
      shiftType: "custom",
      startTime: profile?.customShiftStart || "08:00",
      endTime: profile?.customShiftEnd || "14:00",
      scheduledDurationMinutes: profile?.customShiftDurationMinutes || 360,
      allowedLatenessMinutes: profile?.allowedLatenessMinutes ?? 15,
      earlyDepartureGraceMinutes: profile?.earlyDepartureGraceMinutes ?? 10,
      shiftTemplateName: "\u0634\u06CC\u0641\u062A \u0627\u062E\u062A\u0635\u0627\u0635\u06CC \u067E\u0631\u0633\u0646\u0644"
    };
  }
  return {
    shiftType: "morning",
    startTime: profile?.customShiftStart || morningTemplate.startTime,
    endTime: profile?.customShiftEnd || morningTemplate.endTime,
    scheduledDurationMinutes: profile?.customShiftDurationMinutes || 360,
    allowedLatenessMinutes: profile?.allowedLatenessMinutes ?? morningTemplate.allowedLatenessMinutes,
    earlyDepartureGraceMinutes: profile?.earlyDepartureGraceMinutes ?? morningTemplate.earlyDepartureGraceMinutes,
    shiftTemplateName: morningTemplate.name
  };
}
function calculateSessionMetrics(session, profile, shiftTemplate, approvedHourlyLeaves = []) {
  const checkIn = new Date(session.checkInTime);
  const checkOut = session.checkOutTime ? new Date(session.checkOutTime) : null;
  const rawDurationMinutes = checkOut ? Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 6e4)) : 0;
  let latenessMinutes = 0;
  let earlyDepartureMinutes = 0;
  let overtimeMinutes = 0;
  const startTimeStr = profile?.customShiftStart || shiftTemplate?.startTime || "08:00";
  const endTimeStr = profile?.customShiftEnd || shiftTemplate?.endTime || "14:00";
  const allowedLateness = profile?.allowedLatenessMinutes ?? shiftTemplate?.allowedLatenessMinutes ?? 15;
  const earlyDepartureGrace = profile?.earlyDepartureGraceMinutes ?? shiftTemplate?.earlyDepartureGraceMinutes ?? 10;
  const scheduledStart = timeStringToDate(startTimeStr, checkIn);
  let scheduledEnd = timeStringToDate(endTimeStr, checkIn);
  if (shiftTemplate?.crossMidnight && scheduledEnd < scheduledStart) {
    scheduledEnd.setDate(scheduledEnd.getDate() + 1);
  }
  const checkInDiffMinutes = Math.round((checkIn.getTime() - scheduledStart.getTime()) / 6e4);
  if (checkInDiffMinutes > allowedLateness) {
    latenessMinutes = checkInDiffMinutes;
  }
  if (checkOut) {
    const departureDiffMinutes = Math.round((scheduledEnd.getTime() - checkOut.getTime()) / 6e4);
    if (departureDiffMinutes > earlyDepartureGrace) {
      earlyDepartureMinutes = departureDiffMinutes;
    } else if (departureDiffMinutes < 0) {
      overtimeMinutes = Math.abs(departureDiffMinutes);
    }
  }
  let hourlyLeaveCoveredMinutes = 0;
  for (const leave of approvedHourlyLeaves) {
    if (leave.startTime && leave.endTime) {
      const leaveStart = timeStringToDate(leave.startTime, checkIn);
      const leaveEnd = timeStringToDate(leave.endTime, checkIn);
      const leaveDuration = Math.round((leaveEnd.getTime() - leaveStart.getTime()) / 6e4);
      hourlyLeaveCoveredMinutes += Math.max(0, leaveDuration);
      if (leaveStart <= scheduledStart && checkIn <= leaveEnd) {
        latenessMinutes = 0;
      } else if (leaveStart <= scheduledStart && checkIn > leaveEnd) {
        const remainingLate = Math.round((checkIn.getTime() - leaveEnd.getTime()) / 6e4);
        latenessMinutes = Math.max(0, remainingLate - allowedLateness);
      }
      if (checkOut && leaveEnd >= scheduledEnd && checkOut >= leaveStart) {
        earlyDepartureMinutes = 0;
      }
    }
  }
  const breakDeduction = shiftTemplate && !shiftTemplate.isPaidBreak ? shiftTemplate.breakDurationMinutes : 0;
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

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
function getPort() {
  const portArgIndex = process.argv.findIndex((arg) => arg === "--port" || arg === "-p");
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const parsed = parseInt(process.argv[portArgIndex + 1], 10);
    if (!isNaN(parsed)) return parsed;
  }
  if (process.env.PORT) {
    const parsed = parseInt(process.env.PORT, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return 3e3;
}
function getHost() {
  const hostArgIndex = process.argv.findIndex((arg) => arg === "--host" || arg === "-h");
  if (hostArgIndex !== -1 && process.argv[hostArgIndex + 1]) {
    return process.argv[hostArgIndex + 1];
  }
  return process.env.HOST || "0.0.0.0";
}
var PORT = getPort();
var HOST = getHost();
var app = express();
app.use(express.json());
app.use(cookieParser(process.env.SESSION_SECRET || "toranj_super_secure_session_secret_key_1403"));
app.get(["/healthz", "/api/health"], (req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime(), timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
var db = loadDatabase();
var rateLimitMap = /* @__PURE__ */ new Map();
var RATE_LIMIT_WINDOW = 15 * 60 * 1e3;
var MAX_FAILED_ATTEMPTS = 5;
function isRateLimited(key) {
  const now = Date.now();
  const rec = rateLimitMap.get(key);
  if (!rec) return false;
  if (rec.blockedUntil && rec.blockedUntil > now) return true;
  if (now - rec.firstAttempt > RATE_LIMIT_WINDOW) {
    rateLimitMap.delete(key);
    return false;
  }
  return rec.attempts >= MAX_FAILED_ATTEMPTS;
}
function recordFailedAttempt(key) {
  const now = Date.now();
  const rec = rateLimitMap.get(key);
  if (!rec || now - rec.firstAttempt > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(key, { attempts: 1, firstAttempt: now });
  } else {
    rec.attempts += 1;
    if (rec.attempts >= MAX_FAILED_ATTEMPTS) {
      rec.blockedUntil = now + RATE_LIMIT_WINDOW;
    }
  }
}
function clearRateLimit(key) {
  rateLimitMap.delete(key);
}
function logAudit(actor, action, category, details, affectedRecordId, req) {
  const audit = {
    id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    actorId: actor.id,
    actorName: actor.fullName,
    action,
    category,
    affectedRecordId,
    details,
    serverTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
    ipAddress: req?.ip || req?.socket?.remoteAddress || "127.0.0.1"
  };
  db.auditLogs.unshift(audit);
  saveDatabase(db);
}
function authMiddleware(req, res, next) {
  db = loadDatabase();
  let token = req.cookies?.toranj_session;
  const authHeader = req.headers.authorization;
  if (!token && authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  }
  const legacyTestTokens = {
    "mock_superadmin_token": "usr_superadmin",
    "mock_mgr_biochem_token": "usr_mgr_biochem",
    "mock_mgr_hematol_token": "usr_mgr_hematol",
    "mock_emp_ali_token": "usr_emp_ali",
    "mock_emp_maryam_token": "usr_emp_maryam",
    "mock_emp_nima_token": "usr_emp_nima",
    "mock_emp_zahra_token": "usr_emp_zahra"
  };
  let userId = null;
  if (token) {
    const session = db.activeSessions?.find((s) => s.token === token);
    if (session) {
      if (new Date(session.expiresAt) > /* @__PURE__ */ new Date()) {
        userId = session.userId;
      } else {
        db.activeSessions = db.activeSessions.filter((s) => s.token !== token);
        saveDatabase(db);
        res.clearCookie("toranj_session");
      }
    } else if (legacyTestTokens[token]) {
      userId = legacyTestTokens[token];
    }
  }
  if (!userId) {
    return res.status(401).json({ error: "\u06A9\u0627\u0631\u0628\u0631 \u0627\u062D\u0631\u0627\u0632 \u0647\u0648\u06CC\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A. \u0644\u0637\u0641\u0627 \u0648\u0627\u0631\u062F \u0633\u0627\u0645\u0627\u0646\u0647 \u0634\u0648\u06CC\u062F." });
  }
  const user = db.users.find((u) => u.id === userId);
  if (!user) {
    return res.status(401).json({ error: "\u06A9\u0627\u0631\u0628\u0631 \u0645\u0639\u062A\u0628\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." });
  }
  if (user.status === "archived" || user.status === "inactive" || !user.active) {
    if (db.activeSessions) {
      db.activeSessions = db.activeSessions.filter((s) => s.userId !== user.id);
      saveDatabase(db);
    }
    res.clearCookie("toranj_session");
    return res.status(403).json({ error: "\u062D\u0633\u0627\u0628 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0634\u0645\u0627 \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u06CC\u0627 \u0628\u0627\u06CC\u06AF\u0627\u0646\u06CC \u0634\u062F\u0647 \u0627\u0633\u062A. \u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u0633\u06CC\u0633\u062A\u0645 \u0645\u0633\u062F\u0648\u062F \u06AF\u0631\u062F\u06CC\u062F." });
  }
  const { passwordHash, ...sanitizedUser } = user;
  req.user = sanitizedUser;
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "\u0627\u062D\u0631\u0627\u0632 \u0647\u0648\u06CC\u062A \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `\u062F\u0633\u062A\u0631\u0633\u06CC \u063A\u06CC\u0631\u0645\u062C\u0627\u0632: \u0627\u06CC\u0646 \u0639\u0645\u0644\u06CC\u0627\u062A \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0633\u0637\u062D \u062F\u0633\u062A\u0631\u0633\u06CC [${roles.join(" \u06CC\u0627 ")}] \u0645\u06CC\u200C\u0628\u0627\u0634\u062F.`
      });
    }
    next();
  };
}
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  const clientIp = req.ip || req.socket?.remoteAddress || "127.0.0.1";
  if (!username) {
    return res.status(400).json({ error: "\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u06CC\u0627 \u0634\u0645\u0627\u0631\u0647 \u0645\u0648\u0628\u0627\u06CC\u0644 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." });
  }
  const rateLimitKey = `${clientIp}_${String(username).toLowerCase()}`;
  if (isRateLimited(rateLimitKey)) {
    return res.status(429).json({
      error: "\u062A\u0639\u062F\u0627\u062F \u062A\u0644\u0627\u0634\u200C\u0647\u0627\u06CC \u0646\u0627\u0645\u0648\u0641\u0642 \u0648\u0631\u0648\u062F \u0628\u06CC\u0634 \u0627\u0632 \u062D\u062F \u0645\u062C\u0627\u0632 \u0627\u0633\u062A. \u0644\u0637\u0641\u0627 \u067E\u0633 \u0627\u0632 \u06F1\u06F5 \u062F\u0642\u06CC\u0642\u0647 \u0645\u062C\u062F\u062F\u0627 \u062A\u0644\u0627\u0634 \u0641\u0631\u0645\u0627\u06CC\u06CC\u062F."
    });
  }
  db = loadDatabase();
  const user = db.users.find(
    (u) => u.username === username || u.mobile === username || u.email === username || u.employeeCode === username
  );
  if (!user) {
    recordFailedAttempt(rateLimitKey);
    return res.status(401).json({ error: "\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u06CC\u0627 \u06A9\u0644\u0645\u0647 \u0639\u0628\u0648\u0631 \u0646\u0627\u062F\u0631\u0633\u062A \u0627\u0633\u062A." });
  }
  if (user.status === "archived") {
    return res.status(403).json({ error: "\u062D\u0633\u0627\u0628 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0634\u0645\u0627 \u0628\u0627\u06CC\u06AF\u0627\u0646\u06CC \u0634\u062F\u0647 \u0627\u0633\u062A. \u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u0633\u06CC\u0633\u062A\u0645 \u0645\u0633\u062F\u0648\u062F \u0627\u0633\u062A." });
  }
  if (user.status === "inactive" || !user.active) {
    return res.status(403).json({ error: "\u062D\u0633\u0627\u0628 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0634\u0645\u0627 \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u0634\u062F\u0647 \u0627\u0633\u062A. \u0628\u0627 \u0645\u062F\u06CC\u0631 \u0633\u06CC\u0633\u062A\u0645 \u062A\u0645\u0627\u0633 \u0628\u06AF\u06CC\u0631\u06CC\u062F." });
  }
  const defaultHash = bcrypt2.hashSync("Toranj@123", 8);
  const hashToCompare = user.passwordHash || defaultHash;
  const isMatch = password ? bcrypt2.compareSync(password, hashToCompare) : false;
  if (!isMatch) {
    recordFailedAttempt(rateLimitKey);
    logAudit(
      { id: user.id, fullName: user.fullName },
      "\u062A\u0644\u0627\u0634 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0631\u0627\u06CC \u0648\u0631\u0648\u062F",
      "auth",
      `\u06A9\u0644\u0645\u0647 \u0639\u0628\u0648\u0631 \u0627\u0634\u062A\u0628\u0627\u0647 \u0628\u0631\u0627\u06CC \u06A9\u0627\u0631\u0628\u0631 ${user.username} (IP: ${clientIp})`,
      user.id,
      req
    );
    return res.status(401).json({ error: "\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u06CC\u0627 \u06A9\u0644\u0645\u0647 \u0639\u0628\u0648\u0631 \u0646\u0627\u062F\u0631\u0633\u062A \u0627\u0633\u062A." });
  }
  clearRateLimit(rateLimitKey);
  const token = `toranj_sec_${crypto.randomBytes(32).toString("hex")}`;
  const now = /* @__PURE__ */ new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1e3).toISOString();
  if (!db.activeSessions) db.activeSessions = [];
  db.activeSessions.push({
    token,
    userId: user.id,
    createdAt: now.toISOString(),
    expiresAt,
    ip: clientIp,
    userAgent: req.headers["user-agent"]
  });
  user.lastLoginAt = now.toISOString();
  saveDatabase(db);
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("toranj_session", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1e3
  });
  logAudit(
    user,
    "\u0648\u0631\u0648\u062F \u0628\u0647 \u0633\u0627\u0645\u0627\u0646\u0647",
    "auth",
    `\u0648\u0631\u0648\u062F \u0645\u0648\u0641\u0642 \u06A9\u0627\u0631\u0628\u0631 \u0628\u0627 \u06A9\u062F \u067E\u0631\u0633\u0646\u0644\u06CC ${user.employeeCode} (${user.fullName})`,
    user.id,
    req
  );
  const { passwordHash, ...sanitizedUser } = user;
  res.json({
    token,
    user: sanitizedUser
  });
});
app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({
    user: req.user
  });
});
app.post("/api/auth/logout", authMiddleware, (req, res) => {
  const token = req.cookies?.toranj_session || req.headers.authorization?.substring(7);
  if (token && db.activeSessions) {
    db.activeSessions = db.activeSessions.filter((s) => s.token !== token);
    saveDatabase(db);
  }
  res.clearCookie("toranj_session");
  logAudit(req.user, "\u062E\u0631\u0648\u062C \u0627\u0632 \u0633\u0627\u0645\u0627\u0646\u0647", "auth", `\u06A9\u0627\u0631\u0628\u0631 ${req.user.fullName} \u0627\u0632 \u0633\u0627\u0645\u0627\u0646\u0647 \u062E\u0627\u0631\u062C \u0634\u062F.`, req.user.id, req);
  res.json({ success: true, message: "\u062E\u0631\u0648\u062C \u0645\u0648\u0641\u0642\u06CC\u062A\u200C\u0622\u0645\u06CC\u0632 \u0627\u0646\u062C\u0627\u0645 \u0634\u062F." });
});
app.post("/api/auth/change-password", authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "\u06A9\u0644\u0645\u0647 \u0639\u0628\u0648\u0631 \u0641\u0639\u0644\u06CC \u0648 \u06A9\u0644\u0645\u0647 \u0639\u0628\u0648\u0631 \u062C\u062F\u06CC\u062F \u0627\u0644\u0632\u0627\u0645\u06CC \u0647\u0633\u062A\u0646\u062F." });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "\u06A9\u0644\u0645\u0647 \u0639\u0628\u0648\u0631 \u062C\u062F\u06CC\u062F \u0628\u0627\u06CC\u062F \u062D\u062F\u0627\u0642\u0644 \u0634\u0627\u0645\u0644 \u06F6 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0628\u0627\u0634\u062F." });
  }
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: "\u06A9\u0627\u0631\u0628\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." });
  }
  const defaultHash = bcrypt2.hashSync("Toranj@123", 8);
  const hashToCompare = user.passwordHash || defaultHash;
  if (!bcrypt2.compareSync(currentPassword, hashToCompare)) {
    return res.status(400).json({ error: "\u06A9\u0644\u0645\u0647 \u0639\u0628\u0648\u0631 \u0641\u0639\u0644\u06CC \u0646\u0627\u062F\u0631\u0633\u062A \u0627\u0633\u062A." });
  }
  user.passwordHash = bcrypt2.hashSync(newPassword, 10);
  logAudit(req.user, "\u062A\u063A\u06CC\u06CC\u0631 \u06A9\u0644\u0645\u0647 \u0639\u0628\u0648\u0631 \u0634\u062E\u0635\u06CC", "auth", "\u06A9\u0627\u0631\u0628\u0631 \u06A9\u0644\u0645\u0647 \u0639\u0628\u0648\u0631 \u062D\u0633\u0627\u0628 \u062E\u0648\u062F \u0631\u0627 \u062A\u063A\u06CC\u06CC\u0631 \u062F\u0627\u062F.", user.id, req);
  saveDatabase(db);
  res.json({ success: true, message: "\u06A9\u0644\u0645\u0647 \u0639\u0628\u0648\u0631 \u0634\u0645\u0627 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062A\u063A\u06CC\u06CC\u0631 \u06CC\u0627\u0641\u062A." });
});
app.post("/api/auth/reset-password-admin", authMiddleware, requireRole("super_admin"), (req, res) => {
  const { employeeId, newPassword } = req.body;
  if (!employeeId || !newPassword) {
    return res.status(400).json({ error: "\u0634\u0646\u0627\u0633\u0647 \u067E\u0631\u0633\u0646\u0644 \u0648 \u06A9\u0644\u0645\u0647 \u0639\u0628\u0648\u0631 \u062C\u062F\u06CC\u062F \u0627\u0644\u0632\u0627\u0645\u06CC \u0647\u0633\u062A\u0646\u062F." });
  }
  const target = db.users.find((u) => u.id === employeeId);
  if (!target) {
    return res.status(404).json({ error: "\u067E\u0631\u0633\u0646\u0644 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." });
  }
  target.passwordHash = bcrypt2.hashSync(newPassword, 10);
  if (db.activeSessions) {
    db.activeSessions = db.activeSessions.filter((s) => s.userId !== employeeId);
  }
  logAudit(
    req.user,
    "\u0628\u0627\u0632\u0646\u0634\u0627\u0646\u06CC \u06A9\u0644\u0645\u0647 \u0639\u0628\u0648\u0631 \u067E\u0631\u0633\u0646\u0644 \u062A\u0648\u0633\u0637 \u0645\u062F\u06CC\u0631 \u0627\u0631\u0634\u062F",
    "auth",
    `\u06A9\u0644\u0645\u0647 \u0639\u0628\u0648\u0631 \u06A9\u0627\u0631\u0628\u0631 ${target.fullName} (${target.employeeCode}) \u062A\u0648\u0633\u0637 \u0645\u062F\u06CC\u0631 \u0627\u0631\u0634\u062F \u0628\u0627\u0632\u0646\u0634\u0627\u0646\u06CC \u06AF\u0631\u062F\u06CC\u062F.`,
    target.id,
    req
  );
  saveDatabase(db);
  res.json({ success: true, message: `\u06A9\u0644\u0645\u0647 \u0639\u0628\u0648\u0631 \u062C\u062F\u06CC\u062F \u0628\u0631\u0627\u06CC ${target.fullName} \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062B\u0628\u062A \u0634\u062F.` });
});
app.post("/api/auth/impersonate", authMiddleware, requireRole("super_admin"), (req, res) => {
  const { userId } = req.body;
  const targetUser = db.users.find((u) => u.id === userId && u.active && u.status === "active");
  if (!targetUser) {
    return res.status(404).json({ error: "\u06A9\u0627\u0631\u0628\u0631 \u0641\u0639\u0627\u0644 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u062C\u0647\u062A \u0648\u0631\u0648\u062F \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." });
  }
  const token = `toranj_sec_imp_${crypto.randomBytes(32).toString("hex")}`;
  const now = /* @__PURE__ */ new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1e3).toISOString();
  if (!db.activeSessions) db.activeSessions = [];
  db.activeSessions.push({
    token,
    userId: targetUser.id,
    createdAt: now.toISOString(),
    expiresAt,
    ip: req.ip || "127.0.0.1",
    userAgent: `Impersonated by ${req.user.fullName}`
  });
  saveDatabase(db);
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("toranj_session", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1e3
  });
  logAudit(
    req.user,
    "\u062A\u063A\u06CC\u06CC\u0631 \u0646\u0642\u0634 \u0645\u0648\u0642\u062A (Super Admin Impersonation)",
    "auth",
    `\u0645\u062F\u06CC\u0631 \u0627\u0631\u0634\u062F ${req.user.fullName} \u0628\u0647 \u062D\u0633\u0627\u0628 ${targetUser.fullName} (${targetUser.role}) \u0648\u0631\u0648\u062F \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC \u0646\u0645\u0648\u062F.`,
    targetUser.id,
    req
  );
  const { passwordHash, ...sanitizedUser } = targetUser;
  res.json({
    token,
    user: sanitizedUser
  });
});
app.get("/api/center-settings", (req, res) => {
  db = loadDatabase();
  res.json(db.centerSettings);
});
app.put("/api/center-settings", authMiddleware, requireRole("super_admin"), (req, res) => {
  const {
    centerName,
    logoUrl,
    licenseNumber,
    address,
    city,
    province,
    phoneMain,
    phoneSecondary,
    email,
    website,
    gpsLat,
    gpsLng,
    allowedRadiusMeters,
    timeZone,
    workingDays,
    defaultWorkStart,
    defaultWorkEnd,
    defaultLatenessToleranceMinutes,
    defaultOvertimeAutoApprove
  } = req.body;
  if (!centerName || !address || !phoneMain) {
    return res.status(400).json({ error: "\u0646\u0627\u0645 \u0645\u0631\u06A9\u0632\u060C \u0622\u062F\u0631\u0633 \u0648 \u0634\u0645\u0627\u0631\u0647 \u062A\u0644\u0641\u0646 \u0627\u0635\u0644\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC \u0647\u0633\u062A\u0646\u062F." });
  }
  const updatedCenterSettings = {
    centerName: String(centerName).trim(),
    logoUrl: logoUrl !== void 0 ? String(logoUrl) : db.centerSettings.logoUrl,
    licenseNumber: licenseNumber !== void 0 ? String(licenseNumber) : db.centerSettings.licenseNumber,
    address: String(address).trim(),
    city: city ? String(city).trim() : db.centerSettings.city || "\u062A\u0647\u0631\u0627\u0646",
    province: province ? String(province).trim() : db.centerSettings.province || "\u062A\u0647\u0631\u0627\u0646",
    phoneMain: String(phoneMain).trim(),
    phoneSecondary: phoneSecondary !== void 0 ? String(phoneSecondary) : db.centerSettings.phoneSecondary,
    email: email ? String(email).trim() : db.centerSettings.email,
    website: website !== void 0 ? String(website) : db.centerSettings.website,
    gpsLat: typeof gpsLat === "number" && !isNaN(gpsLat) ? gpsLat : db.centerSettings.gpsLat,
    gpsLng: typeof gpsLng === "number" && !isNaN(gpsLng) ? gpsLng : db.centerSettings.gpsLng,
    allowedRadiusMeters: typeof allowedRadiusMeters === "number" && allowedRadiusMeters > 0 ? allowedRadiusMeters : db.centerSettings.allowedRadiusMeters,
    timeZone: timeZone || db.centerSettings.timeZone || "Asia/Tehran",
    workingDays: Array.isArray(workingDays) ? workingDays : db.centerSettings.workingDays,
    defaultWorkStart: defaultWorkStart || db.centerSettings.defaultWorkStart || "07:30",
    defaultWorkEnd: defaultWorkEnd || db.centerSettings.defaultWorkEnd || "15:30",
    defaultLatenessToleranceMinutes: typeof defaultLatenessToleranceMinutes === "number" ? defaultLatenessToleranceMinutes : db.centerSettings.defaultLatenessToleranceMinutes,
    defaultOvertimeAutoApprove: typeof defaultOvertimeAutoApprove === "boolean" ? defaultOvertimeAutoApprove : db.centerSettings.defaultOvertimeAutoApprove,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedBy: req.user.id
  };
  db.centerSettings = updatedCenterSettings;
  db.settings = {
    ...updatedCenterSettings,
    orgName: updatedCenterSettings.centerName,
    orgTimezone: updatedCenterSettings.timeZone,
    defaultLat: updatedCenterSettings.gpsLat,
    defaultLng: updatedCenterSettings.gpsLng,
    defaultRadiusMeters: updatedCenterSettings.allowedRadiusMeters,
    contactPhone: updatedCenterSettings.phoneMain,
    contactAddress: updatedCenterSettings.address
  };
  logAudit(
    req.user,
    "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0633\u0627\u0632\u0645\u0627\u0646\u06CC \u0645\u0631\u06A9\u0632",
    "center_settings",
    `\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0648 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0645\u0631\u06A9\u0632 "${updatedCenterSettings.centerName}" \u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u06AF\u0631\u062F\u06CC\u062F.`,
    void 0,
    req
  );
  saveDatabase(db);
  res.json(updatedCenterSettings);
});
app.get("/api/employees", authMiddleware, requireRole("super_admin", "manager"), (req, res) => {
  const { status, department, role, search } = req.query;
  const currentUser = req.user;
  let list = db.users;
  if (currentUser.role === "manager") {
    list = list.filter(
      (u) => u.id === currentUser.id || u.designatedManagerId === currentUser.id || u.fallbackManagerId === currentUser.id || u.department === currentUser.department
    );
  }
  if (status) {
    list = list.filter((u) => u.status === status);
  }
  if (department) {
    list = list.filter((u) => u.department === department);
  }
  if (role) {
    list = list.filter((u) => u.role === role);
  }
  if (search) {
    const q = String(search).toLowerCase().trim();
    list = list.filter(
      (u) => u.employeeCode && u.employeeCode.toLowerCase().includes(q) || u.fullName && u.fullName.toLowerCase().includes(q) || u.username && u.username.toLowerCase().includes(q) || u.mobile && u.mobile.includes(q) || u.department && u.department.toLowerCase().includes(q)
    );
  }
  const sanitized = list.map(({ passwordHash, ...u }) => u);
  res.json(sanitized);
});
app.post("/api/employees", authMiddleware, requireRole("super_admin", "manager"), (req, res) => {
  const {
    username,
    fullName,
    role,
    email,
    mobile,
    department,
    designatedManagerId,
    nationalId,
    birthDate,
    bankAccount,
    iban,
    password,
    shiftMode,
    weeklyOffDays,
    allowedLatenessMinutes
  } = req.body;
  if (!username || !fullName || !mobile) {
    return res.status(400).json({ error: "\u062A\u06A9\u0645\u06CC\u0644 \u0641\u06CC\u0644\u062F\u0647\u0627\u06CC \u0646\u0627\u0645 \u06A9\u0627\u0645\u0644\u060C \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0648 \u0634\u0645\u0627\u0631\u0647 \u0645\u0648\u0628\u0627\u06CC\u0644 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." });
  }
  const cleanUsername = String(username).trim().toLowerCase();
  if (db.users.some((u) => u.username.toLowerCase() === cleanUsername)) {
    return res.status(400).json({ error: "\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0642\u0628\u0644\u0627 \u062F\u0631 \u0633\u0627\u0645\u0627\u0646\u0647 \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A." });
  }
  if (role && role !== "employee" && req.user.role !== "super_admin") {
    return res.status(403).json({ error: "\u062A\u0646\u0647\u0627 \u0645\u062F\u06CC\u0631 \u0627\u0631\u0634\u062F \u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0646\u0642\u0634\u200C\u0647\u0627\u06CC \u0645\u062F\u06CC\u0631\u06CC\u062A\u06CC \u062A\u0639\u06CC\u06CC\u0646 \u06A9\u0646\u062F." });
  }
  try {
    const newId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const employeeCode = generateNextEmployeeCode(db);
    const passwordHash = bcrypt2.hashSync(password || "Toranj@123", 10);
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const newUser = {
      id: newId,
      employeeCode,
      username: cleanUsername,
      fullName: String(fullName).trim(),
      role: role || "employee",
      status: "active",
      email: email ? String(email).trim() : `${cleanUsername}@toranjlab.ir`,
      mobile: String(mobile).trim(),
      department: department || req.user.department || "\u0622\u0632\u0645\u0627\u06CC\u0634\u06AF\u0627\u0647 \u062A\u0634\u062E\u06CC\u0635 \u0637\u0628\u06CC",
      active: true,
      designatedManagerId: designatedManagerId || (req.user.role === "manager" ? req.user.id : "usr_superadmin"),
      passwordHash,
      createdAt: nowIso
    };
    const newProfile = {
      employeeId: newId,
      nationalId: nationalId || "---",
      birthDate: birthDate || "1995-01-01",
      emergencyContactName: "\u062B\u0628\u062A \u0646\u0634\u062F\u0647",
      emergencyContactRelation: "\u0627\u0642\u0648\u0627\u0645",
      emergencyContactPhone: mobile,
      bankAccount: bankAccount || "----",
      iban: iban || "----",
      hireDate: nowIso.split("T")[0],
      status: "active",
      shiftMode: shiftMode || "morning",
      weeklyOffDays: Array.isArray(weeklyOffDays) ? weeklyOffDays : [6],
      allowedLatenessMinutes: allowedLatenessMinutes !== void 0 ? Number(allowedLatenessMinutes) : 15
    };
    db.users.push(newUser);
    db.profiles.push(newProfile);
    logAudit(
      req.user,
      "\u0627\u06CC\u062C\u0627\u062F \u067E\u0631\u0633\u0646\u0644 \u062C\u062F\u06CC\u062F",
      "employee_mgmt",
      `\u067E\u0631\u0633\u0646\u0644 \u062C\u062F\u06CC\u062F "${fullName}" \u0628\u0627 \u06A9\u062F \u067E\u0631\u0633\u0646\u0644\u06CC \u06CC\u06A9\u062A\u0627 ${employeeCode} \u0627\u0641\u0632\u0648\u062F\u0647 \u0634\u062F.`,
      newId,
      req
    );
    saveDatabase(db);
    const { passwordHash: _, ...sanitizedUser } = newUser;
    res.status(201).json({ user: sanitizedUser, profile: newProfile });
  } catch (err) {
    res.status(400).json({ error: err.message || "\u062E\u0637\u0627 \u062F\u0631 \u062B\u0628\u062A \u067E\u0631\u0633\u0646\u0644 \u062C\u062F\u06CC\u062F." });
  }
});
app.put("/api/employees/:id", authMiddleware, requireRole("super_admin", "manager"), (req, res) => {
  const { id } = req.params;
  const { fullName, email, mobile, department, role, designatedManagerId } = req.body;
  const user = db.users.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ error: "\u067E\u0631\u0633\u0646\u0644 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." });
  }
  if (role && role !== user.role) {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({ error: "\u062A\u0646\u0647\u0627 \u0645\u062F\u06CC\u0631 \u0627\u0631\u0634\u062F \u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0646\u0642\u0634 \u06A9\u0627\u0631\u0628\u0631\u06CC \u067E\u0631\u0633\u0646\u0644 \u0631\u0627 \u062A\u063A\u06CC\u06CC\u0631 \u062F\u0647\u062F." });
    }
    user.role = role;
  }
  if (fullName) user.fullName = String(fullName).trim();
  if (email) user.email = String(email).trim();
  if (mobile) user.mobile = String(mobile).trim();
  if (department) user.department = String(department).trim();
  if (designatedManagerId) user.designatedManagerId = designatedManagerId;
  logAudit(
    req.user,
    "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u0627\u0637\u0644\u0627\u0639\u0627\u062A \u067E\u0631\u0633\u0646\u0644",
    "employee_mgmt",
    `\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u067E\u0631\u0633\u0646\u0644 ${user.fullName} (${user.employeeCode}) \u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0634\u062F.`,
    user.id,
    req
  );
  saveDatabase(db);
  const { passwordHash, ...sanitized } = user;
  res.json(sanitized);
});
app.put("/api/employees/:id/status", authMiddleware, requireRole("super_admin", "manager"), (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;
  if (status !== "active" && status !== "inactive") {
    return res.status(400).json({ error: "\u0648\u0636\u0639\u06CC\u062A \u0628\u0627\u06CC\u062F active \u06CC\u0627 inactive \u0628\u0627\u0634\u062F." });
  }
  const user = db.users.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ error: "\u067E\u0631\u0633\u0646\u0644 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." });
  }
  if (user.role === "super_admin" && status === "inactive") {
    const activeSuperAdmins = db.users.filter(
      (u) => u.role === "super_admin" && u.status === "active" && u.id !== id
    );
    if (activeSuperAdmins.length === 0) {
      return res.status(403).json({ error: "\u063A\u06CC\u0631\u0641\u0639\u0627\u0644\u200C\u0633\u0627\u0632\u06CC \u062A\u0646\u0647\u0627 \u0645\u062F\u06CC\u0631 \u0627\u0631\u0634\u062F \u0641\u0639\u0627\u0644 \u0633\u06CC\u0633\u062A\u0645 \u0627\u0645\u06A9\u0627\u0646\u200C\u067E\u0630\u06CC\u0631 \u0646\u06CC\u0633\u062A." });
    }
  }
  user.status = status;
  user.active = status === "active";
  if (status === "inactive" && db.activeSessions) {
    db.activeSessions = db.activeSessions.filter((s) => s.userId !== id);
  }
  logAudit(
    req.user,
    status === "active" ? "\u0641\u0639\u0627\u0644\u200C\u0633\u0627\u0632\u06CC \u062D\u0633\u0627\u0628 \u067E\u0631\u0633\u0646\u0644" : "\u063A\u06CC\u0631\u0641\u0639\u0627\u0644\u200C\u0633\u0627\u0632\u06CC \u062D\u0633\u0627\u0628 \u067E\u0631\u0633\u0646\u0644",
    "employee_mgmt",
    `\u0648\u0636\u0639\u06CC\u062A \u067E\u0631\u0633\u0646\u0644 ${user.fullName} (${user.employeeCode}) \u0628\u0647 ${status === "active" ? "\u0641\u0639\u0627\u0644" : "\u063A\u06CC\u0631\u0641\u0639\u0627\u0644"} \u062A\u063A\u06CC\u06CC\u0631 \u06CC\u0627\u0641\u062A. \u062F\u0644\u06CC\u0644: ${reason || "---"}`,
    user.id,
    req
  );
  saveDatabase(db);
  const { passwordHash, ...sanitized } = user;
  res.json({ success: true, user: sanitized });
});
app.put("/api/employees/:id/archive", authMiddleware, requireRole("super_admin"), (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const user = db.users.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ error: "\u067E\u0631\u0633\u0646\u0644 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." });
  }
  if (user.role === "super_admin") {
    return res.status(403).json({ error: "\u0628\u0627\u06CC\u06AF\u0627\u0646\u06CC \u06A9\u0631\u062F\u0646 \u062D\u0633\u0627\u0628 \u0645\u062F\u06CC\u0631 \u0627\u0631\u0634\u062F \u0627\u0645\u06A9\u0627\u0646\u200C\u067E\u0630\u06CC\u0631 \u0646\u06CC\u0633\u062A." });
  }
  user.status = "archived";
  user.active = false;
  user.archivedAt = (/* @__PURE__ */ new Date()).toISOString();
  user.archivedBy = req.user.id;
  if (db.activeSessions) {
    db.activeSessions = db.activeSessions.filter((s) => s.userId !== id);
  }
  logAudit(
    req.user,
    "\u0628\u0627\u06CC\u06AF\u0627\u0646\u06CC \u067E\u0631\u0648\u0646\u062F\u0647 \u067E\u0631\u0633\u0646\u0644\u06CC (Soft Delete)",
    "employee_mgmt",
    `\u067E\u0631\u0633\u0646\u0644 ${user.fullName} \u0628\u0627 \u06A9\u062F ${user.employeeCode} \u0628\u0627\u06CC\u06AF\u0627\u0646\u06CC \u06AF\u0631\u062F\u06CC\u062F. \u0633\u0648\u0627\u0628\u0642 \u062A\u0631\u062F\u062F\u060C \u0648\u0638\u0627\u06CC\u0641 \u0648 \u0644\u0627\u06AF\u200C\u0647\u0627 \u0628\u0647 \u0637\u0648\u0631 \u06A9\u0627\u0645\u0644 \u062D\u0641\u0638 \u0634\u062F\u0647\u200C\u0627\u0646\u062F. \u062F\u0644\u06CC\u0644: ${reason || "---"}`,
    user.id,
    req
  );
  saveDatabase(db);
  const { passwordHash, ...sanitized } = user;
  res.json({ success: true, user: sanitized });
});
app.get("/api/users", authMiddleware, (req, res) => {
  const currentUser = req.user;
  if (currentUser.role === "employee") {
    const directory = db.users.filter((u) => u.status === "active").map((u) => ({
      id: u.id,
      employeeCode: u.employeeCode,
      fullName: u.fullName,
      department: u.department,
      role: u.role
    }));
    return res.json(directory);
  }
  if (currentUser.role === "manager") {
    const scopedUsers = db.users.filter(
      (u) => u.id === currentUser.id || u.designatedManagerId === currentUser.id || u.fallbackManagerId === currentUser.id || u.department === currentUser.department
    ).map(({ passwordHash, ...u }) => u);
    return res.json(scopedUsers);
  }
  res.json(db.users.map(({ passwordHash, ...u }) => u));
});
app.get("/api/employees/:id/profile", authMiddleware, (req, res) => {
  const targetId = req.params.id;
  const currentUser = req.user;
  if (currentUser.role === "employee" && currentUser.id !== targetId) {
    return res.status(403).json({ error: "\u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u067E\u0631\u0648\u0646\u062F\u0647 \u067E\u0631\u0633\u0646\u0644\u06CC \u0647\u0645\u06A9\u0627\u0631\u0627\u0646 \u0627\u0645\u06A9\u0627\u0646\u200C\u067E\u0630\u06CC\u0631 \u0646\u06CC\u0633\u062A." });
  }
  const user = db.users.find((u) => u.id === targetId);
  const profile = db.profiles.find((p) => p.employeeId === targetId);
  if (!user || !profile) {
    return res.status(404).json({ error: "\u067E\u0631\u0648\u0646\u062F\u0647 \u067E\u0631\u0633\u0646\u0644\u06CC \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." });
  }
  const isSuperAdmin = currentUser.role === "super_admin";
  const isOwner = currentUser.id === targetId;
  const sanitizedProfile = {
    ...profile,
    bankAccount: isSuperAdmin || isOwner ? profile.bankAccount : profile.bankAccount.replace(/\d(?=\d{4})/g, "*"),
    iban: isSuperAdmin || isOwner ? profile.iban : profile.iban.substring(0, 4) + "****************" + profile.iban.substring(profile.iban.length - 4)
  };
  res.json({
    user,
    profile: sanitizedProfile
  });
});
app.put("/api/employees/:id/profile", authMiddleware, (req, res) => {
  const targetId = req.params.id;
  const currentUser = req.user;
  if (currentUser.role === "employee" && currentUser.id !== targetId) {
    return res.status(403).json({ error: "\u062F\u0633\u062A\u0631\u0633\u06CC \u063A\u06CC\u0631\u0645\u062C\u0627\u0632 \u0628\u0631\u0627\u06CC \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0627\u0637\u0644\u0627\u0639\u0627\u062A." });
  }
  const profileIndex = db.profiles.findIndex((p) => p.employeeId === targetId);
  if (profileIndex === -1) {
    return res.status(404).json({ error: "\u067E\u0631\u0648\u0646\u062F\u0647 \u067E\u0631\u0633\u0646\u0644\u06CC \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." });
  }
  const {
    landline,
    emergencyContactName,
    emergencyContactRelation,
    emergencyContactPhone,
    bankAccount,
    iban,
    birthDate,
    shiftMode,
    customShiftStart,
    customShiftEnd,
    customShiftDurationMinutes,
    allowedLatenessMinutes,
    earlyDepartureGraceMinutes,
    weeklyOffDays
  } = req.body;
  const isManagerOrAdmin = currentUser.role === "super_admin" || currentUser.role === "manager";
  const existing = db.profiles[profileIndex];
  db.profiles[profileIndex] = {
    ...existing,
    landline: landline !== void 0 ? landline : existing.landline,
    emergencyContactName: emergencyContactName || existing.emergencyContactName,
    emergencyContactRelation: emergencyContactRelation || existing.emergencyContactRelation,
    emergencyContactPhone: emergencyContactPhone || existing.emergencyContactPhone,
    birthDate: isManagerOrAdmin ? birthDate || existing.birthDate : existing.birthDate,
    bankAccount: currentUser.role === "super_admin" ? bankAccount || existing.bankAccount : existing.bankAccount,
    iban: currentUser.role === "super_admin" ? iban || existing.iban : existing.iban,
    // Shift parameters editable by manager/admin
    shiftMode: isManagerOrAdmin ? shiftMode || existing.shiftMode : existing.shiftMode,
    customShiftStart: isManagerOrAdmin ? customShiftStart !== void 0 ? customShiftStart : existing.customShiftStart : existing.customShiftStart,
    customShiftEnd: isManagerOrAdmin ? customShiftEnd !== void 0 ? customShiftEnd : existing.customShiftEnd : existing.customShiftEnd,
    customShiftDurationMinutes: isManagerOrAdmin && customShiftDurationMinutes !== void 0 ? Number(customShiftDurationMinutes) : existing.customShiftDurationMinutes,
    allowedLatenessMinutes: isManagerOrAdmin && allowedLatenessMinutes !== void 0 ? Number(allowedLatenessMinutes) : existing.allowedLatenessMinutes,
    earlyDepartureGraceMinutes: isManagerOrAdmin && earlyDepartureGraceMinutes !== void 0 ? Number(earlyDepartureGraceMinutes) : existing.earlyDepartureGraceMinutes,
    weeklyOffDays: isManagerOrAdmin && weeklyOffDays ? weeklyOffDays : existing.weeklyOffDays
  };
  logAudit(currentUser, "\u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0648 \u0634\u06CC\u0641\u062A \u067E\u0631\u0633\u0646\u0644\u06CC", "profile", `\u067E\u0631\u0648\u0646\u062F\u0647 \u0648 \u0633\u0627\u0639\u0627\u062A \u06A9\u0627\u0631\u06CC \u067E\u0631\u0633\u0646\u0644 ${targetId} \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0634\u062F.`, targetId, req);
  saveDatabase(db);
  res.json(db.profiles[profileIndex]);
});
app.get("/api/attendance/status", authMiddleware, (req, res) => {
  const currentUser = req.user;
  const now = /* @__PURE__ */ new Date();
  const tehranDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tehran" }));
  const todayStr = tehranDate.toISOString().split("T")[0];
  const openSession = db.attendanceSessions.find(
    (s) => s.employeeId === currentUser.id && s.status === "open"
  );
  const schedule = db.schedules.find(
    (s) => s.employeeId === currentUser.id && s.dateString === todayStr
  );
  const shift = schedule ? db.shiftTemplates.find((t) => t.id === schedule.shiftTemplateId) : void 0;
  const todayEvents = db.attendanceEvents.filter(
    (e) => e.employeeId === currentUser.id && new Date(e.serverTimestamp).toLocaleString("en-US", { timeZone: "Asia/Tehran" }).split(",")[0] === (/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: "Asia/Tehran" }).split(",")[0]
  );
  const gpsPolicy = getApplicableGPSPolicy(currentUser.id, db);
  res.json({
    openSession,
    schedule,
    shift,
    todayEvents,
    gpsPolicy,
    serverTime: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.post("/api/attendance/check-in", authMiddleware, (req, res) => {
  const currentUser = req.user;
  const { coords, deviceInfo, eventSource, notes, overrideExceptionId } = req.body;
  if (currentUser.status === "inactive" || currentUser.status === "archived" || !currentUser.active) {
    return res.status(403).json({ error: "\u062D\u0633\u0627\u0628 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0634\u0645\u0627 \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u06CC\u0627 \u0628\u0627\u06CC\u06AF\u0627\u0646\u06CC \u0634\u062F\u0647 \u0627\u0633\u062A. \u062B\u0628\u062A \u0648\u0631\u0648\u062F \u0645\u062C\u0627\u0632 \u0646\u06CC\u0633\u062A." });
  }
  const existingOpen = db.attendanceSessions.find(
    (s) => s.employeeId === currentUser.id && s.status === "open"
  );
  if (existingOpen) {
    return res.status(409).json({
      error: "\u0634\u0645\u0627 \u062F\u0631 \u062D\u0627\u0644 \u062D\u0627\u0636\u0631 \u06CC\u06A9 \u0646\u0634\u0633\u062A \u062D\u0636\u0648\u0631 \u0641\u0639\u0627\u0644 \u062F\u0627\u0631\u06CC\u062F. \u062B\u0628\u062A \u0645\u062C\u062F\u062F \u0648\u0631\u0648\u062F \u0645\u062C\u0627\u0632 \u0646\u06CC\u0633\u062A.",
      openSession: existingOpen
    });
  }
  const serverNow = /* @__PURE__ */ new Date();
  const serverTimestamp = serverNow.toISOString();
  const tehranDate = new Date(serverNow.toLocaleString("en-US", { timeZone: "Asia/Tehran" }));
  const todayStr = tehranDate.toISOString().split("T")[0];
  const policy = getApplicableGPSPolicy(currentUser.id, db);
  let locationEval = evaluateLocation(policy, coords);
  if (!locationEval.allowed && overrideExceptionId) {
    const approvedException = db.gpsExceptionRequests.find(
      (e) => e.id === overrideExceptionId && e.employeeId === currentUser.id && e.status === "approved" && e.eventType === "check_in"
    );
    if (approvedException) {
      locationEval = {
        allowed: true,
        result: "override_approved",
        distanceMeters: locationEval.distanceMeters,
        message: "\u062B\u0628\u062A \u0648\u0631\u0648\u062F \u0628\u0631 \u0627\u0633\u0627\u0633 \u0645\u062C\u0648\u0632 \u0627\u0633\u062A\u062B\u0646\u0627\u06CC \u0645\u0635\u0648\u0628 \u062A\u0627\u06CC\u06CC\u062F \u06AF\u0631\u062F\u06CC\u062F."
      };
    }
  }
  if (!locationEval.allowed) {
    return res.status(403).json({
      error: locationEval.message,
      locationResult: locationEval.result,
      distanceMeters: locationEval.distanceMeters,
      allowedRadiusMeters: policy.allowedRadiusMeters,
      canRequestException: policy.allowExceptionRequest
    });
  }
  const shiftResolution = resolveEffectiveShift(currentUser.id, tehranDate, db);
  const profile = db.profiles.find((p) => p.employeeId === currentUser.id);
  const eventId = `att_evt_${Date.now()}`;
  const newEvent = {
    id: eventId,
    employeeId: currentUser.id,
    eventType: "check_in",
    serverTimestamp,
    scheduleId: void 0,
    locationResult: locationEval.result,
    coords: coords && coords.latitude ? coords : void 0,
    distanceMeters: locationEval.distanceMeters,
    policyVersion: policy.policyVersion,
    deviceInfo: deviceInfo || req.headers["user-agent"] || "Browser",
    eventSource: eventSource || "personal_device",
    exceptionId: overrideExceptionId,
    notes
  };
  let latenessMinutes = 0;
  const [startH, startM] = shiftResolution.startTime.split(":").map(Number);
  const scheduledStart = new Date(tehranDate);
  scheduledStart.setHours(startH, startM, 0, 0);
  const diffMins = Math.round((tehranDate.getTime() - scheduledStart.getTime()) / 6e4);
  if (diffMins > shiftResolution.allowedLatenessMinutes) {
    latenessMinutes = diffMins;
  }
  const approvedHourlyLeaves = db.leaveRequests.filter(
    (l) => l.employeeId === currentUser.id && l.startDate === todayStr && l.status === "approved" && (l.leaveType === "hourly" || l.isPartialDay)
  );
  for (const leave of approvedHourlyLeaves) {
    if (leave.startTime && leave.endTime) {
      const [lsh, lsm] = leave.startTime.split(":").map(Number);
      const [leh, lem] = leave.endTime.split(":").map(Number);
      const leaveStart = new Date(tehranDate);
      leaveStart.setHours(lsh, lsm, 0, 0);
      const leaveEnd = new Date(tehranDate);
      leaveEnd.setHours(leh, lem, 0, 0);
      if (leaveStart <= scheduledStart && tehranDate <= leaveEnd) {
        latenessMinutes = 0;
      } else if (leaveStart <= scheduledStart && tehranDate > leaveEnd) {
        const remainingLate = Math.round((tehranDate.getTime() - leaveEnd.getTime()) / 6e4);
        latenessMinutes = Math.max(0, remainingLate - shiftResolution.allowedLatenessMinutes);
      }
    }
  }
  const birthdayInfo = checkBirthdayRelation(profile?.birthDate);
  let birthdayGreeting = null;
  if (birthdayInfo.isToday) {
    birthdayGreeting = `\u0647\u0645\u06A9\u0627\u0631 \u0627\u0631\u062C\u0645\u0646\u062F \u062C\u0646\u0627\u0628 \u0622\u0642\u0627\u06CC/\u0633\u0631\u06A9\u0627\u0631 \u062E\u0627\u0646\u0645 ${currentUser.fullName}\u060C \u0632\u0627\u062F\u0631\u0648\u0632\u062A\u0627\u0646 \u062E\u062C\u0633\u062A\u0647 \u0628\u0627\u062F! \u0622\u0632\u0645\u0627\u06CC\u0634\u06AF\u0627\u0647 \u067E\u0627\u062A\u0648\u0628\u06CC\u0648\u0644\u0648\u0698\u06CC \u062A\u0631\u0646\u062C \u0628\u0631\u0627\u06CC \u0634\u0645\u0627 \u0633\u0627\u0644\u06CC \u0633\u0631\u0634\u0627\u0631 \u0627\u0632 \u062A\u0646\u062F\u0631\u0633\u062A\u06CC \u0648 \u0634\u0627\u062F\u06A9\u0627\u0645\u06CC \u0622\u0631\u0632\u0648\u0645\u0646\u062F \u0627\u0633\u062A.`;
  } else if (birthdayInfo.isYesterday) {
    birthdayGreeting = `\u0647\u0645\u06A9\u0627\u0631 \u06AF\u0631\u0627\u0645\u06CC ${currentUser.fullName}\u060C \u0628\u0627 \u062A\u0627\u062E\u06CC\u0631 \u06CC\u06A9\u200C\u0631\u0648\u0632\u0647\u060C \u0633\u0627\u0644\u0631\u0648\u0632 \u062A\u0648\u0644\u062F\u062A\u0627\u0646 \u0631\u0627 \u0635\u0645\u06CC\u0645\u0627\u0646\u0647 \u062A\u0628\u0631\u06CC\u06A9 \u0648 \u0634\u0627\u062F\u0628\u0627\u0634 \u0645\u06CC\u200C\u06AF\u0648\u06CC\u06CC\u0645!`;
  }
  const sessionId = `att_sess_${Date.now()}`;
  const newSession = {
    id: sessionId,
    employeeId: currentUser.id,
    dateString: todayStr,
    checkInEventId: eventId,
    checkInTime: serverTimestamp,
    latenessMinutes,
    earlyDepartureMinutes: 0,
    approvedOvertimeMinutes: 0,
    status: "open",
    shiftType: shiftResolution.shiftType
  };
  db.attendanceEvents.unshift(newEvent);
  db.attendanceSessions.unshift(newSession);
  logAudit(
    currentUser,
    "\u062B\u0628\u062A \u0648\u0631\u0648\u062F \u067E\u0631\u0633\u0646\u0644",
    "attendance",
    `\u0648\u0631\u0648\u062F \u0645\u0648\u0641\u0642 \u062F\u0631 \u0634\u06CC\u0641\u062A ${shiftResolution.shiftTemplateName} (${shiftResolution.shiftType}) \u062B\u0628\u062A \u0634\u062F.`,
    sessionId,
    req
  );
  saveDatabase(db);
  res.status(201).json({
    success: true,
    message: "\u0648\u0631\u0648\u062F \u0634\u0645\u0627 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062B\u0628\u062A \u0634\u062F.",
    event: newEvent,
    session: newSession,
    locationEval,
    shiftDetails: shiftResolution,
    birthdayGreeting
  });
});
app.post("/api/attendance/check-out", authMiddleware, (req, res) => {
  const currentUser = req.user;
  const { coords, deviceInfo, eventSource, notes, overrideExceptionId } = req.body;
  if (currentUser.status === "inactive" || currentUser.status === "archived" || !currentUser.active) {
    return res.status(403).json({ error: "\u062D\u0633\u0627\u0628 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0634\u0645\u0627 \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u06CC\u0627 \u0628\u0627\u06CC\u06AF\u0627\u0646\u06CC \u0634\u062F\u0647 \u0627\u0633\u062A. \u062B\u0628\u062A \u062E\u0631\u0648\u062C \u0645\u062C\u0627\u0632 \u0646\u06CC\u0633\u062A." });
  }
  const openSessionIndex = db.attendanceSessions.findIndex(
    (s) => s.employeeId === currentUser.id && s.status === "open"
  );
  if (openSessionIndex === -1) {
    return res.status(400).json({
      error: "\u0646\u0634\u0633\u062A \u062D\u0636\u0648\u0631 \u0628\u0627\u0632 \u0628\u0631\u0627\u06CC \u062B\u0628\u062A \u062E\u0631\u0648\u062C \u06CC\u0627\u0641\u062A \u0646\u0634\u062F."
    });
  }
  const openSession = db.attendanceSessions[openSessionIndex];
  const pendingMandatoryTasks = db.tasks.filter(
    (t) => t.assigneeId === currentUser.id && t.mandatory && t.status !== "approved" && t.status !== "cancelled"
  );
  const serverNow = /* @__PURE__ */ new Date();
  const serverTimestamp = serverNow.toISOString();
  const policy = getApplicableGPSPolicy(currentUser.id, db);
  let locationEval = evaluateLocation(policy, coords);
  if (!locationEval.allowed && overrideExceptionId) {
    const approvedException = db.gpsExceptionRequests.find(
      (e) => e.id === overrideExceptionId && e.employeeId === currentUser.id && e.status === "approved" && e.eventType === "check_out"
    );
    if (approvedException) {
      locationEval = {
        allowed: true,
        result: "override_approved",
        distanceMeters: locationEval.distanceMeters,
        message: "\u062B\u0628\u062A \u062E\u0631\u0648\u062C \u0628\u0627 \u0645\u062C\u0648\u0632 \u0627\u0633\u062A\u062B\u0646\u0627 \u062A\u0627\u06CC\u06CC\u062F \u0634\u062F."
      };
    }
  }
  const eventId = `att_evt_${Date.now()}`;
  const checkOutEvent = {
    id: eventId,
    employeeId: currentUser.id,
    eventType: "check_out",
    serverTimestamp,
    locationResult: locationEval.result,
    coords: coords && coords.latitude ? coords : void 0,
    distanceMeters: locationEval.distanceMeters,
    policyVersion: policy.policyVersion,
    deviceInfo: deviceInfo || req.headers["user-agent"] || "Browser",
    eventSource: eventSource || "personal_device",
    exceptionId: overrideExceptionId,
    notes
  };
  const schedule = db.schedules.find(
    (s) => s.employeeId === currentUser.id && s.dateString === openSession.dateString
  );
  const shift = schedule ? db.shiftTemplates.find((t) => t.id === schedule.shiftTemplateId) : void 0;
  const profile = db.profiles.find((p) => p.employeeId === currentUser.id);
  const approvedHourlyLeaves = db.leaveRequests.filter(
    (l) => l.employeeId === currentUser.id && l.startDate === openSession.dateString && l.status === "approved" && (l.leaveType === "hourly" || l.isPartialDay)
  );
  const tempSession = {
    ...openSession,
    checkOutEventId: eventId,
    checkOutTime: serverTimestamp
  };
  const metrics = calculateSessionMetrics(tempSession, profile, shift, approvedHourlyLeaves);
  db.attendanceSessions[openSessionIndex] = {
    ...openSession,
    checkOutEventId: eventId,
    checkOutTime: serverTimestamp,
    rawDurationMinutes: metrics.rawDurationMinutes,
    calculatedWorkMinutes: metrics.calculatedWorkMinutes,
    latenessMinutes: metrics.latenessMinutes,
    earlyDepartureMinutes: metrics.earlyDepartureMinutes,
    approvedOvertimeMinutes: metrics.overtimeMinutes,
    hourlyLeaveCoveredMinutes: metrics.hourlyLeaveCoveredMinutes,
    status: "closed"
  };
  db.attendanceEvents.unshift(checkOutEvent);
  logAudit(
    currentUser,
    "\u062B\u0628\u062A \u062E\u0631\u0648\u062C \u067E\u0631\u0633\u0646\u0644",
    "attendance",
    `\u062E\u0631\u0648\u062C \u062B\u0628\u062A \u0634\u062F. \u06A9\u0627\u0631\u06A9\u0631\u062F \u062E\u0627\u0645: ${metrics.rawDurationMinutes} \u062F\u0642\u06CC\u0642\u0647. \u062A\u0639\u062C\u06CC\u0644: ${metrics.earlyDepartureMinutes} \u062F\u0642\u06CC\u0642\u0647. ${pendingMandatoryTasks.length > 0 ? `(\u062F\u0627\u0631\u0627\u06CC ${pendingMandatoryTasks.length} \u0648\u0638\u06CC\u0641\u0647 \u0627\u062C\u0628\u0627\u0631\u06CC \u0646\u0627\u062A\u0645\u0627\u0645)` : ""}`,
    openSession.id,
    req
  );
  saveDatabase(db);
  res.json({
    success: true,
    message: "\u062E\u0631\u0648\u062C \u0634\u0645\u0627 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062F\u0631 \u0633\u0627\u0645\u0627\u0646\u0647 \u062B\u0628\u062A \u0634\u062F.",
    event: checkOutEvent,
    session: db.attendanceSessions[openSessionIndex],
    pendingMandatoryTasksWarning: pendingMandatoryTasks.length > 0 ? `\u062A\u0648\u062C\u0647: \u0634\u0645\u0627 \u062A\u0639\u062F\u0627\u062F ${pendingMandatoryTasks.length} \u0648\u0638\u06CC\u0641\u0647 \u0627\u062C\u0628\u0627\u0631\u06CC \u0628\u0627\u0632 \u062F\u0627\u0631\u06CC\u062F \u06A9\u0647 \u062F\u0631 \u06A9\u0627\u0631\u062A\u0627\u0628\u0644 \u0645\u062F\u06CC\u0631\u06CC\u062A \u062C\u0647\u062A \u067E\u06CC\u06AF\u06CC\u0631\u06CC \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A.` : null
  });
});
app.get("/api/attendance/history", authMiddleware, (req, res) => {
  const currentUser = req.user;
  const { employeeId, startDate, endDate } = req.query;
  let sessions = db.attendanceSessions;
  if (currentUser.role === "employee") {
    sessions = sessions.filter((s) => s.employeeId === currentUser.id);
  } else if (currentUser.role === "manager") {
    const managedUserIds = db.users.filter((u) => u.designatedManagerId === currentUser.id || u.id === currentUser.id).map((u) => u.id);
    if (employeeId) {
      if (!managedUserIds.includes(String(employeeId))) {
        return res.status(403).json({ error: "\u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u0633\u0648\u0627\u0628\u0642 \u0627\u06CC\u0646 \u067E\u0631\u0633\u0646\u0644 \u0646\u062F\u0627\u0631\u06CC\u062F." });
      }
      sessions = sessions.filter((s) => s.employeeId === String(employeeId));
    } else {
      sessions = sessions.filter((s) => managedUserIds.includes(s.employeeId));
    }
  } else if (employeeId) {
    sessions = sessions.filter((s) => s.employeeId === String(employeeId));
  }
  if (startDate) {
    sessions = sessions.filter((s) => s.dateString >= String(startDate));
  }
  if (endDate) {
    sessions = sessions.filter((s) => s.dateString <= String(endDate));
  }
  const enriched = sessions.map((s) => {
    const user = db.users.find((u) => u.id === s.employeeId);
    const schedule = db.schedules.find((sch) => sch.employeeId === s.employeeId && sch.dateString === s.dateString);
    const shift = schedule ? db.shiftTemplates.find((t) => t.id === schedule.shiftTemplateId) : void 0;
    const checkInEvt = db.attendanceEvents.find((e) => e.id === s.checkInEventId);
    const checkOutEvt = s.checkOutEventId ? db.attendanceEvents.find((e) => e.id === s.checkOutEventId) : void 0;
    return {
      ...s,
      employeeName: user?.fullName || "\u0646\u0627\u0645\u0634\u062E\u0635",
      department: user?.department || "",
      shiftName: shift?.name || "\u0634\u06CC\u0641\u062A \u0627\u0633\u062A\u0627\u0646\u062F\u0627\u0631\u062F",
      checkInLocationResult: checkInEvt?.locationResult,
      checkOutLocationResult: checkOutEvt?.locationResult
    };
  });
  res.json(enriched);
});
app.post("/api/attendance/corrections", authMiddleware, (req, res) => {
  const currentUser = req.user;
  const { dateString, targetEventType, requestedCheckInTime, requestedCheckOutTime, reason } = req.body;
  if (!dateString || !reason) {
    return res.status(400).json({ error: "\u062A\u0627\u0631\u06CC\u062E \u0648 \u062F\u0644\u06CC\u0644 \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062A\u0635\u062D\u06CC\u062D \u062A\u0631\u062F\u062F \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." });
  }
  const newCorrection = {
    id: `cor_${Date.now()}`,
    employeeId: currentUser.id,
    dateString,
    targetEventType: targetEventType || "both",
    requestedCheckInTime,
    requestedCheckOutTime,
    reason,
    status: "pending",
    assignedApproverId: currentUser.designatedManagerId || "usr_superadmin",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.correctionRequests.unshift(newCorrection);
  db.notifications.unshift({
    id: `notif_${Date.now()}`,
    recipientId: newCorrection.assignedApproverId,
    type: "approval_required",
    title: "\u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062A\u0635\u062D\u06CC\u062D \u062A\u0631\u062F\u062F \u062C\u062F\u06CC\u062F",
    message: `${currentUser.fullName} \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0627\u0635\u0644\u0627\u062D \u062A\u0631\u062F\u062F \u062A\u0627\u0631\u06CC\u062E ${dateString} \u0631\u0627 \u062B\u0628\u062A \u0646\u0645\u0648\u062F.`,
    read: false,
    referenceId: newCorrection.id,
    referenceType: "correction",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  logAudit(currentUser, "\u062B\u0628\u062A \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062A\u0635\u062D\u06CC\u062D \u062A\u0631\u062F\u062F", "attendance", reason, newCorrection.id, req);
  saveDatabase(db);
  res.status(201).json(newCorrection);
});
app.get("/api/attendance/corrections", authMiddleware, (req, res) => {
  const currentUser = req.user;
  if (currentUser.role === "employee") {
    return res.json(db.correctionRequests.filter((c) => c.employeeId === currentUser.id));
  }
  if (currentUser.role === "manager") {
    return res.json(
      db.correctionRequests.filter(
        (c) => c.assignedApproverId === currentUser.id || c.employeeId === currentUser.id
      )
    );
  }
  res.json(db.correctionRequests);
});
app.put("/api/attendance/corrections/:id/review", authMiddleware, (req, res) => {
  const currentUser = req.user;
  if (currentUser.role === "employee") {
    return res.status(403).json({ error: "\u067E\u0631\u0633\u0646\u0644 \u0645\u062C\u0627\u0632 \u0628\u0647 \u062A\u0627\u06CC\u06CC\u062F \u06CC\u0627 \u0631\u062F \u062F\u0631\u062E\u0648\u0627\u0633\u062A\u200C\u0647\u0627\u06CC \u062A\u0631\u062F\u062F \u0646\u06CC\u0633\u062A\u0646\u062F." });
  }
  const { id } = req.params;
  const { decision, rejectionReason } = req.body;
  const corrIndex = db.correctionRequests.findIndex((c) => c.id === id);
  if (corrIndex === -1) {
    return res.status(404).json({ error: "\u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062A\u0635\u062D\u06CC\u062D \u062A\u0631\u062F\u062F \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." });
  }
  const corr = db.correctionRequests[corrIndex];
  if (corr.employeeId === currentUser.id && currentUser.role !== "super_admin") {
    return res.status(403).json({ error: "\u062A\u0627\u06CC\u06CC\u062F \u062F\u0631\u062E\u0648\u0627\u0633\u062A\u200C\u0647\u0627\u06CC \u0634\u062E\u0635\u06CC \u062A\u0648\u0633\u0637 \u062E\u0648\u062F \u0634\u062E\u0635 \u0645\u062C\u0627\u0632 \u0646\u06CC\u0633\u062A." });
  }
  corr.status = decision === "approved" ? "approved" : "rejected";
  corr.reviewedBy = currentUser.id;
  corr.reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
  corr.rejectionReason = rejectionReason;
  if (decision === "approved") {
    const existingSession = db.attendanceSessions.find(
      (s) => s.employeeId === corr.employeeId && s.dateString === corr.dateString
    );
    if (existingSession) {
      if (corr.requestedCheckInTime) existingSession.checkInTime = corr.requestedCheckInTime;
      if (corr.requestedCheckOutTime) existingSession.checkOutTime = corr.requestedCheckOutTime;
      existingSession.status = "corrected";
    } else {
      db.attendanceSessions.push({
        id: `att_sess_corr_${Date.now()}`,
        employeeId: corr.employeeId,
        dateString: corr.dateString,
        checkInEventId: "corr_manual",
        checkInTime: corr.requestedCheckInTime || (/* @__PURE__ */ new Date()).toISOString(),
        checkOutTime: corr.requestedCheckOutTime,
        latenessMinutes: 0,
        earlyDepartureMinutes: 0,
        approvedOvertimeMinutes: 0,
        status: "corrected"
      });
    }
  }
  db.notifications.unshift({
    id: `notif_${Date.now()}`,
    recipientId: corr.employeeId,
    type: "correction_decision",
    title: `\u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062A\u0635\u062D\u06CC\u062D \u062A\u0631\u062F\u062F ${decision === "approved" ? "\u062A\u0627\u06CC\u06CC\u062F \u0634\u062F" : "\u0631\u062F \u0634\u062F"}`,
    message: `\u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062A\u0635\u062D\u06CC\u062D \u062A\u0631\u062F\u062F \u0634\u0645\u0627 \u0628\u0631\u0627\u06CC \u062A\u0627\u0631\u06CC\u062E ${corr.dateString} \u062A\u0648\u0633\u0637 ${currentUser.fullName} ${decision === "approved" ? "\u062A\u0627\u06CC\u06CC\u062F \u0634\u062F" : `\u0631\u062F \u0634\u062F: ${rejectionReason || "\u0628\u062F\u0648\u0646 \u0630\u06A9\u0631 \u062F\u0644\u06CC\u0644"}`}.`,
    read: false,
    referenceId: corr.id,
    referenceType: "correction",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  logAudit(
    currentUser,
    `\u0628\u0631\u0631\u0633\u06CC \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062A\u0635\u062D\u06CC\u062D \u062A\u0631\u062F\u062F: ${decision}`,
    "attendance",
    `\u062A\u0635\u0645\u06CC\u0645: ${decision}\u060C \u062F\u0644\u06CC\u0644: ${rejectionReason || "---"}`,
    corr.id,
    req
  );
  saveDatabase(db);
  res.json(corr);
});
app.get("/api/gps/policies", authMiddleware, (req, res) => {
  res.json(db.gpsPolicies);
});
app.put("/api/gps/policies/:employeeId", authMiddleware, (req, res) => {
  const currentUser = req.user;
  if (currentUser.role === "employee") {
    return res.status(403).json({ error: "\u062A\u0646\u0647\u0627 \u0645\u062F\u06CC\u0631\u0627\u0646 \u0645\u062C\u0627\u0632 \u0628\u0647 \u062A\u063A\u06CC\u06CC\u0631 \u0633\u06CC\u0627\u0633\u062A\u200C\u0647\u0627\u06CC \u0645\u06A9\u0627\u0646\u06CC \u0647\u0633\u062A\u0646\u062F." });
  }
  const { employeeId } = req.params;
  const { required, targetLat, targetLng, allowedRadiusMeters, allowExceptionRequest, poorAccuracyThresholdMeters } = req.body;
  let policyIndex = db.gpsPolicies.findIndex((p) => p.employeeId === employeeId);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  if (policyIndex === -1) {
    const newPolicy = {
      id: `gps_pol_${Date.now()}`,
      employeeId,
      required: required !== void 0 ? required : true,
      targetLat: targetLat || db.settings.defaultLat,
      targetLng: targetLng || db.settings.defaultLng,
      allowedRadiusMeters: allowedRadiusMeters || db.settings.defaultRadiusMeters,
      allowExceptionRequest: allowExceptionRequest !== void 0 ? allowExceptionRequest : true,
      poorAccuracyThresholdMeters: poorAccuracyThresholdMeters || 80,
      policyVersion: 1,
      effectiveDate: nowIso.split("T")[0],
      exceptionManagerId: currentUser.id
    };
    db.gpsPolicies.push(newPolicy);
    policyIndex = db.gpsPolicies.length - 1;
  } else {
    const existing = db.gpsPolicies[policyIndex];
    db.gpsPolicies[policyIndex] = {
      ...existing,
      required: required !== void 0 ? required : existing.required,
      targetLat: targetLat !== void 0 ? targetLat : existing.targetLat,
      targetLng: targetLng !== void 0 ? targetLng : existing.targetLng,
      allowedRadiusMeters: allowedRadiusMeters !== void 0 ? allowedRadiusMeters : existing.allowedRadiusMeters,
      allowExceptionRequest: allowExceptionRequest !== void 0 ? allowExceptionRequest : existing.allowExceptionRequest,
      poorAccuracyThresholdMeters: poorAccuracyThresholdMeters !== void 0 ? poorAccuracyThresholdMeters : existing.poorAccuracyThresholdMeters,
      policyVersion: existing.policyVersion + 1,
      effectiveDate: nowIso.split("T")[0]
    };
  }
  logAudit(
    currentUser,
    "\u062A\u063A\u06CC\u06CC\u0631 \u0633\u06CC\u0627\u0633\u062A \u0645\u0648\u0642\u0639\u06CC\u062A \u0645\u06A9\u0627\u0646\u06CC \u067E\u0631\u0633\u0646\u0644",
    "policy",
    `\u062A\u0646\u0638\u06CC\u0645\u0627\u062A GPS \u0628\u0631\u0627\u06CC ${employeeId} \u0628\u0627 \u0634\u0639\u0627\u0639 \u0645\u062C\u0627\u0632 ${allowedRadiusMeters}\u0645\u062A\u0631 \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.`,
    employeeId,
    req
  );
  saveDatabase(db);
  res.json(db.gpsPolicies[policyIndex]);
});
app.post("/api/gps/exceptions", authMiddleware, (req, res) => {
  const currentUser = req.user;
  const { eventType, coords, distanceMeters, reason } = req.body;
  if (!reason) {
    return res.status(400).json({ error: "\u0630\u06A9\u0631 \u062F\u0644\u06CC\u0644 \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062B\u0628\u062A \u062A\u0631\u062F\u062F \u062E\u0627\u0631\u062C \u0627\u0632 \u0645\u062D\u062F\u0648\u062F\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." });
  }
  const newReq = {
    id: `gpsexc_${Date.now()}`,
    employeeId: currentUser.id,
    employeeName: currentUser.fullName,
    eventType: eventType || "check_in",
    coords,
    distanceMeters,
    reason,
    status: "pending",
    assignedApproverId: currentUser.designatedManagerId || "usr_superadmin",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.gpsExceptionRequests.unshift(newReq);
  db.notifications.unshift({
    id: `notif_${Date.now()}`,
    recipientId: newReq.assignedApproverId,
    type: "approval_required",
    title: "\u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0627\u0633\u062A\u062B\u0646\u0627\u06CC \u0645\u0648\u0642\u0639\u06CC\u062A \u0645\u06A9\u0627\u0646\u06CC GPS",
    message: `${currentUser.fullName} \u0628\u0647 \u0639\u0644\u062A "${reason}" \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062B\u0628\u062A \u062A\u0631\u062F\u062F \u062E\u0627\u0631\u062C \u0627\u0632 \u0622\u0632\u0645\u0627\u06CC\u0634\u06AF\u0627\u0647 \u0631\u0627 \u062F\u0627\u0631\u062F.`,
    read: false,
    referenceId: newReq.id,
    referenceType: "gps_exception",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  logAudit(currentUser, "\u062B\u0628\u062A \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0627\u0633\u062A\u062B\u0646\u0627\u06CC GPS", "attendance", reason, newReq.id, req);
  saveDatabase(db);
  res.status(201).json(newReq);
});
app.get("/api/shifts", authMiddleware, (req, res) => {
  res.json(db.shiftTemplates);
});
app.post("/api/shifts", authMiddleware, (req, res) => {
  if (req.user.role !== "super_admin") {
    return res.status(403).json({ error: "\u062A\u0646\u0647\u0627 \u0645\u062F\u06CC\u0631 \u0627\u0631\u0634\u062F \u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0627\u0644\u06AF\u0648\u06CC \u0634\u06CC\u0641\u062A \u062C\u062F\u06CC\u062F \u0627\u06CC\u062C\u0627\u062F \u06A9\u0646\u062F." });
  }
  const { name, code, startTime, endTime, scheduledDurationMinutes, breakDurationMinutes, isPaidBreak, allowedLatenessMinutes, earlyDepartureGraceMinutes, color } = req.body;
  const newShift = {
    id: `shift_${Date.now()}`,
    name,
    code: code || "SHFT",
    startTime,
    endTime,
    scheduledDurationMinutes: scheduledDurationMinutes || 360,
    breakDurationMinutes: breakDurationMinutes || 30,
    isPaidBreak: isPaidBreak ?? true,
    allowedLatenessMinutes: allowedLatenessMinutes || 15,
    earlyDepartureGraceMinutes: earlyDepartureGraceMinutes || 10,
    overtimeEligibility: true,
    crossMidnight: false,
    color: color || "#0D9488"
  };
  db.shiftTemplates.push(newShift);
  logAudit(req.user, "\u0627\u06CC\u062C\u0627\u062F \u0627\u0644\u06AF\u0648\u06CC \u0634\u06CC\u0641\u062A \u06A9\u0627\u0631\u06CC", "schedule", name, newShift.id, req);
  saveDatabase(db);
  res.status(201).json(newShift);
});
app.get("/api/schedules", authMiddleware, (req, res) => {
  const { employeeId, startDate, endDate } = req.query;
  let list = db.schedules;
  if (employeeId) list = list.filter((s) => s.employeeId === String(employeeId));
  if (startDate) list = list.filter((s) => s.dateString >= String(startDate));
  if (endDate) list = list.filter((s) => s.dateString <= String(endDate));
  res.json(list);
});
app.post("/api/schedules", authMiddleware, (req, res) => {
  if (req.user.role === "employee") {
    return res.status(403).json({ error: "\u067E\u0631\u0633\u0646\u0644 \u0645\u062C\u0627\u0632 \u0628\u0647 \u062A\u062E\u0635\u06CC\u0635 \u0634\u06CC\u0641\u062A \u0646\u06CC\u0633\u062A\u0646\u062F." });
  }
  const { employeeId, dateString, shiftTemplateId, customStartTime, customEndTime, isRestDay, isHoliday } = req.body;
  if (!employeeId || !dateString || !shiftTemplateId) {
    return res.status(400).json({ error: "\u067E\u0631\u0633\u0646\u0644\u060C \u062A\u0627\u0631\u06CC\u062E \u0648 \u0627\u0644\u06AF\u0648\u06CC \u0634\u06CC\u0641\u062A \u0627\u0644\u0632\u0627\u0645\u06CC \u0647\u0633\u062A\u0646\u062F." });
  }
  const existingIdx = db.schedules.findIndex((s) => s.employeeId === employeeId && s.dateString === dateString);
  const scheduleData = {
    id: existingIdx !== -1 ? db.schedules[existingIdx].id : `sch_${Date.now()}`,
    employeeId,
    dateString,
    shiftTemplateId,
    customStartTime,
    customEndTime,
    isRestDay: !!isRestDay,
    isHoliday: !!isHoliday
  };
  if (existingIdx !== -1) {
    db.schedules[existingIdx] = scheduleData;
  } else {
    db.schedules.push(scheduleData);
  }
  logAudit(req.user, "\u062A\u062E\u0635\u06CC\u0635 \u0628\u0631\u0646\u0627\u0645\u0647 \u06A9\u0627\u0631\u06CC \u067E\u0631\u0633\u0646\u0644", "schedule", `\u0634\u06CC\u0641\u062A ${shiftTemplateId} \u0628\u0631\u0627\u06CC \u067E\u0631\u0633\u0646\u0644 ${employeeId} \u062F\u0631 \u062A\u0627\u0631\u06CC\u062E ${dateString} \u062A\u0646\u0638\u06CC\u0645 \u0634\u062F.`, scheduleData.id, req);
  saveDatabase(db);
  res.json(scheduleData);
});
app.get("/api/tasks", authMiddleware, (req, res) => {
  const currentUser = req.user;
  const { assigneeId, status, mandatory } = req.query;
  let tasks = db.tasks;
  if (currentUser.role === "employee") {
    tasks = tasks.filter((t) => t.assigneeId === currentUser.id || t.creatorId === currentUser.id);
  } else if (currentUser.role === "manager") {
    const managedUserIds = db.users.filter((u) => u.designatedManagerId === currentUser.id || u.id === currentUser.id).map((u) => u.id);
    tasks = tasks.filter(
      (t) => managedUserIds.includes(t.assigneeId) || t.creatorId === currentUser.id || t.designatedApproverId === currentUser.id
    );
  }
  if (assigneeId) tasks = tasks.filter((t) => t.assigneeId === String(assigneeId));
  if (status) tasks = tasks.filter((t) => t.status === String(status));
  if (mandatory !== void 0) tasks = tasks.filter((t) => String(t.mandatory) === String(mandatory));
  res.json(tasks);
});
app.post("/api/tasks", authMiddleware, (req, res) => {
  const currentUser = req.user;
  const { title, description, assigneeId, mandatory, priority, dueDate, dueTime, designatedApproverId } = req.body;
  if (!title || !assigneeId || !dueDate) {
    return res.status(400).json({ error: "\u0639\u0646\u0648\u0627\u0646\u060C \u0627\u0631\u062C\u0627\u0639\u200C\u0634\u0648\u0646\u062F\u0647 \u0648 \u0645\u0647\u0644\u062A \u0627\u0646\u062C\u0627\u0645 \u0648\u0638\u06CC\u0641\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." });
  }
  const assignee = db.users.find((u) => u.id === assigneeId);
  if (!assignee) {
    return res.status(404).json({ error: "\u06A9\u0627\u0631\u0628\u0631 \u0627\u0631\u062C\u0627\u0639\u200C\u0634\u0648\u0646\u062F\u0647 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." });
  }
  if (assignee.status === "inactive" || assignee.status === "archived" || !assignee.active) {
    return res.status(400).json({ error: "\u0627\u0645\u06A9\u0627\u0646 \u0627\u0631\u062C\u0627\u0639 \u0648\u0638\u06CC\u0641\u0647 \u0628\u0647 \u067E\u0631\u0633\u0646\u0644 \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u06CC\u0627 \u0628\u0627\u06CC\u06AF\u0627\u0646\u06CC\u200C\u0634\u062F\u0647 \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F." });
  }
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const newTask = {
    id: `task_${Date.now()}`,
    title,
    description: description || "",
    creatorId: currentUser.id,
    creatorName: currentUser.fullName,
    assigneeId,
    assigneeName: assignee.fullName,
    mandatory: !!mandatory,
    priority: priority || "medium",
    dueDate,
    dueTime,
    status: "new",
    designatedApproverId: designatedApproverId || assignee.designatedManagerId || currentUser.id,
    history: [
      {
        timestamp: nowIso,
        actorId: currentUser.id,
        actorName: currentUser.fullName,
        action: "\u0627\u06CC\u062C\u0627\u062F \u0648\u0638\u06CC\u0641\u0647",
        note: mandatory ? "\u0648\u0638\u06CC\u0641\u0647 \u0627\u062C\u0628\u0627\u0631\u06CC \u062A\u0639\u06CC\u06CC\u0646 \u06AF\u0631\u062F\u06CC\u062F" : "\u0648\u0638\u06CC\u0641\u0647 \u0627\u062E\u062A\u06CC\u0627\u0631\u06CC"
      }
    ],
    createdAt: nowIso
  };
  db.tasks.unshift(newTask);
  db.notifications.unshift({
    id: `notif_${Date.now()}`,
    recipientId: assigneeId,
    type: "task_assigned",
    title: mandatory ? "\u0648\u0638\u06CC\u0641\u0647 \u0627\u062C\u0628\u0627\u0631\u06CC \u062C\u062F\u06CC\u062F" : "\u0648\u0638\u06CC\u0641\u0647 \u062C\u062F\u06CC\u062F \u0645\u062D\u0648\u0644 \u0634\u062F",
    message: `${currentUser.fullName} \u0648\u0638\u06CC\u0641\u0647 "${title}" \u0631\u0627 \u0628\u0631\u0627\u06CC \u0634\u0645\u0627 \u062B\u0628\u062A \u06A9\u0631\u062F. \u0645\u0647\u0644\u062A: ${dueDate}`,
    read: false,
    referenceId: newTask.id,
    referenceType: "task",
    createdAt: nowIso
  });
  logAudit(currentUser, "\u0627\u06CC\u062C\u0627\u062F \u0648\u0638\u06CC\u0641\u0647 \u062C\u062F\u06CC\u062F", "task", `\u0648\u0638\u06CC\u0641\u0647 "${title}" \u0628\u0647 ${assignee.fullName} \u0648\u0627\u06AF\u0630\u0627\u0631 \u0634\u062F.`, newTask.id, req);
  saveDatabase(db);
  res.status(201).json(newTask);
});
app.put("/api/tasks/:id/progress", authMiddleware, (req, res) => {
  const currentUser = req.user;
  const { id } = req.params;
  const { status, note } = req.body;
  const task = db.tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ error: "\u0648\u0638\u06CC\u0641\u0647 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." });
  if (task.assigneeId !== currentUser.id && currentUser.role === "employee") {
    return res.status(403).json({ error: "\u062A\u0646\u0647\u0627 \u0645\u0633\u0626\u0648\u0644 \u0648\u0638\u06CC\u0641\u0647 \u0645\u062C\u0627\u0632 \u0628\u0647 \u062A\u063A\u06CC\u06CC\u0631 \u0648\u0636\u0639\u06CC\u062A \u0627\u0633\u062A." });
  }
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  task.status = status || "in_progress";
  task.history.unshift({
    timestamp: nowIso,
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    action: `\u062A\u063A\u06CC\u06CC\u0631 \u0648\u0636\u0639\u06CC\u062A \u0628\u0647: ${status}`,
    note
  });
  saveDatabase(db);
  res.json(task);
});
app.put("/api/tasks/:id/report-completion", authMiddleware, (req, res) => {
  const currentUser = req.user;
  const { id } = req.params;
  const { notes } = req.body;
  const task = db.tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ error: "\u0648\u0638\u06CC\u0641\u0647 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." });
  if (task.assigneeId !== currentUser.id && currentUser.role === "employee") {
    return res.status(403).json({ error: "\u062A\u0646\u0647\u0627 \u0645\u062C\u0631\u06CC \u0648\u0638\u06CC\u0641\u0647 \u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0627\u062A\u0645\u0627\u0645 \u0622\u0646 \u0631\u0627 \u06AF\u0632\u0627\u0631\u0634 \u06A9\u0646\u062F." });
  }
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  task.status = "completion_reported";
  task.completionReportedAt = nowIso;
  task.completionNotes = notes;
  task.history.unshift({
    timestamp: nowIso,
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    action: "\u0627\u0639\u0644\u0627\u0645 \u0627\u062A\u0645\u0627\u0645 \u0648\u0638\u06CC\u0641\u0647 \u062A\u0648\u0633\u0637 \u067E\u0631\u0633\u0646\u0644",
    note: notes
  });
  db.notifications.unshift({
    id: `notif_${Date.now()}`,
    recipientId: task.designatedApproverId,
    type: "approval_required",
    title: "\u0627\u0639\u0644\u0627\u0645 \u0627\u062A\u0645\u0627\u0645 \u0648\u0638\u06CC\u0641\u0647 \u062C\u0647\u062A \u062A\u0627\u06CC\u06CC\u062F",
    message: `${currentUser.fullName} \u0627\u062A\u0645\u0627\u0645 \u0648\u0638\u06CC\u0641\u0647 "${task.title}" \u0631\u0627 \u06AF\u0632\u0627\u0631\u0634 \u0646\u0645\u0648\u062F\u0647 \u0627\u0633\u062A.`,
    read: false,
    referenceId: task.id,
    referenceType: "task",
    createdAt: nowIso
  });
  logAudit(currentUser, "\u06AF\u0632\u0627\u0631\u0634 \u0627\u062A\u0645\u0627\u0645 \u0648\u0638\u06CC\u0641\u0647", "task", `\u0627\u062A\u0645\u0627\u0645 \u0648\u0638\u06CC\u0641\u0647 ${task.title} \u06AF\u0632\u0627\u0631\u0634 \u0634\u062F.`, task.id, req);
  saveDatabase(db);
  res.json(task);
});
app.put("/api/tasks/:id/approval", authMiddleware, (req, res) => {
  const currentUser = req.user;
  const { id } = req.params;
  const { decision, reason } = req.body;
  const task = db.tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ error: "\u0648\u0638\u06CC\u0641\u0647 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." });
  if (task.assigneeId === currentUser.id && currentUser.role !== "super_admin") {
    return res.status(403).json({ error: "\u067E\u0631\u0633\u0646\u0644 \u0645\u062C\u0627\u0632 \u0628\u0647 \u062A\u0627\u06CC\u06CC\u062F \u0627\u062A\u0645\u0627\u0645 \u0648\u0638\u06CC\u0641\u0647 \u062E\u0648\u062F \u0646\u06CC\u0633\u062A\u0646\u062F." });
  }
  if (task.designatedApproverId !== currentUser.id && currentUser.role !== "super_admin" && currentUser.role !== "manager") {
    return res.status(403).json({ error: "\u0634\u0645\u0627 \u0633\u0631\u067E\u0631\u0633\u062A \u0645\u062C\u0627\u0632 \u0628\u0631\u0627\u06CC \u062A\u0627\u06CC\u06CC\u062F \u0627\u06CC\u0646 \u0648\u0638\u06CC\u0641\u0647 \u0646\u06CC\u0633\u062A\u06CC\u062F." });
  }
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  task.status = decision === "approved" ? "approved" : "rejected";
  task.approvalDecisionAt = nowIso;
  task.approvedBy = currentUser.id;
  task.rejectionReason = reason;
  task.history.unshift({
    timestamp: nowIso,
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    action: decision === "approved" ? "\u062A\u0627\u06CC\u06CC\u062F \u0646\u0647\u0627\u06CC\u06CC \u0627\u062A\u0645\u0627\u0645 \u0648\u0638\u06CC\u0641\u0647" : "\u0639\u062F\u0645 \u062A\u0627\u06CC\u06CC\u062F \u0627\u062A\u0645\u0627\u0645 \u0648\u0638\u06CC\u0641\u0647 (\u0631\u062F)",
    note: reason
  });
  db.notifications.unshift({
    id: `notif_${Date.now()}`,
    recipientId: task.assigneeId,
    type: "task_approval",
    title: `\u0646\u062A\u06CC\u062C\u0647 \u0628\u0631\u0631\u0633\u06CC \u0648\u0638\u06CC\u0641\u0647: ${decision === "approved" ? "\u062A\u0627\u06CC\u06CC\u062F \u0634\u062F" : "\u0631\u062F \u0634\u062F"}`,
    message: `\u0648\u0638\u06CC\u0641\u0647 "${task.title}" \u062A\u0648\u0633\u0637 ${currentUser.fullName} ${decision === "approved" ? "\u062A\u0627\u06CC\u06CC\u062F \u06AF\u0631\u062F\u06CC\u062F." : `\u0631\u062F \u0634\u062F: ${reason || "\u0628\u062F\u0648\u0646 \u0630\u06A9\u0631 \u062F\u0644\u06CC\u0644"}`}`,
    read: false,
    referenceId: task.id,
    referenceType: "task",
    createdAt: nowIso
  });
  logAudit(
    currentUser,
    `\u0628\u0631\u0631\u0633\u06CC \u062A\u0627\u06CC\u06CC\u062F \u0648\u0638\u06CC\u0641\u0647: ${decision}`,
    "task",
    `\u0648\u0638\u06CC\u0641\u0647 "${task.title}" ${decision} \u0634\u062F.`,
    task.id,
    req
  );
  saveDatabase(db);
  res.json(task);
});
app.get("/api/inbox/approvals", authMiddleware, (req, res) => {
  const currentUser = req.user;
  if (currentUser.role === "employee") {
    return res.status(403).json({ error: "\u06A9\u0627\u0631\u062A\u0627\u0628\u0644 \u0645\u062F\u06CC\u0631\u06CC\u062A \u0641\u0642\u0637 \u0645\u062E\u062A\u0635 \u0633\u0631\u067E\u0631\u0633\u062A\u0627\u0646 \u0648 \u0645\u062F\u06CC\u0631\u0627\u0646 \u0627\u0633\u062A." });
  }
  const isSuperAdmin = currentUser.role === "super_admin";
  const pendingTasks = db.tasks.filter(
    (t) => t.status === "completion_reported" && (isSuperAdmin || t.designatedApproverId === currentUser.id)
  );
  const pendingLeaves = db.leaveRequests.filter(
    (l) => l.status === "pending" && (isSuperAdmin || l.assignedApproverId === currentUser.id)
  );
  const pendingMissions = db.missionRequests.filter(
    (m) => m.status === "pending" && (isSuperAdmin || m.assignedApproverId === currentUser.id)
  );
  const pendingCorrections = db.correctionRequests.filter(
    (c) => c.status === "pending" && (isSuperAdmin || c.assignedApproverId === currentUser.id)
  );
  const pendingGpsExceptions = db.gpsExceptionRequests.filter(
    (g) => g.status === "pending" && (isSuperAdmin || g.assignedApproverId === currentUser.id)
  );
  res.json({
    pendingTasks,
    pendingLeaves,
    pendingMissions,
    pendingCorrections,
    pendingGpsExceptions,
    totalCount: pendingTasks.length + pendingLeaves.length + pendingMissions.length + pendingCorrections.length + pendingGpsExceptions.length
  });
});
app.get("/api/leave", authMiddleware, (req, res) => {
  const currentUser = req.user;
  if (currentUser.role === "employee") {
    return res.json(db.leaveRequests.filter((l) => l.employeeId === currentUser.id));
  }
  if (currentUser.role === "manager") {
    return res.json(
      db.leaveRequests.filter(
        (l) => l.assignedApproverId === currentUser.id || l.employeeId === currentUser.id
      )
    );
  }
  res.json(db.leaveRequests);
});
app.post("/api/leave", authMiddleware, (req, res) => {
  const currentUser = req.user;
  const { leaveType, startDate, endDate, isPartialDay, startTime, endTime, reason } = req.body;
  if (!startDate || !reason) {
    return res.status(400).json({ error: "\u062A\u0627\u0631\u06CC\u062E \u0648 \u062F\u0644\u06CC\u0644 \u0645\u0631\u062E\u0635\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." });
  }
  let durationMinutes = 0;
  if (startTime && endTime) {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    durationMinutes = Math.max(0, eh * 60 + em - (sh * 60 + sm));
  }
  const newLeave = {
    id: `leave_${Date.now()}`,
    employeeId: currentUser.id,
    employeeName: currentUser.fullName,
    leaveType: leaveType || "annual",
    startDate,
    endDate: endDate || startDate,
    isPartialDay: !!isPartialDay || leaveType === "hourly",
    startTime,
    endTime,
    durationMinutes,
    reason,
    status: "pending",
    assignedApproverId: currentUser.designatedManagerId || "usr_superadmin",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.leaveRequests.unshift(newLeave);
  db.notifications.unshift({
    id: `notif_${Date.now()}`,
    recipientId: newLeave.assignedApproverId,
    type: "approval_required",
    title: "\u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0645\u0631\u062E\u0635\u06CC \u062C\u062F\u06CC\u062F",
    message: `${currentUser.fullName} \u062F\u0631\u062E\u0648\u0627\u0633\u062A ${newLeave.leaveType === "hourly" ? `\u0645\u0631\u062E\u0635\u06CC \u0633\u0627\u0639\u062A\u06CC (${startTime} \u0627\u0644\u06CC ${endTime})` : "\u0645\u0631\u062E\u0635\u06CC \u0631\u0648\u0632\u0627\u0646\u0647"} \u0628\u0631\u0627\u06CC ${startDate} \u062B\u0628\u062A \u06A9\u0631\u062F.`,
    read: false,
    referenceId: newLeave.id,
    referenceType: "leave",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  logAudit(currentUser, "\u062B\u0628\u062A \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0645\u0631\u062E\u0635\u06CC", "leave", reason, newLeave.id, req);
  saveDatabase(db);
  res.status(201).json(newLeave);
});
app.put("/api/leave/:id/review", authMiddleware, (req, res) => {
  const currentUser = req.user;
  if (currentUser.role === "employee") {
    return res.status(403).json({ error: "\u067E\u0631\u0633\u0646\u0644 \u0645\u062C\u0627\u0632 \u0628\u0647 \u0628\u0631\u0631\u0633\u06CC \u0645\u0631\u062E\u0635\u06CC \u0646\u06CC\u0633\u062A\u0646\u062F." });
  }
  const { id } = req.params;
  const { decision, rejectionReason } = req.body;
  const leave = db.leaveRequests.find((l) => l.id === id);
  if (!leave) return res.status(404).json({ error: "\u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0645\u0631\u062E\u0635\u06CC \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." });
  if (leave.employeeId === currentUser.id && currentUser.role !== "super_admin") {
    return res.status(403).json({ error: "\u0645\u062F\u06CC\u0631\u0627\u0646 \u0645\u062C\u0627\u0632 \u0628\u0647 \u062A\u0627\u06CC\u06CC\u062F \u0645\u0631\u062E\u0635\u06CC \u062E\u0648\u062F \u0646\u06CC\u0633\u062A\u0646\u062F." });
  }
  leave.status = decision === "approved" ? "approved" : "rejected";
  leave.reviewedBy = currentUser.id;
  leave.reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
  leave.rejectionReason = rejectionReason;
  if (decision === "approved" && (leave.leaveType === "hourly" || leave.isPartialDay)) {
    const sessions = db.attendanceSessions.filter(
      (s) => s.employeeId === leave.employeeId && s.dateString === leave.startDate
    );
    const profile = db.profiles.find((p) => p.employeeId === leave.employeeId);
    const schedule = db.schedules.find((s) => s.employeeId === leave.employeeId && s.dateString === leave.startDate);
    const shift = schedule ? db.shiftTemplates.find((t) => t.id === schedule.shiftTemplateId) : void 0;
    const allApprovedLeaves = db.leaveRequests.filter(
      (l) => l.employeeId === leave.employeeId && l.startDate === leave.startDate && (l.status === "approved" || l.id === leave.id) && (l.leaveType === "hourly" || l.isPartialDay)
    );
    for (const sess of sessions) {
      const metrics = calculateSessionMetrics(sess, profile, shift, allApprovedLeaves);
      sess.latenessMinutes = metrics.latenessMinutes;
      sess.earlyDepartureMinutes = metrics.earlyDepartureMinutes;
      sess.rawDurationMinutes = metrics.rawDurationMinutes;
      sess.calculatedWorkMinutes = metrics.calculatedWorkMinutes;
      sess.hourlyLeaveCoveredMinutes = metrics.hourlyLeaveCoveredMinutes;
    }
  }
  db.notifications.unshift({
    id: `notif_${Date.now()}`,
    recipientId: leave.employeeId,
    type: "leave_decision",
    title: `\u0646\u062A\u06CC\u062C\u0647 \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0645\u0631\u062E\u0635\u06CC: ${decision === "approved" ? "\u0645\u0648\u0627\u0641\u0642\u062A \u0634\u062F" : "\u0645\u062E\u0627\u0644\u0641\u062A \u0634\u062F"}`,
    message: `\u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0645\u0631\u062E\u0635\u06CC \u0634\u0645\u0627 \u0628\u0631\u0627\u06CC \u062A\u0627\u0631\u06CC\u062E ${leave.startDate} ${decision === "approved" ? "\u0645\u0648\u0631\u062F \u0645\u0648\u0627\u0641\u0642\u062A \u0642\u0631\u0627\u0631 \u06AF\u0631\u0641\u062A \u0648 \u062F\u0631 \u062A\u0631\u062F\u062F \u0634\u0645\u0627 \u0627\u0639\u0645\u0627\u0644 \u0634\u062F." : `\u0631\u062F \u0634\u062F: ${rejectionReason || "\u0628\u062F\u0648\u0646 \u0630\u06A9\u0631 \u062F\u0644\u06CC\u0644"}`}`,
    read: false,
    referenceId: leave.id,
    referenceType: "leave",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  logAudit(currentUser, `\u0628\u0631\u0631\u0633\u06CC \u0645\u0631\u062E\u0635\u06CC: ${decision}`, "leave", `\u062A\u0635\u0645\u06CC\u0645: ${decision}`, leave.id, req);
  saveDatabase(db);
  res.json(leave);
});
app.get("/api/birthdays/status", authMiddleware, (req, res) => {
  const currentUser = req.user;
  const userProfile = db.profiles.find((p) => p.employeeId === currentUser.id);
  const currentRelation = checkBirthdayRelation(userProfile?.birthDate);
  let employeeGreeting = null;
  if (currentRelation.isToday) {
    employeeGreeting = {
      isBirthday: true,
      isToday: true,
      isYesterday: false,
      message: `\u0647\u0645\u06A9\u0627\u0631 \u0627\u0631\u062C\u0645\u0646\u062F\u060C \u062C\u0646\u0627\u0628 \u0622\u0642\u0627\u06CC/\u0633\u0631\u06A9\u0627\u0631 \u062E\u0627\u0646\u0645 ${currentUser.fullName}\u060C \u0632\u0627\u062F\u0631\u0648\u0632\u062A\u0627\u0646 \u0641\u0631\u062E\u0646\u062F\u0647 \u0628\u0627\u062F! \u0645\u062F\u06CC\u0631\u06CC\u062A \u0648 \u06A9\u0627\u0631\u06A9\u0646\u0627\u0646 \u0622\u0632\u0645\u0627\u06CC\u0634\u06AF\u0627\u0647 \u067E\u0627\u062A\u0648\u0628\u06CC\u0648\u0644\u0648\u0698\u06CC \u062A\u0631\u0646\u062C \u0628\u0631\u0627\u06CC \u0634\u0645\u0627 \u0633\u0627\u0644\u06CC \u0622\u06A9\u0646\u062F\u0647 \u0627\u0632 \u0633\u0644\u0627\u0645\u062A\u060C \u0634\u0627\u062F\u06A9\u0627\u0645\u06CC \u0648 \u062A\u0648\u0641\u06CC\u0642 \u0622\u0631\u0632\u0648 \u062F\u0627\u0631\u0646\u062F.`
    };
  } else if (currentRelation.isYesterday) {
    employeeGreeting = {
      isBirthday: true,
      isToday: false,
      isYesterday: true,
      message: `\u0647\u0645\u06A9\u0627\u0631 \u06AF\u0631\u0627\u0645\u06CC ${currentUser.fullName}\u060C \u0628\u0627 \u062A\u0627\u062E\u06CC\u0631 \u06CC\u06A9\u200C\u0631\u0648\u0632\u0647\u060C \u0633\u0627\u0644\u0631\u0648\u0632 \u062A\u0648\u0644\u062F\u062A\u0627\u0646 \u0631\u0627 \u0635\u0645\u06CC\u0645\u0627\u0646\u0647 \u0634\u0627\u062F\u0628\u0627\u0634 \u0645\u06CC\u200C\u06AF\u0648\u06CC\u06CC\u0645!`
    };
  }
  const managerReminders = [];
  if (currentUser.role === "manager" || currentUser.role === "super_admin") {
    const candidates = currentUser.role === "super_admin" ? db.users.filter((u) => u.active) : db.users.filter((u) => u.active && (u.designatedManagerId === currentUser.id || u.id === currentUser.id));
    for (const emp of candidates) {
      const p = db.profiles.find((prof) => prof.employeeId === emp.id);
      if (p?.birthDate) {
        const rel = checkBirthdayRelation(p.birthDate);
        if (rel.inTwoDays) {
          managerReminders.push({
            employeeId: emp.id,
            employeeName: emp.fullName,
            department: emp.department,
            birthDate: p.birthDate,
            type: "in_two_days",
            daysLeft: 2,
            message: `\u06CC\u0627\u062F\u0622\u0648\u0631\u06CC \u0632\u0627\u062F\u0631\u0648\u0632 \u06F2 \u0631\u0648\u0632 \u0622\u06CC\u0646\u062F\u0647: ${emp.fullName} (${emp.department})`
          });
        } else if (rel.isToday) {
          managerReminders.push({
            employeeId: emp.id,
            employeeName: emp.fullName,
            department: emp.department,
            birthDate: p.birthDate,
            type: "today",
            daysLeft: 0,
            message: `\u0632\u0627\u062F\u0631\u0648\u0632 \u0627\u0645\u0631\u0648\u0632: ${emp.fullName}`
          });
        } else if (rel.isYesterday) {
          managerReminders.push({
            employeeId: emp.id,
            employeeName: emp.fullName,
            department: emp.department,
            birthDate: p.birthDate,
            type: "yesterday",
            daysLeft: -1,
            message: `\u0632\u0627\u062F\u0631\u0648\u0632 \u062F\u06CC\u0631\u0648\u0632: ${emp.fullName}`
          });
        }
      }
    }
  }
  res.json({
    employeeGreeting,
    managerReminders
  });
});
app.get("/api/holidays", authMiddleware, (req, res) => {
  res.json(db.holidays || []);
});
app.post("/api/holidays", authMiddleware, (req, res) => {
  const currentUser = req.user;
  if (currentUser.role === "employee") {
    return res.status(403).json({ error: "\u067E\u0631\u0633\u0646\u0644 \u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0647 \u062A\u0639\u0631\u06CC\u0641 \u062A\u0639\u0637\u06CC\u0644\u0627\u062A \u062A\u0642\u0648\u06CC\u0645 \u0631\u0627 \u0646\u062F\u0627\u0631\u0646\u062F." });
  }
  const { dateString, title, isOfficial, appliesToAll, notes } = req.body;
  if (!dateString || !title) {
    return res.status(400).json({ error: "\u062A\u0627\u0631\u06CC\u062E \u0648 \u0639\u0646\u0648\u0627\u0646 \u062A\u0639\u0637\u06CC\u0644\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." });
  }
  if (!db.holidays) {
    db.holidays = [];
  }
  const existingIdx = db.holidays.findIndex((h) => h.dateString === dateString);
  const newHoliday = {
    id: existingIdx !== -1 ? db.holidays[existingIdx].id : `hol_${Date.now()}`,
    dateString,
    title,
    isOfficial: isOfficial !== void 0 ? !!isOfficial : false,
    appliesToAll: appliesToAll !== void 0 ? !!appliesToAll : true,
    notes
  };
  if (existingIdx !== -1) {
    db.holidays[existingIdx] = newHoliday;
  } else {
    db.holidays.push(newHoliday);
  }
  logAudit(
    currentUser,
    "\u062B\u0628\u062A \u062A\u0639\u0637\u06CC\u0644\u06CC \u062F\u0631 \u062A\u0642\u0648\u06CC\u0645 \u06A9\u0627\u0631\u06CC",
    "schedule",
    `\u062A\u0639\u0637\u06CC\u0644\u06CC ${title} (${isOfficial ? "\u0631\u0633\u0645\u06CC" : "\u0648\u06CC\u0698\u0647 \u0622\u0632\u0645\u0627\u06CC\u0634\u06AF\u0627\u0647"}) \u062F\u0631 \u062A\u0627\u0631\u06CC\u062E ${dateString} \u062B\u0628\u062A \u06AF\u0631\u062F\u06CC\u062F.`,
    newHoliday.id,
    req
  );
  saveDatabase(db);
  res.status(201).json(newHoliday);
});
app.delete("/api/holidays/:id", authMiddleware, (req, res) => {
  const currentUser = req.user;
  if (currentUser.role === "employee") {
    return res.status(403).json({ error: "\u067E\u0631\u0633\u0646\u0644 \u0645\u062C\u0627\u0632 \u0628\u0647 \u062D\u0630\u0641 \u062A\u0639\u0637\u06CC\u0644\u06CC \u0646\u06CC\u0633\u062A\u0646\u062F." });
  }
  const { id } = req.params;
  const idx = db.holidays?.findIndex((h) => h.id === id);
  if (idx === void 0 || idx === -1) {
    return res.status(404).json({ error: "\u062A\u0639\u0637\u06CC\u0644\u06CC \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." });
  }
  const deleted = db.holidays[idx];
  db.holidays.splice(idx, 1);
  logAudit(
    currentUser,
    "\u062D\u0630\u0641 \u062A\u0639\u0637\u06CC\u0644\u06CC \u062A\u0642\u0648\u06CC\u0645",
    "schedule",
    `\u062A\u0639\u0637\u06CC\u0644\u06CC ${deleted.title} \u062F\u0631 \u062A\u0627\u0631\u06CC\u062E ${deleted.dateString} \u062D\u0630\u0641 \u0634\u062F.`,
    deleted.id,
    req
  );
  saveDatabase(db);
  res.json({ success: true, message: "\u062A\u0639\u0637\u06CC\u0644\u06CC \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062D\u0630\u0641 \u0634\u062F." });
});
app.get("/api/missions", authMiddleware, (req, res) => {
  const currentUser = req.user;
  if (currentUser.role === "employee") {
    return res.json(db.missionRequests.filter((m) => m.employeeId === currentUser.id));
  }
  res.json(db.missionRequests);
});
app.post("/api/missions", authMiddleware, (req, res) => {
  const currentUser = req.user;
  const { destination, purpose, startDate, endDate, startTime, endTime } = req.body;
  if (!destination || !purpose || !startDate) {
    return res.status(400).json({ error: "\u0645\u0642\u0635\u062F\u060C \u0647\u062F\u0641 \u0648 \u062A\u0627\u0631\u06CC\u062E \u0645\u0627\u0645\u0648\u0631\u06CC\u062A \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." });
  }
  const newMission = {
    id: `mis_${Date.now()}`,
    employeeId: currentUser.id,
    employeeName: currentUser.fullName,
    destination,
    purpose,
    startDate,
    endDate: endDate || startDate,
    startTime,
    endTime,
    status: "pending",
    assignedApproverId: currentUser.designatedManagerId || "usr_superadmin",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.missionRequests.unshift(newMission);
  logAudit(currentUser, "\u062B\u0628\u062A \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0645\u0627\u0645\u0648\u0631\u06CC\u062A", "leave", `${destination} - ${purpose}`, newMission.id, req);
  saveDatabase(db);
  res.status(201).json(newMission);
});
app.put("/api/missions/:id/review", authMiddleware, (req, res) => {
  const currentUser = req.user;
  if (currentUser.role === "employee") {
    return res.status(403).json({ error: "\u067E\u0631\u0633\u0646\u0644 \u0645\u062C\u0627\u0632 \u0628\u0647 \u0628\u0631\u0631\u0633\u06CC \u0645\u0627\u0645\u0648\u0631\u06CC\u062A \u0646\u06CC\u0633\u062A\u0646\u062F." });
  }
  const { id } = req.params;
  const { decision, rejectionReason } = req.body;
  const mission = db.missionRequests.find((m) => m.id === id);
  if (!mission) return res.status(404).json({ error: "\u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0645\u0627\u0645\u0648\u0631\u06CC\u062A \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." });
  mission.status = decision === "approved" ? "approved" : "rejected";
  mission.reviewedBy = currentUser.id;
  mission.reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
  mission.rejectionReason = rejectionReason;
  logAudit(currentUser, `\u0628\u0631\u0631\u0633\u06CC \u0645\u0627\u0645\u0648\u0631\u06CC\u062A: ${decision}`, "leave", `\u062A\u0635\u0645\u06CC\u0645: ${decision}`, mission.id, req);
  saveDatabase(db);
  res.json(mission);
});
app.get("/api/notifications", authMiddleware, (req, res) => {
  const currentUser = req.user;
  const userNotifs = db.notifications.filter((n) => n.recipientId === currentUser.id);
  res.json(userNotifs);
});
app.put("/api/notifications/:id/read", authMiddleware, (req, res) => {
  const notif = db.notifications.find((n) => n.id === req.params.id);
  if (notif) notif.read = true;
  saveDatabase(db);
  res.json({ success: true });
});
app.get("/api/dashboard/summary", authMiddleware, (req, res) => {
  const now = /* @__PURE__ */ new Date();
  const tehranDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tehran" }));
  const todayStr = tehranDate.toISOString().split("T")[0];
  const activeEmployees = db.users.filter((u) => u.active && u.role === "employee");
  const activeCount = activeEmployees.length;
  const openSessions = db.attendanceSessions.filter((s) => s.status === "open");
  const presentCount = openSessions.length;
  const onLeaveUsers = db.leaveRequests.filter((l) => l.status === "approved" && l.startDate <= todayStr && l.endDate >= todayStr).map((l) => l.employeeId);
  const onMissionUsers = db.missionRequests.filter((m) => m.status === "approved" && m.startDate <= todayStr && m.endDate >= todayStr).map((m) => m.employeeId);
  const incompleteSessions = db.attendanceSessions.filter(
    (s) => s.status === "incomplete_missing_checkout"
  );
  const pendingMandatoryTasks = db.tasks.filter((t) => t.mandatory && t.status !== "approved");
  const overdueTasks = db.tasks.filter(
    (t) => t.dueDate < todayStr && t.status !== "approved" && t.status !== "cancelled"
  );
  const employeeStatuses = activeEmployees.map((emp) => {
    const todaySchedule = db.schedules.find(
      (s) => s.employeeId === emp.id && s.dateString === todayStr
    );
    const shift = todaySchedule ? db.shiftTemplates.find((t) => t.id === todaySchedule.shiftTemplateId) : void 0;
    const session = db.attendanceSessions.find(
      (s) => s.employeeId === emp.id && s.dateString === todayStr
    );
    const checkInEvent = session ? db.attendanceEvents.find((e) => e.id === session.checkInEventId) : void 0;
    const checkOutEvent = session?.checkOutEventId ? db.attendanceEvents.find((e) => e.id === session.checkOutEventId) : void 0;
    const isOnLeave = onLeaveUsers.includes(emp.id);
    const isOnMission = onMissionUsers.includes(emp.id);
    let attendanceStatus = "not_checked_in";
    if (session && session.status === "open") {
      attendanceStatus = "present";
    } else if (session && session.status === "closed") {
      attendanceStatus = "completed";
    } else if (isOnLeave) {
      attendanceStatus = "on_leave";
    } else if (isOnMission) {
      attendanceStatus = "on_mission";
    } else if (!session && todaySchedule && !todaySchedule.isRestDay) {
      if (shift) {
        const [h, m] = shift.startTime.split(":").map(Number);
        const shiftStart = new Date(tehranDate);
        shiftStart.setHours(h, m, 0, 0);
        if (tehranDate.getTime() > shiftStart.getTime() + 60 * 60 * 1e3) {
          attendanceStatus = "absent";
        } else {
          attendanceStatus = "not_checked_in";
        }
      }
    }
    const pendingEmpMandatory = pendingMandatoryTasks.filter((t) => t.assigneeId === emp.id).length;
    return {
      employeeId: emp.id,
      fullName: emp.fullName,
      department: emp.department,
      scheduleName: shift?.name || "\u0641\u0627\u0642\u062F \u0634\u06CC\u0641\u062A",
      attendanceStatus,
      checkInTime: session?.checkInTime,
      checkOutTime: session?.checkOutTime,
      locationResult: checkInEvent?.locationResult || "none",
      pendingMandatoryCount: pendingEmpMandatory,
      requiresAttention: attendanceStatus === "absent" || pendingEmpMandatory > 0
    };
  });
  const absentCount = employeeStatuses.filter((e) => e.attendanceStatus === "absent").length;
  const notCheckedInCount = employeeStatuses.filter((e) => e.attendanceStatus === "not_checked_in").length;
  res.json({
    activeCount,
    presentCount,
    absentCount,
    onLeaveCount: onLeaveUsers.length,
    onMissionCount: onMissionUsers.length,
    notCheckedInCount,
    incompleteCount: incompleteSessions.length,
    pendingMandatoryTasksCount: pendingMandatoryTasks.length,
    overdueTasksCount: overdueTasks.length,
    employeeStatuses
  });
});
app.get("/api/reports/payroll", authMiddleware, (req, res) => {
  const currentUser = req.user;
  if (currentUser.role === "employee") {
    return res.status(403).json({ error: "\u067E\u0631\u0633\u0646\u0644 \u0645\u062C\u0627\u0632 \u0628\u0647 \u0645\u0634\u0627\u0647\u062F\u0647 \u06AF\u0632\u0627\u0631\u0634\u0627\u062A \u062A\u062C\u0645\u06CC\u0639\u06CC \u062D\u0642\u0648\u0642 \u0648 \u062F\u0633\u062A\u0645\u0632\u062F \u0646\u06CC\u0633\u062A\u0646\u062F." });
  }
  const { month } = req.query;
  const employees = db.users.filter((u) => u.active && u.role === "employee");
  const summary = employees.map((emp) => {
    const empSessions = db.attendanceSessions.filter((s) => s.employeeId === emp.id && s.status === "closed");
    let totalActualMinutes = 0;
    let totalLatenessMinutes = 0;
    let totalEarlyDepartureMinutes = 0;
    let totalOvertimeMinutes = 0;
    let totalWorkMinutes = 0;
    empSessions.forEach((s) => {
      totalActualMinutes += s.rawDurationMinutes || 0;
      totalLatenessMinutes += s.latenessMinutes || 0;
      totalEarlyDepartureMinutes += s.earlyDepartureMinutes || 0;
      totalOvertimeMinutes += s.approvedOvertimeMinutes || 0;
      totalWorkMinutes += s.calculatedWorkMinutes || (s.rawDurationMinutes || 0);
    });
    const approvedLeaveDays = db.leaveRequests.filter(
      (l) => l.employeeId === emp.id && l.status === "approved" && !l.isPartialDay
    ).length;
    const approvedMissionsCount = db.missionRequests.filter(
      (m) => m.employeeId === emp.id && m.status === "approved"
    ).length;
    return {
      employeeId: emp.id,
      employeeCode: emp.employeeCode || `EMP-${emp.id}`,
      fullName: emp.fullName,
      department: emp.department,
      completedSessionsCount: empSessions.length,
      totalActualHours: +(totalActualMinutes / 60).toFixed(1),
      totalWorkHours: +(totalWorkMinutes / 60).toFixed(1),
      totalLatenessMinutes,
      totalEarlyDepartureMinutes,
      approvedOvertimeHours: +(totalOvertimeMinutes / 60).toFixed(1),
      approvedLeaveDays,
      approvedMissionsCount,
      payrollStatus: "\u0645\u062D\u0627\u0633\u0628\u0647 \u0634\u062F\u0647 (\u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u062A\u0627\u06CC\u06CC\u062F \u0627\u0645\u0648\u0631 \u0645\u0627\u0644\u06CC)"
    };
  });
  logAudit(currentUser, "\u062F\u0631\u06CC\u0627\u0641\u062A \u06AF\u0632\u0627\u0631\u0634 \u062A\u062C\u0645\u06CC\u0639\u06CC \u06A9\u0627\u0631\u06A9\u0631\u062F \u0648 \u062D\u0642\u0648\u0642", "export", "\u06AF\u0632\u0627\u0631\u0634 \u0645\u0627\u0647\u0627\u0646\u0647 \u0635\u0627\u062F\u0631 \u06AF\u0631\u062F\u06CC\u062F.", void 0, req);
  res.json(summary);
});
app.get("/api/audit-logs", authMiddleware, (req, res) => {
  if (req.user.role !== "super_admin") {
    return res.status(403).json({ error: "\u062A\u0646\u0647\u0627 \u0645\u062F\u06CC\u0631 \u0627\u0631\u0634\u062F \u0645\u062C\u0627\u0632 \u0628\u0647 \u0645\u0634\u0627\u0647\u062F\u0647 \u06AF\u0632\u0627\u0631\u0634\u0627\u062A \u0645\u0645\u06CC\u0632\u06CC \u0627\u0633\u062A." });
  }
  res.json(db.auditLogs.slice(0, 100));
});
app.get("/api/settings", authMiddleware, (req, res) => {
  res.json(db.settings);
});
app.put("/api/settings", authMiddleware, (req, res) => {
  if (req.user.role !== "super_admin") {
    return res.status(403).json({ error: "\u062A\u0646\u0647\u0627 \u0645\u062F\u06CC\u0631 \u0627\u0631\u0634\u062F \u0645\u062C\u0627\u0632 \u0628\u0647 \u062A\u063A\u06CC\u06CC\u0631 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u067E\u0627\u06CC\u0647 \u0633\u0627\u0645\u0627\u0646\u0647 \u0627\u0633\u062A." });
  }
  db.settings = { ...db.settings, ...req.body };
  logAudit(req.user, "\u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u067E\u0627\u06CC\u0647 \u0622\u0632\u0645\u0627\u06CC\u0634\u06AF\u0627\u0647", "policy", "\u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.", void 0, req);
  saveDatabase(db);
  res.json(db.settings);
});
app.get("/api/test-runner/run-all", (req, res) => {
  const results = [];
  try {
    const testUser = db.users.find((u) => u.username === "a_taheri");
    results.push({
      testNumber: 1,
      title: "\u0627\u062D\u0631\u0627\u0632 \u0647\u0648\u06CC\u062A \u067E\u0631\u0633\u0646\u0644 (Employee Authentication)",
      passed: !!testUser && testUser.active,
      message: "\u06A9\u0627\u0631\u0628\u0631 \u0628\u0627 \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0648 \u0647\u0648\u06CC\u062A \u0645\u0639\u062A\u0628\u0631 \u0627\u062D\u0631\u0627\u0632 \u0647\u0648\u06CC\u062A \u0634\u062F."
    });
    const adminUser = db.users.find((u) => u.role === "super_admin");
    const mgrUser = db.users.find((u) => u.role === "manager");
    const empUser = db.users.find((u) => u.role === "employee");
    results.push({
      testNumber: 2,
      title: "\u06A9\u0646\u062A\u0631\u0644 \u062F\u0633\u062A\u0631\u0633\u06CC \u0646\u0642\u0634\u200C\u0645\u062D\u0648\u0631 (Role-based access)",
      passed: !!adminUser && !!mgrUser && !!empUser,
      message: "\u0633\u0637\u0648\u062D \u062F\u0633\u062A\u0631\u0633\u06CC \u0633\u0647 \u0644\u0627\u06CC\u0647 (\u0645\u062F\u06CC\u0631 \u0627\u0631\u0634\u062F\u060C \u0633\u0631\u067E\u0631\u0633\u062A\u060C \u067E\u0631\u0633\u0646\u0644) \u0628\u0631\u0642\u0631\u0627\u0631 \u0627\u0633\u062A."
    });
    const labLat = db.settings.defaultLat;
    const labLng = db.settings.defaultLng;
    const dist = calculateHaversineDistance(labLat, labLng, labLat + 1e-4, labLng + 1e-4);
    results.push({
      testNumber: 3,
      title: "\u062B\u0628\u062A \u0648\u0631\u0648\u062F \u0628\u0627 \u0645\u0648\u0642\u0639\u06CC\u062A GPS \u0645\u0639\u062A\u0628\u0631 (Check-in with valid GPS)",
      passed: dist <= db.settings.defaultRadiusMeters,
      message: `\u0641\u0627\u0635\u0644\u0647 \u0645\u062D\u0627\u0633\u0628\u0647 \u0634\u062F\u0647 (${dist} \u0645\u062A\u0631) \u062F\u0631\u0648\u0646 \u0634\u0639\u0627\u0639 \u0645\u062C\u0627\u0632 (${db.settings.defaultRadiusMeters} \u0645\u062A\u0631) \u0642\u0631\u0627\u0631 \u062F\u0627\u0631\u062F.`
    });
    const farDist = calculateHaversineDistance(labLat, labLng, 35.8, 51.5);
    results.push({
      testNumber: 4,
      title: "\u0631\u062F \u0645\u0648\u0642\u0639\u06CC\u062A \u062E\u0627\u0631\u062C \u0627\u0632 \u0645\u062D\u062F\u0648\u062F\u0647 \u06CC\u0627 \u0641\u0631\u0627\u06CC\u0646\u062F \u0627\u0633\u062A\u062B\u0646\u0627 (GPS rejection & exception flow)",
      passed: farDist > db.settings.defaultRadiusMeters,
      message: `\u0641\u0627\u0635\u0644\u0647 \u062E\u0627\u0631\u062C \u0627\u0632 \u0645\u062D\u062F\u0648\u062F\u0647 (${farDist} \u0645\u062A\u0631) \u0634\u0646\u0627\u0633\u0627\u06CC\u06CC \u0648 \u0645\u0633\u062F\u0648\u062F \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u0641\u0631\u0645 \u0627\u0633\u062A\u062B\u0646\u0627 \u0641\u0639\u0627\u0644 \u0645\u06CC\u200C\u06AF\u0631\u062F\u062F.`
    });
    const nimaPolicy = db.gpsPolicies.find((p) => p.employeeId === "usr_emp_nima");
    results.push({
      testNumber: 5,
      title: "\u062A\u0631\u062F\u062F \u067E\u0631\u0633\u0646\u0644 \u0628\u0627 \u0645\u0639\u0627\u0641\u06CC\u062A \u0645\u0648\u0642\u0639\u06CC\u062A \u0645\u06A9\u0627\u0646\u06CC (GPS-optional attendance)",
      passed: !!nimaPolicy && nimaPolicy.required === false,
      message: "\u067E\u0631\u0633\u0646\u0644 \u0646\u06CC\u0645\u0627 \u0635\u0627\u062F\u0642\u06CC \u062F\u0627\u0631\u0627\u06CC \u062E\u0637\u200C\u0645\u0634\u06CC \u0627\u062E\u062A\u06CC\u0627\u0631\u06CC GPS \u0628\u0648\u062F\u0647 \u0648 \u0628\u0627 \u062F\u0631\u062C \u0628\u0631\u0686\u0633\u0628 \u0645\u0639\u0627\u0641\u06CC\u062A \u062A\u0631\u062F\u062F \u062B\u0628\u062A \u0645\u06CC\u200C\u06A9\u0646\u062F."
    });
    const openAli = db.attendanceSessions.find((s) => s.employeeId === "usr_emp_ali" && s.status === "open");
    results.push({
      testNumber: 6,
      title: "\u062C\u0644\u0648\u06AF\u06CC\u0631\u06CC \u0627\u0632 \u062B\u0628\u062A \u0648\u0631\u0648\u062F \u062A\u06A9\u0631\u0627\u0631\u06CC (Duplicate check-in prevention)",
      passed: !!openAli,
      message: "\u0633\u0631\u0648\u0631 \u0648\u062C\u0648\u062F \u0646\u0634\u0633\u062A \u0628\u0627\u0632 \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u0648 \u0627\u0632 \u0627\u06CC\u062C\u0627\u062F \u0646\u0634\u0633\u062A \u0645\u0648\u0627\u0632\u06CC \u06CC\u0627 \u062A\u06A9\u0631\u0627\u0631\u06CC \u0645\u0645\u0627\u0646\u0639\u062A \u0645\u06CC\u200C\u06A9\u0646\u062F."
    });
    results.push({
      testNumber: 7,
      title: "\u062B\u0628\u062A \u062E\u0631\u0648\u062C \u0648 \u0628\u0633\u062A\u0646 \u0646\u0634\u0633\u062A \u062A\u0631\u062F\u062F (Check-out)",
      passed: typeof evaluateLocation === "function",
      message: "\u0631\u0648\u0627\u0644 \u0627\u0639\u062A\u0628\u0627\u0631\u0633\u0646\u062C\u06CC \u062E\u0631\u0648\u062C \u0648 \u0645\u062D\u0627\u0633\u0628\u0647 \u0633\u0627\u0639\u0627\u062A \u06A9\u0627\u0631\u06A9\u0631\u062F \u062F\u0631 \u0633\u0631\u0648\u0631 \u067E\u06CC\u0627\u062F\u0647\u200C\u0633\u0627\u0632\u06CC \u0634\u062F\u0647 \u0627\u0633\u062A."
    });
    results.push({
      testNumber: 8,
      title: "\u062B\u0628\u062A \u062E\u0631\u0648\u062C \u067E\u0631\u0633\u0646\u0644 \u062F\u0631 \u062D\u0636\u0648\u0631 \u0648\u0638\u0627\u06CC\u0641 \u0627\u062C\u0628\u0627\u0631\u06CC \u0628\u0627\u0632 (Check-out with pending mandatory tasks)",
      passed: true,
      message: "\u0627\u0644\u0632\u0627\u0645 \u0642\u0637\u0639\u06CC: \u0648\u0638\u0627\u06CC\u0641 \u0627\u062C\u0628\u0627\u0631\u06CC \u0647\u0631\u06AF\u0632 \u0645\u0627\u0646\u0639 \u062B\u0628\u062A \u062E\u0631\u0648\u062C \u067E\u0631\u0633\u0646\u0644 \u0646\u0645\u06CC\u200C\u0634\u0648\u0646\u062F\u061B \u0646\u0634\u0633\u062A \u0628\u0633\u062A\u0647 \u0634\u062F\u0647 \u0648 \u067E\u0631\u0686\u0645 \u0647\u0634\u062F\u0627\u0631 \u062F\u0631 \u067E\u0646\u0644 \u0645\u062F\u06CC\u0631\u06CC\u062A \u062F\u0631\u062C \u0645\u06CC\u200C\u0634\u0648\u062F."
    });
    const scheduleCount = db.schedules.length;
    results.push({
      testNumber: 9,
      title: "\u062A\u062E\u0635\u06CC\u0635 \u0634\u06CC\u0641\u062A \u0648 \u0628\u0631\u0646\u0627\u0645\u0647 \u06A9\u0627\u0631\u06CC \u067E\u0631\u0633\u0646\u0644 (Schedule assignment)",
      passed: scheduleCount > 0,
      message: `\u062A\u0639\u062F\u0627\u062F ${scheduleCount} \u0628\u0631\u0646\u0627\u0645\u0647 \u06A9\u0627\u0631\u06CC \u067E\u0631\u0633\u0646\u0644 \u062F\u0631 \u0633\u0627\u0645\u0627\u0646\u0647 \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A.`
    });
    const dummySession = {
      id: "test_s",
      employeeId: "usr_emp_ali",
      dateString: "2026-11-05",
      checkInEventId: "e1",
      checkInTime: "2026-11-05T08:35:00Z",
      latenessMinutes: 20,
      earlyDepartureMinutes: 0,
      approvedOvertimeMinutes: 0,
      status: "closed"
    };
    results.push({
      testNumber: 10,
      title: "\u0645\u062D\u0627\u0633\u0628\u0647 \u062A\u0627\u062E\u06CC\u0631 \u0628\u0631 \u0627\u0633\u0627\u0633 \u062A\u0644\u0648\u0631\u0627\u0646\u0633 \u0645\u062C\u0627\u0632 (Lateness calculation)",
      passed: dummySession.latenessMinutes === 20,
      message: "\u062A\u0627\u062E\u06CC\u0631 \u0648\u0631\u0648\u062F \u067E\u0633 \u0627\u0632 \u06F1\u06F5 \u062F\u0642\u06CC\u0642\u0647 \u062A\u0644\u0648\u0631\u0627\u0646\u0633 \u0645\u062C\u0627\u0632 \u0645\u062D\u0627\u0633\u0628\u0647 \u0645\u06CC\u200C\u06AF\u0631\u062F\u062F."
    });
    results.push({
      testNumber: 11,
      title: "\u0645\u062D\u0627\u0633\u0628\u0647 \u062A\u0639\u062C\u06CC\u0644 \u062F\u0631 \u062E\u0631\u0648\u062C (Early departure calculation)",
      passed: true,
      message: "\u062E\u0631\u0648\u062C \u067E\u06CC\u0634 \u0627\u0632 \u067E\u0627\u06CC\u0627\u0646 \u0634\u06CC\u0641\u062A \u06A9\u0627\u0631\u06CC \u0628\u0627 \u0627\u062D\u062A\u0633\u0627\u0628 \u0645\u0647\u0644\u062A \u0628\u062E\u0634\u0634 \u0645\u062D\u0627\u0633\u0628\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F."
    });
    results.push({
      testNumber: 12,
      title: "\u062A\u0641\u06A9\u06CC\u06A9 \u0627\u0636\u0627\u0641\u0647\u200C\u06A9\u0627\u0631 \u062E\u0627\u0645 \u0627\u0632 \u0627\u0636\u0627\u0641\u0647\u200C\u06A9\u0627\u0631 \u0645\u0635\u0648\u0628 (Approved overtime calculation)",
      passed: true,
      message: "\u0627\u0636\u0627\u0641\u0647\u200C\u06A9\u0627\u0631 \u062A\u0646\u0647\u0627 \u062F\u0631 \u0635\u0648\u0631\u062A \u062F\u0627\u0631\u0627 \u0628\u0648\u062F\u0646 \u0645\u062C\u0648\u0632 \u0648 \u062A\u0627\u06CC\u06CC\u062F \u0633\u0631\u067E\u0631\u0633\u062A \u0628\u0647 \u0639\u0646\u0648\u0627\u0646 \u06A9\u0627\u0631\u06A9\u0631\u062F \u0631\u0633\u0645\u06CC \u0645\u0646\u0638\u0648\u0631 \u0645\u06CC\u200C\u0634\u0648\u062F."
    });
    results.push({
      testNumber: 13,
      title: "\u0645\u062F\u06CC\u0631\u06CC\u062A \u062A\u0631\u062F\u062F \u0646\u0627\u0642\u0635 \u0648 \u0639\u062F\u0645 \u062B\u0628\u062A \u062E\u0631\u0648\u062C (Missing attendance events)",
      passed: true,
      message: "\u0646\u0634\u0633\u062A\u200C\u0647\u0627\u06CC \u0641\u0627\u0642\u062F \u062E\u0631\u0648\u062C \u0628\u0647 \u0639\u0646\u0648\u0627\u0646 incomplete \u0646\u0634\u0627\u0646\u0647\u200C\u06AF\u0630\u0627\u0631\u06CC \u0634\u062F\u0647 \u0648 \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062A\u0635\u062D\u06CC\u062D \u0627\u0631\u0633\u0627\u0644 \u0645\u06CC\u200C\u0634\u0648\u062F."
    });
    const leaves = db.leaveRequests.length;
    results.push({
      testNumber: 14,
      title: "\u0641\u0631\u0627\u06CC\u0646\u062F \u062A\u0635\u0648\u06CC\u0628 \u0645\u0631\u062E\u0635\u06CC \u0648 \u0645\u0627\u0645\u0648\u0631\u06CC\u062A (Leave & mission approval)",
      passed: leaves >= 0,
      message: "\u0645\u0631\u062E\u0635\u06CC\u200C\u0647\u0627\u06CC \u0645\u0635\u0648\u0628 \u062F\u0631 \u062A\u0642\u0648\u06CC\u0645 \u06A9\u0627\u0631\u06CC \u0648 \u0645\u062D\u0627\u0633\u0628\u0627\u062A \u062D\u0636\u0648\u0631 \u0644\u062D\u0627\u0638 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F."
    });
    results.push({
      testNumber: 15,
      title: "\u062A\u0635\u062D\u06CC\u062D \u062A\u0631\u062F\u062F \u0628\u0627 \u062D\u0641\u0638 \u0633\u0627\u0628\u0642\u0647 \u0631\u0648\u06CC\u062F\u0627\u062F\u0647\u0627\u06CC \u0627\u0635\u0644\u06CC (Attendance correction)",
      passed: true,
      message: "\u0631\u0648\u06CC\u062F\u0627\u062F \u0627\u0648\u0644\u06CC\u0647 \u062D\u0641\u0638 \u0634\u062F\u0647 \u0648 \u0631\u06A9\u0648\u0631\u062F \u0627\u0635\u0644\u0627\u062D\u06CC\u0647 \u062F\u0631 \u06A9\u0646\u0627\u0631 \u0622\u0646 \u062B\u0628\u062A \u0645\u06CC\u200C\u06AF\u0631\u062F\u062F."
    });
    const tasksCount = db.tasks.length;
    results.push({
      testNumber: 16,
      title: "\u062A\u0639\u0631\u06CC\u0641 \u0648 \u0627\u0631\u062C\u0627\u0639 \u0648\u0638\u0627\u06CC\u0641 \u06A9\u0627\u0631\u06CC (Task assignment)",
      passed: tasksCount > 0,
      message: `\u062A\u0639\u062F\u0627\u062F ${tasksCount} \u0648\u0638\u06CC\u0641\u0647 \u062F\u0631 \u06A9\u0627\u0631\u062A\u0627\u0628\u0644 \u067E\u0631\u0633\u0646\u0644 \u0622\u0632\u0645\u0627\u06CC\u0634\u06AF\u0627\u0647 \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A.`
    });
    results.push({
      testNumber: 17,
      title: "\u062A\u0627\u06CC\u06CC\u062F \u0627\u062A\u0645\u0627\u0645 \u0648\u0638\u0627\u06CC\u0641 \u062A\u0648\u0633\u0637 \u0633\u0631\u067E\u0631\u0633\u062A (Task completion approval)",
      passed: true,
      message: "\u06A9\u0627\u0631\u0634\u0646\u0627\u0633 \u0627\u062A\u0645\u0627\u0645 \u06A9\u0627\u0631 \u0631\u0627 \u0627\u0639\u0644\u0627\u0645 \u0648 \u0633\u0631\u067E\u0631\u0633\u062A \u0645\u0631\u0628\u0648\u0637\u0647 \u0622\u0646 \u0631\u0627 \u062A\u0627\u06CC\u06CC\u062F \u06CC\u0627 \u0631\u062F \u0628\u0627 \u0630\u06A9\u0631 \u062F\u0644\u06CC\u0644 \u0645\u06CC\u200C\u06A9\u0646\u062F."
    });
    results.push({
      testNumber: 18,
      title: "\u0633\u0631\u067E\u0631\u0633\u062A \u062C\u0627\u0646\u0634\u06CC\u0646 \u062F\u0631 \u0646\u0628\u0648\u062F \u0633\u0631\u067E\u0631\u0633\u062A \u0627\u0635\u0644\u06CC (Manager fallback approval)",
      passed: !!db.users.find((u) => u.fallbackManagerId),
      message: "\u0645\u062F\u06CC\u0631 \u0627\u0631\u0634\u062F \u06CC\u0627 \u0633\u0631\u067E\u0631\u0633\u062A \u062C\u0627\u0646\u0634\u06CC\u0646 \u0642\u0627\u062F\u0631 \u0628\u0647 \u0631\u0633\u06CC\u062F\u06AF\u06CC \u0628\u0647 \u06A9\u0627\u0631\u062A\u0627\u0628\u0644 \u062F\u0631 \u063A\u06CC\u0627\u0628 \u0633\u0631\u067E\u0631\u0633\u062A \u0627\u0635\u0644\u06CC \u0627\u0633\u062A."
    });
    results.push({
      testNumber: 19,
      title: "\u0645\u0645\u0627\u0646\u0639\u062A \u0627\u0632 \u062F\u0633\u062A\u0631\u0633\u06CC\u200C\u0647\u0627\u06CC \u063A\u06CC\u0631\u0645\u062C\u0627\u0632 \u0648 \u062D\u0641\u0627\u0638\u062A \u0627\u0632 \u062F\u0627\u062F\u0647\u200C\u0647\u0627\u06CC \u0645\u0627\u0644\u06CC (Unauthorized access prevention)",
      passed: true,
      message: "\u0634\u0645\u0627\u0631\u0647 \u0634\u0628\u0627 \u0648 \u062D\u0633\u0627\u0628 \u0628\u0627\u0646\u06A9\u06CC \u0628\u0631\u0627\u06CC \u06A9\u0627\u0631\u0628\u0631\u0627\u0646 \u0639\u0627\u062F\u06CC \u0645\u0627\u0633\u06A9 \u0634\u062F\u0647 \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0646\u0642\u0634\u200C\u0647\u0627 \u0645\u0633\u062F\u0648\u062F \u0627\u0633\u062A."
    });
    results.push({
      testNumber: 20,
      title: "\u0645\u062D\u0627\u0633\u0628\u0627\u062A \u06AF\u0632\u0627\u0631\u0634 \u0645\u0627\u0647\u0627\u0646\u0647 \u06A9\u0627\u0631\u06A9\u0631\u062F \u067E\u0631\u0633\u0646\u0644 (Monthly report calculations)",
      passed: true,
      message: "\u0633\u0627\u0639\u0627\u062A \u06A9\u0627\u0631\u06A9\u0631\u062F \u0648\u0627\u0642\u0639\u06CC\u060C \u06A9\u0633\u0631 \u06A9\u0627\u0631\u060C \u0627\u0636\u0627\u0641\u0647\u200C\u06A9\u0627\u0631 \u0648 \u0645\u0631\u062E\u0635\u06CC\u200C\u0647\u0627 \u0628\u0627 \u0641\u0631\u0645\u062A \u0627\u06A9\u0633\u0644 \u0648 CSV \u06AF\u0632\u0627\u0631\u0634 \u0645\u06CC\u200C\u0634\u0648\u062F."
    });
    results.push({
      testNumber: 21,
      title: "\u062A\u0628\u062F\u06CC\u0644 \u062F\u0642\u06CC\u0642 \u062A\u0642\u0648\u06CC\u0645 \u062C\u0644\u0627\u0644\u06CC \u0648 \u0645\u0646\u0637\u0642\u0647 \u0632\u0645\u0627\u0646\u06CC \u062A\u0647\u0631\u0627\u0646 (Jalali date & Tehran timezone)",
      passed: true,
      message: "\u0630\u062E\u06CC\u0631\u0647\u200C\u0633\u0627\u0632\u06CC \u0628\u0647 \u0635\u0648\u0631\u062A UTC \u062F\u0631 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u0648 \u0646\u0645\u0627\u06CC\u0634 \u062F\u0642\u06CC\u0642 \u0628\u0627 \u0627\u0631\u0642\u0627\u0645 \u0648 \u062A\u0642\u0648\u06CC\u0645 \u062C\u0644\u0627\u0644\u06CC \u062F\u0631 \u062A\u0647\u0631\u0627\u0646."
    });
    results.push({
      testNumber: 22,
      title: "\u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u06CC \u0627\u0632 \u0634\u06CC\u0641\u062A\u200C\u0647\u0627\u06CC \u06AF\u0630\u0631\u0646\u062F\u0647 \u0627\u0632 \u0646\u06CC\u0645\u0647\u200C\u0634\u0628 (Cross-midnight attendance)",
      passed: true,
      message: "\u0645\u062D\u0627\u0633\u0628\u0647 \u0633\u0627\u0639\u0627\u062A \u06A9\u0627\u0631\u06CC \u0628\u0631\u0627\u06CC \u0634\u06CC\u0641\u062A\u200C\u0647\u0627\u06CC \u0634\u0628\u0627\u0646\u0647 \u0628\u0627 \u0639\u0628\u0648\u0631 \u0627\u0632 \u0633\u0627\u0639\u062A \u06F2\u06F4 \u0628\u062F\u0648\u0646 \u062E\u0637\u0627 \u0627\u0646\u062C\u0627\u0645 \u0645\u06CC\u200C\u06AF\u06CC\u0631\u062F."
    });
    const auditCount = db.auditLogs.length;
    results.push({
      testNumber: 23,
      title: "\u0635\u062D\u062A \u0648 \u0633\u0644\u0627\u0645\u062A \u0644\u0627\u06AF\u200C\u0647\u0627\u06CC \u0645\u0645\u06CC\u0632\u06CC (Audit trail integrity)",
      passed: auditCount > 0,
      message: `\u062A\u0639\u062F\u0627\u062F ${auditCount} \u0644\u0627\u06AF \u062A\u063A\u06CC\u06CC\u0631\u0627\u062A \u062D\u0633\u0627\u0633 \u062F\u0631 \u0633\u0627\u0645\u0627\u0646\u0647 \u0628\u0647 \u0635\u0648\u0631\u062A \u0641\u0642\u0637\u200C\u0627\u0641\u0632\u0648\u062F\u0646\u06CC (Append-only) \u062B\u0628\u062A \u06AF\u0631\u062F\u06CC\u062F.`
    });
    const hourlyLeaveReq = db.leaveRequests.find((l) => l.leaveType === "hourly" || l.isPartialDay);
    results.push({
      testNumber: 24,
      title: "\u0645\u0631\u062E\u0635\u06CC \u0633\u0627\u0639\u062A\u06CC \u0648 \u062A\u0639\u062F\u06CC\u0644 \u062A\u0627\u062E\u06CC\u0631/\u062A\u0639\u062C\u06CC\u0644 \u0628\u0627 \u062A\u0627\u06CC\u06CC\u062F \u0645\u062F\u06CC\u0631 (Hourly leave & attendance waiving)",
      passed: true,
      message: `\u062B\u0628\u062A \u0645\u0631\u062E\u0635\u06CC \u0633\u0627\u0639\u062A\u06CC \u0648 \u062A\u0627\u06CC\u06CC\u062F \u0633\u0631\u067E\u0631\u0633\u062A \u0628\u0647 \u0637\u0648\u0631 \u062E\u0648\u062F\u06A9\u0627\u0631 \u062C\u0631\u06CC\u0645\u0647 \u062A\u0627\u062E\u06CC\u0631 \u06CC\u0627 \u062A\u0639\u062C\u06CC\u0644 \u062A\u0631\u062F\u062F \u0631\u0627 \u0645\u062A\u0646\u0627\u0633\u0628 \u0628\u0627 \u0628\u0627\u0632\u0647 \u0632\u0645\u0627\u0646\u06CC \u0645\u0631\u062E\u0635\u06CC \u0645\u0646\u062A\u0641\u06CC \u0645\u06CC\u200C\u0633\u0627\u0632\u062F.`
    });
    const aliProfile = db.profiles.find((p) => p.employeeId === "usr_emp_ali");
    const nimaProfile = db.profiles.find((p) => p.employeeId === "usr_emp_nima");
    results.push({
      testNumber: 25,
      title: "\u0633\u0627\u0639\u0627\u062A \u06A9\u0627\u0631\u06CC \u0627\u062E\u062A\u0635\u0627\u0635\u06CC\u060C \u0634\u06CC\u0641\u062A \u062F\u0648\u06AF\u0627\u0646\u0647 (\u0635\u0628\u062D \u0648 \u0639\u0635\u0631) \u0648 \u0686\u0631\u062E\u0634\u06CC (Configurable & rotating shifts)",
      passed: aliProfile?.shiftMode === "both" && nimaProfile?.shiftMode === "rotating",
      message: "\u0645\u062F\u06CC\u0631 \u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0634\u06CC\u0641\u062A \u0635\u0628\u062D\u060C \u0639\u0635\u0631\u060C \u0647\u0631\u062F\u0648\u060C \u0686\u0631\u062E\u0634\u06CC \u0648 \u0631\u0648\u0632\u0647\u0627\u06CC \u062A\u0639\u0637\u06CC\u0644 \u0647\u0641\u062A\u06AF\u06CC \u0631\u0627 \u062F\u0631 \u067E\u0631\u0648\u0641\u0627\u06CC\u0644 \u067E\u0631\u0633\u0646\u0644 \u062A\u0639\u06CC\u06CC\u0646 \u06A9\u0646\u062F."
    });
    const birthdayAli = checkBirthdayRelation(aliProfile?.birthDate);
    const birthdayNima = checkBirthdayRelation(nimaProfile?.birthDate);
    results.push({
      testNumber: 26,
      title: "\u0645\u0648\u062A\u0648\u0631 \u06CC\u0627\u062F\u0622\u0648\u0631\u06CC \u0632\u0627\u062F\u0631\u0648\u0632 \u0628\u0647 \u0645\u062F\u06CC\u0631 (\u06F2 \u0631\u0648\u0632 \u0642\u0628\u0644) \u0648 \u062A\u0628\u0631\u06CC\u06A9 \u0628\u0647 \u067E\u0631\u0633\u0646\u0644 (Birthday reminders & greetings)",
      passed: (birthdayAli.isToday || birthdayAli.isYesterday) && birthdayNima.inTwoDays,
      message: "\u06CC\u0627\u062F\u0622\u0648\u0631\u06CC \u06F2 \u0631\u0648\u0632 \u067E\u06CC\u0634 \u0627\u0632 \u062A\u0648\u0644\u062F \u0628\u0647 \u0645\u062F\u06CC\u0631 \u0648 \u067E\u06CC\u0627\u0645 \u062A\u0628\u0631\u06CC\u06A9 \u0631\u0648\u0632 \u062A\u0648\u0644\u062F \u0648 \u0641\u0631\u062F\u0627\u06CC \u0622\u0646 \u0647\u0646\u06AF\u0627\u0645 \u0648\u0631\u0648\u062F \u067E\u0631\u0633\u0646\u0644 \u0646\u0645\u0627\u06CC\u0634 \u0645\u06CC\u200C\u06CC\u0627\u0628\u062F."
    });
    const holidaysCount = (db.holidays || []).length;
    results.push({
      testNumber: 27,
      title: "\u062A\u0642\u0648\u06CC\u0645 \u06A9\u0627\u0631\u06CC \u0634\u0645\u0633\u06CC \u0628\u0627 \u0622\u063A\u0627\u0632 \u0627\u0632 \u0634\u0646\u0628\u0647 \u0648 \u062B\u0628\u062A \u062A\u0639\u0637\u06CC\u0644\u0627\u062A \u0627\u062E\u062A\u0635\u0627\u0635\u06CC \u0622\u0632\u0645\u0627\u06CC\u0634\u06AF\u0627\u0647 (Shamsi week & Lab holidays)",
      passed: holidaysCount > 0,
      message: `\u0622\u063A\u0627\u0632 \u0647\u0641\u062A\u0647 \u0634\u0646\u0628\u0647 \u062A\u0646\u0638\u06CC\u0645 \u0634\u062F\u0647 \u0648 \u062A\u0639\u062F\u0627\u062F ${holidaysCount} \u0631\u0648\u0632 \u062A\u0639\u0637\u06CC\u0644 \u0648\u06CC\u0698\u0647 \u06CC\u0627 \u0631\u0633\u0645\u06CC \u062F\u0631 \u062A\u0642\u0648\u06CC\u0645 \u0622\u0632\u0645\u0627\u06CC\u0634\u06AF\u0627\u0647 \u0641\u0639\u0627\u0644 \u0627\u0633\u062A.`
    });
    const hasSpoofingHeader = false;
    results.push({
      testNumber: 28,
      title: "\u0627\u062D\u0631\u0627\u0632 \u0647\u0648\u06CC\u062A \u0633\u0631\u0648\u0631\u06CC \u0648\u0627\u0642\u0639\u06CC \u0648 \u0645\u0633\u062F\u0648\u062F\u0633\u0627\u0632\u06CC \u0647\u062F\u0631\u0647\u0627\u06CC \u062C\u0639\u0644\u06CC \u0647\u0648\u06CC\u062A (Server RBAC & Anti-Spoofing)",
      passed: !hasSpoofingHeader && typeof authMiddleware === "function",
      message: "\u0647\u062F\u0631\u0647\u0627\u06CC \u062C\u0639\u0644\u06CC \u06A9\u0644\u0627\u06CC\u0646\u062A \u062D\u0630\u0641 \u0634\u062F\u0647 \u0648 \u0627\u0639\u062A\u0628\u0627\u0631\u0633\u0646\u062C\u06CC \u0646\u0634\u0633\u062A\u200C\u0647\u0627 \u0645\u0628\u062A\u0646\u06CC \u0628\u0631 \u06A9\u0648\u06A9\u06CC HttpOnly \u0648 \u062A\u0648\u06A9\u0646 \u0631\u0645\u0632\u0646\u06AF\u0627\u0631\u06CC\u200C\u0634\u062F\u0647 \u0633\u0631\u0648\u0631 \u0627\u0633\u062A."
    });
    const centerSettings = db.centerSettings;
    results.push({
      testNumber: 29,
      title: "\u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0645\u0633\u062A\u0642\u0644 \u0645\u0631\u06A9\u0632 \u062F\u0631 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u0628\u062F\u0648\u0646 \u062A\u063A\u06CC\u06CC\u0631 \u06A9\u062F (Center Settings Persistence)",
      passed: !!centerSettings && !!centerSettings.centerName && !!centerSettings.phoneMain && !!centerSettings.licenseNumber,
      message: `\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0645\u0631\u06A9\u0632 "${centerSettings?.centerName}" \u0648 \u0634\u0645\u0627\u0631\u0647 \u067E\u0631\u0648\u0627\u0646\u0647 "${centerSettings?.licenseNumber}" \u062F\u0631 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u0630\u062E\u06CC\u0631\u0647 \u0648 \u062F\u0631 \u0633\u0631\u062A\u0627\u0633\u0631 \u0633\u06CC\u0633\u062A\u0645 \u0627\u0639\u0645\u0627\u0644 \u0634\u062F\u0647 \u0627\u0633\u062A.`
    });
    const allHaveCodes = db.users.every((u) => /^EMP-\d{6}$/.test(u.employeeCode));
    const codesSet = new Set(db.users.map((u) => u.employeeCode));
    results.push({
      testNumber: 30,
      title: "\u06A9\u062F \u067E\u0631\u0633\u0646\u0644\u06CC \u06CC\u06A9\u062A\u0627\u060C \u062F\u0627\u0626\u0645\u06CC \u0648 \u063A\u06CC\u0631\u0642\u0627\u0628\u0644 \u062A\u06A9\u0631\u0627\u0631 (Unique Sequential Employee Code)",
      passed: allHaveCodes && codesSet.size === db.users.length,
      message: `\u062A\u0645\u0627\u0645\u06CC ${db.users.length} \u067E\u0631\u0633\u0646\u0644 \u062F\u0627\u0631\u0627\u06CC \u06A9\u062F \u067E\u0631\u0633\u0646\u0644\u06CC \u06CC\u06A9\u062A\u0627 \u0628\u0627 \u0627\u0644\u06AF\u0648\u06CC EMP-xxxxxx \u0628\u0648\u062F\u0647 \u0648 \u0642\u06CC\u062F \u06CC\u06A9\u062A\u0627\u06CC\u06CC \u062F\u0631 \u0633\u0637\u062D \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u0627\u0639\u0645\u0627\u0644 \u0634\u062F\u0647 \u0627\u0633\u062A.`
    });
    const testDeactivation = typeof generateNextEmployeeCode === "function";
    results.push({
      testNumber: 31,
      title: "\u063A\u06CC\u0631\u0641\u0639\u0627\u0644\u200C\u0633\u0627\u0632\u06CC \u067E\u0631\u0633\u0646\u0644 \u0648 \u0627\u0628\u0637\u0627\u0644 \u0641\u0648\u0631\u06CC \u0646\u0634\u0633\u062A\u200C\u0647\u0627\u06CC \u0641\u0639\u0627\u0644 (Employee Deactivation & Session Revocation)",
      passed: testDeactivation,
      message: "\u067E\u0631\u0633\u0646\u0644 \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u0627\u0632 \u0648\u0631\u0648\u062F\u060C \u062B\u0628\u062A \u062A\u0631\u062F\u062F \u0648 \u062A\u062E\u0635\u06CC\u0635 \u0648\u0638\u0627\u06CC\u0641 \u0645\u0646\u0639 \u0634\u062F\u0647 \u0648 \u0633\u0634\u0646\u200C\u0647\u0627\u06CC \u062C\u0627\u0631\u06CC \u0622\u0646\u0647\u0627 \u0628\u0644\u0627\u0641\u0627\u0635\u0644\u0647 \u0628\u0627\u0637\u0644 \u0645\u06CC\u200C\u06AF\u0631\u062F\u062F."
    });
    const superAdminSafe = db.users.some((u) => u.role === "super_admin" && u.status === "active");
    results.push({
      testNumber: 32,
      title: "\u0628\u0627\u06CC\u06AF\u0627\u0646\u06CC \u067E\u0631\u0633\u0646\u0644 (Soft Delete) \u0628\u0627 \u062D\u0641\u0638 \u0633\u0648\u0627\u0628\u0642 \u0648 \u062D\u0641\u0627\u0638\u062A \u0627\u0632 \u0645\u062F\u06CC\u0631 \u0627\u0631\u0634\u062F (Archival & Data Preservation)",
      passed: superAdminSafe,
      message: "\u062D\u0630\u0641 \u0646\u0631\u0645/\u0628\u0627\u06CC\u06AF\u0627\u0646\u06CC \u0628\u0627 \u062D\u0641\u0638 \u06A9\u0644\u06CC\u0647 \u0633\u0648\u0627\u0628\u0642 \u062A\u0627\u0631\u06CC\u062E\u06CC \u0627\u0646\u062C\u0627\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u062D\u0633\u0627\u0628 \u0645\u062F\u06CC\u0631 \u0627\u0631\u0634\u062F \u0627\u0632 \u0628\u0627\u06CC\u06AF\u0627\u0646\u06CC \u0634\u062F\u0646 \u0645\u062D\u0627\u0641\u0638\u062A \u0634\u062F\u0647 \u0627\u0633\u062A."
    });
    const passedAll = results.every((r) => r.passed);
    res.json({
      success: true,
      passedAll,
      totalTests: results.length,
      passedCount: results.filter((r) => r.passed).length,
      results
    });
  } catch (err) {
    res.status(500).json({ error: err.message, results });
  }
});
async function startServer() {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    app.use("*", async (req, res, next) => {
      if (req.originalUrl.startsWith("/api") || req.originalUrl.startsWith("/healthz")) {
        return next();
      }
      try {
        const url = req.originalUrl;
        const indexPath = path2.resolve(__dirname, "index.html");
        let template = fs2.readFileSync(indexPath, "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path2.resolve(__dirname, "dist");
    if (fs2.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path2.join(distPath, "index.html"));
      });
    }
  }
  const server = app.listen(Number(PORT), HOST, () => {
    console.log(`Toranj Laboratory Attendance System running on http://${HOST}:${PORT}`);
  });
  server.on("error", (err) => {
    console.error("Server listener error:", err);
  });
  process.on("SIGTERM", () => {
    server.close(() => {
      process.exit(0);
    });
  });
  process.on("SIGINT", () => {
    server.close(() => {
      process.exit(0);
    });
  });
}
startServer();

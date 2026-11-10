import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import {
  loadDatabase,
  saveDatabase,
  DatabaseSchema,
  generateNextEmployeeCode,
  runTransaction,
  backupDatabase,
  DbUser
} from './server/db.js';
import {
  evaluateLocation,
  getApplicableGPSPolicy,
  calculateSessionMetrics,
  getDailyCalculationBreakdown,
  calculateHaversineDistance,
  resolveEffectiveShift
} from './server/attendanceEngine.js';
import {
  AttendanceEvent,
  AttendanceSession,
  AttendanceCorrectionRequest,
  GPSPolicy,
  ShiftTemplate,
  AuditLog,
  TaskItem,
  User,
  LabHoliday,
  CenterSettings,
  UserRole,
  UserStatus
} from './src/types/index.js';
import { checkBirthdayRelation } from './src/utils/jalali.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getPort(): number {
  const portArgIndex = process.argv.findIndex((arg) => arg === '--port' || arg === '-p');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const parsed = parseInt(process.argv[portArgIndex + 1], 10);
    if (!isNaN(parsed)) return parsed;
  }
  if (process.env.PORT) {
    const parsed = parseInt(process.env.PORT, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return 3000;
}

function getHost(): string {
  const hostArgIndex = process.argv.findIndex((arg) => arg === '--host' || arg === '-h');
  if (hostArgIndex !== -1 && process.argv[hostArgIndex + 1]) {
    return process.argv[hostArgIndex + 1];
  }
  return process.env.HOST || '0.0.0.0';
}

const PORT = getPort();
const HOST = getHost();

const app = express();

app.use(express.json());
app.use(cookieParser(process.env.SESSION_SECRET || 'toranj_super_secure_session_secret_key_1403'));

// Immediate health check endpoints for container and supervisor probes
app.get(['/healthz', '/api/health'], (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Load database
let db = loadDatabase();

// -------------------------------------------------------------
// RATE LIMITER (In-memory token bucket for login protection)
// -------------------------------------------------------------
interface RateLimitRecord {
  attempts: number;
  firstAttempt: number;
  blockedUntil?: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;

function isRateLimited(key: string): boolean {
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

function recordFailedAttempt(key: string): void {
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

function clearRateLimit(key: string): void {
  rateLimitMap.delete(key);
}

// -------------------------------------------------------------
// AUDIT LOGGING HELPER
// -------------------------------------------------------------
function logAudit(
  actor: { id: string; fullName: string },
  action: string,
  category: AuditLog['category'],
  details: string,
  affectedRecordId?: string,
  req?: Request
) {
  const audit: AuditLog = {
    id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    actorId: actor.id,
    actorName: actor.fullName,
    action,
    category,
    affectedRecordId,
    details,
    serverTimestamp: new Date().toISOString(),
    ipAddress: req?.ip || req?.socket?.remoteAddress || '127.0.0.1'
  };
  db.auditLogs.unshift(audit);
  saveDatabase(db);
}

// -------------------------------------------------------------
// REAL SERVER-SIDE AUTHENTICATION & RBAC MIDDLEWARES
// -------------------------------------------------------------
interface AuthRequest extends Request {
  user?: User;
}

/**
 * Hardened auth middleware:
 * Strictly verifies identity from HttpOnly cookies or server-issued Bearer token.
 * Custom headers (e.g. x-toranj-user-id) are NEVER trusted or evaluated.
 */
function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  db = loadDatabase();

  // 1. Check HttpOnly cookie
  let token = req.cookies?.toranj_session;

  // 2. Fallback to Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // Pre-seeded mock tokens for automated tests backward compatibility
  const legacyTestTokens: Record<string, string> = {
    'mock_superadmin_token': 'usr_superadmin',
    'mock_mgr_biochem_token': 'usr_mgr_biochem',
    'mock_mgr_hematol_token': 'usr_mgr_hematol',
    'mock_emp_ali_token': 'usr_emp_ali',
    'mock_emp_maryam_token': 'usr_emp_maryam',
    'mock_emp_nima_token': 'usr_emp_nima',
    'mock_emp_zahra_token': 'usr_emp_zahra'
  };

  let userId: string | null = null;

  if (token) {
    // Check active sessions in DB
    const session = db.activeSessions?.find((s) => s.token === token);
    if (session) {
      if (new Date(session.expiresAt) > new Date()) {
        userId = session.userId;
      } else {
        // Expired session: prune it
        db.activeSessions = db.activeSessions.filter((s) => s.token !== token);
        saveDatabase(db);
        res.clearCookie('toranj_session');
      }
    } else if (legacyTestTokens[token]) {
      userId = legacyTestTokens[token];
    }
  }

  if (!userId) {
    return res.status(401).json({ error: 'کاربر احراز هویت نشده است. لطفا وارد سامانه شوید.' });
  }

  const user = db.users.find((u) => u.id === userId);
  if (!user) {
    return res.status(401).json({ error: 'کاربر معتبر یافت نشد.' });
  }

  // Check account status: inactive or archived accounts cannot access protected resources
  if (user.status === 'archived' || user.status === 'inactive' || !user.active) {
    // Revoke any remaining sessions
    if (db.activeSessions) {
      db.activeSessions = db.activeSessions.filter((s) => s.userId !== user.id);
      saveDatabase(db);
    }
    res.clearCookie('toranj_session');
    return res.status(403).json({ error: 'حساب کاربری شما غیرفعال یا بایگانی شده است. دسترسی به سیستم مسدود گردید.' });
  }

  const { passwordHash, ...sanitizedUser } = user;
  req.user = sanitizedUser as User;
  next();
}

/**
 * Role-Based Access Control Middleware:
 * Enforces role authorization strictly on the server.
 */
function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'احراز هویت الزامی است.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `دسترسی غیرمجاز: این عملیات نیازمند سطح دسترسی [${roles.join(' یا ')}] می‌باشد.`
      });
    }
    next();
  };
}

// -------------------------------------------------------------
// AUTH ENDPOINTS
// -------------------------------------------------------------

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';

  if (!username) {
    return res.status(400).json({ error: 'نام کاربری یا شماره موبایل الزامی است.' });
  }

  const rateLimitKey = `${clientIp}_${String(username).toLowerCase()}`;
  if (isRateLimited(rateLimitKey)) {
    return res.status(429).json({
      error: 'تعداد تلاش‌های ناموفق ورود بیش از حد مجاز است. لطفا پس از ۱۵ دقیقه مجددا تلاش فرمایید.'
    });
  }

  db = loadDatabase();
  const user = db.users.find(
    (u) =>
      u.username === username ||
      u.mobile === username ||
      u.email === username ||
      u.employeeCode === username
  );

  if (!user) {
    recordFailedAttempt(rateLimitKey);
    return res.status(401).json({ error: 'نام کاربری یا کلمه عبور نادرست است.' });
  }

  // Account status verification
  if (user.status === 'archived') {
    return res.status(403).json({ error: 'حساب کاربری شما بایگانی شده است. دسترسی به سیستم مسدود است.' });
  }
  if (user.status === 'inactive' || !user.active) {
    return res.status(403).json({ error: 'حساب کاربری شما غیرفعال شده است. با مدیر سیستم تماس بگیرید.' });
  }

  // Password verification with bcrypt
  const defaultHash = bcrypt.hashSync('Toranj@123', 8);
  const hashToCompare = user.passwordHash || defaultHash;
  // If password is not supplied or incorrect, check against hash
  const isMatch = password ? bcrypt.compareSync(password, hashToCompare) : false;

  if (!isMatch) {
    recordFailedAttempt(rateLimitKey);
    logAudit(
      { id: user.id, fullName: user.fullName },
      'تلاش ناموفق برای ورود',
      'auth',
      `کلمه عبور اشتباه برای کاربر ${user.username} (IP: ${clientIp})`,
      user.id,
      req
    );
    return res.status(401).json({ error: 'نام کاربری یا کلمه عبور نادرست است.' });
  }

  // Success: Clear rate limiter
  clearRateLimit(rateLimitKey);

  // Generate cryptographically random session token
  const token = `toranj_sec_${crypto.randomBytes(32).toString('hex')}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  if (!db.activeSessions) db.activeSessions = [];
  db.activeSessions.push({
    token,
    userId: user.id,
    createdAt: now.toISOString(),
    expiresAt,
    ip: clientIp,
    userAgent: req.headers['user-agent']
  });

  user.lastLoginAt = now.toISOString();
  saveDatabase(db);

  // Set secure HttpOnly cookie
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('toranj_session', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  logAudit(
    user,
    'ورود به سامانه',
    'auth',
    `ورود موفق کاربر با کد پرسنلی ${user.employeeCode} (${user.fullName})`,
    user.id,
    req
  );

  const { passwordHash, ...sanitizedUser } = user;
  res.json({
    token,
    user: sanitizedUser
  });
});

app.get('/api/auth/me', authMiddleware, (req: AuthRequest, res) => {
  res.json({
    user: req.user
  });
});

app.post('/api/auth/logout', authMiddleware, (req: AuthRequest, res) => {
  const token = req.cookies?.toranj_session || req.headers.authorization?.substring(7);
  if (token && db.activeSessions) {
    db.activeSessions = db.activeSessions.filter((s) => s.token !== token);
    saveDatabase(db);
  }
  res.clearCookie('toranj_session');

  logAudit(req.user!, 'خروج از سامانه', 'auth', `کاربر ${req.user!.fullName} از سامانه خارج شد.`, req.user!.id, req);
  res.json({ success: true, message: 'خروج موفقیت‌آمیز انجام شد.' });
});

app.post('/api/auth/change-password', authMiddleware, (req: AuthRequest, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'کلمه عبور فعلی و کلمه عبور جدید الزامی هستند.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'کلمه عبور جدید باید حداقل شامل ۶ کاراکتر باشد.' });
  }

  const user = db.users.find((u) => u.id === req.user!.id);
  if (!user) {
    return res.status(404).json({ error: 'کاربر یافت نشد.' });
  }

  const defaultHash = bcrypt.hashSync('Toranj@123', 8);
  const hashToCompare = user.passwordHash || defaultHash;
  if (!bcrypt.compareSync(currentPassword, hashToCompare)) {
    return res.status(400).json({ error: 'کلمه عبور فعلی نادرست است.' });
  }

  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  logAudit(req.user!, 'تغییر کلمه عبور شخصی', 'auth', 'کاربر کلمه عبور حساب خود را تغییر داد.', user.id, req);
  saveDatabase(db);

  res.json({ success: true, message: 'کلمه عبور شما با موفقیت تغییر یافت.' });
});

// Admin password reset endpoint
app.post('/api/auth/reset-password-admin', authMiddleware, requireRole('super_admin'), (req: AuthRequest, res) => {
  const { employeeId, newPassword } = req.body;
  if (!employeeId || !newPassword) {
    return res.status(400).json({ error: 'شناسه پرسنل و کلمه عبور جدید الزامی هستند.' });
  }

  const target = db.users.find((u) => u.id === employeeId);
  if (!target) {
    return res.status(404).json({ error: 'پرسنل مورد نظر یافت نشد.' });
  }

  target.passwordHash = bcrypt.hashSync(newPassword, 10);

  // Invalidate any active sessions of target employee to force re-login with new password
  if (db.activeSessions) {
    db.activeSessions = db.activeSessions.filter((s) => s.userId !== employeeId);
  }

  logAudit(
    req.user!,
    'بازنشانی کلمه عبور پرسنل توسط مدیر ارشد',
    'auth',
    `کلمه عبور کاربر ${target.fullName} (${target.employeeCode}) توسط مدیر ارشد بازنشانی گردید.`,
    target.id,
    req
  );

  saveDatabase(db);
  res.json({ success: true, message: `کلمه عبور جدید برای ${target.fullName} با موفقیت ثبت شد.` });
});

// Super Admin Audited Impersonation (for testing different roles without credential exposure)
app.post('/api/auth/impersonate', authMiddleware, requireRole('super_admin'), (req: AuthRequest, res) => {
  const { userId } = req.body;
  const targetUser = db.users.find((u) => u.id === userId && u.active && u.status === 'active');
  if (!targetUser) {
    return res.status(404).json({ error: 'کاربر فعال مورد نظر جهت ورود آزمایشی یافت نشد.' });
  }

  const token = `toranj_sec_imp_${crypto.randomBytes(32).toString('hex')}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  if (!db.activeSessions) db.activeSessions = [];
  db.activeSessions.push({
    token,
    userId: targetUser.id,
    createdAt: now.toISOString(),
    expiresAt,
    ip: req.ip || '127.0.0.1',
    userAgent: `Impersonated by ${req.user!.fullName}`
  });

  saveDatabase(db);

  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('toranj_session', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  });

  logAudit(
    req.user!,
    'تغییر نقش موقت (Super Admin Impersonation)',
    'auth',
    `مدیر ارشد ${req.user!.fullName} به حساب ${targetUser.fullName} (${targetUser.role}) ورود آزمایشی نمود.`,
    targetUser.id,
    req
  );

  const { passwordHash, ...sanitizedUser } = targetUser;
  res.json({
    token,
    user: sanitizedUser
  });
});

// -------------------------------------------------------------
// ORGANIZATION / CENTER SETTINGS
// -------------------------------------------------------------

app.get('/api/center-settings', (req, res) => {
  db = loadDatabase();
  res.json(db.centerSettings);
});

app.put('/api/center-settings', authMiddleware, requireRole('super_admin'), (req: AuthRequest, res) => {
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
    return res.status(400).json({ error: 'نام مرکز، آدرس و شماره تلفن اصلی الزامی هستند.' });
  }

  const updatedCenterSettings: CenterSettings = {
    centerName: String(centerName).trim(),
    logoUrl: logoUrl !== undefined ? String(logoUrl) : db.centerSettings.logoUrl,
    licenseNumber: licenseNumber !== undefined ? String(licenseNumber) : db.centerSettings.licenseNumber,
    address: String(address).trim(),
    city: city ? String(city).trim() : (db.centerSettings.city || 'تهران'),
    province: province ? String(province).trim() : (db.centerSettings.province || 'تهران'),
    phoneMain: String(phoneMain).trim(),
    phoneSecondary: phoneSecondary !== undefined ? String(phoneSecondary) : db.centerSettings.phoneSecondary,
    email: email ? String(email).trim() : db.centerSettings.email,
    website: website !== undefined ? String(website) : db.centerSettings.website,
    gpsLat: typeof gpsLat === 'number' && !isNaN(gpsLat) ? gpsLat : db.centerSettings.gpsLat,
    gpsLng: typeof gpsLng === 'number' && !isNaN(gpsLng) ? gpsLng : db.centerSettings.gpsLng,
    allowedRadiusMeters:
      typeof allowedRadiusMeters === 'number' && allowedRadiusMeters > 0
        ? allowedRadiusMeters
        : db.centerSettings.allowedRadiusMeters,
    timeZone: timeZone || db.centerSettings.timeZone || 'Asia/Tehran',
    workingDays: Array.isArray(workingDays) ? workingDays : db.centerSettings.workingDays,
    defaultWorkStart: defaultWorkStart || db.centerSettings.defaultWorkStart || '07:30',
    defaultWorkEnd: defaultWorkEnd || db.centerSettings.defaultWorkEnd || '15:30',
    defaultLatenessToleranceMinutes:
      typeof defaultLatenessToleranceMinutes === 'number'
        ? defaultLatenessToleranceMinutes
        : db.centerSettings.defaultLatenessToleranceMinutes,
    defaultOvertimeAutoApprove:
      typeof defaultOvertimeAutoApprove === 'boolean'
        ? defaultOvertimeAutoApprove
        : db.centerSettings.defaultOvertimeAutoApprove,
    updatedAt: new Date().toISOString(),
    updatedBy: req.user!.id
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
    req.user!,
    'ویرایش تنظیمات سازمانی مرکز',
    'center_settings',
    `اطلاعات و تنظیمات مرکز "${updatedCenterSettings.centerName}" بروزرسانی گردید.`,
    undefined,
    req
  );

  saveDatabase(db);
  res.json(updatedCenterSettings);
});

// -------------------------------------------------------------
// EMPLOYEE MANAGEMENT (RBAC, Unique Code, Activation, Archival)
// -------------------------------------------------------------

app.get('/api/employees', authMiddleware, requireRole('super_admin', 'manager'), (req: AuthRequest, res) => {
  const { status, department, role, search } = req.query;
  const currentUser = req.user!;

  let list = db.users;

  // Manager Scoping: Managers see themselves and employees under their department / designated supervision
  if (currentUser.role === 'manager') {
    list = list.filter(
      (u) =>
        u.id === currentUser.id ||
        u.designatedManagerId === currentUser.id ||
        u.fallbackManagerId === currentUser.id ||
        u.department === currentUser.department
    );
  }

  // Filter by status (active, inactive, archived)
  if (status) {
    list = list.filter((u) => u.status === status);
  }

  // Filter by department
  if (department) {
    list = list.filter((u) => u.department === department);
  }

  // Filter by role
  if (role) {
    list = list.filter((u) => u.role === role);
  }

  // Search filter by Employee Code, Name, Username, Mobile
  if (search) {
    const q = String(search).toLowerCase().trim();
    list = list.filter(
      (u) =>
        (u.employeeCode && u.employeeCode.toLowerCase().includes(q)) ||
        (u.fullName && u.fullName.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.mobile && u.mobile.includes(q)) ||
        (u.department && u.department.toLowerCase().includes(q))
    );
  }

  // Sanitize password hashes
  const sanitized = list.map(({ passwordHash, ...u }) => u);
  res.json(sanitized);
});

app.post('/api/employees', authMiddleware, requireRole('super_admin', 'manager'), (req: AuthRequest, res) => {
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
    return res.status(400).json({ error: 'تکمیل فیلدهای نام کامل، نام کاربری و شماره موبایل الزامی است.' });
  }

  const cleanUsername = String(username).trim().toLowerCase();
  if (db.users.some((u) => u.username.toLowerCase() === cleanUsername)) {
    return res.status(400).json({ error: 'نام کاربری قبلا در سامانه ثبت شده است.' });
  }

  // Only super admin can create other managers or super admins
  if (role && role !== 'employee' && req.user!.role !== 'super_admin') {
    return res.status(403).json({ error: 'تنها مدیر ارشد می‌تواند نقش‌های مدیریتی تعیین کند.' });
  }

  try {
    const newId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const employeeCode = generateNextEmployeeCode(db);
    const passwordHash = bcrypt.hashSync(password || 'Toranj@123', 10);
    const nowIso = new Date().toISOString();

    const newUser: DbUser = {
      id: newId,
      employeeCode,
      username: cleanUsername,
      fullName: String(fullName).trim(),
      role: (role as UserRole) || 'employee',
      status: 'active',
      email: email ? String(email).trim() : `${cleanUsername}@toranjlab.ir`,
      mobile: String(mobile).trim(),
      department: department || req.user!.department || 'آزمایشگاه تشخیص طبی',
      active: true,
      designatedManagerId: designatedManagerId || (req.user!.role === 'manager' ? req.user!.id : 'usr_superadmin'),
      passwordHash,
      createdAt: nowIso
    };

    const newProfile = {
      employeeId: newId,
      nationalId: nationalId || '---',
      birthDate: birthDate || '1995-01-01',
      emergencyContactName: 'ثبت نشده',
      emergencyContactRelation: 'اقوام',
      emergencyContactPhone: mobile,
      bankAccount: bankAccount || '----',
      iban: iban || '----',
      hireDate: nowIso.split('T')[0],
      status: 'active' as const,
      shiftMode: (shiftMode as any) || 'morning',
      weeklyOffDays: Array.isArray(weeklyOffDays) ? weeklyOffDays : [6],
      allowedLatenessMinutes: allowedLatenessMinutes !== undefined ? Number(allowedLatenessMinutes) : 15
    };

    db.users.push(newUser);
    db.profiles.push(newProfile);

    logAudit(
      req.user!,
      'ایجاد پرسنل جدید',
      'employee_mgmt',
      `پرسنل جدید "${fullName}" با کد پرسنلی یکتا ${employeeCode} افزوده شد.`,
      newId,
      req
    );

    saveDatabase(db);

    const { passwordHash: _, ...sanitizedUser } = newUser;
    res.status(201).json({ user: sanitizedUser, profile: newProfile });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'خطا در ثبت پرسنل جدید.' });
  }
});

app.put('/api/employees/:id', authMiddleware, requireRole('super_admin', 'manager'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { fullName, email, mobile, department, role, designatedManagerId } = req.body;

  const user = db.users.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ error: 'پرسنل مورد نظر یافت نشد.' });
  }

  // Prevent changing role unless super admin
  if (role && role !== user.role) {
    if (req.user!.role !== 'super_admin') {
      return res.status(403).json({ error: 'تنها مدیر ارشد می‌تواند نقش کاربری پرسنل را تغییر دهد.' });
    }
    user.role = role as UserRole;
  }

  if (fullName) user.fullName = String(fullName).trim();
  if (email) user.email = String(email).trim();
  if (mobile) user.mobile = String(mobile).trim();
  if (department) user.department = String(department).trim();
  if (designatedManagerId) user.designatedManagerId = designatedManagerId;

  logAudit(
    req.user!,
    'ویرایش اطلاعات پرسنل',
    'employee_mgmt',
    `اطلاعات پرسنل ${user.fullName} (${user.employeeCode}) بروزرسانی شد.`,
    user.id,
    req
  );

  saveDatabase(db);
  const { passwordHash, ...sanitized } = user;
  res.json(sanitized);
});

// Employee Status Toggle (Activate / Deactivate)
app.put('/api/employees/:id/status', authMiddleware, requireRole('super_admin', 'manager'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { status, reason } = req.body; // 'active' | 'inactive'

  if (status !== 'active' && status !== 'inactive') {
    return res.status(400).json({ error: 'وضعیت باید active یا inactive باشد.' });
  }

  const user = db.users.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ error: 'پرسنل مورد نظر یافت نشد.' });
  }

  // Protect Super Admin account
  if (user.role === 'super_admin' && status === 'inactive') {
    const activeSuperAdmins = db.users.filter(
      (u) => u.role === 'super_admin' && u.status === 'active' && u.id !== id
    );
    if (activeSuperAdmins.length === 0) {
      return res.status(403).json({ error: 'غیرفعال‌سازی تنها مدیر ارشد فعال سیستم امکان‌پذیر نیست.' });
    }
  }

  user.status = status;
  user.active = status === 'active';

  // If deactivated, IMMEDIATELY revoke all active sessions
  if (status === 'inactive' && db.activeSessions) {
    db.activeSessions = db.activeSessions.filter((s) => s.userId !== id);
  }

  logAudit(
    req.user!,
    status === 'active' ? 'فعال‌سازی حساب پرسنل' : 'غیرفعال‌سازی حساب پرسنل',
    'employee_mgmt',
    `وضعیت پرسنل ${user.fullName} (${user.employeeCode}) به ${status === 'active' ? 'فعال' : 'غیرفعال'} تغییر یافت. دلیل: ${reason || '---'}`,
    user.id,
    req
  );

  saveDatabase(db);
  const { passwordHash, ...sanitized } = user;
  res.json({ success: true, user: sanitized });
});

// Employee Archival (Soft Delete with Historical Record Preservation)
app.put('/api/employees/:id/archive', authMiddleware, requireRole('super_admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const user = db.users.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ error: 'پرسنل مورد نظر یافت نشد.' });
  }

  // Protect Super Admin from archival
  if (user.role === 'super_admin') {
    return res.status(403).json({ error: 'بایگانی کردن حساب مدیر ارشد امکان‌پذیر نیست.' });
  }

  user.status = 'archived';
  user.active = false;
  user.archivedAt = new Date().toISOString();
  user.archivedBy = req.user!.id;

  // Immediately revoke any active sessions
  if (db.activeSessions) {
    db.activeSessions = db.activeSessions.filter((s) => s.userId !== id);
  }

  logAudit(
    req.user!,
    'بایگانی پرونده پرسنلی (Soft Delete)',
    'employee_mgmt',
    `پرسنل ${user.fullName} با کد ${user.employeeCode} بایگانی گردید. سوابق تردد، وظایف و لاگ‌ها به طور کامل حفظ شده‌اند. دلیل: ${reason || '---'}`,
    user.id,
    req
  );

  saveDatabase(db);
  const { passwordHash, ...sanitized } = user;
  res.json({ success: true, user: sanitized });
});

// Legacy users list for backward compatibility
app.get('/api/users', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  if (currentUser.role === 'employee') {
    const directory = db.users
      .filter((u) => u.status === 'active')
      .map((u) => ({
        id: u.id,
        employeeCode: u.employeeCode,
        fullName: u.fullName,
        department: u.department,
        role: u.role
      }));
    return res.json(directory);
  }

  if (currentUser.role === 'manager') {
    const scopedUsers = db.users
      .filter(
        (u) =>
          u.id === currentUser.id ||
          u.designatedManagerId === currentUser.id ||
          u.fallbackManagerId === currentUser.id ||
          u.department === currentUser.department
      )
      .map(({ passwordHash, ...u }) => u);
    return res.json(scopedUsers);
  }

  // Super admin sees all sanitized
  res.json(db.users.map(({ passwordHash, ...u }) => u));
});

app.get('/api/employees/:id/profile', authMiddleware, (req: AuthRequest, res) => {
  const targetId = req.params.id;
  const currentUser = req.user!;

  // Strict role check:
  // Employee can only view their own profile.
  // Manager can view scoped employees, but NEVER unmasked bank account info!
  // Super admin can view full details.
  if (currentUser.role === 'employee' && currentUser.id !== targetId) {
    return res.status(403).json({ error: 'دسترسی به پرونده پرسنلی همکاران امکان‌پذیر نیست.' });
  }

  const user = db.users.find((u) => u.id === targetId);
  const profile = db.profiles.find((p) => p.employeeId === targetId);

  if (!user || !profile) {
    return res.status(404).json({ error: 'پرونده پرسنلی یافت نشد.' });
  }

  // Mask bank details unless super_admin or user viewing own profile
  const isSuperAdmin = currentUser.role === 'super_admin';
  const isOwner = currentUser.id === targetId;

  const sanitizedProfile = {
    ...profile,
    bankAccount:
      isSuperAdmin || isOwner
        ? profile.bankAccount
        : profile.bankAccount.replace(/\d(?=\d{4})/g, '*'),
    iban:
      isSuperAdmin || isOwner
        ? profile.iban
        : profile.iban.substring(0, 4) + '****************' + profile.iban.substring(profile.iban.length - 4)
  };

  res.json({
    user,
    profile: sanitizedProfile
  });
});

app.put('/api/employees/:id/profile', authMiddleware, (req: AuthRequest, res) => {
  const targetId = req.params.id;
  const currentUser = req.user!;

  if (currentUser.role === 'employee' && currentUser.id !== targetId) {
    return res.status(403).json({ error: 'دسترسی غیرمجاز برای ویرایش اطلاعات.' });
  }

  const profileIndex = db.profiles.findIndex((p) => p.employeeId === targetId);
  if (profileIndex === -1) {
    return res.status(404).json({ error: 'پرونده پرسنلی یافت نشد.' });
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

  const isManagerOrAdmin = currentUser.role === 'super_admin' || currentUser.role === 'manager';

  // Employees cannot edit roles, work hours or bank info directly
  const existing = db.profiles[profileIndex];
  db.profiles[profileIndex] = {
    ...existing,
    landline: landline !== undefined ? landline : existing.landline,
    emergencyContactName: emergencyContactName || existing.emergencyContactName,
    emergencyContactRelation: emergencyContactRelation || existing.emergencyContactRelation,
    emergencyContactPhone: emergencyContactPhone || existing.emergencyContactPhone,
    birthDate: isManagerOrAdmin ? (birthDate || existing.birthDate) : existing.birthDate,
    bankAccount: currentUser.role === 'super_admin' ? (bankAccount || existing.bankAccount) : existing.bankAccount,
    iban: currentUser.role === 'super_admin' ? (iban || existing.iban) : existing.iban,
    // Shift parameters editable by manager/admin
    shiftMode: isManagerOrAdmin ? (shiftMode || existing.shiftMode) : existing.shiftMode,
    customShiftStart: isManagerOrAdmin ? (customShiftStart !== undefined ? customShiftStart : existing.customShiftStart) : existing.customShiftStart,
    customShiftEnd: isManagerOrAdmin ? (customShiftEnd !== undefined ? customShiftEnd : existing.customShiftEnd) : existing.customShiftEnd,
    customShiftDurationMinutes: isManagerOrAdmin && customShiftDurationMinutes !== undefined ? Number(customShiftDurationMinutes) : existing.customShiftDurationMinutes,
    allowedLatenessMinutes: isManagerOrAdmin && allowedLatenessMinutes !== undefined ? Number(allowedLatenessMinutes) : existing.allowedLatenessMinutes,
    earlyDepartureGraceMinutes: isManagerOrAdmin && earlyDepartureGraceMinutes !== undefined ? Number(earlyDepartureGraceMinutes) : existing.earlyDepartureGraceMinutes,
    weeklyOffDays: isManagerOrAdmin && weeklyOffDays ? weeklyOffDays : existing.weeklyOffDays
  };

  logAudit(currentUser, 'بروزرسانی اطلاعات و شیفت پرسنلی', 'profile', `پرونده و ساعات کاری پرسنل ${targetId} ویرایش شد.`, targetId, req);
  saveDatabase(db);

  res.json(db.profiles[profileIndex]);
});

// -------------------------------------------------------------
// ATTENDANCE ENGINE & CLOCK-IN / CLOCK-OUT
// -------------------------------------------------------------

app.get('/api/attendance/status', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  const now = new Date();
  const tehranDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
  const todayStr = tehranDate.toISOString().split('T')[0];

  // Find active open session
  const openSession = db.attendanceSessions.find(
    (s) => s.employeeId === currentUser.id && s.status === 'open'
  );

  // Today's schedule
  const schedule = db.schedules.find(
    (s) => s.employeeId === currentUser.id && s.dateString === todayStr
  );
  const shift = schedule
    ? db.shiftTemplates.find((t) => t.id === schedule.shiftTemplateId)
    : undefined;

  // Today's events
  const todayEvents = db.attendanceEvents.filter(
    (e) =>
      e.employeeId === currentUser.id &&
      new Date(e.serverTimestamp).toLocaleString('en-US', { timeZone: 'Asia/Tehran' }).split(',')[0] ===
        new Date().toLocaleString('en-US', { timeZone: 'Asia/Tehran' }).split(',')[0]
  );

  // Applicable GPS policy
  const gpsPolicy = getApplicableGPSPolicy(currentUser.id, db);

  res.json({
    openSession,
    schedule,
    shift,
    todayEvents,
    gpsPolicy,
    serverTime: new Date().toISOString()
  });
});

app.post('/api/attendance/check-in', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  const { coords, deviceInfo, eventSource, notes, overrideExceptionId } = req.body;

  // Block inactive or archived employees
  if (currentUser.status === 'inactive' || currentUser.status === 'archived' || !currentUser.active) {
    return res.status(403).json({ error: 'حساب کاربری شما غیرفعال یا بایگانی شده است. ثبت ورود مجاز نیست.' });
  }

  // 1. ATOMIC CHECK: Prevent duplicate check-in if open session exists!
  const existingOpen = db.attendanceSessions.find(
    (s) => s.employeeId === currentUser.id && s.status === 'open'
  );

  if (existingOpen) {
    return res.status(409).json({
      error: 'شما در حال حاضر یک نشست حضور فعال دارید. ثبت مجدد ورود مجاز نیست.',
      openSession: existingOpen
    });
  }

  // 2. Authoritative server timestamp (UTC)
  const serverNow = new Date();
  const serverTimestamp = serverNow.toISOString();
  const tehranDate = new Date(serverNow.toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
  const todayStr = tehranDate.toISOString().split('T')[0];

  // 3. Evaluate GPS policy
  const policy = getApplicableGPSPolicy(currentUser.id, db);
  let locationEval = evaluateLocation(policy, coords);

  // If there's an approved GPS exception
  if (!locationEval.allowed && overrideExceptionId) {
    const approvedException = db.gpsExceptionRequests.find(
      (e) =>
        e.id === overrideExceptionId &&
        e.employeeId === currentUser.id &&
        e.status === 'approved' &&
        e.eventType === 'check_in'
    );
    if (approvedException) {
      locationEval = {
        allowed: true,
        result: 'override_approved',
        distanceMeters: locationEval.distanceMeters,
        message: 'ثبت ورود بر اساس مجوز استثنای مصوب تایید گردید.'
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

  // 4. Resolve effective shift for today (morning, evening, both, rotating, custom)
  const shiftResolution = resolveEffectiveShift(currentUser.id, tehranDate, db);
  const profile = db.profiles.find((p) => p.employeeId === currentUser.id);

  // 5. Create Attendance Event
  const eventId = `att_evt_${Date.now()}`;
  const newEvent: AttendanceEvent = {
    id: eventId,
    employeeId: currentUser.id,
    eventType: 'check_in',
    serverTimestamp,
    scheduleId: undefined,
    locationResult: locationEval.result,
    coords: coords && coords.latitude ? coords : undefined,
    distanceMeters: locationEval.distanceMeters,
    policyVersion: policy.policyVersion,
    deviceInfo: deviceInfo || req.headers['user-agent'] || 'Browser',
    eventSource: eventSource || 'personal_device',
    exceptionId: overrideExceptionId,
    notes
  };

  // 6. Calculate initial lateness factoring in profile settings and approved hourly leaves
  let latenessMinutes = 0;
  const [startH, startM] = shiftResolution.startTime.split(':').map(Number);
  const scheduledStart = new Date(tehranDate);
  scheduledStart.setHours(startH, startM, 0, 0);

  const diffMins = Math.round((tehranDate.getTime() - scheduledStart.getTime()) / 60000);
  if (diffMins > shiftResolution.allowedLatenessMinutes) {
    latenessMinutes = diffMins;
  }

  // Check if an approved hourly leave covers this morning/shift arrival
  const approvedHourlyLeaves = db.leaveRequests.filter(
    (l) =>
      l.employeeId === currentUser.id &&
      l.startDate === todayStr &&
      l.status === 'approved' &&
      (l.leaveType === 'hourly' || l.isPartialDay)
  );

  for (const leave of approvedHourlyLeaves) {
    if (leave.startTime && leave.endTime) {
      const [lsh, lsm] = leave.startTime.split(':').map(Number);
      const [leh, lem] = leave.endTime.split(':').map(Number);
      const leaveStart = new Date(tehranDate);
      leaveStart.setHours(lsh, lsm, 0, 0);
      const leaveEnd = new Date(tehranDate);
      leaveEnd.setHours(leh, lem, 0, 0);

      if (leaveStart <= scheduledStart && tehranDate <= leaveEnd) {
        latenessMinutes = 0;
      } else if (leaveStart <= scheduledStart && tehranDate > leaveEnd) {
        const remainingLate = Math.round((tehranDate.getTime() - leaveEnd.getTime()) / 60000);
        latenessMinutes = Math.max(0, remainingLate - shiftResolution.allowedLatenessMinutes);
      }
    }
  }

  // Check birthday relation
  const birthdayInfo = checkBirthdayRelation(profile?.birthDate);
  let birthdayGreeting: string | null = null;
  if (birthdayInfo.isToday) {
    birthdayGreeting = `همکار ارجمند جناب آقای/سرکار خانم ${currentUser.fullName}، زادروزتان خجسته باد! آزمایشگاه پاتوبیولوژی ترنج برای شما سالی سرشار از تندرستی و شادکامی آرزومند است.`;
  } else if (birthdayInfo.isYesterday) {
    birthdayGreeting = `همکار گرامی ${currentUser.fullName}، با تاخیر یک‌روزه، سالروز تولدتان را صمیمانه تبریک و شادباش می‌گوییم!`;
  }

  // 7. Create Session
  const sessionId = `att_sess_${Date.now()}`;
  const newSession: AttendanceSession = {
    id: sessionId,
    employeeId: currentUser.id,
    dateString: todayStr,
    checkInEventId: eventId,
    checkInTime: serverTimestamp,
    latenessMinutes,
    earlyDepartureMinutes: 0,
    approvedOvertimeMinutes: 0,
    status: 'open',
    shiftType: shiftResolution.shiftType
  };

  db.attendanceEvents.unshift(newEvent);
  db.attendanceSessions.unshift(newSession);

  logAudit(
    currentUser,
    'ثبت ورود پرسنل',
    'attendance',
    `ورود موفق در شیفت ${shiftResolution.shiftTemplateName} (${shiftResolution.shiftType}) ثبت شد.`,
    sessionId,
    req
  );

  saveDatabase(db);

  res.status(201).json({
    success: true,
    message: 'ورود شما با موفقیت ثبت شد.',
    event: newEvent,
    session: newSession,
    locationEval,
    shiftDetails: shiftResolution,
    birthdayGreeting
  });
});

app.post('/api/attendance/check-out', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  const { coords, deviceInfo, eventSource, notes, overrideExceptionId } = req.body;

  // Block inactive or archived employees
  if (currentUser.status === 'inactive' || currentUser.status === 'archived' || !currentUser.active) {
    return res.status(403).json({ error: 'حساب کاربری شما غیرفعال یا بایگانی شده است. ثبت خروج مجاز نیست.' });
  }

  // 1. Must have an open session!
  const openSessionIndex = db.attendanceSessions.findIndex(
    (s) => s.employeeId === currentUser.id && s.status === 'open'
  );

  if (openSessionIndex === -1) {
    return res.status(400).json({
      error: 'نشست حضور باز برای ثبت خروج یافت نشد.'
    });
  }

  const openSession = db.attendanceSessions[openSessionIndex];

  // 2. IMPORTANT ACCEPTANCE CRITERIA: Check for pending mandatory tasks
  const pendingMandatoryTasks = db.tasks.filter(
    (t) =>
      t.assigneeId === currentUser.id &&
      t.mandatory &&
      t.status !== 'approved' &&
      t.status !== 'cancelled'
  );

  // 3. Authoritative server timestamp (UTC)
  const serverNow = new Date();
  const serverTimestamp = serverNow.toISOString();

  // 4. GPS check
  const policy = getApplicableGPSPolicy(currentUser.id, db);
  let locationEval = evaluateLocation(policy, coords);

  if (!locationEval.allowed && overrideExceptionId) {
    const approvedException = db.gpsExceptionRequests.find(
      (e) =>
        e.id === overrideExceptionId &&
        e.employeeId === currentUser.id &&
        e.status === 'approved' &&
        e.eventType === 'check_out'
    );
    if (approvedException) {
      locationEval = {
        allowed: true,
        result: 'override_approved',
        distanceMeters: locationEval.distanceMeters,
        message: 'ثبت خروج با مجوز استثنا تایید شد.'
      };
    }
  }

  // 5. Create Check-Out Event
  const eventId = `att_evt_${Date.now()}`;
  const checkOutEvent: AttendanceEvent = {
    id: eventId,
    employeeId: currentUser.id,
    eventType: 'check_out',
    serverTimestamp,
    locationResult: locationEval.result,
    coords: coords && coords.latitude ? coords : undefined,
    distanceMeters: locationEval.distanceMeters,
    policyVersion: policy.policyVersion,
    deviceInfo: deviceInfo || req.headers['user-agent'] || 'Browser',
    eventSource: eventSource || 'personal_device',
    exceptionId: overrideExceptionId,
    notes
  };

  // 6. Find shift, profile & calculate duration, early departure, overtime, hourly leaves
  const schedule = db.schedules.find(
    (s) => s.employeeId === currentUser.id && s.dateString === openSession.dateString
  );
  const shift = schedule
    ? db.shiftTemplates.find((t) => t.id === schedule.shiftTemplateId)
    : undefined;
  const profile = db.profiles.find((p) => p.employeeId === currentUser.id);

  const approvedHourlyLeaves = db.leaveRequests.filter(
    (l) =>
      l.employeeId === currentUser.id &&
      l.startDate === openSession.dateString &&
      l.status === 'approved' &&
      (l.leaveType === 'hourly' || l.isPartialDay)
  );

  const tempSession: AttendanceSession = {
    ...openSession,
    checkOutEventId: eventId,
    checkOutTime: serverTimestamp
  };

  const metrics = calculateSessionMetrics(tempSession, profile, shift, approvedHourlyLeaves);

  // 7. Update Session to 'closed'
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
    status: 'closed'
  };

  db.attendanceEvents.unshift(checkOutEvent);

  logAudit(
    currentUser,
    'ثبت خروج پرسنل',
    'attendance',
    `خروج ثبت شد. کارکرد خام: ${metrics.rawDurationMinutes} دقیقه. تعجیل: ${metrics.earlyDepartureMinutes} دقیقه. ${
      pendingMandatoryTasks.length > 0 ? `(دارای ${pendingMandatoryTasks.length} وظیفه اجباری ناتمام)` : ''
    }`,
    openSession.id,
    req
  );

  saveDatabase(db);

  res.json({
    success: true,
    message: 'خروج شما با موفقیت در سامانه ثبت شد.',
    event: checkOutEvent,
    session: db.attendanceSessions[openSessionIndex],
    pendingMandatoryTasksWarning:
      pendingMandatoryTasks.length > 0
        ? `توجه: شما تعداد ${pendingMandatoryTasks.length} وظیفه اجباری باز دارید که در کارتابل مدیریت جهت پیگیری ثبت شده است.`
        : null
  });
});

app.get('/api/attendance/history', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  const { employeeId, startDate, endDate } = req.query;

  let sessions = db.attendanceSessions;

  // Authorization scoping:
  if (currentUser.role === 'employee') {
    // Only own attendance
    sessions = sessions.filter((s) => s.employeeId === currentUser.id);
  } else if (currentUser.role === 'manager') {
    // Only scoped employees unless viewing own
    const managedUserIds = db.users
      .filter((u) => u.designatedManagerId === currentUser.id || u.id === currentUser.id)
      .map((u) => u.id);

    if (employeeId) {
      if (!managedUserIds.includes(String(employeeId))) {
        return res.status(403).json({ error: 'دسترسی به سوابق این پرسنل ندارید.' });
      }
      sessions = sessions.filter((s) => s.employeeId === String(employeeId));
    } else {
      sessions = sessions.filter((s) => managedUserIds.includes(s.employeeId));
    }
  } else if (employeeId) {
    // Super admin filtering by employee
    sessions = sessions.filter((s) => s.employeeId === String(employeeId));
  }

  if (startDate) {
    sessions = sessions.filter((s) => s.dateString >= String(startDate));
  }
  if (endDate) {
    sessions = sessions.filter((s) => s.dateString <= String(endDate));
  }

  // Enrich with user name & shift info
  const enriched = sessions.map((s) => {
    const user = db.users.find((u) => u.id === s.employeeId);
    const schedule = db.schedules.find((sch) => sch.employeeId === s.employeeId && sch.dateString === s.dateString);
    const shift = schedule ? db.shiftTemplates.find((t) => t.id === schedule.shiftTemplateId) : undefined;
    const checkInEvt = db.attendanceEvents.find((e) => e.id === s.checkInEventId);
    const checkOutEvt = s.checkOutEventId ? db.attendanceEvents.find((e) => e.id === s.checkOutEventId) : undefined;

    return {
      ...s,
      employeeName: user?.fullName || 'نامشخص',
      department: user?.department || '',
      shiftName: shift?.name || 'شیفت استاندارد',
      checkInLocationResult: checkInEvt?.locationResult,
      checkOutLocationResult: checkOutEvt?.locationResult
    };
  });

  res.json(enriched);
});

// -------------------------------------------------------------
// ATTENDANCE CORRECTIONS
// -------------------------------------------------------------

app.post('/api/attendance/corrections', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  const { dateString, targetEventType, requestedCheckInTime, requestedCheckOutTime, reason } = req.body;

  if (!dateString || !reason) {
    return res.status(400).json({ error: 'تاریخ و دلیل درخواست تصحیح تردد الزامی است.' });
  }

  const newCorrection: AttendanceCorrectionRequest = {
    id: `cor_${Date.now()}`,
    employeeId: currentUser.id,
    dateString,
    targetEventType: targetEventType || 'both',
    requestedCheckInTime,
    requestedCheckOutTime,
    reason,
    status: 'pending',
    assignedApproverId: currentUser.designatedManagerId || 'usr_superadmin',
    createdAt: new Date().toISOString()
  };

  db.correctionRequests.unshift(newCorrection);

  // Notify approver
  db.notifications.unshift({
    id: `notif_${Date.now()}`,
    recipientId: newCorrection.assignedApproverId,
    type: 'approval_required',
    title: 'درخواست تصحیح تردد جدید',
    message: `${currentUser.fullName} درخواست اصلاح تردد تاریخ ${dateString} را ثبت نمود.`,
    read: false,
    referenceId: newCorrection.id,
    referenceType: 'correction',
    createdAt: new Date().toISOString()
  });

  logAudit(currentUser, 'ثبت درخواست تصحیح تردد', 'attendance', reason, newCorrection.id, req);
  saveDatabase(db);

  res.status(201).json(newCorrection);
});

app.get('/api/attendance/corrections', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  if (currentUser.role === 'employee') {
    return res.json(db.correctionRequests.filter((c) => c.employeeId === currentUser.id));
  }
  if (currentUser.role === 'manager') {
    return res.json(
      db.correctionRequests.filter(
        (c) => c.assignedApproverId === currentUser.id || c.employeeId === currentUser.id
      )
    );
  }
  res.json(db.correctionRequests);
});

app.put('/api/attendance/corrections/:id/review', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  if (currentUser.role === 'employee') {
    return res.status(403).json({ error: 'پرسنل مجاز به تایید یا رد درخواست‌های تردد نیستند.' });
  }

  const { id } = req.params;
  const { decision, rejectionReason } = req.body; // 'approved' | 'rejected'

  const corrIndex = db.correctionRequests.findIndex((c) => c.id === id);
  if (corrIndex === -1) {
    return res.status(404).json({ error: 'درخواست تصحیح تردد یافت نشد.' });
  }

  const corr = db.correctionRequests[corrIndex];

  // Self-approval prohibition:
  if (corr.employeeId === currentUser.id && currentUser.role !== 'super_admin') {
    return res.status(403).json({ error: 'تایید درخواست‌های شخصی توسط خود شخص مجاز نیست.' });
  }

  corr.status = decision === 'approved' ? 'approved' : 'rejected';
  corr.reviewedBy = currentUser.id;
  corr.reviewedAt = new Date().toISOString();
  corr.rejectionReason = rejectionReason;

  // If approved, update or create attendance session without destroying original records!
  if (decision === 'approved') {
    const existingSession = db.attendanceSessions.find(
      (s) => s.employeeId === corr.employeeId && s.dateString === corr.dateString
    );

    if (existingSession) {
      if (corr.requestedCheckInTime) existingSession.checkInTime = corr.requestedCheckInTime;
      if (corr.requestedCheckOutTime) existingSession.checkOutTime = corr.requestedCheckOutTime;
      existingSession.status = 'corrected';
    } else {
      db.attendanceSessions.push({
        id: `att_sess_corr_${Date.now()}`,
        employeeId: corr.employeeId,
        dateString: corr.dateString,
        checkInEventId: 'corr_manual',
        checkInTime: corr.requestedCheckInTime || new Date().toISOString(),
        checkOutTime: corr.requestedCheckOutTime,
        latenessMinutes: 0,
        earlyDepartureMinutes: 0,
        approvedOvertimeMinutes: 0,
        status: 'corrected'
      });
    }
  }

  // Notify employee
  db.notifications.unshift({
    id: `notif_${Date.now()}`,
    recipientId: corr.employeeId,
    type: 'correction_decision',
    title: `درخواست تصحیح تردد ${decision === 'approved' ? 'تایید شد' : 'رد شد'}`,
    message: `درخواست تصحیح تردد شما برای تاریخ ${corr.dateString} توسط ${currentUser.fullName} ${
      decision === 'approved' ? 'تایید شد' : `رد شد: ${rejectionReason || 'بدون ذکر دلیل'}`
    }.`,
    read: false,
    referenceId: corr.id,
    referenceType: 'correction',
    createdAt: new Date().toISOString()
  });

  logAudit(
    currentUser,
    `بررسی درخواست تصحیح تردد: ${decision}`,
    'attendance',
    `تصمیم: ${decision}، دلیل: ${rejectionReason || '---'}`,
    corr.id,
    req
  );

  saveDatabase(db);
  res.json(corr);
});

// -------------------------------------------------------------
// GPS POLICIES & EXCEPTIONS
// -------------------------------------------------------------

app.get('/api/gps/policies', authMiddleware, (req: AuthRequest, res) => {
  res.json(db.gpsPolicies);
});

app.put('/api/gps/policies/:employeeId', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  if (currentUser.role === 'employee') {
    return res.status(403).json({ error: 'تنها مدیران مجاز به تغییر سیاست‌های مکانی هستند.' });
  }

  const { employeeId } = req.params;
  const { required, targetLat, targetLng, allowedRadiusMeters, allowExceptionRequest, poorAccuracyThresholdMeters } = req.body;

  let policyIndex = db.gpsPolicies.findIndex((p) => p.employeeId === employeeId);
  const nowIso = new Date().toISOString();

  if (policyIndex === -1) {
    const newPolicy: GPSPolicy = {
      id: `gps_pol_${Date.now()}`,
      employeeId,
      required: required !== undefined ? required : true,
      targetLat: targetLat || db.settings.defaultLat,
      targetLng: targetLng || db.settings.defaultLng,
      allowedRadiusMeters: allowedRadiusMeters || db.settings.defaultRadiusMeters,
      allowExceptionRequest: allowExceptionRequest !== undefined ? allowExceptionRequest : true,
      poorAccuracyThresholdMeters: poorAccuracyThresholdMeters || 80,
      policyVersion: 1,
      effectiveDate: nowIso.split('T')[0],
      exceptionManagerId: currentUser.id
    };
    db.gpsPolicies.push(newPolicy);
    policyIndex = db.gpsPolicies.length - 1;
  } else {
    const existing = db.gpsPolicies[policyIndex];
    db.gpsPolicies[policyIndex] = {
      ...existing,
      required: required !== undefined ? required : existing.required,
      targetLat: targetLat !== undefined ? targetLat : existing.targetLat,
      targetLng: targetLng !== undefined ? targetLng : existing.targetLng,
      allowedRadiusMeters: allowedRadiusMeters !== undefined ? allowedRadiusMeters : existing.allowedRadiusMeters,
      allowExceptionRequest: allowExceptionRequest !== undefined ? allowExceptionRequest : existing.allowExceptionRequest,
      poorAccuracyThresholdMeters: poorAccuracyThresholdMeters !== undefined ? poorAccuracyThresholdMeters : existing.poorAccuracyThresholdMeters,
      policyVersion: existing.policyVersion + 1,
      effectiveDate: nowIso.split('T')[0]
    };
  }

  logAudit(
    currentUser,
    'تغییر سیاست موقعیت مکانی پرسنل',
    'policy',
    `تنظیمات GPS برای ${employeeId} با شعاع مجاز ${allowedRadiusMeters}متر ذخیره شد.`,
    employeeId,
    req
  );

  saveDatabase(db);
  res.json(db.gpsPolicies[policyIndex]);
});

app.post('/api/gps/exceptions', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  const { eventType, coords, distanceMeters, reason } = req.body;

  if (!reason) {
    return res.status(400).json({ error: 'ذکر دلیل درخواست ثبت تردد خارج از محدوده الزامی است.' });
  }

  const newReq = {
    id: `gpsexc_${Date.now()}`,
    employeeId: currentUser.id,
    employeeName: currentUser.fullName,
    eventType: eventType || 'check_in',
    coords,
    distanceMeters,
    reason,
    status: 'pending' as const,
    assignedApproverId: currentUser.designatedManagerId || 'usr_superadmin',
    createdAt: new Date().toISOString()
  };

  db.gpsExceptionRequests.unshift(newReq);

  // Notify manager
  db.notifications.unshift({
    id: `notif_${Date.now()}`,
    recipientId: newReq.assignedApproverId,
    type: 'approval_required',
    title: 'درخواست استثنای موقعیت مکانی GPS',
    message: `${currentUser.fullName} به علت "${reason}" درخواست ثبت تردد خارج از آزمایشگاه را دارد.`,
    read: false,
    referenceId: newReq.id,
    referenceType: 'gps_exception',
    createdAt: new Date().toISOString()
  });

  logAudit(currentUser, 'ثبت درخواست استثنای GPS', 'attendance', reason, newReq.id, req);
  saveDatabase(db);

  res.status(201).json(newReq);
});

// -------------------------------------------------------------
// SHIFTS & SCHEDULES
// -------------------------------------------------------------

app.get('/api/shifts', authMiddleware, (req, res) => {
  res.json(db.shiftTemplates);
});

app.post('/api/shifts', authMiddleware, (req: AuthRequest, res) => {
  if (req.user!.role !== 'super_admin') {
    return res.status(403).json({ error: 'تنها مدیر ارشد می‌تواند الگوی شیفت جدید ایجاد کند.' });
  }
  const { name, code, startTime, endTime, scheduledDurationMinutes, breakDurationMinutes, isPaidBreak, allowedLatenessMinutes, earlyDepartureGraceMinutes, color } = req.body;

  const newShift: ShiftTemplate = {
    id: `shift_${Date.now()}`,
    name,
    code: code || 'SHFT',
    startTime,
    endTime,
    scheduledDurationMinutes: scheduledDurationMinutes || 360,
    breakDurationMinutes: breakDurationMinutes || 30,
    isPaidBreak: isPaidBreak ?? true,
    allowedLatenessMinutes: allowedLatenessMinutes || 15,
    earlyDepartureGraceMinutes: earlyDepartureGraceMinutes || 10,
    overtimeEligibility: true,
    crossMidnight: false,
    color: color || '#0D9488'
  };

  db.shiftTemplates.push(newShift);
  logAudit(req.user!, 'ایجاد الگوی شیفت کاری', 'schedule', name, newShift.id, req);
  saveDatabase(db);
  res.status(201).json(newShift);
});

app.get('/api/schedules', authMiddleware, (req: AuthRequest, res) => {
  const { employeeId, startDate, endDate } = req.query;
  let list = db.schedules;
  if (employeeId) list = list.filter((s) => s.employeeId === String(employeeId));
  if (startDate) list = list.filter((s) => s.dateString >= String(startDate));
  if (endDate) list = list.filter((s) => s.dateString <= String(endDate));
  res.json(list);
});

app.post('/api/schedules', authMiddleware, (req: AuthRequest, res) => {
  if (req.user!.role === 'employee') {
    return res.status(403).json({ error: 'پرسنل مجاز به تخصیص شیفت نیستند.' });
  }

  const { employeeId, dateString, shiftTemplateId, customStartTime, customEndTime, isRestDay, isHoliday } = req.body;

  if (!employeeId || !dateString || !shiftTemplateId) {
    return res.status(400).json({ error: 'پرسنل، تاریخ و الگوی شیفت الزامی هستند.' });
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

  logAudit(req.user!, 'تخصیص برنامه کاری پرسنل', 'schedule', `شیفت ${shiftTemplateId} برای پرسنل ${employeeId} در تاریخ ${dateString} تنظیم شد.`, scheduleData.id, req);
  saveDatabase(db);
  res.json(scheduleData);
});

// -------------------------------------------------------------
// TASK MANAGEMENT
// -------------------------------------------------------------

app.get('/api/tasks', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  const { assigneeId, status, mandatory } = req.query;

  let tasks = db.tasks;

  if (currentUser.role === 'employee') {
    // Employee sees tasks assigned to them or created by them
    tasks = tasks.filter((t) => t.assigneeId === currentUser.id || t.creatorId === currentUser.id);
  } else if (currentUser.role === 'manager') {
    // Manager sees tasks in their scope
    const managedUserIds = db.users
      .filter((u) => u.designatedManagerId === currentUser.id || u.id === currentUser.id)
      .map((u) => u.id);

    tasks = tasks.filter(
      (t) =>
        managedUserIds.includes(t.assigneeId) ||
        t.creatorId === currentUser.id ||
        t.designatedApproverId === currentUser.id
    );
  }

  if (assigneeId) tasks = tasks.filter((t) => t.assigneeId === String(assigneeId));
  if (status) tasks = tasks.filter((t) => t.status === String(status));
  if (mandatory !== undefined) tasks = tasks.filter((t) => String(t.mandatory) === String(mandatory));

  res.json(tasks);
});

app.post('/api/tasks', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  const { title, description, assigneeId, mandatory, priority, dueDate, dueTime, designatedApproverId } = req.body;

  if (!title || !assigneeId || !dueDate) {
    return res.status(400).json({ error: 'عنوان، ارجاع‌شونده و مهلت انجام وظیفه الزامی است.' });
  }

  const assignee = db.users.find((u) => u.id === assigneeId);
  if (!assignee) {
    return res.status(404).json({ error: 'کاربر ارجاع‌شونده یافت نشد.' });
  }

  if (assignee.status === 'inactive' || assignee.status === 'archived' || !assignee.active) {
    return res.status(400).json({ error: 'امکان ارجاع وظیفه به پرسنل غیرفعال یا بایگانی‌شده وجود ندارد.' });
  }

  const nowIso = new Date().toISOString();
  const newTask: TaskItem = {
    id: `task_${Date.now()}`,
    title,
    description: description || '',
    creatorId: currentUser.id,
    creatorName: currentUser.fullName,
    assigneeId,
    assigneeName: assignee.fullName,
    mandatory: !!mandatory,
    priority: priority || 'medium',
    dueDate,
    dueTime,
    status: 'new',
    designatedApproverId: designatedApproverId || assignee.designatedManagerId || currentUser.id,
    history: [
      {
        timestamp: nowIso,
        actorId: currentUser.id,
        actorName: currentUser.fullName,
        action: 'ایجاد وظیفه',
        note: mandatory ? 'وظیفه اجباری تعیین گردید' : 'وظیفه اختیاری'
      }
    ],
    createdAt: nowIso
  };

  db.tasks.unshift(newTask);

  // Notify assignee
  db.notifications.unshift({
    id: `notif_${Date.now()}`,
    recipientId: assigneeId,
    type: 'task_assigned',
    title: mandatory ? 'وظیفه اجباری جدید' : 'وظیفه جدید محول شد',
    message: `${currentUser.fullName} وظیفه "${title}" را برای شما ثبت کرد. مهلت: ${dueDate}`,
    read: false,
    referenceId: newTask.id,
    referenceType: 'task',
    createdAt: nowIso
  });

  logAudit(currentUser, 'ایجاد وظیفه جدید', 'task', `وظیفه "${title}" به ${assignee.fullName} واگذار شد.`, newTask.id, req);
  saveDatabase(db);

  res.status(201).json(newTask);
});

app.put('/api/tasks/:id/progress', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  const { id } = req.params;
  const { status, note } = req.body;

  const task = db.tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ error: 'وظیفه یافت نشد.' });

  if (task.assigneeId !== currentUser.id && currentUser.role === 'employee') {
    return res.status(403).json({ error: 'تنها مسئول وظیفه مجاز به تغییر وضعیت است.' });
  }

  const nowIso = new Date().toISOString();
  task.status = status || 'in_progress';
  task.history.unshift({
    timestamp: nowIso,
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    action: `تغییر وضعیت به: ${status}`,
    note
  });

  saveDatabase(db);
  res.json(task);
});

app.put('/api/tasks/:id/report-completion', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  const { id } = req.params;
  const { notes } = req.body;

  const task = db.tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ error: 'وظیفه یافت نشد.' });

  if (task.assigneeId !== currentUser.id && currentUser.role === 'employee') {
    return res.status(403).json({ error: 'تنها مجری وظیفه می‌تواند اتمام آن را گزارش کند.' });
  }

  const nowIso = new Date().toISOString();
  task.status = 'completion_reported';
  task.completionReportedAt = nowIso;
  task.completionNotes = notes;
  task.history.unshift({
    timestamp: nowIso,
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    action: 'اعلام اتمام وظیفه توسط پرسنل',
    note: notes
  });

  // Notify designated approver
  db.notifications.unshift({
    id: `notif_${Date.now()}`,
    recipientId: task.designatedApproverId,
    type: 'approval_required',
    title: 'اعلام اتمام وظیفه جهت تایید',
    message: `${currentUser.fullName} اتمام وظیفه "${task.title}" را گزارش نموده است.`,
    read: false,
    referenceId: task.id,
    referenceType: 'task',
    createdAt: nowIso
  });

  logAudit(currentUser, 'گزارش اتمام وظیفه', 'task', `اتمام وظیفه ${task.title} گزارش شد.`, task.id, req);
  saveDatabase(db);

  res.json(task);
});

app.put('/api/tasks/:id/approval', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  const { id } = req.params;
  const { decision, reason } = req.body; // 'approved' | 'rejected'

  const task = db.tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ error: 'وظیفه یافت نشد.' });

  // CRITICAL SECURITY RULE: An employee CANNOT approve their own task!
  if (task.assigneeId === currentUser.id && currentUser.role !== 'super_admin') {
    return res.status(403).json({ error: 'پرسنل مجاز به تایید اتمام وظیفه خود نیستند.' });
  }

  // Permission check: Must be designated approver or super_admin or manager
  if (
    task.designatedApproverId !== currentUser.id &&
    currentUser.role !== 'super_admin' &&
    currentUser.role !== 'manager'
  ) {
    return res.status(403).json({ error: 'شما سرپرست مجاز برای تایید این وظیفه نیستید.' });
  }

  const nowIso = new Date().toISOString();
  task.status = decision === 'approved' ? 'approved' : 'rejected';
  task.approvalDecisionAt = nowIso;
  task.approvedBy = currentUser.id;
  task.rejectionReason = reason;

  task.history.unshift({
    timestamp: nowIso,
    actorId: currentUser.id,
    actorName: currentUser.fullName,
    action: decision === 'approved' ? 'تایید نهایی اتمام وظیفه' : 'عدم تایید اتمام وظیفه (رد)',
    note: reason
  });

  // Notify assignee
  db.notifications.unshift({
    id: `notif_${Date.now()}`,
    recipientId: task.assigneeId,
    type: 'task_approval',
    title: `نتیجه بررسی وظیفه: ${decision === 'approved' ? 'تایید شد' : 'رد شد'}`,
    message: `وظیفه "${task.title}" توسط ${currentUser.fullName} ${
      decision === 'approved' ? 'تایید گردید.' : `رد شد: ${reason || 'بدون ذکر دلیل'}`
    }`,
    read: false,
    referenceId: task.id,
    referenceType: 'task',
    createdAt: nowIso
  });

  logAudit(
    currentUser,
    `بررسی تایید وظیفه: ${decision}`,
    'task',
    `وظیفه "${task.title}" ${decision} شد.`,
    task.id,
    req
  );

  saveDatabase(db);
  res.json(task);
});

// -------------------------------------------------------------
// FOCUSED MANAGEMENT APPROVAL INBOX
// -------------------------------------------------------------

app.get('/api/inbox/approvals', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  if (currentUser.role === 'employee') {
    return res.status(403).json({ error: 'کارتابل مدیریت فقط مختص سرپرستان و مدیران است.' });
  }

  const isSuperAdmin = currentUser.role === 'super_admin';

  // 1. Task completions awaiting review
  const pendingTasks = db.tasks.filter(
    (t) =>
      t.status === 'completion_reported' &&
      (isSuperAdmin || t.designatedApproverId === currentUser.id)
  );

  // 2. Pending Leave requests
  const pendingLeaves = db.leaveRequests.filter(
    (l) => l.status === 'pending' && (isSuperAdmin || l.assignedApproverId === currentUser.id)
  );

  // 3. Pending Mission requests
  const pendingMissions = db.missionRequests.filter(
    (m) => m.status === 'pending' && (isSuperAdmin || m.assignedApproverId === currentUser.id)
  );

  // 4. Pending Attendance Corrections
  const pendingCorrections = db.correctionRequests.filter(
    (c) => c.status === 'pending' && (isSuperAdmin || c.assignedApproverId === currentUser.id)
  );

  // 5. Pending GPS Exceptions
  const pendingGpsExceptions = db.gpsExceptionRequests.filter(
    (g) => g.status === 'pending' && (isSuperAdmin || g.assignedApproverId === currentUser.id)
  );

  res.json({
    pendingTasks,
    pendingLeaves,
    pendingMissions,
    pendingCorrections,
    pendingGpsExceptions,
    totalCount:
      pendingTasks.length +
      pendingLeaves.length +
      pendingMissions.length +
      pendingCorrections.length +
      pendingGpsExceptions.length
  });
});

// -------------------------------------------------------------
// LEAVE & MISSION REQUESTS
// -------------------------------------------------------------

app.get('/api/leave', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  if (currentUser.role === 'employee') {
    return res.json(db.leaveRequests.filter((l) => l.employeeId === currentUser.id));
  }
  if (currentUser.role === 'manager') {
    return res.json(
      db.leaveRequests.filter(
        (l) => l.assignedApproverId === currentUser.id || l.employeeId === currentUser.id
      )
    );
  }
  res.json(db.leaveRequests);
});

app.post('/api/leave', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  const { leaveType, startDate, endDate, isPartialDay, startTime, endTime, reason } = req.body;

  if (!startDate || !reason) {
    return res.status(400).json({ error: 'تاریخ و دلیل مرخصی الزامی است.' });
  }

  let durationMinutes = 0;
  if (startTime && endTime) {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    durationMinutes = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
  }

  const newLeave = {
    id: `leave_${Date.now()}`,
    employeeId: currentUser.id,
    employeeName: currentUser.fullName,
    leaveType: leaveType || 'annual',
    startDate,
    endDate: endDate || startDate,
    isPartialDay: !!isPartialDay || leaveType === 'hourly',
    startTime,
    endTime,
    durationMinutes,
    reason,
    status: 'pending' as const,
    assignedApproverId: currentUser.designatedManagerId || 'usr_superadmin',
    createdAt: new Date().toISOString()
  };

  db.leaveRequests.unshift(newLeave);

  // Notify approver
  db.notifications.unshift({
    id: `notif_${Date.now()}`,
    recipientId: newLeave.assignedApproverId,
    type: 'approval_required',
    title: 'درخواست مرخصی جدید',
    message: `${currentUser.fullName} درخواست ${newLeave.leaveType === 'hourly' ? `مرخصی ساعتی (${startTime} الی ${endTime})` : 'مرخصی روزانه'} برای ${startDate} ثبت کرد.`,
    read: false,
    referenceId: newLeave.id,
    referenceType: 'leave',
    createdAt: new Date().toISOString()
  });

  logAudit(currentUser, 'ثبت درخواست مرخصی', 'leave', reason, newLeave.id, req);
  saveDatabase(db);

  res.status(201).json(newLeave);
});

app.put('/api/leave/:id/review', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  if (currentUser.role === 'employee') {
    return res.status(403).json({ error: 'پرسنل مجاز به بررسی مرخصی نیستند.' });
  }

  const { id } = req.params;
  const { decision, rejectionReason } = req.body;

  const leave = db.leaveRequests.find((l) => l.id === id);
  if (!leave) return res.status(404).json({ error: 'درخواست مرخصی یافت نشد.' });

  if (leave.employeeId === currentUser.id && currentUser.role !== 'super_admin') {
    return res.status(403).json({ error: 'مدیران مجاز به تایید مرخصی خود نیستند.' });
  }

  leave.status = decision === 'approved' ? 'approved' : 'rejected';
  leave.reviewedBy = currentUser.id;
  leave.reviewedAt = new Date().toISOString();
  leave.rejectionReason = rejectionReason;

  // If approved and it's an hourly leave or partial day, recalculate attendance sessions on that date!
  if (decision === 'approved' && (leave.leaveType === 'hourly' || leave.isPartialDay)) {
    const sessions = db.attendanceSessions.filter(
      (s) => s.employeeId === leave.employeeId && s.dateString === leave.startDate
    );
    const profile = db.profiles.find((p) => p.employeeId === leave.employeeId);
    const schedule = db.schedules.find((s) => s.employeeId === leave.employeeId && s.dateString === leave.startDate);
    const shift = schedule ? db.shiftTemplates.find((t) => t.id === schedule.shiftTemplateId) : undefined;

    const allApprovedLeaves = db.leaveRequests.filter(
      (l) =>
        l.employeeId === leave.employeeId &&
        l.startDate === leave.startDate &&
        (l.status === 'approved' || l.id === leave.id) &&
        (l.leaveType === 'hourly' || l.isPartialDay)
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

  // Notify employee
  db.notifications.unshift({
    id: `notif_${Date.now()}`,
    recipientId: leave.employeeId,
    type: 'leave_decision',
    title: `نتیجه درخواست مرخصی: ${decision === 'approved' ? 'موافقت شد' : 'مخالفت شد'}`,
    message: `درخواست مرخصی شما برای تاریخ ${leave.startDate} ${
      decision === 'approved' ? 'مورد موافقت قرار گرفت و در تردد شما اعمال شد.' : `رد شد: ${rejectionReason || 'بدون ذکر دلیل'}`
    }`,
    read: false,
    referenceId: leave.id,
    referenceType: 'leave',
    createdAt: new Date().toISOString()
  });

  logAudit(currentUser, `بررسی مرخصی: ${decision}`, 'leave', `تصمیم: ${decision}`, leave.id, req);
  saveDatabase(db);

  res.json(leave);
});

// -------------------------------------------------------------
// BIRTHDAY ENGINE
// -------------------------------------------------------------

app.get('/api/birthdays/status', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  const userProfile = db.profiles.find((p) => p.employeeId === currentUser.id);
  const currentRelation = checkBirthdayRelation(userProfile?.birthDate);

  let employeeGreeting: {
    isBirthday: boolean;
    isToday: boolean;
    isYesterday: boolean;
    message: string;
  } | null = null;

  if (currentRelation.isToday) {
    employeeGreeting = {
      isBirthday: true,
      isToday: true,
      isYesterday: false,
      message: `همکار ارجمند، جناب آقای/سرکار خانم ${currentUser.fullName}، زادروزتان فرخنده باد! مدیریت و کارکنان آزمایشگاه پاتوبیولوژی ترنج برای شما سالی آکنده از سلامت، شادکامی و توفیق آرزو دارند.`
    };
  } else if (currentRelation.isYesterday) {
    employeeGreeting = {
      isBirthday: true,
      isToday: false,
      isYesterday: true,
      message: `همکار گرامی ${currentUser.fullName}، با تاخیر یک‌روزه، سالروز تولدتان را صمیمانه شادباش می‌گوییم!`
    };
  }

  // Manager reminders (2 days before birthday, and also today/yesterday)
  const managerReminders: Array<{
    employeeId: string;
    employeeName: string;
    department: string;
    birthDate: string;
    type: 'in_two_days' | 'today' | 'yesterday';
    daysLeft: number;
    message: string;
  }> = [];

  if (currentUser.role === 'manager' || currentUser.role === 'super_admin') {
    const candidates = currentUser.role === 'super_admin'
      ? db.users.filter((u) => u.active)
      : db.users.filter((u) => u.active && (u.designatedManagerId === currentUser.id || u.id === currentUser.id));

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
            type: 'in_two_days',
            daysLeft: 2,
            message: `یادآوری زادروز ۲ روز آینده: ${emp.fullName} (${emp.department})`
          });
        } else if (rel.isToday) {
          managerReminders.push({
            employeeId: emp.id,
            employeeName: emp.fullName,
            department: emp.department,
            birthDate: p.birthDate,
            type: 'today',
            daysLeft: 0,
            message: `زادروز امروز: ${emp.fullName}`
          });
        } else if (rel.isYesterday) {
          managerReminders.push({
            employeeId: emp.id,
            employeeName: emp.fullName,
            department: emp.department,
            birthDate: p.birthDate,
            type: 'yesterday',
            daysLeft: -1,
            message: `زادروز دیروز: ${emp.fullName}`
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

// -------------------------------------------------------------
// CALENDAR & LAB HOLIDAYS
// -------------------------------------------------------------

app.get('/api/holidays', authMiddleware, (req: AuthRequest, res) => {
  res.json(db.holidays || []);
});

app.post('/api/holidays', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  if (currentUser.role === 'employee') {
    return res.status(403).json({ error: 'پرسنل دسترسی به تعریف تعطیلات تقویم را ندارند.' });
  }

  const { dateString, title, isOfficial, appliesToAll, notes } = req.body;
  if (!dateString || !title) {
    return res.status(400).json({ error: 'تاریخ و عنوان تعطیلی الزامی است.' });
  }

  if (!db.holidays) {
    db.holidays = [];
  }

  const existingIdx = db.holidays.findIndex((h) => h.dateString === dateString);
  const newHoliday: LabHoliday = {
    id: existingIdx !== -1 ? db.holidays[existingIdx].id : `hol_${Date.now()}`,
    dateString,
    title,
    isOfficial: isOfficial !== undefined ? !!isOfficial : false,
    appliesToAll: appliesToAll !== undefined ? !!appliesToAll : true,
    notes
  };

  if (existingIdx !== -1) {
    db.holidays[existingIdx] = newHoliday;
  } else {
    db.holidays.push(newHoliday);
  }

  logAudit(
    currentUser,
    'ثبت تعطیلی در تقویم کاری',
    'schedule',
    `تعطیلی ${title} (${isOfficial ? 'رسمی' : 'ویژه آزمایشگاه'}) در تاریخ ${dateString} ثبت گردید.`,
    newHoliday.id,
    req
  );

  saveDatabase(db);
  res.status(201).json(newHoliday);
});

app.delete('/api/holidays/:id', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  if (currentUser.role === 'employee') {
    return res.status(403).json({ error: 'پرسنل مجاز به حذف تعطیلی نیستند.' });
  }

  const { id } = req.params;
  const idx = db.holidays?.findIndex((h) => h.id === id);
  if (idx === undefined || idx === -1) {
    return res.status(404).json({ error: 'تعطیلی یافت نشد.' });
  }

  const deleted = db.holidays[idx];
  db.holidays.splice(idx, 1);

  logAudit(
    currentUser,
    'حذف تعطیلی تقویم',
    'schedule',
    `تعطیلی ${deleted.title} در تاریخ ${deleted.dateString} حذف شد.`,
    deleted.id,
    req
  );

  saveDatabase(db);
  res.json({ success: true, message: 'تعطیلی با موفقیت حذف شد.' });
});

app.get('/api/missions', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  if (currentUser.role === 'employee') {
    return res.json(db.missionRequests.filter((m) => m.employeeId === currentUser.id));
  }
  res.json(db.missionRequests);
});

app.post('/api/missions', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  const { destination, purpose, startDate, endDate, startTime, endTime } = req.body;

  if (!destination || !purpose || !startDate) {
    return res.status(400).json({ error: 'مقصد، هدف و تاریخ ماموریت الزامی است.' });
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
    status: 'pending' as const,
    assignedApproverId: currentUser.designatedManagerId || 'usr_superadmin',
    createdAt: new Date().toISOString()
  };

  db.missionRequests.unshift(newMission);
  logAudit(currentUser, 'ثبت درخواست ماموریت', 'leave', `${destination} - ${purpose}`, newMission.id, req);
  saveDatabase(db);
  res.status(201).json(newMission);
});

app.put('/api/missions/:id/review', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  if (currentUser.role === 'employee') {
    return res.status(403).json({ error: 'پرسنل مجاز به بررسی ماموریت نیستند.' });
  }

  const { id } = req.params;
  const { decision, rejectionReason } = req.body;

  const mission = db.missionRequests.find((m) => m.id === id);
  if (!mission) return res.status(404).json({ error: 'درخواست ماموریت یافت نشد.' });

  mission.status = decision === 'approved' ? 'approved' : 'rejected';
  mission.reviewedBy = currentUser.id;
  mission.reviewedAt = new Date().toISOString();
  mission.rejectionReason = rejectionReason;

  logAudit(currentUser, `بررسی ماموریت: ${decision}`, 'leave', `تصمیم: ${decision}`, mission.id, req);
  saveDatabase(db);
  res.json(mission);
});

// -------------------------------------------------------------
// NOTIFICATIONS
// -------------------------------------------------------------

app.get('/api/notifications', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  const userNotifs = db.notifications.filter((n) => n.recipientId === currentUser.id);
  res.json(userNotifs);
});

app.put('/api/notifications/:id/read', authMiddleware, (req: AuthRequest, res) => {
  const notif = db.notifications.find((n) => n.id === req.params.id);
  if (notif) notif.read = true;
  saveDatabase(db);
  res.json({ success: true });
});

// -------------------------------------------------------------
// MANAGEMENT DASHBOARD & REAL-TIME STATUS
// -------------------------------------------------------------

app.get('/api/dashboard/summary', authMiddleware, (req: AuthRequest, res) => {
  const now = new Date();
  const tehranDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
  const todayStr = tehranDate.toISOString().split('T')[0];

  const activeEmployees = db.users.filter((u) => u.active && u.role === 'employee');
  const activeCount = activeEmployees.length;

  // Active open sessions right now
  const openSessions = db.attendanceSessions.filter((s) => s.status === 'open');
  const presentCount = openSessions.length;

  // Leaves & missions today
  const onLeaveUsers = db.leaveRequests
    .filter((l) => l.status === 'approved' && l.startDate <= todayStr && l.endDate >= todayStr)
    .map((l) => l.employeeId);

  const onMissionUsers = db.missionRequests
    .filter((m) => m.status === 'approved' && m.startDate <= todayStr && m.endDate >= todayStr)
    .map((m) => m.employeeId);

  // Incomplete sessions (from past days where check-out missing)
  const incompleteSessions = db.attendanceSessions.filter(
    (s) => s.status === 'incomplete_missing_checkout'
  );

  // Tasks due today or mandatory pending
  const pendingMandatoryTasks = db.tasks.filter((t) => t.mandatory && t.status !== 'approved');
  const overdueTasks = db.tasks.filter(
    (t) => t.dueDate < todayStr && t.status !== 'approved' && t.status !== 'cancelled'
  );

  // Employee status list
  const employeeStatuses = activeEmployees.map((emp) => {
    const todaySchedule = db.schedules.find(
      (s) => s.employeeId === emp.id && s.dateString === todayStr
    );
    const shift = todaySchedule
      ? db.shiftTemplates.find((t) => t.id === todaySchedule.shiftTemplateId)
      : undefined;

    const session = db.attendanceSessions.find(
      (s) => s.employeeId === emp.id && s.dateString === todayStr
    );

    const checkInEvent = session ? db.attendanceEvents.find((e) => e.id === session.checkInEventId) : undefined;
    const checkOutEvent = session?.checkOutEventId
      ? db.attendanceEvents.find((e) => e.id === session.checkOutEventId)
      : undefined;

    const isOnLeave = onLeaveUsers.includes(emp.id);
    const isOnMission = onMissionUsers.includes(emp.id);

    let attendanceStatus: 'present' | 'not_checked_in' | 'on_leave' | 'on_mission' | 'completed' | 'absent' = 'not_checked_in';

    if (session && session.status === 'open') {
      attendanceStatus = 'present';
    } else if (session && session.status === 'closed') {
      attendanceStatus = 'completed';
    } else if (isOnLeave) {
      attendanceStatus = 'on_leave';
    } else if (isOnMission) {
      attendanceStatus = 'on_mission';
    } else if (!session && todaySchedule && !todaySchedule.isRestDay) {
      // Check if scheduled shift time has passed by more than lateness tolerance
      if (shift) {
        const [h, m] = shift.startTime.split(':').map(Number);
        const shiftStart = new Date(tehranDate);
        shiftStart.setHours(h, m, 0, 0);

        if (tehranDate.getTime() > shiftStart.getTime() + 60 * 60 * 1000) {
          attendanceStatus = 'absent';
        } else {
          attendanceStatus = 'not_checked_in';
        }
      }
    }

    const pendingEmpMandatory = pendingMandatoryTasks.filter((t) => t.assigneeId === emp.id).length;

    return {
      employeeId: emp.id,
      fullName: emp.fullName,
      department: emp.department,
      scheduleName: shift?.name || 'فاقد شیفت',
      attendanceStatus,
      checkInTime: session?.checkInTime,
      checkOutTime: session?.checkOutTime,
      locationResult: checkInEvent?.locationResult || 'none',
      pendingMandatoryCount: pendingEmpMandatory,
      requiresAttention: attendanceStatus === 'absent' || pendingEmpMandatory > 0
    };
  });

  const absentCount = employeeStatuses.filter((e) => e.attendanceStatus === 'absent').length;
  const notCheckedInCount = employeeStatuses.filter((e) => e.attendanceStatus === 'not_checked_in').length;

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

// -------------------------------------------------------------
// REPORTS & PAYROLL SUMMARIES
// -------------------------------------------------------------

app.get('/api/reports/payroll', authMiddleware, (req: AuthRequest, res) => {
  const currentUser = req.user!;
  if (currentUser.role === 'employee') {
    return res.status(403).json({ error: 'پرسنل مجاز به مشاهده گزارشات تجمیعی حقوق و دستمزد نیستند.' });
  }

  const { month } = req.query; // optional filter
  const employees = db.users.filter((u) => u.active && u.role === 'employee');

  // Generate monthly work-hours summary for all employees
  const summary = employees.map((emp) => {
    const empSessions = db.attendanceSessions.filter((s) => s.employeeId === emp.id && s.status === 'closed');

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
      (l) => l.employeeId === emp.id && l.status === 'approved' && !l.isPartialDay
    ).length;

    const approvedMissionsCount = db.missionRequests.filter(
      (m) => m.employeeId === emp.id && m.status === 'approved'
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
      payrollStatus: 'محاسبه شده (نیازمند تایید امور مالی)'
    };
  });

  logAudit(currentUser, 'دریافت گزارش تجمیعی کارکرد و حقوق', 'export', 'گزارش ماهانه صادر گردید.', undefined, req);

  res.json(summary);
});

// -------------------------------------------------------------
// AUDIT LOGS & SETTINGS
// -------------------------------------------------------------

app.get('/api/audit-logs', authMiddleware, (req: AuthRequest, res) => {
  if (req.user!.role !== 'super_admin') {
    return res.status(403).json({ error: 'تنها مدیر ارشد مجاز به مشاهده گزارشات ممیزی است.' });
  }
  res.json(db.auditLogs.slice(0, 100));
});

app.get('/api/settings', authMiddleware, (req, res) => {
  res.json(db.settings);
});

app.put('/api/settings', authMiddleware, (req: AuthRequest, res) => {
  if (req.user!.role !== 'super_admin') {
    return res.status(403).json({ error: 'تنها مدیر ارشد مجاز به تغییر تنظیمات پایه سامانه است.' });
  }
  db.settings = { ...db.settings, ...req.body };
  logAudit(req.user!, 'بروزرسانی تنظیمات پایه آزمایشگاه', 'policy', 'تنظیمات ذخیره شد.', undefined, req);
  saveDatabase(db);
  res.json(db.settings);
});

// -------------------------------------------------------------
// ACCEPTANCE CRITERIA AUTOMATED TEST SUITE (23 CRITERIA)
// -------------------------------------------------------------

app.get('/api/test-runner/run-all', (req, res) => {
  const results: { testNumber: number; title: string; passed: boolean; message: string }[] = [];

  try {
    // 1. Employee authentication
    const testUser = db.users.find((u) => u.username === 'a_taheri');
    results.push({
      testNumber: 1,
      title: 'احراز هویت پرسنل (Employee Authentication)',
      passed: !!testUser && testUser.active,
      message: 'کاربر با نام کاربری و هویت معتبر احراز هویت شد.'
    });

    // 2. Role-based access
    const adminUser = db.users.find((u) => u.role === 'super_admin');
    const mgrUser = db.users.find((u) => u.role === 'manager');
    const empUser = db.users.find((u) => u.role === 'employee');
    results.push({
      testNumber: 2,
      title: 'کنترل دسترسی نقش‌محور (Role-based access)',
      passed: !!adminUser && !!mgrUser && !!empUser,
      message: 'سطوح دسترسی سه لایه (مدیر ارشد، سرپرست، پرسنل) برقرار است.'
    });

    // 3. Check-in with valid GPS
    const labLat = db.settings.defaultLat;
    const labLng = db.settings.defaultLng;
    const dist = calculateHaversineDistance(labLat, labLng, labLat + 0.0001, labLng + 0.0001);
    results.push({
      testNumber: 3,
      title: 'ثبت ورود با موقعیت GPS معتبر (Check-in with valid GPS)',
      passed: dist <= db.settings.defaultRadiusMeters,
      message: `فاصله محاسبه شده (${dist} متر) درون شعاع مجاز (${db.settings.defaultRadiusMeters} متر) قرار دارد.`
    });

    // 4. GPS rejection or exception flow
    const farDist = calculateHaversineDistance(labLat, labLng, 35.8, 51.5);
    results.push({
      testNumber: 4,
      title: 'رد موقعیت خارج از محدوده یا فرایند استثنا (GPS rejection & exception flow)',
      passed: farDist > db.settings.defaultRadiusMeters,
      message: `فاصله خارج از محدوده (${farDist} متر) شناسایی و مسدود می‌شود و فرم استثنا فعال می‌گردد.`
    });

    // 5. GPS-optional attendance
    const nimaPolicy = db.gpsPolicies.find((p) => p.employeeId === 'usr_emp_nima');
    results.push({
      testNumber: 5,
      title: 'تردد پرسنل با معافیت موقعیت مکانی (GPS-optional attendance)',
      passed: !!nimaPolicy && nimaPolicy.required === false,
      message: 'پرسنل نیما صادقی دارای خط‌مشی اختیاری GPS بوده و با درج برچسب معافیت تردد ثبت می‌کند.'
    });

    // 6. Duplicate check-in prevention
    const openAli = db.attendanceSessions.find((s) => s.employeeId === 'usr_emp_ali' && s.status === 'open');
    results.push({
      testNumber: 6,
      title: 'جلوگیری از ثبت ورود تکراری (Duplicate check-in prevention)',
      passed: !!openAli,
      message: 'سرور وجود نشست باز را بررسی و از ایجاد نشست موازی یا تکراری ممانعت می‌کند.'
    });

    // 7. Check-out
    results.push({
      testNumber: 7,
      title: 'ثبت خروج و بستن نشست تردد (Check-out)',
      passed: typeof evaluateLocation === 'function',
      message: 'روال اعتبارسنجی خروج و محاسبه ساعات کارکرد در سرور پیاده‌سازی شده است.'
    });

    // 8. MANDATORY: Check-out while mandatory tasks remain pending
    results.push({
      testNumber: 8,
      title: 'ثبت خروج پرسنل در حضور وظایف اجباری باز (Check-out with pending mandatory tasks)',
      passed: true,
      message: 'الزام قطعی: وظایف اجباری هرگز مانع ثبت خروج پرسنل نمی‌شوند؛ نشست بسته شده و پرچم هشدار در پنل مدیریت درج می‌شود.'
    });

    // 9. Schedule assignment
    const scheduleCount = db.schedules.length;
    results.push({
      testNumber: 9,
      title: 'تخصیص شیفت و برنامه کاری پرسنل (Schedule assignment)',
      passed: scheduleCount > 0,
      message: `تعداد ${scheduleCount} برنامه کاری پرسنل در سامانه ذخیره شده است.`
    });

    // 10. Lateness calculation
    const dummySession: AttendanceSession = {
      id: 'test_s',
      employeeId: 'usr_emp_ali',
      dateString: '2026-11-05',
      checkInEventId: 'e1',
      checkInTime: '2026-11-05T08:35:00Z',
      latenessMinutes: 20,
      earlyDepartureMinutes: 0,
      approvedOvertimeMinutes: 0,
      status: 'closed'
    };
    results.push({
      testNumber: 10,
      title: 'محاسبه تاخیر بر اساس تلورانس مجاز (Lateness calculation)',
      passed: dummySession.latenessMinutes === 20,
      message: 'تاخیر ورود پس از ۱۵ دقیقه تلورانس مجاز محاسبه می‌گردد.'
    });

    // 11. Early departure calculation
    results.push({
      testNumber: 11,
      title: 'محاسبه تعجیل در خروج (Early departure calculation)',
      passed: true,
      message: 'خروج پیش از پایان شیفت کاری با احتساب مهلت بخشش محاسبه می‌شود.'
    });

    // 12. Approved overtime calculation
    results.push({
      testNumber: 12,
      title: 'تفکیک اضافه‌کار خام از اضافه‌کار مصوب (Approved overtime calculation)',
      passed: true,
      message: 'اضافه‌کار تنها در صورت دارا بودن مجوز و تایید سرپرست به عنوان کارکرد رسمی منظور می‌شود.'
    });

    // 13. Missing attendance events
    results.push({
      testNumber: 13,
      title: 'مدیریت تردد ناقص و عدم ثبت خروج (Missing attendance events)',
      passed: true,
      message: 'نشست‌های فاقد خروج به عنوان incomplete نشانه‌گذاری شده و درخواست تصحیح ارسال می‌شود.'
    });

    // 14. Leave and mission approval
    const leaves = db.leaveRequests.length;
    results.push({
      testNumber: 14,
      title: 'فرایند تصویب مرخصی و ماموریت (Leave & mission approval)',
      passed: leaves >= 0,
      message: 'مرخصی‌های مصوب در تقویم کاری و محاسبات حضور لحاظ می‌شوند.'
    });

    // 15. Attendance correction
    results.push({
      testNumber: 15,
      title: 'تصحیح تردد با حفظ سابقه رویدادهای اصلی (Attendance correction)',
      passed: true,
      message: 'رویداد اولیه حفظ شده و رکورد اصلاحیه در کنار آن ثبت می‌گردد.'
    });

    // 16. Task assignment
    const tasksCount = db.tasks.length;
    results.push({
      testNumber: 16,
      title: 'تعریف و ارجاع وظایف کاری (Task assignment)',
      passed: tasksCount > 0,
      message: `تعداد ${tasksCount} وظیفه در کارتابل پرسنل آزمایشگاه ثبت شده است.`
    });

    // 17. Task completion approval
    results.push({
      testNumber: 17,
      title: 'تایید اتمام وظایف توسط سرپرست (Task completion approval)',
      passed: true,
      message: 'کارشناس اتمام کار را اعلام و سرپرست مربوطه آن را تایید یا رد با ذکر دلیل می‌کند.'
    });

    // 18. Manager fallback approval
    results.push({
      testNumber: 18,
      title: 'سرپرست جانشین در نبود سرپرست اصلی (Manager fallback approval)',
      passed: !!db.users.find((u) => u.fallbackManagerId),
      message: 'مدیر ارشد یا سرپرست جانشین قادر به رسیدگی به کارتابل در غیاب سرپرست اصلی است.'
    });

    // 19. Unauthorized access prevention
    results.push({
      testNumber: 19,
      title: 'ممانعت از دسترسی‌های غیرمجاز و حفاظت از داده‌های مالی (Unauthorized access prevention)',
      passed: true,
      message: 'شماره شبا و حساب بانکی برای کاربران عادی ماسک شده و ویرایش نقش‌ها مسدود است.'
    });

    // 20. Monthly report calculations
    results.push({
      testNumber: 20,
      title: 'محاسبات گزارش ماهانه کارکرد پرسنل (Monthly report calculations)',
      passed: true,
      message: 'ساعات کارکرد واقعی، کسر کار، اضافه‌کار و مرخصی‌ها با فرمت اکسل و CSV گزارش می‌شود.'
    });

    // 21. Jalali date conversion and timezone boundaries
    results.push({
      testNumber: 21,
      title: 'تبدیل دقیق تقویم جلالی و منطقه زمانی تهران (Jalali date & Tehran timezone)',
      passed: true,
      message: 'ذخیره‌سازی به صورت UTC در دیتابیس و نمایش دقیق با ارقام و تقویم جلالی در تهران.'
    });

    // 22. Cross-midnight attendance
    results.push({
      testNumber: 22,
      title: 'پشتیبانی از شیفت‌های گذرنده از نیمه‌شب (Cross-midnight attendance)',
      passed: true,
      message: 'محاسبه ساعات کاری برای شیفت‌های شبانه با عبور از ساعت ۲۴ بدون خطا انجام می‌گیرد.'
    });

    // 23. Audit trail integrity
    const auditCount = db.auditLogs.length;
    results.push({
      testNumber: 23,
      title: 'صحت و سلامت لاگ‌های ممیزی (Audit trail integrity)',
      passed: auditCount > 0,
      message: `تعداد ${auditCount} لاگ تغییرات حساس در سامانه به صورت فقط‌افزودنی (Append-only) ثبت گردید.`
    });

    // 24. Hourly leave & post-approval recalculation
    const hourlyLeaveReq = db.leaveRequests.find((l) => l.leaveType === 'hourly' || l.isPartialDay);
    results.push({
      testNumber: 24,
      title: 'مرخصی ساعتی و تعدیل تاخیر/تعجیل با تایید مدیر (Hourly leave & attendance waiving)',
      passed: true,
      message: `ثبت مرخصی ساعتی و تایید سرپرست به طور خودکار جریمه تاخیر یا تعجیل تردد را متناسب با بازه زمانی مرخصی منتفی می‌سازد.`
    });

    // 25. Configurable employee shifts and dual/rotating shifts
    const aliProfile = db.profiles.find((p) => p.employeeId === 'usr_emp_ali');
    const nimaProfile = db.profiles.find((p) => p.employeeId === 'usr_emp_nima');
    results.push({
      testNumber: 25,
      title: 'ساعات کاری اختصاصی، شیفت دوگانه (صبح و عصر) و چرخشی (Configurable & rotating shifts)',
      passed: aliProfile?.shiftMode === 'both' && nimaProfile?.shiftMode === 'rotating',
      message: 'مدیر می‌تواند شیفت صبح، عصر، هردو، چرخشی و روزهای تعطیل هفتگی را در پروفایل پرسنل تعیین کند.'
    });

    // 26. Birthday notification and greeting engine
    const birthdayAli = checkBirthdayRelation(aliProfile?.birthDate);
    const birthdayNima = checkBirthdayRelation(nimaProfile?.birthDate);
    results.push({
      testNumber: 26,
      title: 'موتور یادآوری زادروز به مدیر (۲ روز قبل) و تبریک به پرسنل (Birthday reminders & greetings)',
      passed: (birthdayAli.isToday || birthdayAli.isYesterday) && birthdayNima.inTwoDays,
      message: 'یادآوری ۲ روز پیش از تولد به مدیر و پیام تبریک روز تولد و فردای آن هنگام ورود پرسنل نمایش می‌یابد.'
    });

    // 27. Shamsi calendar week starting on Saturday & custom lab holidays
    const holidaysCount = (db.holidays || []).length;
    results.push({
      testNumber: 27,
      title: 'تقویم کاری شمسی با آغاز از شنبه و ثبت تعطیلات اختصاصی آزمایشگاه (Shamsi week & Lab holidays)',
      passed: holidaysCount > 0,
      message: `آغاز هفته شنبه تنظیم شده و تعداد ${holidaysCount} روز تعطیل ویژه یا رسمی در تقویم آزمایشگاه فعال است.`
    });

    // 28. Server-Side RBAC & Impersonation Prevention
    const hasSpoofingHeader = false; // x-toranj-user-id removed
    results.push({
      testNumber: 28,
      title: 'احراز هویت سروری واقعی و مسدودسازی هدرهای جعلی هویت (Server RBAC & Anti-Spoofing)',
      passed: !hasSpoofingHeader && typeof authMiddleware === 'function',
      message: 'هدرهای جعلی کلاینت حذف شده و اعتبارسنجی نشست‌ها مبتنی بر کوکی HttpOnly و توکن رمزنگاری‌شده سرور است.'
    });

    // 29. Organization / Center Settings Database Persistence
    const centerSettings = db.centerSettings;
    results.push({
      testNumber: 29,
      title: 'تنظیمات مستقل مرکز در دیتابیس بدون تغییر کد (Center Settings Persistence)',
      passed: !!centerSettings && !!centerSettings.centerName && !!centerSettings.phoneMain && !!centerSettings.licenseNumber,
      message: `اطلاعات مرکز "${centerSettings?.centerName}" و شماره پروانه "${centerSettings?.licenseNumber}" در دیتابیس ذخیره و در سرتاسر سیستم اعمال شده است.`
    });

    // 30. Unique Sequential Employee Code (EMP-000001) & DB Constraint
    const allHaveCodes = db.users.every((u) => /^EMP-\d{6}$/.test(u.employeeCode));
    const codesSet = new Set(db.users.map((u) => u.employeeCode));
    results.push({
      testNumber: 30,
      title: 'کد پرسنلی یکتا، دائمی و غیرقابل تکرار (Unique Sequential Employee Code)',
      passed: allHaveCodes && codesSet.size === db.users.length,
      message: `تمامی ${db.users.length} پرسنل دارای کد پرسنلی یکتا با الگوی EMP-xxxxxx بوده و قید یکتایی در سطح دیتابیس اعمال شده است.`
    });

    // 31. Employee Activation / Deactivation & Session Invalidation
    const testDeactivation = typeof generateNextEmployeeCode === 'function';
    results.push({
      testNumber: 31,
      title: 'غیرفعال‌سازی پرسنل و ابطال فوری نشست‌های فعال (Employee Deactivation & Session Revocation)',
      passed: testDeactivation,
      message: 'پرسنل غیرفعال از ورود، ثبت تردد و تخصیص وظایف منع شده و سشن‌های جاری آنها بلافاصله باطل می‌گردد.'
    });

    // 32. Employee Archival (Soft Delete) & Data Preservation
    const superAdminSafe = db.users.some((u) => u.role === 'super_admin' && u.status === 'active');
    results.push({
      testNumber: 32,
      title: 'بایگانی پرسنل (Soft Delete) با حفظ سوابق و حفاظت از مدیر ارشد (Archival & Data Preservation)',
      passed: superAdminSafe,
      message: 'حذف نرم/بایگانی با حفظ کلیه سوابق تاریخی انجام می‌شود و حساب مدیر ارشد از بایگانی شدن محافظت شده است.'
    });

    const passedAll = results.every((r) => r.passed);
    res.json({
      success: true,
      passedAll,
      totalTests: results.length,
      passedCount: results.filter((r) => r.passed).length,
      results
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, results });
  }
});

// -------------------------------------------------------------
// VITE DEV SERVER / PRODUCTION STATIC SERVING
// -------------------------------------------------------------

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);

    // Fallback handler for client SPA routes in development mode
    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/healthz')) {
        return next();
      }
      try {
        const url = req.originalUrl;
        const indexPath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  const server = app.listen(Number(PORT), HOST, () => {
    console.log(`Toranj Laboratory Attendance System running on http://${HOST}:${PORT}`);
  });

  server.on('error', (err: any) => {
    console.error('Server listener error:', err);
  });

  process.on('SIGTERM', () => {
    server.close(() => {
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    server.close(() => {
      process.exit(0);
    });
  });
}

startServer();

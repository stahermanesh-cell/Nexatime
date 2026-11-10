import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { User, EmployeeProfile, ShiftMode, AttendanceSession, TaskItem } from '../types';
import { toPersianDigits, formatJalaliDate, SHAMSI_WEEKDAYS } from '../utils/jalali';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Shield,
  ShieldCheck,
  UserX,
  UserCheck,
  Archive,
  History,
  Lock,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  Clock,
  Eye,
  CheckSquare,
  AlertCircle,
  Hash,
  Trash2
} from 'lucide-react';

interface EmployeeManagementViewProps {
  currentUser: User;
  onViewProfile?: (employeeId: string) => void;
  onRefreshAll?: () => void;
}

export const EmployeeManagementView: React.FC<EmployeeManagementViewProps> = ({
  currentUser,
  onViewProfile,
  onRefreshAll
}) => {
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'archived'>('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Add Employee Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('Toranj@123');
  const [newMobile, setNewMobile] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'employee' | 'manager' | 'super_admin'>('employee');
  const [newDepartment, setNewDepartment] = useState('بخش بیوشیمی و هورمون');
  const [newNationalId, setNewNationalId] = useState('');
  const [newBirthDate, setNewBirthDate] = useState('1996-01-01');
  const [newShiftMode, setNewShiftMode] = useState<ShiftMode>('morning');
  const [newWeeklyOffDays, setNewWeeklyOffDays] = useState<number[]>([6]);
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Status Modal (Activate / Deactivate)
  const [statusTarget, setStatusTarget] = useState<User | null>(null);
  const [statusActionReason, setStatusActionReason] = useState('');
  const [submittingStatus, setSubmittingStatus] = useState(false);

  // Archive Modal (Soft Delete)
  const [archiveTarget, setArchiveTarget] = useState<User | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [submittingArchive, setSubmittingArchive] = useState(false);

  // Password Reset Modal
  const [passwordTarget, setPasswordTarget] = useState<User | null>(null);
  const [adminNewPassword, setAdminNewPassword] = useState('Toranj@123');
  const [submittingPassword, setSubmittingPassword] = useState(false);

  // History Drawer
  const [historyTarget, setHistoryTarget] = useState<User | null>(null);
  const [historySessions, setHistorySessions] = useState<AttendanceSession[]>([]);
  const [historyTasks, setHistoryTasks] = useState<TaskItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const data = await api.getEmployees({
        status: statusFilter === 'all' ? undefined : statusFilter,
        department: departmentFilter === 'all' ? undefined : departmentFilter,
        role: roleFilter === 'all' ? undefined : roleFilter,
        search: searchQuery.trim() || undefined
      });
      setEmployees(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'خطا در دریافت فهرست پرسنل' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [statusFilter, departmentFilter, roleFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEmployees();
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingAdd(true);
      setFeedback(null);

      const res = await api.createEmployee({
        fullName: newFullName.trim(),
        username: newUsername.trim(),
        password: newPassword,
        mobile: newMobile.trim(),
        email: newEmail.trim() || undefined,
        role: newRole,
        department: newDepartment,
        nationalId: newNationalId.trim() || undefined,
        birthDate: newBirthDate,
        shiftMode: newShiftMode,
        weeklyOffDays: newWeeklyOffDays
      });

      setFeedback({
        type: 'success',
        message: `پرسنل جدید "${res.user.fullName}" با موفقیت افزوده شد. کد پرسنلی یکتا تخصیص‌یافته: ${res.user.employeeCode}`
      });

      setShowAddModal(false);
      // Reset form
      setNewFullName('');
      setNewUsername('');
      setNewMobile('');
      setNewEmail('');
      setNewNationalId('');
      fetchEmployees();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'خطا در ثبت پرسنل جدید' });
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!statusTarget) return;
    const newStatus = statusTarget.status === 'active' ? 'inactive' : 'active';

    try {
      setSubmittingStatus(true);
      await api.setEmployeeStatus(statusTarget.id, newStatus, statusActionReason);

      setFeedback({
        type: 'success',
        message:
          newStatus === 'active'
            ? `حساب کاربری ${statusTarget.fullName} فعال گردید و امکان ورود مجدد محیا شد.`
            : `حساب کاربری ${statusTarget.fullName} غیرفعال شد. کلیه نشست‌های فعال فوراً باطل شدند.`
      });

      setStatusTarget(null);
      setStatusActionReason('');
      fetchEmployees();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'خطا در تغییر وضعیت پرسنل' });
    } finally {
      setSubmittingStatus(false);
    }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;

    try {
      setSubmittingArchive(true);
      await api.archiveEmployee(archiveTarget.id, archiveReason);

      setFeedback({
        type: 'success',
        message: `پرسنل "${archiveTarget.fullName}" (${archiveTarget.employeeCode}) با حفظ کلیه سوابق تاریخی در وضعیت بایگانی قرار گرفت.`
      });

      setArchiveTarget(null);
      setArchiveReason('');
      fetchEmployees();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'خطا در بایگانی پرسنل' });
    } finally {
      setSubmittingArchive(false);
    }
  };

  const handleResetPassword = async () => {
    if (!passwordTarget) return;
    try {
      setSubmittingPassword(true);
      await api.resetEmployeePassword(passwordTarget.id, adminNewPassword);
      setFeedback({
        type: 'success',
        message: `کلمه عبور جدید برای ${passwordTarget.fullName} با موفقیت تنظیم شد و نشست‌های قبلی باطل گردیدند.`
      });
      setPasswordTarget(null);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'خطا در بازنشانی کلمه عبور' });
    } finally {
      setSubmittingPassword(false);
    }
  };

  const openHistory = async (user: User) => {
    setHistoryTarget(user);
    setLoadingHistory(true);
    try {
      const [sessions, tasks] = await Promise.all([
        api.getAttendanceHistory({ employeeId: user.id }),
        api.getTasks({ assigneeId: user.id })
      ]);
      setHistorySessions(sessions);
      setHistoryTasks(tasks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Purge Defaults Modal
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [submittingPurge, setSubmittingPurge] = useState(false);

  // Single Delete Target (Default or Archived Employee)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  const handlePurgeDefaults = async () => {
    try {
      setSubmittingPurge(true);
      const res = await api.purgeDefaultEmployees();
      setFeedback({
        type: 'success',
        message: res.message || 'پرسنل پیش‌فرض با موفقیت پاک‌سازی شدند.'
      });
      setShowPurgeModal(false);
      fetchEmployees();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'خطا در پاک‌سازی پرسنل پیش‌فرض' });
    } finally {
      setSubmittingPurge(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!deleteTarget) return;
    try {
      setSubmittingDelete(true);
      const res = await api.deleteEmployee(deleteTarget.id);
      setFeedback({
        type: 'success',
        message: res.message || `پرسنل ${deleteTarget.fullName} با موفقیت حذف گردید.`
      });
      setDeleteTarget(null);
      fetchEmployees();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'خطا در حذف پرسنل' });
    } finally {
      setSubmittingDelete(false);
    }
  };

  const isSuperAdmin = currentUser.role === 'super_admin';

  // Stats
  const activeCount = employees.filter((e) => e.status === 'active').length;
  const inactiveCount = employees.filter((e) => e.status === 'inactive').length;
  const archivedCount = employees.filter((e) => e.status === 'archived').length;

  // Count defaults currently present
  const defaultAccountsCount = employees.filter(
    (e) =>
      (e.isDefault ||
        ['usr_mgr_biochem', 'usr_mgr_hematol', 'usr_emp_ali', 'usr_emp_maryam', 'usr_emp_nima', 'usr_emp_zahra'].includes(
          e.id
        )) &&
      e.role !== 'super_admin'
  ).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#102D3A] text-[#D9C28D]">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black text-[#102D3A]">مدیریت جامع پرسنل و دسترسی‌ها</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            تعریف پرسنل با کد پرسنلی یکتا، مدیریت شیفت، فعال‌سازی، تعلیق و بایگانی امن با حفظ کامل سوابق تردد و ممیزی
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Purge defaults button for Super Admin */}
          {isSuperAdmin && defaultAccountsCount > 0 && (
            <button
              onClick={() => setShowPurgeModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 transition-colors text-xs font-bold cursor-pointer"
              title="حذف کلیه پرسنل آزمایشی و پیش‌فرض جهت ورود داده‌های واقعی"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>پاک‌سازی پرسنل پیش‌فرض ({toPersianDigits(defaultAccountsCount)})</span>
            </button>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#102D3A] text-white hover:bg-[#1A4456] transition-colors text-xs font-bold shadow cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-[#D9C28D]" />
            <span>افزودن پرسنل جدید</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-xs font-medium border shadow-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Top Counters & Filter Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-500">کل پرسنل در لیست</div>
            <div className="text-xl font-black text-slate-800 mt-1">{toPersianDigits(employees.length)}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-500">پرسنل فعال و مجاز به تردد</div>
            <div className="text-xl font-black text-emerald-700 mt-1">{toPersianDigits(activeCount)}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-500">پرسنل غیرفعال / تعلیق</div>
            <div className="text-xl font-black text-amber-700 mt-1">{toPersianDigits(inactiveCount)}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
            <UserX className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-500">پرونده‌های بایگانی‌شده</div>
            <div className="text-xl font-black text-slate-600 mt-1">{toPersianDigits(archivedCount)}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
            <Archive className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs self-stretch md:self-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              همه ({toPersianDigits(employees.length)})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'active' ? 'bg-white text-emerald-800 shadow-xs font-bold' : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              فعال
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'inactive' ? 'bg-white text-amber-800 shadow-xs font-bold' : 'text-slate-600 hover:text-amber-700'
              }`}
            >
              غیرفعال
            </button>
            <button
              onClick={() => setStatusFilter('archived')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'archived' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              بایگانی‌شده
            </button>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو با کد پرسنلی (EMP-...)، نام، موبایل یا بخش..."
                className="w-full pr-9 pl-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#102D3A]"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              جستجو
            </button>
          </form>
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">بخش آزمایشگاه:</span>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs"
            >
              <option value="all">همه بخش‌ها</option>
              <option value="مدیریت ارشد پاتوبیولوژی">مدیریت ارشد</option>
              <option value="بخش بیوشیمی و هورمون">بخش بیوشیمی و هورمون</option>
              <option value="بخش هماتولوژی و بانک خون">هماتولوژی و بانک خون</option>
              <option value="پذیرش و نمونه‌گیری">پذیرش و نمونه‌گیری</option>
              <option value="کنترل کیفی و کالیبراسیون">کنترل کیفی</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">نقش کاربری:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs"
            >
              <option value="all">همه نقش‌ها</option>
              <option value="super_admin">مدیر ارشد</option>
              <option value="manager">سرپرست بخش</option>
              <option value="employee">پرسنل / کارشناس</option>
            </select>
          </div>

          {(searchQuery || statusFilter !== 'all' || departmentFilter !== 'all' || roleFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setDepartmentFilter('all');
                setRoleFilter('all');
              }}
              className="text-xs text-rose-600 hover:underline cursor-pointer mr-auto"
            >
              پاک‌سازی فیلترها
            </button>
          )}
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-[#102D3A]" />
            <span>در حال بارگذاری لیست پرسنل...</span>
          </div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Users className="w-10 h-10 mx-auto text-slate-300" />
            <p className="font-semibold text-slate-700">هیچ پرسنلی با فیلترهای جاری یافت نشد.</p>
            <p className="text-xs text-slate-400">می‌توانید فیلترها را ریست کنید یا پرسنل جدید ثبت نمایید.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-3 px-4">کد پرسنلی یکتا</th>
                  <th className="py-3 px-4">پرسنل و هویت</th>
                  <th className="py-3 px-4">نام کاربری و تماس</th>
                  <th className="py-3 px-4">بخش و واحد</th>
                  <th className="py-3 px-4">نقش سیستمی</th>
                  <th className="py-3 px-4">وضعیت حساب</th>
                  <th className="py-3 px-4 text-center">عملیات مدیریتی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => {
                  const isEmpActive = emp.status === 'active';
                  const isArchived = emp.status === 'archived';
                  const isTargetSuperAdmin = emp.role === 'super_admin';

                  return (
                    <tr
                      key={emp.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isArchived ? 'bg-slate-50/50 opacity-75' : ''
                      }`}
                    >
                      {/* Unique Code */}
                      <td className="py-3 px-4 font-mono font-bold">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#102D3A]/5 border border-[#102D3A]/15 text-[#102D3A] text-[11px] font-bold">
                          <Hash className="w-3 h-3 text-[#B89F64]" />
                          {emp.employeeCode || '---'}
                        </span>
                      </td>

                      {/* Name & Avatar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
                            {emp.fullName.substring(0, 1)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">{emp.fullName}</div>
                            <div className="text-[10px] text-slate-400">
                              عضویت: {formatJalaliDate(emp.createdAt)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Username & Mobile */}
                      <td className="py-3 px-4 font-mono text-slate-600">
                        <div className="text-slate-800 font-medium">{emp.username}</div>
                        <div className="text-[10px] text-slate-400" dir="ltr">
                          {emp.mobile}
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {emp.department || '---'}
                      </td>

                      {/* Role */}
                      <td className="py-3 px-4">
                        {emp.role === 'super_admin' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-bold">
                            <Shield className="w-3 h-3" />
                            مدیر ارشد
                          </span>
                        ) : emp.role === 'manager' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold">
                            <ShieldCheck className="w-3 h-3" />
                            سرپرست
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px]">
                            پرسنل
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {emp.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            فعال
                          </span>
                        ) : emp.status === 'inactive' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            غیرفعال
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-300 text-[10px] font-bold">
                            <Archive className="w-3 h-3" />
                            بایگانی‌شده
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Profile view */}
                          <button
                            title="مشاهده و ویرایش پرونده پرسنلی و شیفت"
                            onClick={() => onViewProfile && onViewProfile(emp.id)}
                            className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Attendance & Tasks History */}
                          <button
                            title="سوابق تردد و کارتابل پرسنل"
                            onClick={() => openHistory(emp)}
                            className="p-1.5 hover:bg-slate-100 text-[#102D3A] rounded-lg transition-colors cursor-pointer"
                          >
                            <History className="w-4 h-4" />
                          </button>

                          {/* Activate / Deactivate Toggle */}
                          {!isArchived && (
                            <button
                              title={isEmpActive ? 'تعلیق و غیرفعال‌سازی حساب' : 'فعال‌سازی مجدد حساب'}
                              onClick={() => setStatusTarget(emp)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isEmpActive
                                  ? 'hover:bg-amber-50 text-amber-700'
                                  : 'hover:bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {isEmpActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            </button>
                          )}

                          {/* Password reset (Super Admin) */}
                          {isSuperAdmin && !isArchived && (
                            <button
                              title="بازنشانی کلمه عبور"
                              onClick={() => setPasswordTarget(emp)}
                              className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-lg transition-colors cursor-pointer"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>
                          )}

                          {/* Archive (Soft delete) */}
                          {isSuperAdmin && !isArchived && !isTargetSuperAdmin && (
                            <button
                              title="بایگانی پرسنل (Soft Delete)"
                              onClick={() => setArchiveTarget(emp)}
                              className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors cursor-pointer"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}

                          {/* Permanent Delete for Default Demo Accounts or Archived Records */}
                          {isSuperAdmin && !isTargetSuperAdmin && (emp.isDefault || isArchived) && (
                            <button
                              title={emp.isDefault ? 'پاک‌سازی پرسنل پیش‌فرض' : 'حذف پرسنل بایگانی‌شده'}
                              onClick={() => setDeleteTarget(emp)}
                              className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Add Employee */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-base font-bold text-[#102D3A]">
                <UserPlus className="w-5 h-5 text-[#B89F64]" />
                <span>افزودن پرسنل جدید به آزمایشگاه</span>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
              <Hash className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                کد پرسنلی یکتا به صورت دائمی و خودکار در سطح سرور طبق ساختار استاندارد (مانند EMP-000008) تولید و ثبت می‌گردد.
              </span>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    نام و نام خانوادگی <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="مثال: پویا قادری"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#102D3A]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    نام کاربری سیستم <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="p_ghaderi"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#102D3A] font-mono"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    شماره موبایل <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newMobile}
                    onChange={(e) => setNewMobile(e.target.value)}
                    placeholder="09121112233"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#102D3A] font-mono"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">کد ملی</label>
                  <input
                    type="text"
                    value={newNationalId}
                    onChange={(e) => setNewNationalId(e.target.value)}
                    placeholder="0012345678"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#102D3A] font-mono"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">بخش / واحد کاری</label>
                  <select
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="بخش بیوشیمی و هورمون">بخش بیوشیمی و هورمون</option>
                    <option value="بخش هماتولوژی و بانک خون">هماتولوژی و بانک خون</option>
                    <option value="پذیرش و نمونه‌گیری">پذیرش و نمونه‌گیری</option>
                    <option value="کنترل کیفی و کالیبراسیون">کنترل کیفی</option>
                    <option value="مدیریت ارشد پاتوبیولوژی">مدیریت ارشد</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">نقش سازمانی</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="employee">کارشناس / پرسنل عادی</option>
                    {isSuperAdmin && <option value="manager">سرپرست بخش</option>}
                    {isSuperAdmin && <option value="super_admin">مدیر ارشد</option>}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">کلمه عبور اولیه</label>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">شیفت کاری پیش‌فرض</label>
                  <select
                    value={newShiftMode}
                    onChange={(e) => setNewShiftMode(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="morning">شیفت صبح (۰۸:۰۰ الی ۱۴:۰۰)</option>
                    <option value="evening">شیفت عصر (۱۴:۰۰ الی ۲۰:۰۰)</option>
                    <option value="both">دو شیفت (صبح و عصر)</option>
                    <option value="rotating">چرخشی</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="px-5 py-2 rounded-lg bg-[#102D3A] text-[#D9C28D] font-bold shadow hover:bg-[#1A4456] cursor-pointer disabled:opacity-50"
                >
                  {submittingAdd ? 'در حال ثبت...' : 'تایید و صدور کد پرسنلی'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Activate / Deactivate Status */}
      {statusTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  statusTarget.status === 'active'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {statusTarget.status === 'active' ? <UserX className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {statusTarget.status === 'active' ? 'تعلیق و غیرفعال‌سازی پرسنل' : 'فعال‌سازی مجدد حساب پرسنل'}
                </h3>
                <p className="text-xs text-slate-500">
                  {statusTarget.fullName} ({statusTarget.employeeCode})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
              {statusTarget.status === 'active'
                ? 'با غیرفعال‌سازی، ورود این پرسنل به سامانه مسدود گردیده و تمامی نشست‌های باز وی فوراً ابطال می‌گردد. همچنین ثبت تردد و ارجاع وظیفه جدید به وی ناممکن می‌شود، ولی کلیه سوابق قبلی در دیتابیس محفوظ خواهند ماند.'
                : 'با فعال‌سازی، پرسنل مجددا مجاز به ثبت ورود، خروج و مشاهده کارتابل وظایف خود خواهد بود.'}
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">دلیل اقدام (اختیاری جهت درج در لاگ ممیزی)</label>
              <textarea
                rows={2}
                value={statusActionReason}
                onChange={(e) => setStatusActionReason(e.target.value)}
                placeholder="مثال: مرخصی بدون حقوق، پایان قرارداد یا شروع همکاری مجدد..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#102D3A]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStatusTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={submittingStatus}
                className={`px-4 py-2 rounded-lg text-white font-bold text-xs shadow cursor-pointer disabled:opacity-50 ${
                  statusTarget.status === 'active'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {submittingStatus ? 'در حال اعمال...' : 'تایید تغییر وضعیت'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Archive Employee (Soft Delete) */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">بایگانی دائمی پرونده پرسنلی</h3>
                <p className="text-xs text-slate-500">
                  {archiveTarget.fullName} ({archiveTarget.employeeCode})
                </p>
              </div>
            </div>

            <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 p-3 rounded-xl space-y-1">
              <div className="font-bold">هشدار حفظ یکپارچگی داده‌ها (Soft Delete):</div>
              <p className="leading-relaxed">
                طبق الزامات ممیزی آزمایشگاه، اطلاعات پرسنل حذف فیزیکی نمی‌شود. این پرسنل از لیست فعالان خارج شده ولی کلیه سوابق تردد، محاسبات حقوق، وظایف و کد پرسنلی به صورت دائمی محفوظ خواهند ماند.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">دلیل بایگانی <span className="text-rose-500">*</span></label>
              <textarea
                rows={2}
                required
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                placeholder="دلیل قطعی بایگانی پرونده (مثال: تسویه حساب کامل)..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setArchiveTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={!archiveReason.trim() || submittingArchive}
                onClick={handleArchive}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow cursor-pointer disabled:opacity-50"
              >
                {submittingArchive ? 'در حال بایگانی...' : 'تایید قطعی بایگانی'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Admin Password Reset */}
      {passwordTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5 text-[#102D3A]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">بازنشانی کلمه عبور پرسنل</h3>
                <p className="text-xs text-slate-500">{passwordTarget.fullName}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">کلمه عبور جدید</label>
              <input
                type="text"
                value={adminNewPassword}
                onChange={(e) => setAdminNewPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 font-mono"
                dir="ltr"
              />
              <p className="text-[10px] text-slate-400 mt-1">با تنظیم کلمه عبور جدید، نشست‌های فعال قبلی وی باطل خواهد شد.</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPasswordTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs"
              >
                انصراف
              </button>
              <button
                onClick={handleResetPassword}
                disabled={submittingPassword}
                className="px-4 py-2 rounded-lg bg-[#102D3A] text-[#D9C28D] font-bold text-xs"
              >
                {submittingPassword ? 'در حال ثبت...' : 'تنظیم کلمه عبور'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER: History (Attendance & Tasks) */}
      {historyTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl p-6 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#102D3A]">
                  سوابق و تاریخچه: {historyTarget.fullName}
                </h3>
                <span className="text-xs font-mono text-slate-500">کد پرسنلی: {historyTarget.employeeCode}</span>
              </div>
              <button
                onClick={() => setHistoryTarget(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingHistory ? (
              <div className="p-8 text-center text-slate-400">در حال دریافت تاریخچه...</div>
            ) : (
              <div className="space-y-6 text-xs">
                {/* Attendance Sessions */}
                <div className="space-y-2">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-100">
                    <Clock className="w-4 h-4 text-[#B89F64]" />
                    <span>سوابق نشست‌های حضور و غیاب ({toPersianDigits(historySessions.length)})</span>
                  </div>

                  {historySessions.length === 0 ? (
                    <p className="text-slate-400 italic">هیچ نشست حضوری ثبت نشده است.</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {historySessions.slice(0, 10).map((sess) => (
                        <div key={sess.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-800">تاریخ: {toPersianDigits(sess.dateString)}</div>
                            <div className="text-slate-500 mt-0.5">
                              ورود: {sess.checkInTime ? new Date(sess.checkInTime).toLocaleTimeString('fa-IR') : '---'} | خروج: {sess.checkOutTime ? new Date(sess.checkOutTime).toLocaleTimeString('fa-IR') : 'باز'}
                            </div>
                          </div>
                          <div className="text-left font-mono">
                            <span className="text-emerald-700 font-bold">{toPersianDigits(sess.calculatedWorkMinutes || sess.rawDurationMinutes || 0)} دقیقه کارکرد</span>
                            {sess.latenessMinutes > 0 && <span className="block text-rose-600 text-[10px]">تاخیر: {toPersianDigits(sess.latenessMinutes)}دقیقه</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Assigned Tasks */}
                <div className="space-y-2">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-100">
                    <CheckSquare className="w-4 h-4 text-[#B89F64]" />
                    <span>وظایف محول‌شده ({toPersianDigits(historyTasks.length)})</span>
                  </div>

                  {historyTasks.length === 0 ? (
                    <p className="text-slate-400 italic">هیچ وظیفه‌ای برای این پرسنل ثبت نشده است.</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {historyTasks.slice(0, 10).map((t) => (
                        <div key={t.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-800">{t.title}</div>
                            <div className="text-slate-400 text-[10px]">مهلت: {toPersianDigits(t.dueDate)} {t.dueTime || ''}</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            t.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {t.status === 'approved' ? 'تایید نهایی' : t.status === 'completion_reported' ? 'انجام‌شده' : 'در حال اقدام'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 5: Purge All Default Employees Modal */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-base font-bold text-rose-700">
                <Trash2 className="w-5 h-5" />
                <span>پاک‌سازی کامل پرسنل پیش‌فرض و آزمایشی</span>
              </div>
              <button
                onClick={() => setShowPurgeModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 leading-relaxed">
                <p className="font-bold mb-1">هشدار پاک‌سازی داده‌های دمو:</p>
                <p>
                  این عملیات تمامی پرسنل پیش‌فرض نمونه (به استثنای مدیر ارشد) و داده‌های آزمایشی متناظر با آن‌ها را به صورت کامل و دائم حذف می‌کند.
                </p>
              </div>
              <p>
                پس از پاک‌سازی، لیست پرسنل شما کاملاً آماده ورود اطلاعات واقعی سازمان و کارکنان خواهد بود و دکمه‌های «غیرفعال‌سازی» و «بایگانی» تنها روی پرسنل ثبت‌شده توسط شما اعمال می‌گردد.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPurgeModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handlePurgeDefaults}
                disabled={submittingPurge}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {submittingPurge ? (
                  <span>در حال پاک‌سازی...</span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>تایید و پاک‌سازی پرسنل پیش‌فرض</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: Delete Single Employee Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-base font-bold text-rose-700">
                <Trash2 className="w-5 h-5" />
                <span>حذف قطعی پرسنل</span>
              </div>
              <button
                onClick={() => setDeleteTarget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p>
                آیا از حذف دائم پرسنل <strong className="text-slate-900 font-bold">{deleteTarget.fullName}</strong> با کد پرسنلی <strong className="font-mono text-[#102D3A]">{deleteTarget.employeeCode}</strong> اطمینان دارید؟
              </p>
              {deleteTarget.isDefault && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px]">
                  این پرسنل از حساب‌های پیش‌فرض اولیه سیستم است و حذف آن هیچ‌گونه آسیبی به اطلاعات اصلی یا عملکرد سامانه وارد نخواهد کرد.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleDeleteEmployee}
                disabled={submittingDelete}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {submittingDelete ? (
                  <span>در حال حذف...</span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>حذف قطعی پرسنل</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { EmployeeProfile, User, ShiftMode } from '../types';
import { formatJalaliDate, toPersianDigits, SHAMSI_WEEKDAYS } from '../utils/jalali';
import {
  UserCheck,
  Shield,
  Lock,
  Phone,
  CreditCard,
  Heart,
  Save,
  Clock,
  Calendar,
  Cake,
  Repeat,
  CheckCircle2,
  Users
} from 'lucide-react';

interface ProfileViewProps {
  currentUser: User;
  allUsers?: User[];
}

export const ProfileView: React.FC<ProfileViewProps> = ({ currentUser, allUsers = [] }) => {
  const isManagerOrAdmin = currentUser.role === 'super_admin' || currentUser.role === 'manager';

  // Target employee ID to inspect/edit
  const [targetEmployeeId, setTargetEmployeeId] = useState<string>(currentUser.id);

  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  // Editable fields (Personnel Contact)
  const [landline, setLandline] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Managerial Shift & Schedule settings
  const [shiftMode, setShiftMode] = useState<ShiftMode>('morning');
  const [customShiftStart, setCustomShiftStart] = useState('08:00');
  const [customShiftEnd, setCustomShiftEnd] = useState('14:00');
  const [customDurationMinutes, setCustomDurationMinutes] = useState(360);
  const [allowedLatenessMinutes, setAllowedLatenessMinutes] = useState(15);
  const [earlyDepartureGraceMinutes, setEarlyDepartureGraceMinutes] = useState(10);
  const [weeklyOffDays, setWeeklyOffDays] = useState<number[]>([6]); // Default: Friday (index 6 in Shamsi)
  const [birthDate, setBirthDate] = useState('1995-01-01');

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchProfile = async (empId: string) => {
    try {
      setLoading(true);
      const res = await api.getProfile(empId);
      setUser(res.user);
      setProfile(res.profile);
      setLandline(res.profile.landline || '');
      setEmergencyName(res.profile.emergencyContactName || '');
      setEmergencyRelation(res.profile.emergencyContactRelation || '');
      setEmergencyPhone(res.profile.emergencyContactPhone || '');

      // Load shift & scheduling settings
      setShiftMode(res.profile.shiftMode || 'morning');
      setCustomShiftStart(res.profile.customShiftStart || '08:00');
      setCustomShiftEnd(res.profile.customShiftEnd || '14:00');
      setCustomDurationMinutes(res.profile.customShiftDurationMinutes || 360);
      setAllowedLatenessMinutes(res.profile.allowedLatenessMinutes ?? 15);
      setEarlyDepartureGraceMinutes(res.profile.earlyDepartureGraceMinutes ?? 10);
      setWeeklyOffDays(res.profile.weeklyOffDays || [6]);
      setBirthDate(res.profile.birthDate || '1995-01-01');
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', text: err.message || 'خطا در دریافت پرونده پرسنلی' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile(targetEmployeeId);
  }, [targetEmployeeId]);

  const toggleWeeklyOffDay = (dayIndex: number) => {
    setWeeklyOffDays((prev) =>
      prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);

      const payload: Partial<EmployeeProfile> = {
        landline,
        emergencyContactName: emergencyName,
        emergencyContactRelation: emergencyRelation,
        emergencyContactPhone: emergencyPhone
      };

      if (isManagerOrAdmin) {
        payload.shiftMode = shiftMode;
        payload.customShiftStart = customShiftStart;
        payload.customShiftEnd = customShiftEnd;
        payload.customShiftDurationMinutes = Number(customDurationMinutes);
        payload.allowedLatenessMinutes = Number(allowedLatenessMinutes);
        payload.earlyDepartureGraceMinutes = Number(earlyDepartureGraceMinutes);
        payload.weeklyOffDays = weeklyOffDays;
        payload.birthDate = birthDate;
      }

      const updated = await api.updateProfile(targetEmployeeId, payload);
      setProfile(updated);
      setEditing(false);
      setFeedback({ type: 'success', text: 'ساعات کاری و اطلاعات پرونده با موفقیت در سامانه ذخیره گردید.' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'خطا در ویرایش اطلاعات' });
    } finally {
      setSubmitting(false);
    }
  };

  const getShiftModeLabel = (mode?: ShiftMode) => {
    switch (mode) {
      case 'morning':
        return 'شیفت صبح (۰۸:۰۰ الی ۱۴:۰۰)';
      case 'evening':
        return 'شیفت عصر (۱۴:۰۰ الی ۲۰:۰۰)';
      case 'both':
        return 'دو شیفت هم‌زمان (صبح و عصر - ثبت ورود مستقل برای هر دو شیفت)';
      case 'rotating':
        return 'شیفت چرخشی در طول روز (تطبیق هوشمند صبح/عصر با ساعت مراجعه)';
      case 'custom':
        return 'شیفت سفارشی با ساعات اختصاصی';
      default:
        return 'شیفت صبح استاندارد';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Employee Switcher for Managers */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">پرونده پرسنلی و تنظیمات شیفت کاری</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            تعریف ساعات ورود و خروج، مدت زمان موظفی شیفت، روزهای تعطیل هفتگی و اطلاعات هویتی
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Employee selector for managers / admin */}
          {isManagerOrAdmin && allUsers.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200 text-xs">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-600 font-medium">انتخاب پرسنل:</span>
              <select
                value={targetEmployeeId}
                onChange={(e) => {
                  setTargetEmployeeId(e.target.value);
                  setEditing(false);
                }}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-800"
              >
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.department})
                  </option>
                ))}
              </select>
            </div>
          )}

          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 bg-[#102D3A] hover:bg-[#1A4456] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              ویرایش اطلاعات و شیفت
            </button>
          ) : (
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              انصراف
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-lg text-xs flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {loading || !profile || !user ? (
        <div className="text-center py-12 text-xs text-slate-400">در حال بارگذاری پرونده...</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Managerial Shift & Work Hours Configuration */}
          <div className="bg-white rounded-xl border border-amber-200/80 shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#D9C28D]" />
                <span>تعریف شیفت کاری، ساعات ورود/خروج و تعطیلات کاری پرسنل (پنل سرپرست)</span>
              </h3>
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                مبنای ثبت تاخیر، تعجیل و غیبت
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
              {/* Shift Mode Selector */}
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-slate-700 font-bold mb-1.5">
                  نوع شیفت و الگوی تردد پرسنل *
                </label>
                {editing && isManagerOrAdmin ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      {
                        mode: 'morning',
                        title: 'شیفت صبح',
                        desc: '۰۸:۰۰ الی ۱۴:۰۰ - موظف ۶ ساعت'
                      },
                      {
                        mode: 'evening',
                        title: 'شیفت عصر',
                        desc: '۱۴:۰۰ الی ۲۰:۰۰ - موظف ۶ ساعت'
                      },
                      {
                        mode: 'both',
                        title: 'دو شیفت (صبح و عصر)',
                        desc: 'امکان حضور در صبح یا عصر یا هر دو شیفت در یک روز با ثبت تردد مستقل'
                      },
                      {
                        mode: 'rotating',
                        title: 'شیفت چرخشی در طول روز',
                        desc: 'تشخیص خودکار صبح (قبل ۱۳) یا عصر (بعد ۱۳) بر مبنای زمان ورود'
                      },
                      {
                        mode: 'custom',
                        title: 'شیفت سفارشی اختصاصی',
                        desc: 'تعریف دقیق ساعات شروع و پایان و طول شیفت'
                      }
                    ].map((item) => (
                      <div
                        key={item.mode}
                        onClick={() => setShiftMode(item.mode as ShiftMode)}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          shiftMode === item.mode
                            ? 'bg-amber-50/80 border-[#D9C28D] ring-1 ring-[#D9C28D]'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{item.title}</span>
                          {shiftMode === item.mode && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                          {item.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 text-sm">{getShiftModeLabel(profile.shiftMode)}</span>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        تردد، تاخیر و تعجیل بر مبنای این شیفت ارزیابی می‌گردد.
                      </p>
                    </div>
                    <Repeat className="w-5 h-5 text-slate-400" />
                  </div>
                )}
              </div>

              {/* Start Time */}
              <div>
                <span className="text-slate-600 block font-medium">ساعت رسمی شروع شیفت (ورود)</span>
                {editing && isManagerOrAdmin ? (
                  <input
                    type="time"
                    value={customShiftStart}
                    onChange={(e) => setCustomShiftStart(e.target.value)}
                    className="mt-1 p-2 rounded-lg border border-slate-300 w-full font-mono text-center"
                  />
                ) : (
                  <span className="font-mono font-bold text-slate-900 text-sm mt-1 block tabular-nums">
                    {toPersianDigits(profile.customShiftStart || '08:00')}
                  </span>
                )}
              </div>

              {/* End Time */}
              <div>
                <span className="text-slate-600 block font-medium">ساعت رسمی پایان شیفت (خروج)</span>
                {editing && isManagerOrAdmin ? (
                  <input
                    type="time"
                    value={customShiftEnd}
                    onChange={(e) => setCustomShiftEnd(e.target.value)}
                    className="mt-1 p-2 rounded-lg border border-slate-300 w-full font-mono text-center"
                  />
                ) : (
                  <span className="font-mono font-bold text-slate-900 text-sm mt-1 block tabular-nums">
                    {toPersianDigits(profile.customShiftEnd || '14:00')}
                  </span>
                )}
              </div>

              {/* Duration Minutes */}
              <div>
                <span className="text-slate-600 block font-medium">طول موظفی شیفت (دقیقه)</span>
                {editing && isManagerOrAdmin ? (
                  <input
                    type="number"
                    min="60"
                    step="15"
                    value={customDurationMinutes}
                    onChange={(e) => setCustomDurationMinutes(Number(e.target.value))}
                    className="mt-1 p-2 rounded-lg border border-slate-300 w-full font-mono text-center"
                  />
                ) : (
                  <span className="font-mono font-bold text-slate-900 text-sm mt-1 block tabular-nums">
                    {toPersianDigits(profile.customShiftDurationMinutes || 360)} دقیقه ({toPersianDigits((profile.customShiftDurationMinutes || 360) / 60)} ساعت)
                  </span>
                )}
              </div>

              {/* Allowed Lateness Minutes */}
              <div>
                <span className="text-slate-600 block font-medium">فرجه مجاز تاخیر ورود (دقیقه)</span>
                {editing && isManagerOrAdmin ? (
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={allowedLatenessMinutes}
                    onChange={(e) => setAllowedLatenessMinutes(Number(e.target.value))}
                    className="mt-1 p-2 rounded-lg border border-slate-300 w-full font-mono text-center"
                  />
                ) : (
                  <span className="font-mono font-bold text-slate-800 mt-1 block tabular-nums">
                    {toPersianDigits(profile.allowedLatenessMinutes ?? 15)} دقیقه
                  </span>
                )}
              </div>

              {/* Early Departure Grace Minutes */}
              <div>
                <span className="text-slate-600 block font-medium">مهلت مجاز تعجیل خروج (دقیقه)</span>
                {editing && isManagerOrAdmin ? (
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={earlyDepartureGraceMinutes}
                    onChange={(e) => setEarlyDepartureGraceMinutes(Number(e.target.value))}
                    className="mt-1 p-2 rounded-lg border border-slate-300 w-full font-mono text-center"
                  />
                ) : (
                  <span className="font-mono font-bold text-slate-800 mt-1 block tabular-nums">
                    {toPersianDigits(profile.earlyDepartureGraceMinutes ?? 10)} دقیقه
                  </span>
                )}
              </div>

              {/* Weekly Off Days Selection */}
              <div className="sm:col-span-2 lg:col-span-3 pt-2 border-t border-slate-100">
                <span className="text-slate-700 block font-bold mb-2">
                  روزهای تعطیل کاری هفتگی پرسنل (هفته شمسی از شنبه تا جمعه):
                </span>
                <p className="text-[11px] text-slate-500 mb-3">
                  عدم حضور پرسنل در این روزها به عنوان غیبت غیرمجاز ثبت نمی‌گردد.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  {SHAMSI_WEEKDAYS.map((dayName, idx) => {
                    const isOff = weeklyOffDays.includes(idx);
                    return (
                      <button
                        type="button"
                        key={idx}
                        disabled={!editing || !isManagerOrAdmin}
                        onClick={() => toggleWeeklyOffDay(idx)}
                        className={`p-2.5 rounded-lg border text-center transition-colors ${
                          isOff
                            ? 'bg-rose-50 border-rose-300 text-rose-900 font-bold'
                            : 'bg-white border-slate-200 text-slate-700'
                        } ${editing && isManagerOrAdmin ? 'cursor-pointer hover:border-slate-400' : 'cursor-default'}`}
                      >
                        <div className="text-xs">{dayName}</div>
                        <div className="text-[10px] mt-0.5">
                          {isOff ? 'تعطیل هفتگی' : 'روز کاری'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Main Official Info Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#D9C28D]" />
                <span>مشخصات هویتی و پرسنلی رسمی</span>
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-[#102D3A] text-[#D9C28D] px-2.5 py-1 rounded-lg font-mono font-bold shadow-xs">
                  کد پرسنلی: {user.employeeCode || '---'}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  user.status === 'active'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : user.status === 'inactive'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-300'
                }`}>
                  {user.status === 'active' ? 'حساب فعال' : user.status === 'inactive' ? 'حساب غیرفعال' : 'بایگانی‌شده'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2">
              <div>
                <span className="text-slate-500 block">کد پرسنلی یکتا (دائمی)</span>
                <span className="font-mono font-black text-[#102D3A] text-sm mt-0.5 block">
                  {user.employeeCode || '---'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">نام و نام خانوادگی</span>
                <span className="font-bold text-slate-900 mt-0.5 block">{user.fullName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">کد ملی</span>
                <span className="font-mono font-bold text-slate-800 mt-0.5 block tabular-nums">
                  {toPersianDigits(profile.nationalId)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">تاریخ تولد (موتور تبریک و یادآوری مدیر)</span>
                {editing && isManagerOrAdmin ? (
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="mt-1 p-2 rounded-lg border border-slate-300 w-full"
                  />
                ) : (
                  <span className="text-slate-800 mt-0.5 block tabular-nums font-semibold flex items-center gap-1.5">
                    <Cake className="w-3.5 h-3.5 text-amber-600" />
                    <span>{formatJalaliDate(profile.birthDate)}</span>
                  </span>
                )}
              </div>
              <div>
                <span className="text-slate-500 block">بخش تخصصی آزمایشگاه</span>
                <span className="text-slate-800 mt-0.5 block">{user.department}</span>
              </div>
              <div>
                <span className="text-slate-500 block">شماره تلفن همراه</span>
                <span className="font-mono text-slate-800 mt-0.5 block tabular-nums">
                  {toPersianDigits(user.mobile)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">تلفن ثابت</span>
                {editing ? (
                  <input
                    type="text"
                    value={landline}
                    onChange={(e) => setLandline(e.target.value)}
                    className="mt-1 p-2 rounded-lg border border-slate-200 w-full"
                  />
                ) : (
                  <span className="font-mono text-slate-800 mt-0.5 block tabular-nums">
                    {profile.landline ? toPersianDigits(profile.landline) : 'ثبت نشده'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-600" />
              <span>اطلاعات تماس اضطراری (محدود به حوادث و مواقع بحرانی)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2">
              <div>
                <span className="text-slate-500 block">نام مخاطب اضطراری</span>
                {editing ? (
                  <input
                    type="text"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    className="mt-1 p-2 rounded-lg border border-slate-200 w-full"
                  />
                ) : (
                  <span className="font-semibold text-slate-800 mt-0.5 block">
                    {profile.emergencyContactName}
                  </span>
                )}
              </div>

              <div>
                <span className="text-slate-500 block">نسبت</span>
                {editing ? (
                  <input
                    type="text"
                    value={emergencyRelation}
                    onChange={(e) => setEmergencyRelation(e.target.value)}
                    className="mt-1 p-2 rounded-lg border border-slate-200 w-full"
                  />
                ) : (
                  <span className="text-slate-700 mt-0.5 block">
                    {profile.emergencyContactRelation}
                  </span>
                )}
              </div>

              <div>
                <span className="text-slate-500 block">شماره تماس اضطراری</span>
                {editing ? (
                  <input
                    type="text"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    className="mt-1 p-2 rounded-lg border border-slate-200 w-full"
                  />
                ) : (
                  <span className="font-mono text-slate-800 mt-0.5 block tabular-nums">
                    {toPersianDigits(profile.emergencyContactPhone)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Banking details with strict mask */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-600" />
                <span>اطلاعات بانکی پرداخت حقوق و مزایا</span>
              </h3>
              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>دسترسی محافظت‌شده و ماسک‌دار</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
              <div>
                <span className="text-slate-500 block">شماره حساب بانکی حقوق</span>
                <span className="font-mono font-bold text-slate-800 mt-1 block tabular-nums">
                  {profile.bankAccount}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">شماره شبا (IBAN)</span>
                <span className="font-mono font-bold text-slate-800 mt-1 block tabular-nums">
                  {profile.iban}
                </span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                طبق ماده ۱۱، اطلاعات بانکی پرسنل صرفاً برای مدیر ارشد مالی قابل رویت بوده و در گزارشات عمومی حضور و غیاب ماسک می‌شود.
              </span>
            </div>
          </div>

          {editing && (
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-1.5 px-6 py-3 bg-[#102D3A] hover:bg-[#1A4456] text-white text-xs font-semibold rounded-lg shadow-md transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4 text-[#D9C28D]" />
                <span>{submitting ? 'در حال ذخیره...' : 'ذخیره تنظیمات شیفت و مشخصات'}</span>
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
};

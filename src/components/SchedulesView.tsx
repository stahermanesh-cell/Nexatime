import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { ShiftTemplate, User, WorkSchedule, LabHoliday } from '../types';
import {
  formatJalaliDate,
  formatJalaliDateWithDay,
  toPersianDigits,
  SHAMSI_WEEKDAYS,
  toJalali
} from '../utils/jalali';
import {
  Calendar,
  Plus,
  Clock,
  Users,
  CheckCircle2,
  ShieldCheck,
  CalendarHeart,
  Trash2,
  AlertCircle,
  Sun,
  Moon,
  Coffee
} from 'lucide-react';

interface SchedulesViewProps {
  currentUser: User;
  allUsers: User[];
  onRefreshAll?: () => void;
}

export const SchedulesView: React.FC<SchedulesViewProps> = ({ currentUser, allUsers, onRefreshAll }) => {
  const [shifts, setShifts] = useState<ShiftTemplate[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [holidays, setHolidays] = useState<LabHoliday[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCreateShiftModal, setShowCreateShiftModal] = useState(false);
  const [showAddHolidayModal, setShowAddHolidayModal] = useState(false);

  // Form states - Assign Schedule
  const [selectedEmpId, setSelectedEmpId] = useState(allUsers[0]?.id || '');
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [assignDate, setAssignDate] = useState(new Date().toISOString().split('T')[0]);
  const [isRestDay, setIsRestDay] = useState(false);

  // Form states - Add Holiday
  const [holidayDate, setHolidayDate] = useState(new Date().toISOString().split('T')[0]);
  const [holidayTitle, setHolidayTitle] = useState('');
  const [isOfficialHoliday, setIsOfficialHoliday] = useState(false);
  const [holidayNotes, setHolidayNotes] = useState('');

  // Form states - New shift template
  const [shiftName, setShiftName] = useState('');
  const [shiftStart, setShiftStart] = useState('08:00');
  const [shiftEnd, setShiftEnd] = useState('14:00');
  const [shiftColor, setShiftColor] = useState('#0D9488');

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [shiftsData, schedulesData, holidaysData] = await Promise.all([
        api.getShifts(),
        api.getSchedules(),
        api.getHolidays()
      ]);
      setShifts(shiftsData);
      setSchedules(schedulesData);
      setHolidays(holidaysData);
      if (shiftsData.length > 0 && !selectedShiftId) {
        setSelectedShiftId(shiftsData[0].id);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'خطا در بارگذاری شیفت‌ها و تعطیلات' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAssignSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.assignSchedule({
        employeeId: selectedEmpId,
        dateString: assignDate,
        shiftTemplateId: selectedShiftId,
        isRestDay
      });
      setShowAssignModal(false);
      setFeedback({ type: 'success', text: 'شیفت کاری با موفقیت برای پرسنل تخصیص یافت.' });
      fetchData();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'خطا در تخصیص شیفت' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayTitle.trim() || !holidayDate) return;

    try {
      setSubmitting(true);
      await api.createHoliday({
        dateString: holidayDate,
        title: holidayTitle,
        isOfficial: isOfficialHoliday,
        appliesToAll: true,
        notes: holidayNotes
      });
      setShowAddHolidayModal(false);
      setHolidayTitle('');
      setHolidayNotes('');
      setFeedback({
        type: 'success',
        text: `روز ${holidayDate} با موفقیت به عنوان ${isOfficialHoliday ? 'تعطیل رسمی' : 'تعطیلی ویژه آزمایشگاه'} ثبت شد.`
      });
      fetchData();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'خطا در ثبت روز تعطیل' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteHoliday = async (id: string, title: string) => {
    if (!confirm(`آیا از حذف روز تعطیل "${title}" اطمینان دارید؟`)) return;
    try {
      await api.deleteHoliday(id);
      setFeedback({ type: 'success', text: 'تعطیلی با موفقیت حذف گردید.' });
      fetchData();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'خطا در حذف تعطیلی' });
    }
  };

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftName.trim()) return;

    try {
      setSubmitting(true);
      await api.createShift({
        name: shiftName,
        startTime: shiftStart,
        endTime: shiftEnd,
        color: shiftColor,
        scheduledDurationMinutes: 360,
        breakDurationMinutes: 30,
        isPaidBreak: true,
        allowedLatenessMinutes: 15
      });
      setShowCreateShiftModal(false);
      setShiftName('');
      setFeedback({ type: 'success', text: 'الگوی شیفت جدید ایجاد گردید.' });
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'خطا در تعریف شیفت' });
    } finally {
      setSubmitting(false);
    }
  };

  const isManagerOrAdmin = currentUser.role === 'super_admin' || currentUser.role === 'manager';

  // Calculate dates of the current Shamsi week (Saturday to Friday)
  const getShamsiWeekDays = () => {
    const now = new Date();
    // JS getDay(): Sunday = 0, Monday = 1, ..., Saturday = 6
    const jsDay = now.getDay();
    // In Iran week starts on Saturday:
    // Saturday -> offset 0
    // Sunday -> offset 1
    // ...
    // Friday -> offset 6
    const daysSinceSaturday = (jsDay + 1) % 7;

    const saturday = new Date(now);
    saturday.setDate(now.getDate() - daysSinceSaturday);

    const weekDays: Array<{
      dayIndex: number;
      dayName: string;
      date: Date;
      dateString: string;
      jalaliStr: string;
    }> = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(saturday);
      d.setDate(saturday.getDate() + i);
      const dateString = d.toISOString().split('T')[0];
      const j = toJalali(d);
      weekDays.push({
        dayIndex: i,
        dayName: SHAMSI_WEEKDAYS[i],
        date: d,
        dateString,
        jalaliStr: `${toPersianDigits(j.jd)} ${
          ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'][j.jm - 1]
        }`
      });
    }

    return weekDays;
  };

  const shamsiWeek = getShamsiWeekDays();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">تقویم کاری شمسی، شیفت‌ها و تعطیلات آزمایشگاه</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            آغاز هفته از شنبه بر اساس تقویم شمسی، تعریف تعطیلات اختصاصی آزمایشگاه ترنج و شیفت‌های کاری
          </p>
        </div>

        {isManagerOrAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAddHolidayModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-800 hover:bg-rose-100 text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <CalendarHeart className="w-4 h-4 text-rose-600" />
              <span>ثبت روز تعطیل در تقویم</span>
            </button>

            <button
              onClick={() => setShowAssignModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#102D3A] hover:bg-[#1A4456] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-[#D9C28D]" />
              <span>تخصیص شیفت به پرسنل</span>
            </button>

            {currentUser.role === 'super_admin' && (
              <button
                onClick={() => setShowCreateShiftModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>تعریف الگوی شیفت</span>
              </button>
            )}
          </div>
        )}
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

      {/* Shamsi Weekly Calendar Grid (Saturday to Friday) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#D9C28D]" />
            <h3 className="text-sm font-bold text-slate-900">
              تقویم هفتگی شمسی آزمایشگاه ترنج (هفته جاری: شنبه تا جمعه)
            </h3>
          </div>
          <div className="text-xs text-slate-500">
            امروز: <span className="font-bold text-slate-800">{formatJalaliDateWithDay(new Date())}</span>
          </div>
        </div>

        {/* 7 Columns: شنبه to جمعه */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {shamsiWeek.map((day) => {
            const isToday = day.dateString === new Date().toISOString().split('T')[0];
            const holiday = holidays.find((h) => h.dateString === day.dateString);
            const daySchedules = schedules.filter((s) => s.dateString === day.dateString);

            return (
              <div
                key={day.dateString}
                className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                  isToday
                    ? 'border-[#102D3A] ring-2 ring-[#102D3A]/20 bg-slate-50/90'
                    : holiday
                    ? 'border-rose-200 bg-rose-50/40'
                    : 'border-slate-200 bg-white hover:bg-slate-50/50'
                }`}
              >
                <div>
                  {/* Day Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className={`text-xs font-bold ${isToday ? 'text-[#102D3A]' : 'text-slate-800'}`}>
                      {day.dayName}
                    </span>
                    {isToday && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#102D3A] text-white">
                        امروز
                      </span>
                    )}
                  </div>

                  {/* Jalali Date */}
                  <div className="text-[11px] font-mono text-slate-500 mt-1 tabular-nums">
                    {day.jalaliStr}
                  </div>

                  {/* Holiday Badge if present */}
                  {holiday && (
                    <div
                      className={`mt-2 p-1.5 rounded text-[11px] font-bold border ${
                        holiday.isOfficial
                          ? 'bg-rose-100/80 text-rose-900 border-rose-300'
                          : 'bg-amber-100/80 text-amber-900 border-amber-300'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <Coffee className="w-3 h-3 shrink-0" />
                        <span className="truncate">{holiday.title}</span>
                      </div>
                      <span className="text-[9px] block opacity-80 mt-0.5">
                        {holiday.isOfficial ? 'تعطیل رسمی تقویم' : 'تعطیلی ویژه آزمایشگاه'}
                      </span>
                    </div>
                  )}

                  {/* Friday default off-day label if no custom holiday */}
                  {!holiday && day.dayIndex === 6 && (
                    <div className="mt-2 p-1.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
                      <Coffee className="w-3 h-3" />
                      <span>تعطیل پایان هفته</span>
                    </div>
                  )}

                  {/* Day Schedules count */}
                  <div className="mt-3 space-y-1">
                    {daySchedules.length > 0 ? (
                      daySchedules.map((sch) => {
                        const emp = allUsers.find((u) => u.id === sch.employeeId);
                        const sh = shifts.find((s) => s.id === sch.shiftTemplateId);
                        return (
                          <div
                            key={sch.id}
                            className="text-[10px] p-1 rounded bg-slate-100 text-slate-700 flex items-center justify-between"
                          >
                            <span className="font-semibold truncate">{emp?.fullName.split(' ')[0]}</span>
                            <span className="text-slate-500 truncate">{sh?.code || 'شیفت'}</span>
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-[10px] text-slate-400 block pt-1">شیفت‌های جاری پرسنل</span>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                  <span>{toPersianDigits(day.dateString.slice(5))}</span>
                  {daySchedules.length > 0 && (
                    <span className="text-emerald-700 font-bold">
                      {toPersianDigits(daySchedules.length)} شیفت
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Registered Holidays Management List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CalendarHeart className="w-4 h-4 text-rose-600" />
            <h3 className="text-sm font-bold text-slate-900">
              تعطیلات ثبت‌شده در تقویم کاری آزمایشگاه (رسمی و اختصاصی)
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            مجموع: {toPersianDigits(holidays.length)} روز تعطیل
          </span>
        </div>

        {holidays.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">
            هنوز تعطیلی خاصی ثبت نشده است. با زدن دکمه "ثبت روز تعطیل در تقویم" می‌توانید مناسبت‌های رسمی یا تعطیلی آزمایشگاه را تعریف فرمایید.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {holidays.map((h) => (
              <div
                key={h.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{h.title}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        h.isOfficial
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {h.isOfficial ? 'رسمی کشور' : 'ویژه آزمایشگاه ترنج'}
                    </span>
                  </div>
                  <div className="text-slate-600 font-mono text-[11px] tabular-nums">
                    تاریخ: {formatJalaliDate(h.dateString)} ({h.dateString})
                  </div>
                  {h.notes && <p className="text-slate-500 text-[11px]">{h.notes}</p>}
                </div>

                {isManagerOrAdmin && (
                  <button
                    onClick={() => handleDeleteHoliday(h.id, h.title)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-white transition-colors cursor-pointer"
                    title="حذف تعطیلی"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shift Templates Overview */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-700">الگوهای شیفت فعال در آزمایشگاه ترنج</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shifts.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900">{s.name}</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded text-white" style={{ backgroundColor: s.color }}>
                  {s.code}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span>ساعات کاری:</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {toPersianDigits(s.startTime)} الی {toPersianDigits(s.endTime)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>مدت موظفی:</span>
                  <span>{toPersianDigits(s.scheduledDurationMinutes / 60)} ساعت</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>فرجه تاخیر مجاز:</span>
                  <span>{toPersianDigits(s.allowedLatenessMinutes)} دقیقه</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>استراحت/نماز:</span>
                  <span>{toPersianDigits(s.breakDurationMinutes)} دقیقه ({s.isPaidBreak ? 'با حقوق' : 'بدون حقوق'})</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Assigned Schedules Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900">برنامه کاری ثبت‌شده پرسنل</h3>
          <span className="text-xs text-slate-500">تاریخ امروز: {formatJalaliDate(new Date())}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-4">پرسنل</th>
                <th className="py-3 px-4">تاریخ شیفت</th>
                <th className="py-3 px-4">عنوان شیفت</th>
                <th className="py-3 px-4">ساعت موظف</th>
                <th className="py-3 px-4">وضعیت روز</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {schedules.map((sch) => {
                const user = allUsers.find((u) => u.id === sch.employeeId);
                const shiftObj = shifts.find((s) => s.id === sch.shiftTemplateId);
                return (
                  <tr key={sch.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-bold text-slate-900">{user?.fullName || sch.employeeId}</td>
                    <td className="py-3 px-4 tabular-nums text-slate-600">{formatJalaliDate(sch.dateString)}</td>
                    <td className="py-3 px-4 text-slate-800 font-medium">{shiftObj?.name || 'شیفت نامشخص'}</td>
                    <td className="py-3 px-4 tabular-nums text-slate-600">
                      {shiftObj ? `${toPersianDigits(shiftObj.startTime)} - ${toPersianDigits(shiftObj.endTime)}` : '--'}
                    </td>
                    <td className="py-3 px-4">
                      {sch.isRestDay ? (
                        <span className="text-amber-700 font-semibold">روز استراحت</span>
                      ) : (
                        <span className="text-emerald-700">موظف به حضور</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Holiday */}
      {showAddHolidayModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-right space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">ثبت روز تعطیل در تقویم آزمایشگاه</h3>
              <button onClick={() => setShowAddHolidayModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleAddHoliday} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">تاریخ تعطیلی *</label>
                <input
                  type="date"
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">عنوان و مناسبت تعطیلی *</label>
                <input
                  type="text"
                  value={holidayTitle}
                  onChange={(e) => setHolidayTitle(e.target.value)}
                  placeholder="مثال: تعطیلی سراسری عید نوروز یا تعمیرات دوره‌ای دستگاه‌ها"
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-200"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <input
                  type="checkbox"
                  id="isOfficial"
                  checked={isOfficialHoliday}
                  onChange={(e) => setIsOfficialHoliday(e.target.checked)}
                  className="w-4 h-4 text-[#102D3A] rounded"
                />
                <label htmlFor="isOfficial" className="text-slate-700 font-medium cursor-pointer">
                  این روز جزو تعطیلات رسمی تقویم کشور است (در غیر اینصورت تعطیلی داخلی آزمایشگاه محسوب می‌شود)
                </label>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">یادداشت و توضیحات تکمیلی</label>
                <textarea
                  value={holidayNotes}
                  onChange={(e) => setHolidayNotes(e.target.value)}
                  placeholder="توضیحات بخشنامه یا ابلاغیه مدیریت..."
                  rows={2}
                  className="w-full p-2.5 rounded-lg border border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddHolidayModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-white bg-rose-700 hover:bg-rose-800 rounded-lg font-semibold cursor-pointer"
                >
                  ثبت تعطیلی در تقویم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Assign Schedule */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-right space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">تخصیص شیفت کاری به پرسنل</h3>
              <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleAssignSchedule} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">انتخاب پرسنل *</label>
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-white"
                >
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">تاریخ برنامه *</label>
                <input
                  type="date"
                  value={assignDate}
                  onChange={(e) => setAssignDate(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">الگوی شیفت *</label>
                <select
                  value={selectedShiftId}
                  onChange={(e) => setSelectedShiftId(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-white"
                >
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.startTime} الی {s.endTime})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isRestDay"
                  checked={isRestDay}
                  onChange={(e) => setIsRestDay(e.target.checked)}
                  className="w-4 h-4 text-[#102D3A] rounded"
                />
                <label htmlFor="isRestDay" className="text-slate-700 font-medium">
                  این روز به عنوان روز استراحت پرسنل منظور شود
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-white bg-[#102D3A] hover:bg-[#1A4456] rounded-lg font-semibold cursor-pointer"
                >
                  ثبت شیفت
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Shift Template */}
      {showCreateShiftModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-right space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">تعریف الگوی شیفت جدید</h3>
              <button onClick={() => setShowCreateShiftModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateShift} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">نام شیفت *</label>
                <input
                  type="text"
                  value={shiftName}
                  onChange={(e) => setShiftName(e.target.value)}
                  placeholder="مثال: شیفت ویژه کشیک شب"
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">ساعت شروع</label>
                  <input
                    type="time"
                    value={shiftStart}
                    onChange={(e) => setShiftStart(e.target.value)}
                    required
                    className="w-full p-2.5 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">ساعت پایان</label>
                  <input
                    type="time"
                    value={shiftEnd}
                    onChange={(e) => setShiftEnd(e.target.value)}
                    required
                    className="w-full p-2.5 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">رنگ برچسب شیفت</label>
                <input
                  type="color"
                  value={shiftColor}
                  onChange={(e) => setShiftColor(e.target.value)}
                  className="w-full h-9 rounded border border-slate-200 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateShiftModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-white bg-[#102D3A] hover:bg-[#1A4456] rounded-lg font-semibold cursor-pointer"
                >
                  ایجاد شیفت
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

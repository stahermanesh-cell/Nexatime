import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { AttendanceEvent, AttendanceSession, GPSPolicy, ShiftTemplate, WorkSchedule, User } from '../types';
import {
  formatJalaliDate,
  formatJalaliDateTime,
  formatTime,
  toPersianDigits,
  formatDurationMinutes
} from '../utils/jalali';
import {
  LogIn,
  LogOut,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Compass,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Send,
  Cake,
  Sparkles,
  Repeat
} from 'lucide-react';

interface AttendanceViewProps {
  currentUser: User;
  onRefreshAll?: () => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({ currentUser, onRefreshAll }) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [openSession, setOpenSession] = useState<AttendanceSession | null>(null);
  const [schedule, setSchedule] = useState<WorkSchedule | null>(null);
  const [shift, setShift] = useState<ShiftTemplate | null>(null);
  const [todayEvents, setTodayEvents] = useState<AttendanceEvent[]>([]);
  const [gpsPolicy, setGpsPolicy] = useState<GPSPolicy | null>(null);
  const [serverTime, setServerTime] = useState<string>('');

  // Birthday greeting modal upon check-in
  const [birthdayAlertGreeting, setBirthdayAlertGreeting] = useState<string | null>(null);

  // GPS Simulation / Hardware state
  const [gpsMode, setGpsMode] = useState<'real' | 'lab_valid' | 'out_of_bounds' | 'low_accuracy' | 'disabled'>('lab_valid');
  const [realCoords, setRealCoords] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [gettingRealGps, setGettingRealGps] = useState(false);

  // Status message
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Exception request modal
  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const [exceptionReason, setExceptionReason] = useState('');
  const [exceptionEventType, setExceptionEventType] = useState<'check_in' | 'check_out'>('check_in');

  // Elapsed time counter for active open session
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await api.getAttendanceStatus();
      setOpenSession(res.openSession || null);
      setSchedule(res.schedule || null);
      setShift(res.shift || null);
      setTodayEvents(res.todayEvents || []);
      setGpsPolicy(res.gpsPolicy || null);
      setServerTime(res.serverTime || '');
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: err.message || 'خطا در دریافت وضعیت حضور' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [currentUser.id]);

  useEffect(() => {
    if (!openSession) {
      setElapsedMinutes(0);
      return;
    }
    const updateElapsed = () => {
      const checkInDate = new Date(openSession.checkInTime);
      const now = new Date();
      const diff = Math.max(0, Math.floor((now.getTime() - checkInDate.getTime()) / 60000));
      setElapsedMinutes(diff);
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 30000);
    return () => clearInterval(interval);
  }, [openSession]);

  // Request browser geolocation
  const handleGetRealGps = () => {
    if (!navigator.geolocation) {
      setStatusMessage({ type: 'error', text: 'مرورگر شما از قابلیت مکان‌یابی پشتیبانی نمی‌کند.' });
      return;
    }
    setGettingRealGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRealCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
        setGpsMode('real');
        setGettingRealGps(false);
        setStatusMessage({
          type: 'success',
          text: `موقعیت جغرافیایی واقعی مرورگر دریافت شد (دقت: ${toPersianDigits(Math.round(pos.coords.accuracy))} متر)`
        });
      },
      (err) => {
        setGettingRealGps(false);
        let msg = 'خطا در دریافت موقعیت مکانی مرورگر.';
        if (err.code === 1) msg = 'دسترسی به موقعیت مکانی توسط کاربر رد شد.';
        else if (err.code === 2) msg = 'سیگنال موقعیت مکانی در دسترس نیست.';
        else if (err.code === 3) msg = 'زمان پاسخ‌دهی GPS به پایان رسید.';
        setStatusMessage({ type: 'warning', text: `${msg} می‌توانید از حالت شبیه‌ساز جهت آزمایش سامانه استفاده فرمایید.` });
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const getEffectiveCoords = () => {
    if (gpsMode === 'disabled') return undefined;
    if (gpsMode === 'real') return realCoords || undefined;
    if (gpsMode === 'out_of_bounds') {
      // 35.7750, 51.4200 is ~2.5km away from Toranj Lab (35.7592, 51.4116)
      return { latitude: 35.775, longitude: 51.42, accuracy: 15 };
    }
    if (gpsMode === 'low_accuracy') {
      return { latitude: 35.7592, longitude: 51.4116, accuracy: 140 }; // Accuracy worse than 80m threshold
    }
    // Default valid Toranj lab location
    return { latitude: 35.75921, longitude: 51.41159, accuracy: 12 };
  };

  const handleCheckIn = async () => {
    try {
      setSubmitting(true);
      setStatusMessage(null);
      const coords = getEffectiveCoords();
      const res = await api.checkIn({
        coords,
        deviceInfo: navigator.userAgent
      });

      if (res.birthdayGreeting) {
        setBirthdayAlertGreeting(res.birthdayGreeting);
      }

      setStatusMessage({ type: 'success', text: res.message });
      fetchStatus();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'خطا در ثبت ورود'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setSubmitting(true);
      setStatusMessage(null);
      const coords = getEffectiveCoords();
      const res = await api.checkOut({
        coords,
        deviceInfo: navigator.userAgent
      });

      if (res.pendingMandatoryTasksWarning) {
        setStatusMessage({
          type: 'warning',
          text: `${res.message} - ${res.pendingMandatoryTasksWarning}`
        });
      } else {
        setStatusMessage({ type: 'success', text: res.message });
      }

      fetchStatus();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'خطا در ثبت خروج'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitException = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exceptionReason.trim()) return;

    try {
      setSubmitting(true);
      const coords = getEffectiveCoords();
      await api.submitGPSException({
        eventType: exceptionEventType,
        coords,
        distanceMeters: 500,
        reason: exceptionReason
      });
      setShowExceptionModal(false);
      setExceptionReason('');
      setStatusMessage({
        type: 'success',
        text: 'درخواست استثنای موقعیت مکانی برای سرپرست مربوطه ارسال شد.'
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'خطا در ثبت درخواست استثنا' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert banner if exists */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-start justify-between gap-3 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : statusMessage.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : statusMessage.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>

          {statusMessage.type === 'error' && gpsPolicy?.allowExceptionRequest && (
            <button
              onClick={() => {
                setExceptionEventType(openSession ? 'check_out' : 'check_in');
                setShowExceptionModal(true);
              }}
              className="px-2.5 py-1 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 rounded text-[11px] font-medium shrink-0 cursor-pointer"
            >
              ثبت درخواست استثنا
            </button>
          )}
        </div>
      )}

      {/* Main Attendance Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">
                برنامه کاری امروز ({formatJalaliDate(new Date())})
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-600">
                {currentUser.fullName} ({currentUser.department})
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <h2 className="text-lg font-bold text-slate-900">
                {shift ? shift.name : 'شیفت استاندارد آزمایشگاه ترنج (۰۸:۰۰ الی ۱۴:۰۰)'}
              </h2>
              {openSession?.shiftType && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                  {openSession.shiftType === 'morning'
                    ? 'شیفت صبح'
                    : openSession.shiftType === 'evening'
                    ? 'شیفت عصر'
                    : openSession.shiftType === 'rotating'
                    ? 'شیفت چرخشی'
                    : 'شیفت اختصاصی'}
                </span>
              )}
            </div>
          </div>

          {/* Current Session Indicator */}
          <div className="flex items-center gap-2">
            {openSession ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>حاضر در شیفت کاری</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span>خارج از شیفت (ورود ثبت نشده)</span>
              </div>
            )}
          </div>
        </div>

        {/* Live Metrics Grid if Checked In */}
        {openSession && (
          <div className="space-y-3 my-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div>
                <span className="text-xs text-slate-500 block">ساعت ثبت ورود رسمی (سرور)</span>
                <span className="text-base font-bold text-slate-900 tabular-nums">
                  {formatTime(openSession.checkInTime)}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">مدت زمان حضور تا این لحظه</span>
                <span className="text-base font-bold text-[#102D3A] tabular-nums">
                  {formatDurationMinutes(elapsedMinutes)}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">وضعیت تاخیر ورود اولیه</span>
                <span className="text-base font-bold text-slate-700 tabular-nums">
                  {openSession.latenessMinutes > 0
                    ? `${toPersianDigits(openSession.latenessMinutes)} دقیقه تاخیر`
                    : 'بدون تاخیر (بموقع)'}
                </span>
              </div>
            </div>

            {(openSession.hourlyLeaveCoveredMinutes || 0) > 0 && (
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                <span>
                  این تردد تحت پوشش مرخصی ساعتی مصوب به مدت {toPersianDigits(openSession.hourlyLeaveCoveredMinutes!)} دقیقه قرار دارد و جریمه تاخیر/تعجیل آن بخشوده شده است.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Primary Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
          {/* Check-In Button */}
          <button
            onClick={handleCheckIn}
            disabled={submitting || !!openSession}
            className={`flex items-center justify-center gap-2.5 py-4 px-6 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              openSession
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                : 'bg-[#102D3A] hover:bg-[#1A4456] text-white shadow-md hover:shadow-lg'
            }`}
          >
            <LogIn className="w-5 h-5 text-[#D9C28D]" />
            <span>{submitting ? 'در حال ثبت ورود...' : 'ثبت ورود به آزمایشگاه'}</span>
          </button>

          {/* Check-Out Button */}
          <button
            onClick={handleCheckOut}
            disabled={submitting || !openSession}
            className={`flex items-center justify-center gap-2.5 py-4 px-6 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              !openSession
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                : 'bg-rose-700 hover:bg-rose-800 text-white shadow-md hover:shadow-lg'
            }`}
          >
            <LogOut className="w-5 h-5 text-rose-200" />
            <span>{submitting ? 'در حال ثبت خروج...' : 'ثبت خروج از شیفت'}</span>
          </button>
        </div>

        {/* Mandatory Tasks & Checkout Non-Blocking Notice */}
        <div className="p-3.5 rounded-lg bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">تضمین عدم توقف خروج پرسنل در حضور وظایف باز:</p>
            <p className="text-amber-800 text-[11px] leading-relaxed">
              بر اساس ماده ۱۲ ضوابط داخلی ترنج، هیچ وظیفه‌ای (اعم از اجباری یا اختیاری) مانع ثبت خروج پرسنل در پایان شیفت نخواهد بود. در صورت وجود وظایف اجباری تاییدنشده، خروج شما ثبت شده و موضوع صرفاً جهت یادآوری در کارتابل سرپرست نشانه‌گذاری می‌شود.
            </p>
          </div>
        </div>

        {/* GPS Verification & Simulator Section */}
        <div className="mt-8 pt-6 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#D9C28D]" />
              <h3 className="text-xs font-bold text-slate-900">
                تنظیمات و راستی‌آزمایی موقعیت مکانی (GPS Verification)
              </h3>
            </div>
            <div className="text-[11px] text-slate-500">
              سیاست اعمال‌شده: {gpsPolicy?.required ? `الزامی (حداکثر ${toPersianDigits(gpsPolicy.allowedRadiusMeters)} متر)` : 'معافیت اختیاری'}
            </div>
          </div>

          {/* Location Mode Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
            <button
              onClick={() => setGpsMode('lab_valid')}
              className={`p-2.5 rounded-lg border text-right transition-colors cursor-pointer ${
                gpsMode === 'lab_valid'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="font-medium">آزمایشگاه ترنج (مجاز)</div>
              <div className="text-[10px] text-slate-500 mt-0.5">فاصله: ۵ متر · دقت: ۱۲ متر</div>
            </button>

            <button
              onClick={() => setGpsMode('out_of_bounds')}
              className={`p-2.5 rounded-lg border text-right transition-colors cursor-pointer ${
                gpsMode === 'out_of_bounds'
                  ? 'bg-rose-50 border-rose-300 text-rose-900 font-semibold'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="font-medium">خارج از محدوده (تست خطا)</div>
              <div className="text-[10px] text-slate-500 mt-0.5">فاصله: ۲.۵ کیلومتر · فعال‌سازی استثنا</div>
            </button>

            <button
              onClick={() => setGpsMode('low_accuracy')}
              className={`p-2.5 rounded-lg border text-right transition-colors cursor-pointer ${
                gpsMode === 'low_accuracy'
                  ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="font-medium">دقت ضعیف GPS</div>
              <div className="text-[10px] text-slate-500 mt-0.5">خطای دقت: ۱۴۰ متر ({'>'} ۸۰متر)</div>
            </button>

            <button
              onClick={handleGetRealGps}
              disabled={gettingRealGps}
              className={`p-2.5 rounded-lg border text-right transition-colors cursor-pointer ${
                gpsMode === 'real'
                  ? 'bg-blue-50 border-blue-300 text-blue-900 font-semibold'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="font-medium flex items-center justify-between">
                <span>GPS واقعی مرورگر</span>
                {gettingRealGps && <span className="animate-spin text-blue-600">●</span>}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {realCoords ? `دریافت شد (${Math.round(realCoords.accuracy)}m)` : 'کلیک جهت دریافت سنسور'}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Today's Events Timeline */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" />
          <span>سوابق رویدادهای حضور امروز (لاگ‌های دارای تاییدیه سرور)</span>
        </h3>

        {todayEvents.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            هنوز رویداد ثبتی برای امروز وجود ندارد. با زدن دکمه ثبت ورود، رویداد در سرور ثبت می‌گردد.
          </div>
        ) : (
          <div className="space-y-3">
            {todayEvents.map((evt) => (
              <div
                key={evt.id}
                className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                      evt.eventType === 'check_in'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {evt.eventType === 'check_in' ? 'ورود' : 'خروج'}
                  </div>

                  <div>
                    <span className="font-semibold text-slate-900">
                      {evt.eventType === 'check_in' ? 'ثبت ورود به شیفت' : 'ثبت خروج از شیفت'}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      ساعت سرور: {formatJalaliDateTime(evt.serverTimestamp)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {evt.locationResult === 'verified'
                        ? `تایید شده (${toPersianDigits(evt.distanceMeters || 0)} متر)`
                        : evt.locationResult === 'gps_optional_exempt'
                        ? 'معافیت GPS'
                        : evt.locationResult === 'override_approved'
                        ? 'تایید با استثنا'
                        : evt.locationResult}
                    </span>
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-400">دستگاه شخصی</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exception Request Modal */}
      {showExceptionModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-right space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                درخواست مجوز استثنای موقعیت مکانی
              </h3>
              <button
                onClick={() => setShowExceptionModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              چنانچه به دلیل ماموریت، قطع اینترنت، یا کالیبراسیون تجهیزات در خارج از آزمایشگاه حضور دارید، دلیل خود را جهت تایید سرپرست یادداشت فرمایید:
            </p>

            <form onSubmit={handleSubmitException} className="space-y-3">
              <textarea
                value={exceptionReason}
                onChange={(e) => setExceptionReason(e.target.value)}
                placeholder="توضیح ضرورت ثبت تردد خارج از شعاع مجاز آزمایشگاه..."
                rows={3}
                required
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#102D3A]"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExceptionModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#102D3A] hover:bg-[#1A4456] rounded-lg cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5 text-[#D9C28D]" />
                  <span>ارسال به سرپرست</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Birthday Celebration Modal upon Check-In */}
      {birthdayAlertGreeting && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-gradient-to-b from-white via-amber-50/50 to-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center space-y-4 border border-amber-200">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#D9C28D] to-amber-500 text-white flex items-center justify-center mx-auto shadow-lg ring-4 ring-amber-100">
              <Cake className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-center gap-1.5 text-amber-700 font-bold text-sm">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>تبریک زادروز از سوی مدیریت آزمایشگاه ترنج</span>
                <Sparkles className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-medium px-2">
                {birthdayAlertGreeting}
              </p>
            </div>

            <div className="pt-2 border-t border-amber-100">
              <button
                onClick={() => setBirthdayAlertGreeting(null)}
                className="w-full py-2.5 bg-[#102D3A] hover:bg-[#1A4456] text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer"
              >
                سپاسگزارم (شروع شیفت کاری)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

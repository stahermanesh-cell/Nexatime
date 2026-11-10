import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { CenterSettings, User } from '../types';
import { toPersianDigits, SHAMSI_WEEKDAYS } from '../utils/jalali';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  ShieldCheck,
  Save,
  CheckCircle2,
  AlertCircle,
  FileBadge,
  Compass,
  RefreshCw
} from 'lucide-react';

interface CenterSettingsViewProps {
  currentUser: User;
  onSettingsUpdated?: (settings: CenterSettings) => void;
}

export const CenterSettingsView: React.FC<CenterSettingsViewProps> = ({
  currentUser,
  onSettingsUpdated
}) => {
  const [settings, setSettings] = useState<CenterSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form states
  const [centerName, setCenterName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [phoneMain, setPhoneMain] = useState('');
  const [phoneSecondary, setPhoneSecondary] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [gpsLat, setGpsLat] = useState(35.7592);
  const [gpsLng, setGpsLng] = useState(51.4116);
  const [allowedRadiusMeters, setAllowedRadiusMeters] = useState(100);
  const [timeZone, setTimeZone] = useState('Asia/Tehran');
  const [workingDays, setWorkingDays] = useState<number[]>([0, 1, 2, 3, 4, 5]);
  const [defaultWorkStart, setDefaultWorkStart] = useState('07:30');
  const [defaultWorkEnd, setDefaultWorkEnd] = useState('15:30');
  const [defaultLatenessToleranceMinutes, setDefaultLatenessToleranceMinutes] = useState(15);
  const [defaultOvertimeAutoApprove, setDefaultOvertimeAutoApprove] = useState(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await api.getCenterSettings();
      setSettings(data);
      setCenterName(data.centerName || '');
      setLogoUrl(data.logoUrl || '');
      setLicenseNumber(data.licenseNumber || '');
      setAddress(data.address || '');
      setCity(data.city || 'تهران');
      setProvince(data.province || 'تهران');
      setPhoneMain(data.phoneMain || '');
      setPhoneSecondary(data.phoneSecondary || '');
      setEmail(data.email || '');
      setWebsite(data.website || '');
      setGpsLat(data.gpsLat ?? 35.7592);
      setGpsLng(data.gpsLng ?? 51.4116);
      setAllowedRadiusMeters(data.allowedRadiusMeters ?? 100);
      setTimeZone(data.timeZone || 'Asia/Tehran');
      setWorkingDays(data.workingDays || [0, 1, 2, 3, 4, 5]);
      setDefaultWorkStart(data.defaultWorkStart || '07:30');
      setDefaultWorkEnd(data.defaultWorkEnd || '15:30');
      setDefaultLatenessToleranceMinutes(data.defaultLatenessToleranceMinutes ?? 15);
      setDefaultOvertimeAutoApprove(!!data.defaultOvertimeAutoApprove);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'خطا در بارگذاری اطلاعات مرکز' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const toggleWorkingDay = (dayIdx: number) => {
    setWorkingDays((prev) =>
      prev.includes(dayIdx) ? prev.filter((d) => d !== dayIdx) : [...prev, dayIdx]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role !== 'super_admin') {
      setFeedback({ type: 'error', message: 'تنها مدیر ارشد مجاز به ویرایش تنظیمات مرکز است.' });
      return;
    }

    try {
      setSaving(true);
      setFeedback(null);

      const payload: Partial<CenterSettings> = {
        centerName: centerName.trim(),
        logoUrl: logoUrl.trim(),
        licenseNumber: licenseNumber.trim(),
        address: address.trim(),
        city: city.trim(),
        province: province.trim(),
        phoneMain: phoneMain.trim(),
        phoneSecondary: phoneSecondary.trim(),
        email: email.trim(),
        website: website.trim(),
        gpsLat: Number(gpsLat),
        gpsLng: Number(gpsLng),
        allowedRadiusMeters: Number(allowedRadiusMeters),
        timeZone,
        workingDays,
        defaultWorkStart,
        defaultWorkEnd,
        defaultLatenessToleranceMinutes: Number(defaultLatenessToleranceMinutes),
        defaultOvertimeAutoApprove
      };

      const updated = await api.updateCenterSettings(payload);
      setSettings(updated);
      setFeedback({
        type: 'success',
        message: 'تنظیمات مرکز با موفقیت ذخیره شد و در تمامی بخش‌های سامانه و گزارشات اعمال گردید.'
      });

      if (onSettingsUpdated) {
        onSettingsUpdated(updated);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'خطا در ذخیره‌سازی اطلاعات مرکز.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin text-[#102D3A] ml-2" />
        <span>در حال بارگذاری اطلاعات سازمانی مرکز...</span>
      </div>
    );
  }

  const isSuperAdmin = currentUser.role === 'super_admin';

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#102D3A] to-[#1A4456] rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#D9C28D] to-[#B89F64] flex items-center justify-center text-[#102D3A] shadow-inner font-extrabold text-2xl">
            {centerName.substring(0, 1) || 'ت'}
          </div>
          <div>
            <h1 className="text-xl font-black flex items-center gap-2">
              تنظیمات مرکز و هویت سازمانی
              <span className="text-xs bg-[#D9C28D]/20 text-[#D9C28D] border border-[#D9C28D]/30 px-2.5 py-0.5 rounded-full font-normal">
                مدیریت ارشد
              </span>
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              مدیریت اطلاعات ثبتی، پروانه، نشانی، شعاع مکانی GPS، ساعات کار و اطلاعات تماس مرکز بدون نیاز به تغییر کد منبع
            </p>
          </div>
        </div>

        {isSuperAdmin && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D9C28D] to-[#B89F64] text-[#102D3A] font-bold text-xs shadow hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>در حال ذخیره...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>ذخیره تغییرات مرکز</span>
              </>
            )}
          </button>
        )}
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

      {!isSuperAdmin && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-700" />
          <span>تنها مدیر ارشد آزمایشگاه دسترسی ویرایش به تنظیمات مرکز را دارد. شما در حال مشاهده اطلاعات هستید.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Input Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Identity & Licensing */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-sm font-bold text-[#102D3A]">
              <Building2 className="w-4 h-4 text-[#B89F64]" />
              <span>هویت سازمانی و شماره پروانه</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  نام کامل مرکز / آزمایشگاه <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={!isSuperAdmin}
                  value={centerName}
                  onChange={(e) => setCenterName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#102D3A] focus:ring-1 focus:ring-[#102D3A] disabled:bg-slate-50"
                  placeholder="مثال: آزمایشگاه پاتوبیولوژی و ژنتیک ترنج"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  شماره نظام پزشکی / پروانه تاسیس <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <FileBadge className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    required
                    disabled={!isSuperAdmin}
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#102D3A] focus:ring-1 focus:ring-[#102D3A] font-mono disabled:bg-slate-50"
                    placeholder="L-1402-98721"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  آدرس تصویر لوگوی مرکز (URL یا مسیر محلی)
                </label>
                <input
                  type="text"
                  disabled={!isSuperAdmin}
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#102D3A] focus:ring-1 focus:ring-[#102D3A] font-mono text-left disabled:bg-slate-50"
                  placeholder="/assets/toranj_logo.svg"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Contact & Address */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-sm font-bold text-[#102D3A]">
              <Phone className="w-4 h-4 text-[#B89F64]" />
              <span>نشانی و اطلاعات تماس</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">استان</label>
                <input
                  type="text"
                  disabled={!isSuperAdmin}
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#102D3A] disabled:bg-slate-50"
                  placeholder="تهران"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">شهر</label>
                <input
                  type="text"
                  disabled={!isSuperAdmin}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#102D3A] disabled:bg-slate-50"
                  placeholder="تهران"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  آدرس کامل مرکز <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  disabled={!isSuperAdmin}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#102D3A] disabled:bg-slate-50"
                  placeholder="خیابان ولیعصر، بالاتر از میرداماد، پلاک ۱۲"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  تلفن تماس اصلی <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={!isSuperAdmin}
                  value={phoneMain}
                  onChange={(e) => setPhoneMain(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#102D3A] font-mono text-left disabled:bg-slate-50"
                  placeholder="۰۲۱-۸۸۷۷۶۶۵۵"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">تلفن تماس دوم / پشتیبان</label>
                <input
                  type="text"
                  disabled={!isSuperAdmin}
                  value={phoneSecondary}
                  onChange={(e) => setPhoneSecondary(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#102D3A] font-mono text-left disabled:bg-slate-50"
                  placeholder="۰۲۱-۸۸۷۷۶۶۵۶"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ایمیل رسمی مرکز</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="email"
                    disabled={!isSuperAdmin}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#102D3A] font-mono text-left disabled:bg-slate-50"
                    placeholder="info@toranjlab.ir"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">وب‌سایت رسمی</label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="url"
                    disabled={!isSuperAdmin}
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#102D3A] font-mono text-left disabled:bg-slate-50"
                    placeholder="https://toranjlab.ir"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: GPS Coordinates & Radius */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-sm font-bold text-[#102D3A]">
              <Compass className="w-4 h-4 text-[#B89F64]" />
              <span>موقعیت جغرافیایی GPS و شعاع مجاز تردد</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  عرض جغرافیایی (Latitude) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  disabled={!isSuperAdmin}
                  value={gpsLat}
                  onChange={(e) => setGpsLat(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#102D3A] font-mono text-left disabled:bg-slate-50"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  طول جغرافیایی (Longitude) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  disabled={!isSuperAdmin}
                  value={gpsLng}
                  onChange={(e) => setGpsLng(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#102D3A] font-mono text-left disabled:bg-slate-50"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  شعاع مجاز تردد (متر) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="20"
                  max="1000"
                  required
                  disabled={!isSuperAdmin}
                  value={allowedRadiusMeters}
                  onChange={(e) => setAllowedRadiusMeters(parseInt(e.target.value, 10) || 100)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#102D3A] font-mono text-left disabled:bg-slate-50"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* Card 4: Working Days & Working Hours */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-sm font-bold text-[#102D3A]">
              <Clock className="w-4 h-4 text-[#B89F64]" />
              <span>روزهای کاری و ساعات عمومی مرکز</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                روزهای کاری فعال مرکز در تقویم شمسی
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {SHAMSI_WEEKDAYS.map((dayName, idx) => {
                  const isChecked = workingDays.includes(idx);
                  return (
                    <button
                      type="button"
                      key={dayName}
                      disabled={!isSuperAdmin}
                      onClick={() => toggleWorkingDay(idx)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border text-center transition-colors cursor-pointer disabled:cursor-default ${
                        isChecked
                          ? 'bg-[#102D3A] text-white border-[#102D3A]'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {dayName}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ساعت شروع عمومی</label>
                <input
                  type="time"
                  disabled={!isSuperAdmin}
                  value={defaultWorkStart}
                  onChange={(e) => setDefaultWorkStart(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 font-mono text-center disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ساعت پایان عمومی</label>
                <input
                  type="time"
                  disabled={!isSuperAdmin}
                  value={defaultWorkEnd}
                  onChange={(e) => setDefaultWorkEnd(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 font-mono text-center disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">فرجه تاخیر مجاز (دقیقه)</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  disabled={!isSuperAdmin}
                  value={defaultLatenessToleranceMinutes}
                  onChange={(e) => setDefaultLatenessToleranceMinutes(parseInt(e.target.value, 10) || 15)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 font-mono text-center disabled:bg-slate-50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Column: Live Preview & System Info */}
        <div className="space-y-6">
          {/* Card: Live Identity Preview */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              پیش‌نمایش زنده در سربرگ و گزارشات
            </h3>

            {/* Official Report Header Preview */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#102D3A] text-[#D9C28D] flex items-center justify-center font-bold text-sm shadow-sm">
                    {centerName.substring(0, 1) || 'ت'}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 leading-tight">{centerName || 'نام مرکز'}</h4>
                    <span className="text-[10px] text-slate-500">پروانه: {licenseNumber || '---'}</span>
                  </div>
                </div>
                <div className="text-left text-[10px] text-slate-400 font-mono">
                  {toPersianDigits('1405/08/19')}
                </div>
              </div>

              <div className="text-[11px] text-slate-600 space-y-1">
                <div className="flex items-start gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{address || 'آدرس آزمایشگاه'}</span>
                </div>
                <div className="flex items-center gap-1 font-mono text-[10px]">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{phoneMain || 'تلفن تماس'}</span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg p-3 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>عدم وابستگی به کدهای ثابت</span>
              </div>
              <p className="text-[10px] text-emerald-700 leading-relaxed">
                هرگونه تغییر در این صفحه مستقیما در بانک اطلاعاتی پایدار ذخیره شده و در صفحه لاگین، داشبورد، سربرگ‌ها و پرینت‌ها بازتاب می‌یابد و به هیچ وجه روی کدهای پرسنلی یا سوابق تردد قبلی تاثیری ندارد.
              </p>
            </div>
          </div>

          {/* Card: Audit & Version metadata */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3 text-xs text-slate-600">
            <h4 className="font-bold text-slate-800">مشخصات فنی و استقرار</h4>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">موتور پایگاه داده:</span>
                <span className="font-medium text-slate-800">Persistent Relational Store</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">نسخه اسکیما:</span>
                <span className="font-mono text-slate-800">Migration v4</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">منطقه زمانی:</span>
                <span className="font-mono text-slate-800">{timeZone}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">وضعیت استقلال سرویس:</span>
                <span className="text-emerald-700 font-medium">مستقل بدون نیاز به VPN</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">آخرین بروزرسانی:</span>
                <span className="text-slate-700">{settings?.updatedAt ? new Date(settings.updatedAt).toLocaleDateString('fa-IR') : 'پیش‌فرض'}</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

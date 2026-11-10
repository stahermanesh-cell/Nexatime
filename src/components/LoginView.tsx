import React, { useState } from 'react';
import { api, setAuthSession } from '../api/client';
import { User, CenterSettings } from '../types';
import { Building2, Lock, User as UserIcon, AlertCircle, ArrowLeft, ShieldCheck, Phone, MapPin } from 'lucide-react';
import { toPersianDigits } from '../utils/jalali';

interface LoginViewProps {
  centerSettings: CenterSettings | null;
  onLoginSuccess: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ centerSettings, onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password.trim()) {
      setError('نام کاربری و کلمه عبور الزامی است.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.login(username.trim(), password);
      setAuthSession(res.token, res.user.id);
      onLoginSuccess(res.user);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'نام کاربری یا کلمه عبور نادرست است.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (uname: string) => {
    setUsername(uname);
    setPassword('Toranj@123');
  };

  const centerName = centerSettings?.centerName || 'آزمایشگاه پاتوبیولوژی و ژنتیک ترنج';
  const logoUrl = centerSettings?.logoUrl;
  const address = centerSettings?.address;
  const phoneMain = centerSettings?.phoneMain;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0c222c] via-[#102D3A] to-[#163c4e] flex flex-col justify-between p-4 sm:p-6 text-slate-100" dir="rtl">
      {/* Top Header */}
      <div className="max-w-md mx-auto w-full pt-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded-xl object-contain bg-white/10 p-1 border border-white/20" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-[#D9C28D]/40 flex items-center justify-center font-bold text-[#D9C28D] shadow-inner text-lg">
              ت
            </div>
          )}
          <div>
            <h1 className="text-sm font-bold text-white">{centerName}</h1>
            <p className="text-[11px] text-[#D9C28D]/90 font-medium">سامانه جامع حضور و غیاب، کارتابل و امنیت سازمانی</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-[11px] text-emerald-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>امنیت سخت‌گیرانه v4</span>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="max-w-md mx-auto w-full my-auto py-6">
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 text-slate-900 border border-slate-100 space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-lg font-bold text-slate-900">ورود به سامانه پرسنلی</h2>
            <p className="text-xs text-slate-500">
              لطفاً جهت ثبت تردد و دسترسی به وظایف سازمانی، احراز هویت نمایید.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                نام کاربری یا کد پرسنلی
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثال: dr_hosseini یا EMP-000001"
                  required
                  dir="ltr"
                  className="w-full text-xs pl-3 pr-9 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#102D3A] focus:border-transparent text-left font-mono"
                />
                <UserIcon className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                کلمه عبور
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  dir="ltr"
                  className="w-full text-xs pl-3 pr-9 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#102D3A] focus:border-transparent text-left font-mono"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              </div>
            </div>

            <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
              <p className="font-semibold text-slate-700 mb-1">سیاست امنیتی نشست:</p>
              <p>ورود شما از طریق کوکی‌های محافظت‌شده HttpOnly و رمزنگاری bcrypt کنترل می‌شود. حساب‌های غیرفعال یا بایگانی‌شده مسدود می‌گردند.</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#102D3A] hover:bg-[#1A4456] text-white text-xs font-bold rounded-lg shadow transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>در حال بررسی اعتبارنامه...</span>
              ) : (
                <>
                  <span>ورود امن به سامانه</span>
                  <ArrowLeft className="w-4 h-4 text-[#D9C28D]" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Switcher / Credentials */}
          <div className="pt-4 border-t border-slate-100">
            <p className="text-[11px] font-semibold text-slate-600 mb-2">حساب‌های آزمایشی (کلمه عبور پیش‌فرض: <code className="bg-slate-100 px-1 py-0.5 rounded text-[#102D3A] font-mono">Toranj@123</code>):</p>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => handleQuickLogin('dr_hosseini')}
                className="p-2 rounded-lg border border-slate-200 hover:border-[#102D3A] hover:bg-slate-50 text-right transition"
              >
                <div className="font-bold text-slate-900">دکتر حسینی</div>
                <div className="text-slate-500 text-[10px]">مدیر ارشد (Super Admin)</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('m_mohammadi')}
                className="p-2 rounded-lg border border-slate-200 hover:border-[#102D3A] hover:bg-slate-50 text-right transition"
              >
                <div className="font-bold text-slate-900">مریم محمدی</div>
                <div className="text-slate-500 text-[10px]">سرپرست بیوشیمی (Manager)</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('a_taheri')}
                className="p-2 rounded-lg border border-slate-200 hover:border-[#102D3A] hover:bg-slate-50 text-right transition"
              >
                <div className="font-bold text-slate-900">علی طاهری</div>
                <div className="text-slate-500 text-[10px]">کارشناس هماتولوژی</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('s_karimi')}
                className="p-2 rounded-lg border border-slate-200 hover:border-[#102D3A] hover:bg-slate-50 text-right transition"
              >
                <div className="font-bold text-slate-900">سارا کریمی</div>
                <div className="text-slate-500 text-[10px]">کارشناس شیفت چرخشی</div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <footer className="max-w-md mx-auto w-full pb-4 text-center text-[11px] text-white/60 space-y-1">
        {address && (
          <p className="flex items-center justify-center gap-1">
            <MapPin className="w-3 h-3 text-[#D9C28D]" />
            <span>{address}</span>
          </p>
        )}
        {phoneMain && (
          <p className="flex items-center justify-center gap-1">
            <Phone className="w-3 h-3 text-[#D9C28D]" />
            <span>تماس: {toPersianDigits(phoneMain)}</span>
          </p>
        )}
        <p className="text-[10px] text-white/40 pt-1">
          تمامی حقوق و داده‌های پرسنلی محفوظ و تحت پروتکل‌های امنیت سایبری نگهداری می‌شود.
        </p>
      </footer>
    </div>
  );
};

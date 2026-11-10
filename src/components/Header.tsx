import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { formatJalaliDateWithDay, toPersianDigits } from '../utils/jalali';
import { api } from '../api/client';
import { Bell, Users, ShieldCheck, Clock, CheckCircle2, Cake, Gift, Sparkles, X } from 'lucide-react';

interface HeaderProps {
  currentUser: User;
  allUsers: User[];
  onSwitchUser: (userId: string) => void;
  onOpenNotifications: () => void;
  onLogout?: () => void;
  unreadNotifsCount: number;
  centerName?: string;
  logoUrl?: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  allUsers,
  onSwitchUser,
  onOpenNotifications,
  onLogout,
  unreadNotifsCount,
  centerName,
  logoUrl
}) => {
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Birthday states
  const [birthdayGreeting, setBirthdayGreeting] = useState<{
    isBirthday: boolean;
    isToday: boolean;
    isYesterday: boolean;
    message: string;
  } | null>(null);
  const [managerReminders, setManagerReminders] = useState<Array<{
    employeeId: string;
    employeeName: string;
    department: string;
    birthDate: string;
    type: 'in_two_days' | 'today' | 'yesterday';
    daysLeft: number;
    message: string;
  }>>([]);
  const [showBirthdayBanner, setShowBirthdayBanner] = useState(true);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format in Tehran timezone
      const tehranDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
      const h = String(tehranDate.getHours()).padStart(2, '0');
      const m = String(tehranDate.getMinutes()).padStart(2, '0');
      const s = String(tehranDate.getSeconds()).padStart(2, '0');
      setCurrentTimeStr(toPersianDigits(`${h}:${m}:${s}`));
      setCurrentDateStr(formatJalaliDateWithDay(now));
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchBirthdayStatus = async () => {
      try {
        const res = await api.getBirthdaysStatus();
        setBirthdayGreeting(res.employeeGreeting);
        setManagerReminders(res.managerReminders || []);
        setShowBirthdayBanner(true);
      } catch (err) {
        console.error('Failed to load birthday status:', err);
      }
    };
    fetchBirthdayStatus();
  }, [currentUser.id]);

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'مدیر ارشد آزمایشگاه';
      case 'manager':
        return 'سرپرست بخش';
      case 'employee':
        return 'کارشناس / پرسنل';
      default:
        return role;
    }
  };

  const isSuperAdmin = currentUser.role === 'super_admin';

  return (
    <>
      <header className="bg-[#102D3A] text-white border-b border-[#1A4456] sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand Zone */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#D9C28D] to-[#B89F64] flex items-center justify-center text-[#102D3A] font-extrabold text-lg shadow-inner">
              {centerName ? centerName.substring(0, 1) : 'ت'}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-white flex items-center gap-2">
                {centerName || 'سامانه حضور و وظایف آزمایشگاه ترنج'}
              </span>
              <span className="text-[11px] text-[#D9C28D]/90 hidden sm:inline">
                کد پرسنلی شما: {currentUser.employeeCode || '---'}
              </span>
            </div>
          </div>

          {/* Live Tehran Time & Jalali Date (Zone 2) */}
          <div className="hidden md:flex items-center gap-3 bg-[#0A1E27]/70 px-3.5 py-1.5 rounded-lg border border-[#1A4456] text-xs">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-[#D9C28D]" />
              <span className="tabular-nums font-mono font-medium text-white">{currentTimeStr}</span>
            </div>
            <span className="text-slate-600">|</span>
            <span className="text-slate-300">{currentDateStr}</span>
            <span className="text-slate-600">|</span>
            <span className="text-[#D9C28D] font-medium text-[11px]">تهران (UTC+3:30)</span>
          </div>

          {/* User Account & Switcher (Zone 3) */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Notification Button */}
            <button
              onClick={onOpenNotifications}
              className="relative p-2 text-slate-300 hover:text-white hover:bg-[#1A4456] rounded-lg transition-colors cursor-pointer"
              title="اعلان‌ها"
              aria-label="اعلان‌ها"
            >
              <Bell className="w-5 h-5" />
              {unreadNotifsCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-[#D97706] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {toPersianDigits(unreadNotifsCount)}
                </span>
              )}
            </button>

            {/* User Profile / Menu Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2.5 p-1.5 pr-2.5 rounded-lg bg-[#0A1E27] hover:bg-[#1A4456] border border-[#1A4456] transition-colors cursor-pointer text-right"
              >
                <div className="w-7 h-7 rounded-md bg-[#1A4456] text-[#D9C28D] flex items-center justify-center text-xs font-bold border border-[#D9C28D]/30">
                  {currentUser.fullName.charAt(0)}
                </div>
                <div className="hidden sm:flex flex-col">
                  <span className="text-xs font-semibold text-white leading-tight">
                    {currentUser.fullName}
                  </span>
                  <span className="text-[10px] text-[#D9C28D] leading-tight font-mono">
                    {currentUser.employeeCode || getRoleLabel(currentUser.role)}
                  </span>
                </div>
                <Users className="w-3.5 h-3.5 text-slate-400 ml-1" />
              </button>

              {/* Menu Modal / Dropdown */}
              {showUserMenu && (
                <div className="absolute left-0 mt-2 w-72 bg-white text-slate-800 rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900">{currentUser.fullName}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      کد پرسنلی: <span className="font-mono font-bold text-[#102D3A]">{currentUser.employeeCode || '---'}</span>
                    </p>
                    <p className="text-[10px] text-slate-400">
                      بخش: {currentUser.department} · {getRoleLabel(currentUser.role)}
                    </p>
                  </div>

                  {/* Super Admin Audited Impersonation Switcher */}
                  {isSuperAdmin && allUsers.length > 0 && (
                    <>
                      <div className="px-3.5 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        ورود آزمایشی پرسنل (Super Admin Impersonation)
                      </div>
                      <div className="max-h-56 overflow-y-auto py-1">
                        {allUsers.map((user) => (
                          <button
                            key={user.id}
                            onClick={() => {
                              onSwitchUser(user.id);
                              setShowUserMenu(false);
                            }}
                            className={`w-full px-3.5 py-2 text-right text-xs flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                              user.id === currentUser.id ? 'bg-amber-50/70 text-[#102D3A] font-semibold' : 'text-slate-700'
                            }`}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{user.fullName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {user.employeeCode} · {getRoleLabel(user.role)}
                              </span>
                            </div>
                            {user.id === currentUser.id && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Logout Button */}
                  {onLogout && (
                    <div className="pt-2 border-t border-slate-100 px-2">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onLogout();
                        }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        <span>خروج امن از حساب کاربری</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Birthday Celebration Banner for Employee (Today or Yesterday) */}
      {birthdayGreeting && showBirthdayBanner && (
        <div className="bg-gradient-to-r from-amber-500 via-[#D9C28D] to-amber-600 text-[#102D3A] px-4 py-2.5 shadow-md border-b border-amber-300">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center shrink-0 shadow-sm text-amber-700">
                <Cake className="w-4 h-4" />
              </div>
              <div className="font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-white" />
                <span>{birthdayGreeting.message}</span>
              </div>
            </div>
            <button
              onClick={() => setShowBirthdayBanner(false)}
              className="text-[#102D3A]/70 hover:text-[#102D3A] p-1 rounded hover:bg-white/20 transition-colors cursor-pointer"
              title="بستن پیام"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Birthday Reminder Banner for Managers (2 days ahead, today, yesterday) */}
      {managerReminders.length > 0 && (
        <div className="bg-[#0A1E27] text-amber-200 border-b border-[#1A4456] px-4 py-2 text-xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex items-center gap-2 shrink-0">
              <Gift className="w-4 h-4 text-[#D9C28D]" />
              <span className="font-semibold text-white">یادآوری تولد پرسنل برای مدیر:</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto">
              {managerReminders.map((rem, idx) => (
                <span
                  key={idx}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border flex items-center gap-1 shrink-0 ${
                    rem.type === 'in_two_days'
                      ? 'bg-amber-900/40 border-amber-500/50 text-amber-300'
                      : rem.type === 'today'
                      ? 'bg-emerald-900/40 border-emerald-500/50 text-emerald-300 font-bold'
                      : 'bg-slate-800 border-slate-600 text-slate-300'
                  }`}
                >
                  <Cake className="w-3 h-3" />
                  <span>{rem.message}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

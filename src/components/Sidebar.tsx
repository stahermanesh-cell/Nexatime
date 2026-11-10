import React from 'react';
import { User } from '../types';
import {
  Clock,
  CheckSquare,
  Inbox,
  LayoutDashboard,
  Calendar,
  FileText,
  BarChart3,
  MapPin,
  UserCheck,
  CheckCircle,
  LogOut,
  Building2,
  Users
} from 'lucide-react';
import { toPersianDigits } from '../utils/jalali';

export type NavTab =
  | 'attendance'
  | 'tasks'
  | 'approvals'
  | 'dashboard'
  | 'employee_mgmt'
  | 'center_settings'
  | 'schedules'
  | 'requests'
  | 'reports'
  | 'gps_policies'
  | 'profile'
  | 'test_runner';

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  currentUser: User;
  pendingApprovalsCount: number;
  pendingTasksCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  currentUser,
  pendingApprovalsCount,
  pendingTasksCount
}) => {
  const isManagerOrAdmin = currentUser.role === 'super_admin' || currentUser.role === 'manager';
  const isSuperAdmin = currentUser.role === 'super_admin';

  const navItems = [
    {
      id: 'attendance' as NavTab,
      label: 'ثبت تردد و ساعت‌زنی',
      icon: Clock,
      visible: true
    },
    {
      id: 'tasks' as NavTab,
      label: 'کارتابل وظایف من',
      icon: CheckSquare,
      visible: true,
      badge: pendingTasksCount > 0 ? toPersianDigits(pendingTasksCount) : undefined,
      badgeColor: 'bg-amber-100 text-amber-800'
    },
    {
      id: 'approvals' as NavTab,
      label: 'کارتابل تاییدات مدیریت',
      icon: Inbox,
      visible: isManagerOrAdmin,
      badge: pendingApprovalsCount > 0 ? toPersianDigits(pendingApprovalsCount) : undefined,
      badgeColor: 'bg-rose-100 text-rose-800'
    },
    {
      id: 'dashboard' as NavTab,
      label: 'داشبورد وضعیت پرسنل',
      icon: LayoutDashboard,
      visible: isManagerOrAdmin
    },
    {
      id: 'employee_mgmt' as NavTab,
      label: 'مدیریت پرسنل و دسترسی‌ها',
      icon: Users,
      visible: isManagerOrAdmin
    },
    {
      id: 'center_settings' as NavTab,
      label: 'تنظیمات مرکز / آزمایشگاه',
      icon: Building2,
      visible: isSuperAdmin
    },
    {
      id: 'schedules' as NavTab,
      label: 'برنامه شیفت و تقویم',
      icon: Calendar,
      visible: true
    },
    {
      id: 'requests' as NavTab,
      label: 'درخواست مرخصی و اصلاح',
      icon: FileText,
      visible: true
    },
    {
      id: 'reports' as NavTab,
      label: 'گزارشات و کارکرد حقوق',
      icon: BarChart3,
      visible: isManagerOrAdmin
    },
    {
      id: 'gps_policies' as NavTab,
      label: 'موقعیت GPS و تنظیمات',
      icon: MapPin,
      visible: isManagerOrAdmin
    },
    {
      id: 'profile' as NavTab,
      label: 'پرونده پرسنلی من',
      icon: UserCheck,
      visible: true
    },
    {
      id: 'test_runner' as NavTab,
      label: 'تست معیارهای پذیرش (۳۲ گانه)',
      icon: CheckCircle,
      visible: true,
      highlight: true
    }
  ];

  return (
    <aside className="w-64 bg-white border-l border-slate-200 shrink-0 flex flex-col justify-between hidden md:flex">
      <div className="py-4 px-3 space-y-1">
        <div className="px-3 pb-3 pt-1 text-[11px] font-semibold text-slate-400 tracking-wider">
          بخش‌های سامانه
        </div>

        {navItems
          .filter((item) => item.visible)
          .map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#102D3A] text-white shadow-sm font-semibold'
                    : item.highlight
                    ? 'bg-amber-50 text-amber-900 hover:bg-amber-100/70 border border-amber-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-[#D9C28D]' : item.highlight ? 'text-amber-700' : 'text-slate-500'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                      isActive ? 'bg-[#D9C28D] text-[#102D3A]' : item.badgeColor
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50">
        <div className="text-[11px] text-slate-500 flex items-center justify-between">
          <span>آزمایشگاه پاتوبیولوژی ترنج</span>
          <span className="text-[10px] text-emerald-600 font-medium">نسخه سازمانی</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-1">
          سامانه پایش حضور و کارتابل پرسنل
        </div>
      </div>
    </aside>
  );
};

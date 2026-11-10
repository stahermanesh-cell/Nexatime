import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { User } from '../types';
import { formatJalaliDate, formatTime, toPersianDigits } from '../utils/jalali';
import {
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Search,
  Filter,
  ShieldAlert,
  MapPin,
  RefreshCw
} from 'lucide-react';

interface DashboardViewProps {
  currentUser: User;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    activeCount: number;
    presentCount: number;
    absentCount: number;
    onLeaveCount: number;
    onMissionCount: number;
    notCheckedInCount: number;
    incompleteCount: number;
    pendingMandatoryTasksCount: number;
    overdueTasksCount: number;
    employeeStatuses: any[];
  }>({
    activeCount: 0,
    presentCount: 0,
    absentCount: 0,
    onLeaveCount: 0,
    onMissionCount: 0,
    notCheckedInCount: 0,
    incompleteCount: 0,
    pendingMandatoryTasksCount: 0,
    overdueTasksCount: 0,
    employeeStatuses: []
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboardSummary();
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredStatuses = data.employeeStatuses.filter((emp) => {
    const matchesSearch =
      emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || emp.attendanceStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'present':
        return <span className="text-emerald-700 font-bold">حاضر در شیفت</span>;
      case 'not_checked_in':
        return <span className="text-slate-600 font-medium">هنوز ورود نزده</span>;
      case 'completed':
        return <span className="text-blue-700 font-medium">شیفت خاتمه‌یافته</span>;
      case 'on_leave':
        return <span className="text-indigo-700 font-medium">مرخصی مصوب</span>;
      case 'on_mission':
        return <span className="text-teal-700 font-medium">ماموریت مصوب</span>;
      case 'absent':
        return <span className="text-rose-700 font-bold">غیبت غیرموجه</span>;
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">داشبورد وضعیت بلادرنگ پرسنل آزمایشگاه ترنج</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            پایش لحظه‌ای حضور در شیفت‌ها، تفکیک غیبت قطعی از عدم ورود، و نظارت بر وظایف اجباری
          </p>
        </div>

        <button
          onClick={fetchDashboard}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>بروزرسانی داده‌ها</span>
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <span className="text-xs text-slate-500 block">کل پرسنل فعال</span>
          <span className="text-xl font-bold text-slate-900 mt-1 block tabular-nums">
            {toPersianDigits(data.activeCount)} نفر
          </span>
        </div>

        <div className="bg-emerald-50/60 rounded-xl border border-emerald-200 p-4 shadow-sm">
          <span className="text-xs text-emerald-800 block font-semibold">حاضرین در شیفت</span>
          <span className="text-xl font-bold text-emerald-900 mt-1 block tabular-nums">
            {toPersianDigits(data.presentCount)} نفر
          </span>
        </div>

        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 shadow-sm">
          <span className="text-xs text-slate-600 block">هنوز ورود نزده</span>
          <span className="text-xl font-bold text-slate-700 mt-1 block tabular-nums">
            {toPersianDigits(data.notCheckedInCount)} نفر
          </span>
        </div>

        <div className="bg-rose-50/60 rounded-xl border border-rose-200 p-4 shadow-sm">
          <span className="text-xs text-rose-800 block font-semibold">غیبت غیرموجه</span>
          <span className="text-xl font-bold text-rose-900 mt-1 block tabular-nums">
            {toPersianDigits(data.absentCount)} نفر
          </span>
        </div>

        <div className="bg-indigo-50/60 rounded-xl border border-indigo-200 p-4 shadow-sm">
          <span className="text-xs text-indigo-800 block font-semibold">مرخصی / ماموریت</span>
          <span className="text-xl font-bold text-indigo-900 mt-1 block tabular-nums">
            {toPersianDigits(data.onLeaveCount + data.onMissionCount)} نفر
          </span>
        </div>

        <div className="bg-amber-50/60 rounded-xl border border-amber-200 p-4 shadow-sm">
          <span className="text-xs text-amber-800 block font-semibold">وظایف اجباری باز</span>
          <span className="text-xl font-bold text-amber-900 mt-1 block tabular-nums">
            {toPersianDigits(data.pendingMandatoryTasksCount)} مورد
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو بر اساس نام پرسنل یا بخش..."
            className="w-full pr-9 pl-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#102D3A]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <span className="text-slate-400 whitespace-nowrap">فیلتر وضعیت:</span>
          {['all', 'present', 'not_checked_in', 'absent', 'on_leave'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap cursor-pointer transition-colors ${
                statusFilter === st
                  ? 'bg-[#102D3A] text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'all'
                ? 'همه'
                : st === 'present'
                ? 'حاضر'
                : st === 'not_checked_in'
                ? 'ورود نزده'
                : st === 'absent'
                ? 'غایب'
                : 'مرخصی'}
            </button>
          ))}
        </div>
      </div>

      {/* Employee Status Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-4">پرسنل</th>
                <th className="py-3 px-4">بخش تخصصی</th>
                <th className="py-3 px-4">شیفت موظف</th>
                <th className="py-3 px-4">وضعیت حضور</th>
                <th className="py-3 px-4">زمان ثبت ورود</th>
                <th className="py-3 px-4">راستی‌آزمایی مکانی</th>
                <th className="py-3 px-4">وظایف اجباری</th>
                <th className="py-3 px-4">وضعیت نظارتی</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStatuses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    موردی یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredStatuses.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{emp.fullName}</td>
                    <td className="py-3 px-4 text-slate-600">{emp.department}</td>
                    <td className="py-3 px-4 text-slate-700">{emp.scheduleName}</td>
                    <td className="py-3 px-4">{getStatusLabel(emp.attendanceStatus)}</td>
                    <td className="py-3 px-4 tabular-nums text-slate-700">
                      {emp.checkInTime ? formatTime(emp.checkInTime) : '--:--'}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-600">
                      {emp.locationResult === 'verified' ? (
                        <span className="text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>تایید در آزمایشگاه</span>
                        </span>
                      ) : emp.locationResult === 'gps_optional_exempt' ? (
                        <span className="text-slate-500">معافیت GPS</span>
                      ) : (
                        <span className="text-slate-400">ثبت نشده</span>
                      )}
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {emp.pendingMandatoryCount > 0 ? (
                        <span className="text-rose-700 font-bold">
                          {toPersianDigits(emp.pendingMandatoryCount)} وظیفه باز
                        </span>
                      ) : (
                        <span className="text-emerald-700">تکمیل</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {emp.requiresAttention ? (
                        <span className="text-amber-700 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>نیازمند توجه سرپرست</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">عادی</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

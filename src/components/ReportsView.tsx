import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { User } from '../types';
import { toPersianDigits } from '../utils/jalali';
import { Download, FileSpreadsheet, Filter, CheckCircle2 } from 'lucide-react';

interface ReportsViewProps {
  currentUser: User;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any[]>([]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const data = await api.getPayrollReport();
      setReportData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handleExportCSV = () => {
    // Generate CSV content with UTF-8 BOM for perfect Persian encoding in Excel
    const BOM = '\uFEFF';
    const headers = [
      'کد پرسنلی',
      'شناسه سیستم',
      'نام و نام خانوادگی',
      'بخش تخصصی',
      'تعداد نشست‌های حضور',
      'مجموع ساعات حضور فیزیکی',
      'ساعات کارکرد خالص مصوب',
      'مجموع دقایق تاخیر',
      'مجموع دقایق تعجیل',
      'اضافه‌کار مصوب سرپرست (ساعت)',
      'روزهای مرخصی مصوب',
      'ماموریت‌ها',
      'وضعیت تایید حقوق'
    ];

    const rows = reportData.map((r) => [
      r.employeeCode || '-',
      r.employeeId,
      r.fullName,
      r.department,
      r.completedSessionsCount,
      r.totalActualHours,
      r.totalWorkHours,
      r.totalLatenessMinutes,
      r.totalEarlyDepartureMinutes,
      r.approvedOvertimeHours,
      r.approvedLeaveDays,
      r.approvedMissionsCount,
      r.payrollStatus
    ]);

    const csvContent =
      BOM +
      [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `گزارش_کارکرد_پرسنل_ترنج_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">گزارشات تجمیعی کارکرد و برآورد حقوق پرسنل</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            محاسبه ساعات موظفی، کارکرد واقعی، کسر کار، مرخصی و اضافه‌کار مصوب با قابلیت خروجی اکسل
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={loading || reportData.length === 0}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4 text-emerald-200" />
          <span>دانلود خروجی اکسل (CSV UTF-8)</span>
        </button>
      </div>

      {/* Notice */}
      <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
        <div>
          <span className="font-semibold text-slate-800">ملاحظه قانونی: </span>
          <span>
            خلاصه‌های کارکرد کارتابل تا پیش از امضای نهایی مدیریت مالی، برآورد اداری تلقی شده و جهت نظارت بر شیفت‌ها استفاده می‌گردد.
          </span>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">Asia/Tehran Standard</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-4">کد پرسنلی</th>
                <th className="py-3 px-4">پرسنل</th>
                <th className="py-3 px-4">بخش</th>
                <th className="py-3 px-4">شیفت‌های حضور</th>
                <th className="py-3 px-4">کارکرد واقعی (ساعت)</th>
                <th className="py-3 px-4">کارکرد خالص (ساعت)</th>
                <th className="py-3 px-4">تاخیر ورود (دقیقه)</th>
                <th className="py-3 px-4">تعجیل خروج (دقیقه)</th>
                <th className="py-3 px-4">اضافه‌کار مصوب</th>
                <th className="py-3 px-4">مرخصی مصوب</th>
                <th className="py-3 px-4">وضعیت حقوق</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    در حال محاسبه گزارش ماهانه...
                  </td>
                </tr>
              ) : reportData.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    داده‌ای یافت نشد.
                  </td>
                </tr>
              ) : (
                reportData.map((row) => (
                  <tr key={row.employeeId} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono font-bold text-[#102D3A] text-[11px]">
                      {row.employeeCode || '-'}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{row.fullName}</td>
                    <td className="py-3 px-4 text-slate-600">{row.department}</td>
                    <td className="py-3 px-4 tabular-nums text-slate-700">
                      {toPersianDigits(row.completedSessionsCount)} شیفت
                    </td>
                    <td className="py-3 px-4 tabular-nums font-semibold text-slate-900">
                      {toPersianDigits(row.totalActualHours)}
                    </td>
                    <td className="py-3 px-4 tabular-nums font-bold text-emerald-800">
                      {toPersianDigits(row.totalWorkHours)}
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-600">
                      {row.totalLatenessMinutes > 0 ? (
                        <span className="text-amber-700 font-semibold">
                          {toPersianDigits(row.totalLatenessMinutes)}
                        </span>
                      ) : (
                        '۰'
                      )}
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-600">
                      {row.totalEarlyDepartureMinutes > 0 ? (
                        <span className="text-amber-700 font-semibold">
                          {toPersianDigits(row.totalEarlyDepartureMinutes)}
                        </span>
                      ) : (
                        '۰'
                      )}
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-700">
                      {toPersianDigits(row.approvedOvertimeHours)} ساعت
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-700">
                      {toPersianDigits(row.approvedLeaveDays)} روز
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-500">
                      {row.payrollStatus}
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

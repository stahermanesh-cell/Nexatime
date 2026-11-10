import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { GPSPolicy, SystemSettings, User } from '../types';
import { toPersianDigits } from '../utils/jalali';
import { MapPin, ShieldCheck, Settings, Edit, Save, Compass } from 'lucide-react';

interface GPSPoliciesViewProps {
  currentUser: User;
  allUsers: User[];
  onRefreshAll?: () => void;
}

export const GPSPoliciesView: React.FC<GPSPoliciesViewProps> = ({ currentUser, allUsers, onRefreshAll }) => {
  const [policies, setPolicies] = useState<GPSPolicy[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingPolicy, setEditingPolicy] = useState<{
    employeeId: string;
    employeeName: string;
    required: boolean;
    allowedRadiusMeters: number;
    poorAccuracyThresholdMeters: number;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [policiesData, settingsData] = await Promise.all([
        api.getGPSPolicies(),
        api.getSettings()
      ]);
      setPolicies(policiesData);
      setSettings(settingsData);
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', text: err.message || 'خطا در دریافت اطلاعات موقعیت مکانی' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPolicy) return;

    try {
      setSubmitting(true);
      await api.updateGPSPolicy(editingPolicy.employeeId, {
        required: editingPolicy.required,
        allowedRadiusMeters: Number(editingPolicy.allowedRadiusMeters),
        poorAccuracyThresholdMeters: Number(editingPolicy.poorAccuracyThresholdMeters)
      });

      setEditingPolicy(null);
      setFeedback({ type: 'success', text: `سیاست موقعیت مکانی ${editingPolicy.employeeName} بروزرسانی شد.` });
      fetchData();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'خطا در ذخیره سیاست' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">سیاست‌های جغرافیایی (GPS) و تنظیمات آزمایشگاه</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            پیکربندی مختصات جغرافیایی شعبه مرکزی آزمایشگاه ترنج و تخصیص سیاست مجزا به ازای هر پرسنل
          </p>
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

      {/* Lab Central Coordinates Card */}
      {settings && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#102D3A]" />
              <h3 className="text-sm font-bold text-slate-900">{settings.orgName} (دفتر مرکزی)</h3>
            </div>
            <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              موقعیت تایید شده فعال
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div>
              <span className="text-slate-500 block">عرض جغرافیایی (Latitude)</span>
              <span className="font-mono font-bold text-slate-800 tabular-nums">
                {settings.defaultLat}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">طول جغرافیایی (Longitude)</span>
              <span className="font-mono font-bold text-slate-800 tabular-nums">
                {settings.defaultLng}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">شعاع مجاز پیش‌فرض</span>
              <span className="font-bold text-[#102D3A] tabular-nums">
                {toPersianDigits(settings.defaultRadiusMeters)} متر
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">فرجه مجاز تاخیر شیفت</span>
              <span className="font-bold text-slate-800 tabular-nums">
                {toPersianDigits(settings.defaultLatenessToleranceMinutes)} دقیقه
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            نشانی: {settings.contactAddress} · شماره تماس: {settings.contactPhone}
          </p>
        </div>
      )}

      {/* Per-Employee GPS Policy Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900">سیاست‌های اختصاصی پرسنل (Per-Employee GPS Policies)</h3>
          <span className="text-xs text-slate-400">تعداد پرسنل: {toPersianDigits(allUsers.length)}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-4">پرسنل</th>
                <th className="py-3 px-4">بخش</th>
                <th className="py-3 px-4">وضعیت الزام GPS</th>
                <th className="py-3 px-4">حداکثر شعاع مجاز</th>
                <th className="py-3 px-4">آستانه خطای دقت</th>
                <th className="py-3 px-4">قابلیت درخواست استثنا</th>
                <th className="py-3 px-4">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allUsers.map((user) => {
                const specificPolicy = policies.find((p) => p.employeeId === user.id);
                const defaultPol = policies.find((p) => p.employeeId === 'default');
                const effective = specificPolicy || defaultPol;

                const isRequired = specificPolicy ? specificPolicy.required : (defaultPol?.required ?? true);
                const radius = specificPolicy ? specificPolicy.allowedRadiusMeters : (defaultPol?.allowedRadiusMeters || 100);
                const poorAcc = specificPolicy ? specificPolicy.poorAccuracyThresholdMeters : 80;

                return (
                  <tr key={user.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-bold text-slate-900">{user.fullName}</td>
                    <td className="py-3 px-4 text-slate-600">{user.department}</td>
                    <td className="py-3 px-4">
                      {isRequired ? (
                        <span className="text-emerald-800 font-semibold flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>الزامی در آزمایشگاه</span>
                        </span>
                      ) : (
                        <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          معافیت اختیاری (ماموریت / کالیبراسیون)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-700">
                      {toPersianDigits(radius)} متر
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-600">
                      حداکثر {toPersianDigits(poorAcc)} متر
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      فعال (ارجاع به سرپرست)
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() =>
                          setEditingPolicy({
                            employeeId: user.id,
                            employeeName: user.fullName,
                            required: isRequired,
                            allowedRadiusMeters: radius,
                            poorAccuracyThresholdMeters: poorAcc
                          })
                        }
                        className="text-xs text-[#102D3A] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>ویرایش سیاست</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Policy Modal */}
      {editingPolicy && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-right space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                ویرایش سیاست موقعیت مکانی: {editingPolicy.employeeName}
              </h3>
              <button onClick={() => setEditingPolicy(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleSavePolicy} className="space-y-4 text-xs">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <input
                  type="checkbox"
                  id="gpsRequiredCheck"
                  checked={editingPolicy.required}
                  onChange={(e) =>
                    setEditingPolicy({ ...editingPolicy, required: e.target.checked })
                  }
                  className="rounded text-[#102D3A] w-4 h-4"
                />
                <label htmlFor="gpsRequiredCheck" className="font-semibold text-slate-800 cursor-pointer">
                  موقعیت مکانی برای این پرسنل الزامی است (عدم اجازه ثبت ورود در بیرون آزمایشگاه)
                </label>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  شعاع مجاز ثبت تردد (متر) *
                </label>
                <input
                  type="number"
                  min="20"
                  max="5000"
                  value={editingPolicy.allowedRadiusMeters}
                  onChange={(e) =>
                    setEditingPolicy({
                      ...editingPolicy,
                      allowedRadiusMeters: parseInt(e.target.value, 10) || 100
                    })
                  }
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-200"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  فاصله مجاز از نقطه مرکزی آزمایشگاه (پیش‌فرض استاندارد ۱۰۰ متر است).
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  آستانه خطای دقت مجاز GPS (متر)
                </label>
                <input
                  type="number"
                  min="30"
                  max="500"
                  value={editingPolicy.poorAccuracyThresholdMeters}
                  onChange={(e) =>
                    setEditingPolicy({
                      ...editingPolicy,
                      poorAccuracyThresholdMeters: parseInt(e.target.value, 10) || 80
                    })
                  }
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setEditingPolicy(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-white bg-[#102D3A] hover:bg-[#1A4456] rounded-lg font-semibold cursor-pointer"
                >
                  ذخیره تغییرات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { LeaveRequest, MissionRequest, User } from '../types';
import { formatJalaliDate, formatJalaliDateTime, toPersianDigits } from '../utils/jalali';
import { FileText, Plus, CheckCircle2, XCircle, Clock, Send, Calendar } from 'lucide-react';

interface RequestsViewProps {
  currentUser: User;
  onRefreshAll?: () => void;
}

export const RequestsView: React.FC<RequestsViewProps> = ({ currentUser, onRefreshAll }) => {
  const [activeTab, setActiveTab] = useState<'leave' | 'mission' | 'correction'>('leave');
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [missions, setMissions] = useState<MissionRequest[]>([]);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Leave Form
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveRequest['leaveType']>('hourly');
  const [leaveDate, setLeaveDate] = useState(new Date().toISOString().split('T')[0]);
  const [isPartial, setIsPartial] = useState(true);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('12:00');
  const [leaveReason, setLeaveReason] = useState('');

  // Correction Form
  const [showCorrModal, setShowCorrModal] = useState(false);
  const [corrDate, setCorrDate] = useState(new Date().toISOString().split('T')[0]);
  const [corrType, setCorrType] = useState('both');
  const [reqCheckIn, setReqCheckIn] = useState('08:00');
  const [reqCheckOut, setReqCheckOut] = useState('14:00');
  const [corrReason, setCorrReason] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const [lData, mData, cData] = await Promise.all([
        api.getLeaves(),
        api.getMissions(),
        api.getCorrections()
      ]);
      setLeaves(lData);
      setMissions(mData);
      setCorrections(cData);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [currentUser.id]);

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveReason.trim()) return;

    try {
      setSubmitting(true);
      await api.submitLeave({
        leaveType,
        startDate: leaveDate,
        endDate: leaveDate,
        isPartialDay: isPartial,
        startTime: isPartial ? startTime : undefined,
        endTime: isPartial ? endTime : undefined,
        reason: leaveReason
      });

      setShowLeaveModal(false);
      setLeaveReason('');
      setFeedback({ type: 'success', text: 'درخواست مرخصی با موفقیت ثبت و به سرپرست ارسال شد.' });
      fetchRequests();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'خطا در ثبت درخواست مرخصی' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewLeave = async (id: string, decision: 'approved' | 'rejected') => {
    try {
      await api.reviewLeave(id, decision);
      setFeedback({
        type: 'success',
        text: `درخواست مرخصی با موفقیت ${decision === 'approved' ? 'تایید و در محاسبات تردد اعمال گردید.' : 'رد شد.'}`
      });
      fetchRequests();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'خطا در بررسی مرخصی' });
    }
  };

  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!corrReason.trim()) return;

    try {
      setSubmitting(true);
      await api.submitCorrection({
        dateString: corrDate,
        targetEventType: corrType,
        requestedCheckInTime: `${corrDate}T${reqCheckIn}:00Z`,
        requestedCheckOutTime: `${corrDate}T${reqCheckOut}:00Z`,
        reason: corrReason
      });

      setShowCorrModal(false);
      setCorrReason('');
      setFeedback({ type: 'success', text: 'درخواست تصحیح تردد با موفقیت برای سرپرست ارسال شد.' });
      fetchRequests();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'خطا در ثبت تصحیح تردد' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">درخواست‌های پرسنلی و اصلاحات تردد</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ثبت مرخصی ساعتی/روزانه، ماموریت برون‌سازمانی، و اصلاح نشست‌های تردد فراموش‌شده
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLeaveModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#102D3A] hover:bg-[#1A4456] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#D9C28D]" />
            <span>ثبت مرخصی جدید</span>
          </button>
          <button
            onClick={() => setShowCorrModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Clock className="w-4 h-4" />
            <span>درخواست تصحیح تردد</span>
          </button>
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

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg max-w-fit text-xs">
        <button
          onClick={() => setActiveTab('leave')}
          className={`px-3 py-1.5 font-medium rounded-md cursor-pointer ${
            activeTab === 'leave' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-600'
          }`}
        >
          سوابق مرخصی ({leaves.length})
        </button>
        <button
          onClick={() => setActiveTab('correction')}
          className={`px-3 py-1.5 font-medium rounded-md cursor-pointer ${
            activeTab === 'correction' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-600'
          }`}
        >
          درخواست‌های تصحیح تردد ({corrections.length})
        </button>
        <button
          onClick={() => setActiveTab('mission')}
          className={`px-3 py-1.5 font-medium rounded-md cursor-pointer ${
            activeTab === 'mission' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-600'
          }`}
        >
          ماموریت‌ها ({missions.length})
        </button>
      </div>

      {/* Lists */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        {loading ? (
          <div className="text-center py-8 text-xs text-slate-400">در حال دریافت داده‌ها...</div>
        ) : activeTab === 'leave' ? (
          leaves.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">هنوز درخواستی ثبت نشده است.</div>
          ) : (
            <div className="space-y-3">
              {leaves.map((l) => (
                <div
                  key={l.id}
                  className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900">
                        {l.leaveType === 'hourly' ? 'مرخصی ساعتی' : 'مرخصی استحقاقی روزانه'}
                      </span>
                      {l.employeeName && (
                        <span className="text-[11px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border">
                          {l.employeeName}
                        </span>
                      )}
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-600">
                        تاریخ: {formatJalaliDate(l.startDate)} {l.isPartialDay ? `(از ${l.startTime} تا ${l.endTime})` : ''}
                      </span>
                      {l.durationMinutes ? (
                        <span className="text-[10px] font-mono font-bold bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded">
                          مدت: {toPersianDigits(l.durationMinutes)} دقیقه
                        </span>
                      ) : null}
                    </div>
                    <p className="text-slate-600">{l.reason}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {l.status === 'pending' ? (
                      <div className="flex items-center gap-2">
                        {(currentUser.role === 'manager' || currentUser.role === 'super_admin') ? (
                          <>
                            <button
                              onClick={() => handleReviewLeave(l.id, 'approved')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded text-[11px] flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>تایید و بخشش تاخیر</span>
                            </button>
                            <button
                              onClick={() => handleReviewLeave(l.id, 'rejected')}
                              className="px-2.5 py-1 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold rounded text-[11px] flex items-center gap-1 cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>رد</span>
                            </button>
                          </>
                        ) : (
                          <span className="text-amber-700 font-semibold">در انتظار تایید سرپرست</span>
                        )}
                      </div>
                    ) : l.status === 'approved' ? (
                      <span className="text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>موافقت شده (بخشش تاخیر/تعجیل)</span>
                      </span>
                    ) : (
                      <span className="text-rose-700 font-bold flex items-center gap-1 bg-rose-50 px-2 py-1 rounded border border-rose-200">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>رد شده</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : activeTab === 'correction' ? (
          corrections.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">درخواست اصلاحیه‌ای وجود ندارد.</div>
          ) : (
            <div className="space-y-3">
              {corrections.map((c) => (
                <div
                  key={c.id}
                  className="p-3.5 rounded-lg border border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-1">
                    <span className="font-bold text-slate-900">اصلاح تردد تاریخ {formatJalaliDate(c.dateString)}</span>
                    <p className="text-slate-600">دلیل: {c.reason}</p>
                  </div>

                  <div>
                    {c.status === 'pending' ? (
                      <span className="text-amber-700 font-semibold">در دست بررسی سرپرست</span>
                    ) : c.status === 'approved' ? (
                      <span className="text-emerald-700 font-bold">اصلاح تایید شد</span>
                    ) : (
                      <span className="text-rose-700 font-bold">اصلاح رد شد</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="text-center py-8 text-xs text-slate-400">ماموریتی ثبت نشده است.</div>
        )}
      </div>

      {/* Modal: New Leave */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-right space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">ثبت درخواست مرخصی</h3>
              <button onClick={() => setShowLeaveModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleSubmitLeave} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">نوع مرخصی *</label>
                <select
                  value={leaveType}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setLeaveType(val);
                    setIsPartial(val === 'hourly');
                  }}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="hourly">مرخصی ساعتی (بخشی از شیفت روز)</option>
                  <option value="annual">مرخصی استحقاقی روزانه (کامل)</option>
                  <option value="medical">مرخصی استعلاجی / پزشکی</option>
                  <option value="emergency">مرخصی اضطراری</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">تاریخ مرخصی *</label>
                <input
                  type="date"
                  value={leaveDate}
                  onChange={(e) => setLeaveDate(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-white"
                />
              </div>

              {isPartial && (
                <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">از ساعت</label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        required
                        className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">تا ساعت</label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        required
                        className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                  </div>

                  {startTime && endTime && (
                    <div className="text-[11px] text-teal-800 font-medium pt-1 border-t border-slate-200 flex items-center justify-between">
                      <span>مدت زمان مرخصی:</span>
                      <span className="font-bold tabular-nums">
                        {toPersianDigits(
                          Math.max(
                            0,
                            (Number(endTime.split(':')[0]) * 60 + Number(endTime.split(':')[1])) -
                              (Number(startTime.split(':')[0]) * 60 + Number(startTime.split(':')[1]))
                          )
                        )} دقیقه
                      </span>
                    </div>
                  )}

                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    نکته: پس از تایید مدیر، تاخیر در ورود یا تعجیل در خروج مربوط به این بازه ساعتی از کارکرد پرسنل کسر نخواهد شد.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">علت مرخصی *</label>
                <textarea
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="ذکر دلیل یا امور شخصی..."
                  rows={2}
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-white bg-[#102D3A] hover:bg-[#1A4456] rounded-lg font-semibold cursor-pointer"
                >
                  ارسال درخواست مرخصی
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Correction */}
      {showCorrModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-right space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">درخواست تصحیح تردد فراموش‌شده</h3>
              <button onClick={() => setShowCorrModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleSubmitCorrection} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">تاریخ تردد مورد نظر</label>
                <input
                  type="date"
                  value={corrDate}
                  onChange={(e) => setCorrDate(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">ساعت ورود واقعی</label>
                  <input
                    type="time"
                    value={reqCheckIn}
                    onChange={(e) => setReqCheckIn(e.target.value)}
                    required
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">ساعت خروج واقعی</label>
                  <input
                    type="time"
                    value={reqCheckOut}
                    onChange={(e) => setReqCheckOut(e.target.value)}
                    required
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">دلیل عدم ثبت بموقع *</label>
                <textarea
                  value={corrReason}
                  onChange={(e) => setCorrReason(e.target.value)}
                  placeholder="توضیح علت عدم ثبت تردد در سامانه (قطع اینترنت، عدم همراه داشتن گوشی، ...)"
                  rows={2}
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowCorrModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-white bg-[#102D3A] hover:bg-[#1A4456] rounded-lg font-semibold cursor-pointer"
                >
                  ثبت درخواست تصحیح
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

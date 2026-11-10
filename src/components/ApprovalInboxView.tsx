import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { LeaveRequest, MissionRequest, TaskItem, User } from '../types';
import { formatJalaliDateTime, toPersianDigits } from '../utils/jalali';
import {
  Inbox,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Calendar,
  FileCheck,
  AlertCircle,
  Send
} from 'lucide-react';

interface ApprovalInboxViewProps {
  currentUser: User;
  onRefreshAll?: () => void;
}

export const ApprovalInboxView: React.FC<ApprovalInboxViewProps> = ({ currentUser, onRefreshAll }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    pendingTasks: TaskItem[];
    pendingLeaves: LeaveRequest[];
    pendingMissions: MissionRequest[];
    pendingCorrections: any[];
    pendingGpsExceptions: any[];
    totalCount: number;
  }>({
    pendingTasks: [],
    pendingLeaves: [],
    pendingMissions: [],
    pendingCorrections: [],
    pendingGpsExceptions: [],
    totalCount: 0
  });

  const [activeTab, setActiveTab] = useState<'all' | 'tasks' | 'leaves' | 'corrections' | 'gps'>('all');
  const [rejectingItem, setRejectingItem] = useState<{ type: string; id: string; title: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchInbox = async () => {
    try {
      setLoading(true);
      const res = await api.getApprovalInbox();
      setData(res);
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', text: err.message || 'خطا در بارگذاری کارتابل تاییدات' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInbox();
  }, [currentUser.id]);

  const handleApprove = async (type: string, id: string) => {
    try {
      setSubmitting(true);
      if (type === 'task') {
        await api.reviewTaskCompletion(id, 'approved');
      } else if (type === 'leave') {
        await api.reviewLeave(id, 'approved');
      } else if (type === 'mission') {
        await api.reviewMission(id, 'approved');
      } else if (type === 'correction') {
        await api.reviewCorrection(id, 'approved');
      }
      setFeedback({ type: 'success', text: 'درخواست با موفقیت تایید و ابلاغ شد.' });
      fetchInbox();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'خطا در تایید درخواست' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingItem || !rejectionReason.trim()) return;

    try {
      setSubmitting(true);
      if (rejectingItem.type === 'task') {
        await api.reviewTaskCompletion(rejectingItem.id, 'rejected', rejectionReason);
      } else if (rejectingItem.type === 'leave') {
        await api.reviewLeave(rejectingItem.id, 'rejected', rejectionReason);
      } else if (rejectingItem.type === 'mission') {
        await api.reviewMission(rejectingItem.id, 'rejected', rejectionReason);
      } else if (rejectingItem.type === 'correction') {
        await api.reviewCorrection(rejectingItem.id, 'rejected', rejectionReason);
      }

      setRejectingItem(null);
      setRejectionReason('');
      setFeedback({ type: 'success', text: 'درخواست با ثبت علت رد عودت داده شد.' });
      fetchInbox();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'خطا در رد درخواست' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-[#102D3A]" />
            <h2 className="text-lg font-bold text-slate-900">کارتابل تاییدات و تصمیم‌گیری مدیریت</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            صرفاً رویدادهای نیازمند تصمیم‌گیری سرپرستی (مرخصی، تصحیح تردد، اتمام وظایف و استثنای GPS)
          </p>
        </div>

        <div className="text-xs font-semibold px-3 py-1.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg">
          مجموع موارد در انتظار اقدام: {toPersianDigits(data.totalCount)} مورد
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

      {/* Category Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg max-w-fit text-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer ${
            activeTab === 'all' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          همه موارد ({toPersianDigits(data.totalCount)})
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer ${
            activeTab === 'tasks' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          اتمام وظایف ({toPersianDigits(data.pendingTasks.length)})
        </button>
        <button
          onClick={() => setActiveTab('leaves')}
          className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer ${
            activeTab === 'leaves' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          مرخصی و ماموریت ({toPersianDigits(data.pendingLeaves.length + data.pendingMissions.length)})
        </button>
        <button
          onClick={() => setActiveTab('corrections')}
          className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer ${
            activeTab === 'corrections' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          تصحیح تردد ({toPersianDigits(data.pendingCorrections.length)})
        </button>
        <button
          onClick={() => setActiveTab('gps')}
          className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer ${
            activeTab === 'gps' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          استثنای GPS ({toPersianDigits(data.pendingGpsExceptions.length)})
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-xs text-slate-400">در حال دریافت کارتابل...</div>
      ) : data.totalCount === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-xs text-slate-400 space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
          <p className="font-semibold text-slate-700">کارتابل تاییدات خالی است!</p>
          <p>کلیه درخواست‌های پرسنل بررسی و تایید شده‌اند.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Section 1: Task Completion Approvals */}
          {(activeTab === 'all' || activeTab === 'tasks') &&
            data.pendingTasks.map((task) => (
              <div
                key={task.id}
                className="bg-white rounded-xl border border-amber-200/80 shadow-sm p-5 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-800 font-bold text-xs">تایید اتمام وظیفه</span>
                    <span className="text-slate-300">·</span>
                    <h3 className="text-sm font-bold text-slate-900">{task.title}</h3>
                  </div>
                  <span className="text-xs text-slate-500">
                    ارسال شده: {formatJalaliDateTime(task.completionReportedAt || task.createdAt)}
                  </span>
                </div>

                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="font-semibold text-slate-800 mb-1">
                    گزارش اعلامی مجری ({task.assigneeName}):
                  </div>
                  <p>{task.completionNotes || 'گزارش کتبی ثبت نشده است.'}</p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="text-[11px] text-slate-500">
                    {task.mandatory ? (
                      <span className="text-rose-700 font-semibold">وظیفه الزامی آزمایشگاه</span>
                    ) : (
                      'وظیفه عادی'
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApprove('task', task.id)}
                      disabled={submitting}
                      className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>تایید اتمام</span>
                    </button>
                    <button
                      onClick={() =>
                        setRejectingItem({ type: 'task', id: task.id, title: task.title })
                      }
                      disabled={submitting}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      رد با ذکر دلیل
                    </button>
                  </div>
                </div>
              </div>
            ))}

          {/* Section 2: Leave Requests */}
          {(activeTab === 'all' || activeTab === 'leaves') &&
            data.pendingLeaves.map((leave) => (
              <div
                key={leave.id}
                className="bg-white rounded-xl border border-blue-200/80 shadow-sm p-5 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-800 font-bold text-xs">
                      {leave.leaveType === 'hourly' ? 'درخواست مرخصی ساعتی' : 'درخواست مرخصی روزانه'}
                    </span>
                    <span className="text-slate-300">·</span>
                    <h3 className="text-sm font-bold text-slate-900">{leave.employeeName}</h3>
                  </div>
                  <span className="text-xs text-slate-500">
                    تاریخ درخواست: {formatJalaliDateTime(leave.createdAt)}
                  </span>
                </div>

                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
                  <div>
                    <span className="font-semibold text-slate-700">بازه زمانی: </span>
                    <span>
                      {leave.startDate} {leave.isPartialDay ? `(از ${leave.startTime} تا ${leave.endTime})` : `تا ${leave.endDate}`}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">دلیل: </span>
                    <span>{leave.reason}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => handleApprove('leave', leave.id)}
                    disabled={submitting}
                    className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>موافقت با مرخصی</span>
                  </button>
                  <button
                    onClick={() =>
                      setRejectingItem({
                        type: 'leave',
                        id: leave.id,
                        title: `مرخصی ${leave.employeeName}`
                      })
                    }
                    disabled={submitting}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    مخالفت (رد با دلیل)
                  </button>
                </div>
              </div>
            ))}

          {/* Section 3: Attendance Corrections */}
          {(activeTab === 'all' || activeTab === 'corrections') &&
            data.pendingCorrections.map((corr) => (
              <div
                key={corr.id}
                className="bg-white rounded-xl border border-purple-200/80 shadow-sm p-5 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-purple-800 font-bold text-xs">درخواست تصحیح تردد</span>
                    <span className="text-slate-300">·</span>
                    <h3 className="text-sm font-bold text-slate-900">تاریخ: {corr.dateString}</h3>
                  </div>
                  <span className="text-xs text-slate-500">
                    ارسال: {formatJalaliDateTime(corr.createdAt)}
                  </span>
                </div>

                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
                  <div>
                    <span className="font-semibold text-slate-700">زمان‌های پیشنهادی: </span>
                    <span>
                      ورود: {corr.requestedCheckInTime || '---'} | خروج: {corr.requestedCheckOutTime || '---'}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">دلیل عدم ثبت بموقع: </span>
                    <span>{corr.reason}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => handleApprove('correction', corr.id)}
                    disabled={submitting}
                    className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>تایید و اصلاح تردد</span>
                  </button>
                  <button
                    onClick={() =>
                      setRejectingItem({
                        type: 'correction',
                        id: corr.id,
                        title: `تصحیح تردد ${corr.dateString}`
                      })
                    }
                    disabled={submitting}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    رد اصلاحیه
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectingItem && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-right space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-rose-800">عدم موافقت / رد درخواست</h3>
              <button onClick={() => setRejectingItem(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <p className="text-xs text-slate-600">
              دلیل عدم تایید <span className="font-bold text-slate-900">{rejectingItem.title}</span> را ثبت فرمایید:
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-3 text-xs">
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="علت رد درخواست به اطلاع متقاضی خواهد رسید..."
                rows={3}
                required
                className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setRejectingItem(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-white bg-rose-700 hover:bg-rose-800 rounded-lg font-semibold cursor-pointer"
                >
                  ثبت رد درخواست
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

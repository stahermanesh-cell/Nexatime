import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { TaskItem, User } from '../types';
import { formatJalaliDate, formatJalaliDateTime, toPersianDigits } from '../utils/jalali';
import {
  CheckSquare,
  AlertTriangle,
  Clock,
  Plus,
  CheckCircle2,
  XCircle,
  FileCheck,
  Send,
  UserCheck,
  Calendar
} from 'lucide-react';

interface TasksViewProps {
  currentUser: User;
  allUsers: User[];
  onRefreshAll?: () => void;
}

export const TasksView: React.FC<TasksViewProps> = ({ currentUser, allUsers, onRefreshAll }) => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'in_progress' | 'mandatory' | 'awaiting_approval' | 'approved'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState<TaskItem | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<TaskItem | null>(null);

  // Form states
  const [reportNotes, setReportNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New task form state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newAssigneeId, setNewAssigneeId] = useState(currentUser.id);
  const [newMandatory, setNewMandatory] = useState(true);
  const [newPriority, setNewPriority] = useState<TaskItem['priority']>('high');
  const [newDueDate, setNewDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [newDueTime, setNewDueTime] = useState('14:00');

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const data = await api.getTasks();
      setTasks(data);
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', text: err.message || 'خطا در بارگذاری وظایف' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [currentUser.id]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setSubmitting(true);
      await api.createTask({
        title: newTitle,
        description: newDescription,
        assigneeId: newAssigneeId,
        mandatory: newMandatory,
        priority: newPriority,
        dueDate: newDueDate,
        dueTime: newDueTime
      });

      setShowCreateModal(false);
      setNewTitle('');
      setNewDescription('');
      setFeedback({ type: 'success', text: 'وظیفه جدید با موفقیت ایجاد و ارجاع شد.' });
      fetchTasks();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'خطا در ایجاد وظیفه' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReportCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReportModal) return;

    try {
      setSubmitting(true);
      await api.reportTaskCompletion(showReportModal.id, reportNotes);
      setShowReportModal(null);
      setReportNotes('');
      setFeedback({ type: 'success', text: 'اتمام وظیفه با موفقیت به سرپرست اعلام شد.' });
      fetchTasks();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'خطا در ثبت گزارش اتمام' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (task: TaskItem) => {
    try {
      setSubmitting(true);
      await api.reviewTaskCompletion(task.id, 'approved');
      setFeedback({ type: 'success', text: `وظیفه "${task.title}" با موفقیت تایید شد.` });
      fetchTasks();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'خطا در تایید وظیفه' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showRejectModal || !rejectReason.trim()) return;

    try {
      setSubmitting(true);
      await api.reviewTaskCompletion(showRejectModal.id, 'rejected', rejectReason);
      setShowRejectModal(null);
      setRejectReason('');
      setFeedback({ type: 'success', text: 'وظیفه با ثبت دلیل عدم تایید بازگردانده شد.' });
      fetchTasks();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'خطا در رد وظیفه' });
    } finally {
      setSubmitting(false);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (filter === 'in_progress') return t.status === 'in_progress' || t.status === 'new';
    if (filter === 'mandatory') return t.mandatory && t.status !== 'approved';
    if (filter === 'awaiting_approval') return t.status === 'completion_reported';
    if (filter === 'approved') return t.status === 'approved';
    return true;
  });

  const getStatusBadge = (status: TaskItem['status']) => {
    switch (status) {
      case 'new':
        return <span className="text-slate-600 font-medium">جدید (تعریف شده)</span>;
      case 'in_progress':
        return <span className="text-blue-600 font-medium">در حال اجرا</span>;
      case 'completion_reported':
        return <span className="text-amber-600 font-bold">اتمام گزارش شده (منتظر تایید)</span>;
      case 'approved':
        return <span className="text-emerald-600 font-bold">تایید شده توسط سرپرست</span>;
      case 'rejected':
        return <span className="text-rose-600 font-bold">رد شده (نیاز به بازبینی)</span>;
      default:
        return <span>{status}</span>;
    }
  };

  const getPriorityBadge = (priority: TaskItem['priority']) => {
    switch (priority) {
      case 'urgent':
        return <span className="text-rose-700 font-bold">فوری / بحرانی</span>;
      case 'high':
        return <span className="text-amber-700 font-semibold">اولویت بالا</span>;
      case 'medium':
        return <span className="text-slate-700">اولویت عادی</span>;
      case 'low':
        return <span className="text-slate-500">پایین</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">کارتابل وظایف و چک‌لیست‌های پرسنلی</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            مدیریت وظایف محوله آزمایشگاهی، اعلام اتمام کار و تایید دو مرحله‌ای توسط سرپرستان
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#102D3A] hover:bg-[#1A4456] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#D9C28D]" />
          <span>تعریف وظیفه جدید</span>
        </button>
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

      {/* Filter Tabs (Interactive segmented control) */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg max-w-fit text-xs overflow-x-auto">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer ${
            filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          همه وظایف ({toPersianDigits(tasks.length)})
        </button>
        <button
          onClick={() => setFilter('mandatory')}
          className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer ${
            filter === 'mandatory' ? 'bg-white text-amber-900 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          وظایف اجباری باز
        </button>
        <button
          onClick={() => setFilter('awaiting_approval')}
          className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer ${
            filter === 'awaiting_approval' ? 'bg-white text-blue-900 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          منتظر تایید سرپرست
        </button>
        <button
          onClick={() => setFilter('in_progress')}
          className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer ${
            filter === 'in_progress' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          در حال انجام
        </button>
        <button
          onClick={() => setFilter('approved')}
          className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer ${
            filter === 'approved' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          تایید شده
        </button>
      </div>

      {/* Task List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-xs text-slate-400">در حال دریافت وظایف...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-400">
            وظیفه‌ای در این دسته‌بندی یافت نشد.
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isAssignee = task.assigneeId === currentUser.id;
            const canApprove =
              (currentUser.role === 'super_admin' || currentUser.role === 'manager') &&
              (!isAssignee || currentUser.role === 'super_admin');

            return (
              <div
                key={task.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 hover:border-slate-300 transition-colors"
              >
                {/* Header: Title & Classification */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-slate-400 shrink-0" />
                    <h3 className="text-sm font-bold text-slate-900">{task.title}</h3>
                  </div>

                  {/* Badges without pills */}
                  <div className="flex items-center gap-2 text-xs">
                    {task.mandatory ? (
                      <span className="text-rose-700 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>وظیفه الزامی / اجباری</span>
                      </span>
                    ) : (
                      <span className="text-slate-500">اختیاری</span>
                    )}
                    <span className="text-slate-300">·</span>
                    {getPriorityBadge(task.priority)}
                  </div>
                </div>

                {/* Description */}
                {task.description && (
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                    {task.description}
                  </p>
                )}

                {/* Metadata Row */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-100">
                  <div>
                    <span>مسئول انجام: </span>
                    <span className="font-semibold text-slate-800">{task.assigneeName}</span>
                  </div>
                  <span className="text-slate-300">·</span>
                  <div>
                    <span>تعریف‌کننده: </span>
                    <span className="text-slate-700">{task.creatorName}</span>
                  </div>
                  <span className="text-slate-300">·</span>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>مهلت: {formatJalaliDate(task.dueDate)}</span>
                    {task.dueTime && <span>(ساعت {toPersianDigits(task.dueTime)})</span>}
                  </div>
                  <span className="text-slate-300">·</span>
                  <div>
                    <span>وضعیت: </span>
                    {getStatusBadge(task.status)}
                  </div>
                </div>

                {/* Completion Note if reported */}
                {task.completionNotes && (
                  <div className="p-2.5 rounded bg-blue-50/70 border border-blue-100 text-xs text-blue-900">
                    <span className="font-semibold">گزارش مجری: </span>
                    <span>{task.completionNotes}</span>
                  </div>
                )}

                {/* Rejection Note if rejected */}
                {task.rejectionReason && (
                  <div className="p-2.5 rounded bg-rose-50/70 border border-rose-100 text-xs text-rose-900">
                    <span className="font-semibold">دلیل عدم تایید سرپرست: </span>
                    <span>{task.rejectionReason}</span>
                  </div>
                )}

                {/* Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <div className="text-[11px] text-slate-400">
                    ثبت در تاریخ: {formatJalaliDateTime(task.createdAt)}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Assignee Action: Report Completion */}
                    {isAssignee && task.status !== 'approved' && task.status !== 'completion_reported' && (
                      <button
                        onClick={() => {
                          setShowReportModal(task);
                          setReportNotes('');
                        }}
                        className="px-3.5 py-1.5 bg-[#102D3A] hover:bg-[#1A4456] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <FileCheck className="w-3.5 h-3.5 text-[#D9C28D]" />
                        <span>اعلام اتمام وظیفه</span>
                      </button>
                    )}

                    {/* Manager Approval Actions */}
                    {task.status === 'completion_reported' && canApprove && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(task)}
                          disabled={submitting}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer shadow-sm"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>تایید نهایی اتمام</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowRejectModal(task);
                            setRejectReason('');
                          }}
                          disabled={submitting}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>عدم تایید (رد با دلیل)</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Create Task */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 text-right space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">تعریف و ارجاع وظیفه جدید</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">عنوان وظیفه *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="مثال: کنترل کیفی دستگاه اتوآنالایزر بیوشیمی"
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#102D3A]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">شرح دستورالعمل اجرایی</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="جزئیات و نکات فنی لازم برای مجری..."
                  rows={3}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#102D3A]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">ارجاع به پرسنل *</label>
                  <select
                    value={newAssigneeId}
                    onChange={(e) => setNewAssigneeId(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white"
                  >
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.department})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">اولویت</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="urgent">فوری / بحرانی</option>
                    <option value="high">بالا</option>
                    <option value="medium">عادی</option>
                    <option value="low">پایین</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">مهلت انجام (تاریخ)</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    required
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">ساعت موعد</label>
                  <input
                    type="time"
                    value={newDueTime}
                    onChange={(e) => setNewDueTime(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
              </div>

              {/* Mandatory Toggle */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50/70 border border-amber-200/70">
                <input
                  type="checkbox"
                  id="mandatoryCheckbox"
                  checked={newMandatory}
                  onChange={(e) => setNewMandatory(e.target.checked)}
                  className="rounded text-[#102D3A] w-4 h-4"
                />
                <label htmlFor="mandatoryCheckbox" className="font-semibold text-amber-900 cursor-pointer">
                  وظیفه اجباری است (در داشبورد مدیریت پایش خواهد شد)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-white bg-[#102D3A] hover:bg-[#1A4456] rounded-lg font-semibold cursor-pointer"
                >
                  {submitting ? 'در حال ثبت...' : 'ثبت و ارجاع وظیفه'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Report Completion */}
      {showReportModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-right space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">اعلام اتمام وظیفه</h3>
              <button onClick={() => setShowReportModal(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <p className="text-xs text-slate-600">
              وظیفه: <span className="font-bold text-slate-900">{showReportModal.title}</span>
            </p>

            <form onSubmit={handleReportCompletion} className="space-y-3 text-xs">
              <label className="block text-slate-700 font-semibold">توضیحات و گزارش انجام کار:</label>
              <textarea
                value={reportNotes}
                onChange={(e) => setReportNotes(e.target.value)}
                placeholder="تست‌ها طبق SOP انجام شد، نتایج ثبت و نمونه‌ها بایگانی گردید..."
                rows={3}
                required
                className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#102D3A]"
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowReportModal(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg font-semibold cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>ارسال گزارش برای تایید سرپرست</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reject with reason */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-right space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-rose-800">عدم تایید اتمام وظیفه (ثبت دلیل)</h3>
              <button onClick={() => setShowRejectModal(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <p className="text-xs text-slate-600">
              دلیل عدم تایید کار به اطلاع مجری ({showRejectModal.assigneeName}) خواهد رسید:
            </p>

            <form onSubmit={handleReject} className="space-y-3 text-xs">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="دلیل عدم تایید (مثال: فرم لاگ دمایی امضا نشده است یا مستندات کالیبراسیون ضمیمه نیست)..."
                rows={3}
                required
                className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-white bg-rose-700 hover:bg-rose-800 rounded-lg font-semibold cursor-pointer"
                >
                  ثبت رد و بازگرداندن وظیفه
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { AppNotification } from '../types';
import { formatJalaliDateTime } from '../utils/jalali';
import { Bell, CheckCheck, X } from 'lucide-react';

interface NotificationsModalProps {
  notifications: AppNotification[];
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  notifications,
  onClose,
  onMarkAsRead
}) => {
  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 text-right space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#102D3A]" />
            <h3 className="font-bold text-sm text-slate-900">مرکز اعلان‌های درون‌برنامه‌ای</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-400">
              هیچ اعلان جدیدی وجود ندارد.
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-3.5 rounded-lg border text-xs space-y-1.5 transition-colors ${
                  notif.read ? 'bg-slate-50 border-slate-100 text-slate-600' : 'bg-amber-50/60 border-amber-200/80 text-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">{notif.title}</span>
                  <span className="text-[10px] text-slate-400">
                    {formatJalaliDateTime(notif.createdAt)}
                  </span>
                </div>
                <p className="text-slate-700 leading-relaxed text-[11px]">{notif.message}</p>

                {!notif.read && (
                  <div className="pt-1 flex justify-end">
                    <button
                      onClick={() => onMarkAsRead(notif.id)}
                      className="text-[10px] text-blue-700 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <CheckCheck className="w-3 h-3" />
                      <span>خوانده شد</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

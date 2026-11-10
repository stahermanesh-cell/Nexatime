import React, { useState, useEffect } from 'react';
import { api, setAuthSession, clearAuthSession } from './api/client';
import { User, AppNotification, CenterSettings } from './types';
import { Header } from './components/Header';
import { Sidebar, NavTab } from './components/Sidebar';
import { AttendanceView } from './components/AttendanceView';
import { TasksView } from './components/TasksView';
import { ApprovalInboxView } from './components/ApprovalInboxView';
import { DashboardView } from './components/DashboardView';
import { EmployeeManagementView } from './components/EmployeeManagementView';
import { CenterSettingsView } from './components/CenterSettingsView';
import { SchedulesView } from './components/SchedulesView';
import { RequestsView } from './components/RequestsView';
import { ReportsView } from './components/ReportsView';
import { GPSPoliciesView } from './components/GPSPoliciesView';
import { ProfileView } from './components/ProfileView';
import { TestRunnerView } from './components/TestRunnerView';
import { NotificationsModal } from './components/NotificationsModal';
import { LoginView } from './components/LoginView';
import { Clock, CheckSquare, Inbox, LayoutDashboard, UserCheck, Users, Building2 } from 'lucide-react';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [centerSettings, setCenterSettings] = useState<CenterSettings | null>(null);
  const [currentTab, setCurrentTab] = useState<NavTab>('attendance');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Notifications state
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifModal, setShowNotifModal] = useState(false);

  // Counter badges
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);

  const initApp = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load Center Settings first (available even before full user session)
      try {
        const settings = await api.getCenterSettings();
        setCenterSettings(settings);
      } catch (err) {
        console.warn('Center settings could not be fetched:', err);
      }

      // Fetch self
      const meRes = await api.getMe();
      setCurrentUser(meRes.user);

      // Fetch all users
      const usersRes = await api.getUsers();
      setAllUsers(usersRes);

      // Fetch notifications
      const notifsRes = await api.getNotifications();
      setNotifications(notifsRes);

      // Fetch pending counts
      if (meRes.user.role === 'super_admin' || meRes.user.role === 'manager') {
        const inboxRes = await api.getApprovalInbox();
        setPendingApprovalsCount(inboxRes.totalCount);
      }

      const tasksRes = await api.getTasks({ assigneeId: meRes.user.id, mandatory: true });
      setPendingTasksCount(tasksRes.filter((t) => t.status !== 'approved').length);
    } catch (err: any) {
      console.warn('User not authenticated or session expired:', err);
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initApp();
  }, []);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      clearAuthSession();
      setCurrentUser(null);
      setCurrentTab('attendance');
    }
  };

  const handleLoginSuccess = async (user: User) => {
    setCurrentUser(user);
    await initApp();
  };

  const handleSwitchUser = async (userId: string) => {
    try {
      setLoading(true);
      // Impersonate endpoint on server
      const res = await api.impersonateUser(userId);
      setAuthSession(res.token, res.user.id);
      setCurrentUser(res.user);

      // If switching from admin to employee and currently on admin-only tab, revert to attendance
      if (
        res.user.role === 'employee' &&
        ['approvals', 'dashboard', 'reports', 'gps_policies', 'center_settings', 'employee_mgmt'].includes(currentTab)
      ) {
        setCurrentTab('attendance');
      }

      await initApp();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'خطا در جابجایی حساب کاربری');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !currentUser) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center text-xs text-slate-500 gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#102D3A] text-[#D9C28D] flex items-center justify-center font-bold text-xl shadow-md animate-pulse">
          ت
        </div>
        <span>سامانه حضور و غیاب و کارتابل آزمایشگاه در حال آماده‌سازی...</span>
      </div>
    );
  }

  // If user is not authenticated, display real Login View
  if (!currentUser) {
    return (
      <LoginView
        centerSettings={centerSettings}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  const unreadNotifsCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col text-slate-900" dir="rtl">
      {/* Top Header */}
      <Header
        currentUser={currentUser}
        allUsers={allUsers}
        onSwitchUser={handleSwitchUser}
        onOpenNotifications={() => setShowNotifModal(true)}
        onLogout={handleLogout}
        unreadNotifsCount={unreadNotifsCount}
        centerName={centerSettings?.centerName}
        logoUrl={centerSettings?.logoUrl}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Persistent Desktop Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          currentUser={currentUser}
          pendingApprovalsCount={pendingApprovalsCount}
          pendingTasksCount={pendingTasksCount}
        />

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto pb-24 md:pb-8">
          {currentTab === 'attendance' && (
            <AttendanceView currentUser={currentUser} onRefreshAll={initApp} />
          )}
          {currentTab === 'tasks' && (
            <TasksView currentUser={currentUser} allUsers={allUsers} onRefreshAll={initApp} />
          )}
          {currentTab === 'approvals' && (
            <ApprovalInboxView currentUser={currentUser} onRefreshAll={initApp} />
          )}
          {currentTab === 'dashboard' && <DashboardView currentUser={currentUser} />}
          {currentTab === 'employee_mgmt' && (
            <EmployeeManagementView
              currentUser={currentUser}
              onRefreshAll={initApp}
            />
          )}
          {currentTab === 'center_settings' && (
            <CenterSettingsView
              currentUser={currentUser}
              onSettingsUpdated={(updated) => setCenterSettings(updated)}
            />
          )}
          {currentTab === 'schedules' && (
            <SchedulesView currentUser={currentUser} allUsers={allUsers} onRefreshAll={initApp} />
          )}
          {currentTab === 'requests' && (
            <RequestsView currentUser={currentUser} onRefreshAll={initApp} />
          )}
          {currentTab === 'reports' && <ReportsView currentUser={currentUser} />}
          {currentTab === 'gps_policies' && (
            <GPSPoliciesView currentUser={currentUser} allUsers={allUsers} onRefreshAll={initApp} />
          )}
          {currentTab === 'profile' && <ProfileView currentUser={currentUser} allUsers={allUsers} />}
          {currentTab === 'test_runner' && <TestRunnerView />}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 flex items-center justify-around py-2 px-1 shadow-lg">
        <button
          onClick={() => setCurrentTab('attendance')}
          className={`flex flex-col items-center gap-1 text-[10px] ${
            currentTab === 'attendance' ? 'text-[#102D3A] font-bold' : 'text-slate-500'
          }`}
        >
          <Clock className="w-5 h-5" />
          <span>تردد</span>
        </button>

        <button
          onClick={() => setCurrentTab('tasks')}
          className={`flex flex-col items-center gap-1 text-[10px] relative ${
            currentTab === 'tasks' ? 'text-[#102D3A] font-bold' : 'text-slate-500'
          }`}
        >
          <CheckSquare className="w-5 h-5" />
          <span>وظایف</span>
          {pendingTasksCount > 0 && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {pendingTasksCount}
            </span>
          )}
        </button>

        {(currentUser.role === 'super_admin' || currentUser.role === 'manager') && (
          <button
            onClick={() => setCurrentTab('employee_mgmt')}
            className={`flex flex-col items-center gap-1 text-[10px] ${
              currentTab === 'employee_mgmt' ? 'text-[#102D3A] font-bold' : 'text-slate-500'
            }`}
          >
            <Users className="w-5 h-5" />
            <span>پرسنل</span>
          </button>
        )}

        {(currentUser.role === 'super_admin' || currentUser.role === 'manager') && (
          <button
            onClick={() => setCurrentTab('approvals')}
            className={`flex flex-col items-center gap-1 text-[10px] relative ${
              currentTab === 'approvals' ? 'text-[#102D3A] font-bold' : 'text-slate-500'
            }`}
          >
            <Inbox className="w-5 h-5" />
            <span>تاییدات</span>
            {pendingApprovalsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {pendingApprovalsCount}
              </span>
            )}
          </button>
        )}

        {currentUser.role === 'super_admin' && (
          <button
            onClick={() => setCurrentTab('center_settings')}
            className={`flex flex-col items-center gap-1 text-[10px] ${
              currentTab === 'center_settings' ? 'text-[#102D3A] font-bold' : 'text-slate-500'
            }`}
          >
            <Building2 className="w-5 h-5" />
            <span>تنظیمات</span>
          </button>
        )}

        <button
          onClick={() => setCurrentTab('profile')}
          className={`flex flex-col items-center gap-1 text-[10px] ${
            currentTab === 'profile' ? 'text-[#102D3A] font-bold' : 'text-slate-500'
          }`}
        >
          <UserCheck className="w-5 h-5" />
          <span>پروفایل</span>
        </button>
      </nav>

      {/* Notifications Drawer Modal */}
      {showNotifModal && (
        <NotificationsModal
          notifications={notifications}
          onClose={() => setShowNotifModal(false)}
          onMarkAsRead={handleMarkNotificationRead}
        />
      )}
    </div>
  );
}
export default App;


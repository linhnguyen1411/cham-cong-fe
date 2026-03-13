
import React, { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import { TimeTracker } from './components/TimeTracker';
import { History } from './components/History';
import { Dashboard } from './components/Dashboard';
import { ShiftSettings } from './components/ShiftSettings';
import { StaffManagement } from './components/StaffManagement';
import { DepartmentSettings } from './components/DepartmentSettings';
import PositionSettings from './components/PositionSettings';
import ShiftRegistration from './components/ShiftRegistration';
import ShiftApproval from './components/ShiftApproval';
import StaffSchedule from './components/StaffSchedule';
import MySchedule from './components/MySchedule';
import ViewAllStaffSchedule from './components/ViewAllStaffSchedule';
import ProfileSettings from './components/ProfileSettings';
import { AppSettings } from './components/AppSettings';
import { Settings } from './components/Settings';
import { ForgotCheckinRequestForm } from './components/ForgotCheckinRequestForm';
import { AdminForgotCheckinRequests } from './components/AdminForgotCheckinRequests';
import RoleManagement from './components/RoleManagement';
import TeamManagement from './components/TeamManagement';
import BranchManagement from './components/BranchManagement';
import { User, UserRole } from './types';
import * as api from './services/api';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState('tracker'); // dashboard, tracker, history, shift-settings
  const [isLoading, setIsLoading] = useState(true);
  const [showProfileSettings, setShowProfileSettings] = useState(false);

  useEffect(() => {
    const authData = api.getCurrentUser();
    if (authData) {
      // Set user ngay từ cache để tránh nháy về màn login khi F5
      setUser(authData.user);
      setView(authData.user.role === UserRole.ADMIN || authData.user.canManageTeam
        ? 'view-all-staff-schedule'
        : 'tracker');
      // Reload user từ API để cập nhật role/flags mới nhất (chạy nền)
      api.getUser(authData.user.id).then(updatedUser => {
        setUser(updatedUser);
        const updatedAuthData = { ...authData, user: updatedUser };
        if (localStorage.getItem('timekeep_user')) {
          localStorage.setItem('timekeep_user', JSON.stringify(updatedAuthData));
        } else if (sessionStorage.getItem('timekeep_user')) {
          sessionStorage.setItem('timekeep_user', JSON.stringify(updatedAuthData));
        }
      }).catch(() => {
        // 401: logout đã clear storage → setUser(null) để hiện màn login
        // Lỗi mạng: giữ user từ cache (đã set ở trên)
        if (!api.getCurrentUser()) setUser(null);
      });
    }
    setIsLoading(false);
  }, []);

  const handleLogin = async (u: string, p: string, remember: boolean) => {
    const response = await api.login(u, p, remember);
    setUser(response.user);
    // Set default view based on user role
    // Admin: show staff schedule (lịch làm việc)
    // Staff: show tracker (chấm công)
    setView(response.user.role === UserRole.ADMIN || response.user.canManageTeam
      ? 'view-all-staff-schedule'
      : 'tracker');
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setView('tracker');
  };

  const handleShowSettings = (component: 'shifts' | 'users') => {
    setView('shift-settings');
  };

  const handleProfileUpdated = async () => {
    // Reload user info after profile update
    const authData = api.getCurrentUser();
    if (authData) {
      setUser(authData.user);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-blue-600">Loading...</div>;
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Layout 
      user={user} 
      currentView={view} 
      onNavigate={setView} 
      onLogout={handleLogout}
      onOpenProfile={() => setShowProfileSettings(true)}
    >
      {view === 'dashboard' && <Dashboard user={user} onShowSettings={handleShowSettings} />}
      {view === 'tracker' && <TimeTracker user={user} />}
      {view === 'history' && <History user={user} />}
      {view === 'shift-registration' && <ShiftRegistration user={user} />}
      {view === 'department-settings' && <DepartmentSettings currentUser={user} />}
      {view === 'position-settings' && <PositionSettings currentUser={user} />}
      {view === 'shift-settings' && <ShiftSettings currentUser={user} />}
      {view === 'shift-approval' && <ShiftApproval user={user} />}
      {view === 'staff-schedule' && <ViewAllStaffSchedule user={user} />}
      {view === 'my-schedule' && <MySchedule user={user} />}
      {view === 'view-all-staff-schedule' && <ViewAllStaffSchedule user={user} />}
      {view === 'staff-management' && <StaffManagement currentUser={user} />}
      {view === 'app-settings' && <AppSettings />}
      {view === 'settings' && <Settings user={user} />}
      {view === 'forgot-checkin-request' && <ForgotCheckinRequestForm user={user} />}
      {view === 'admin-forgot-checkin-requests' && <AdminForgotCheckinRequests user={user} />}
      {view === 'role-management' && <RoleManagement user={user} />}
      {view === 'team-management' && <TeamManagement user={user} />}
      {view === 'branch-management' && <BranchManagement currentUser={user} />}
      
      {showProfileSettings && (
        <ProfileSettings
          userId={user.id}
          onClose={() => setShowProfileSettings(false)}
          onProfileUpdated={handleProfileUpdated}
        />
      )}
    </Layout>
  );
};

export default App;

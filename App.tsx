
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
import { User } from './types';
import * as api from './services/api';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState('tracker'); // dashboard, tracker, history, shift-settings
  const [isLoading, setIsLoading] = useState(true);
  const [showProfileSettings, setShowProfileSettings] = useState(false);

  useEffect(() => {
    // Check for existing session in storage (LocalStorage or SessionStorage)
    const authData = api.getCurrentUser();
    if (authData) {
      setUser(authData.user);
      // Set default view based on user role
      // Admin: show staff schedule (lịch làm việc)
      // Staff: show tracker (chấm công)
      setView(authData.user.role === 'ADMIN' ? 'staff-schedule' : 'tracker');
    }
    setIsLoading(false);
  }, []);

  const handleLogin = async (u: string, p: string, remember: boolean) => {
    const response = await api.login(u, p, remember);
    setUser(response.user);
    // Set default view based on user role
    // Admin: show staff schedule (lịch làm việc)
    // Staff: show tracker (chấm công)
    setView(response.user.role === 'ADMIN' ? 'staff-schedule' : 'tracker');
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
      {view === 'department-settings' && <DepartmentSettings />}
      {view === 'position-settings' && <PositionSettings />}
      {view === 'shift-settings' && <ShiftSettings />}
      {view === 'shift-approval' && <ShiftApproval user={user} />}
      {view === 'staff-schedule' && <ViewAllStaffSchedule user={user} />}
      {view === 'my-schedule' && <MySchedule user={user} />}
      {view === 'view-all-staff-schedule' && <ViewAllStaffSchedule user={user} />}
      {view === 'staff-management' && <StaffManagement />}
      {view === 'app-settings' && <AppSettings />}
      {view === 'settings' && <Settings user={user} />}
      {view === 'forgot-checkin-request' && <ForgotCheckinRequestForm user={user} />}
      {view === 'admin-forgot-checkin-requests' && <AdminForgotCheckinRequests user={user} />}
      
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

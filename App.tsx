
import React, { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import { TimeTracker } from './components/TimeTracker';
import { History } from './components/History';
import { Dashboard } from './components/Dashboard';
import { ShiftSettings } from './components/ShiftSettings';
import { User } from './types';
import * as api from './services/api';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState('tracker'); // dashboard, tracker, history, shift-settings
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session in storage (LocalStorage or SessionStorage)
    const authData = api.getCurrentUser();
    if (authData) {
      setUser(authData.user);
      // Set default view based on user role
      setView(authData.user.role === 'ADMIN' ? 'dashboard' : 'tracker');
    }
    setIsLoading(false);
  }, []);

  const handleLogin = async (u: string, p: string, remember: boolean) => {
    const response = await api.login(u, p, remember);
    setUser(response.user);
    // Set default view based on user role
    setView(response.user.role === 'ADMIN' ? 'dashboard' : 'tracker');
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setView('tracker');
  };

  const handleShowSettings = (component: 'shifts' | 'users') => {
    setView('shift-settings');
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
    >
      {view === 'dashboard' && <Dashboard user={user} onShowSettings={handleShowSettings} />}
      {view === 'tracker' && <TimeTracker user={user} />}
      {view === 'history' && <History user={user} />}
      {view === 'shift-settings' && <ShiftSettings />}
    </Layout>
  );
};

export default App;

import React from 'react';
import { User, UserRole } from '../types';
import { LayoutDashboard, Clock, History, LogOut, User as UserIcon, Settings } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  currentView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, currentView, onNavigate, onLogout }) => {
  
  const NavItem = ({ view, icon: Icon, label }: { view: string, icon: any, label: string }) => (
    <button
      onClick={() => onNavigate(view)}
      className={`flex items-center w-full px-4 py-3 mb-2 rounded-lg transition-colors ${
        currentView === view 
          ? 'bg-blue-600 text-white shadow-md' 
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon size={20} className="mr-3" />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-2xl font-bold text-blue-600 flex items-center">
            <Clock className="mr-2" /> TimeKeep
          </h1>
        </div>

        <nav className="flex-1 p-4">
          <NavItem view="dashboard" icon={LayoutDashboard} label="Tổng quan" />
          {user.role !== UserRole.ADMIN && (
            <NavItem view="tracker" icon={Clock} label="Chấm công" />
          )}
          <NavItem view="history" icon={History} label="Lịch sử" />
          {user.role === UserRole.ADMIN && (
            <NavItem view="shift-settings" icon={Settings} label="Cài đặt ca làm việc" />
          )}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden mr-3">
               <img src={user.avatar} alt="User" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{user.username}</p>
              <p className="text-xs text-slate-500">{user.role === UserRole.ADMIN ? 'Quản trị viên' : 'Nhân viên'}</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={16} className="mr-2" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Mobile Header (visible only on small screens) */}
      <div className="md:hidden fixed top-0 w-full bg-white z-10 border-b p-4 flex justify-between items-center">
         <h1 className="text-xl font-bold text-blue-600">TimeKeep</h1>
         <button onClick={onLogout}><LogOut size={20} className="text-slate-600"/></button>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 mt-14 md:mt-0">
        <div className="w-full">
          {children}
        </div>
      </main>
      
      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 w-full bg-white border-t border-slate-200 flex justify-around p-3 z-10">
         <button onClick={() => onNavigate('dashboard')} className={`p-2 rounded-full ${currentView === 'dashboard' ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}><LayoutDashboard size={24}/></button>
         {user.role === UserRole.ADMIN ? (
          <button onClick={() => onNavigate('shift-settings')} className={`p-2 rounded-full ${currentView === 'shift-settings' ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}><Settings size={24}/></button>
         ) : (
          <button onClick={() => onNavigate('tracker')} className={`p-2 rounded-full ${currentView === 'tracker' ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}><Clock size={24}/></button>
         )}
         <button onClick={() => onNavigate('history')} className={`p-2 rounded-full ${currentView === 'history' ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}><History size={24}/></button>
      </div>
    </div>
  );
};
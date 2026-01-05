import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { 
  LayoutDashboard, Clock, History, LogOut, User as UserIcon, Settings, 
  UserCog, Users, Building2, Briefcase, CalendarPlus, ClipboardCheck,
  Menu, X, ChevronRight, Calendar, Eye
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  currentView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  onOpenProfile?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, currentView, onNavigate, onLogout, onOpenProfile }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const NavItem = ({ view, icon: Icon, label, onClick }: { view: string, icon: any, label: string, onClick?: () => void }) => (
    <button
      onClick={() => {
        onNavigate(view);
        onClick?.();
      }}
      className={`flex items-center w-full px-4 py-3 mb-2 rounded-lg transition-colors ${
        currentView === view 
          ? 'bg-blue-600 text-white shadow-md' 
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon size={20} className="mr-3" />
      <span className="font-medium">{label}</span>
      {currentView === view && <ChevronRight size={16} className="ml-auto" />}
    </button>
  );

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar - Desktop */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-2xl font-bold text-blue-600 flex items-center">
            <Clock className="mr-2" /> TimeKeep
          </h1>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <NavItem view="dashboard" icon={LayoutDashboard} label="Tổng quan" />
          {user.role !== UserRole.ADMIN && (
            <>
            <NavItem view="tracker" icon={Clock} label="Chấm công" />
              <NavItem view="shift-registration" icon={CalendarPlus} label="Đăng ký ca" />
              <NavItem view="my-schedule" icon={Calendar} label="Lịch làm việc" />
              <NavItem view="view-all-staff-schedule" icon={Eye} label="Xem lịch tuần này" />
              <NavItem view="forgot-checkin-request" icon={ClipboardCheck} label="Quên in/out" />
            </>
          )}
          <NavItem view="history" icon={History} label="Lịch sử" />
          {user.role === UserRole.ADMIN && (
            <>
              <div className="mt-4 mb-2 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Quản lý</div>
              <NavItem view="department-settings" icon={Building2} label="Quản lý Khối" />
              <NavItem view="position-settings" icon={Briefcase} label="Quản lý Vị trí" />
              <NavItem view="shift-settings" icon={Settings} label="Cài đặt ca làm" />
              <NavItem view="shift-approval" icon={ClipboardCheck} label="Duyệt đăng ký ca" />
              <NavItem view="staff-schedule" icon={Calendar} label="Lịch làm việc" />
              <NavItem view="staff-management" icon={Users} label="Quản lý nhân viên" />
              <NavItem view="admin-forgot-checkin-requests" icon={ClipboardCheck} label="Duyệt xin quên checkin/out" />
              <NavItem view="settings" icon={Settings} label="Cài đặt IP" />
              <NavItem view="app-settings" icon={Settings} label="Cài đặt hệ thống" />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div 
            className="flex items-center mb-4 px-2 cursor-pointer hover:bg-slate-50 rounded-lg py-2 transition"
            onClick={onOpenProfile}
          >
            <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden mr-3 flex items-center justify-center">
               {user.avatar ? (
                 <img src={user.avatar} alt="User" className="w-full h-full object-cover" />
               ) : (
                 <UserIcon size={20} className="text-slate-400" />
               )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">{user.fullName}</p>
              <p className="text-xs text-slate-500">{user.role === UserRole.ADMIN ? 'Quản trị viên' : 'Nhân viên'}</p>
            </div>
            <UserCog size={16} className="text-slate-400" />
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

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full bg-white z-20 border-b px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <Menu size={22} className="text-slate-600" />
          </button>
          <h1 className="text-lg font-bold text-blue-600">TimeKeep</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onOpenProfile}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center">
              {user.avatar ? (
                <img src={user.avatar} alt="User" className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={16} className="text-slate-400" />
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Slide-out Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeMobileMenu}
          />
          
          {/* Menu Panel */}
          <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-2xl flex flex-col animate-slide-in">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h1 className="text-xl font-bold text-blue-600 flex items-center">
                <Clock className="mr-2" size={22} /> TimeKeep
              </h1>
              <button 
                onClick={closeMobileMenu}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            {/* User Info */}
            <div 
              className="p-4 border-b border-slate-100 flex items-center gap-3 cursor-pointer hover:bg-slate-50"
              onClick={() => { onOpenProfile?.(); closeMobileMenu(); }}
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 overflow-hidden flex items-center justify-center">
                {user.avatar ? (
                  <img src={user.avatar} alt="User" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={24} className="text-white" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-800">{user.fullName}</p>
                <p className="text-xs text-slate-500">{user.role === UserRole.ADMIN ? 'Quản trị viên' : 'Nhân viên'}</p>
              </div>
              <ChevronRight size={18} className="text-slate-400" />
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 overflow-y-auto">
              <NavItem view="dashboard" icon={LayoutDashboard} label="Tổng quan" onClick={closeMobileMenu} />
              
              {user.role !== UserRole.ADMIN && (
                <>
                  <NavItem view="tracker" icon={Clock} label="Chấm công" onClick={closeMobileMenu} />
                  <NavItem view="shift-registration" icon={CalendarPlus} label="Đăng ký ca" onClick={closeMobileMenu} />
                  <NavItem view="my-schedule" icon={Calendar} label="Lịch làm việc" onClick={closeMobileMenu} />
                  <NavItem view="view-all-staff-schedule" icon={Eye} label="Xem lịch tuần này" onClick={closeMobileMenu} />
                  <NavItem view="forgot-checkin-request" icon={ClipboardCheck} label="Quên in/out" onClick={closeMobileMenu} />
                </>
              )}
              
              <NavItem view="history" icon={History} label="Lịch sử" onClick={closeMobileMenu} />
              
              {user.role === UserRole.ADMIN && (
                <>
                  <div className="mt-4 mb-2 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Quản lý
                  </div>
                  <NavItem view="department-settings" icon={Building2} label="Quản lý Khối" onClick={closeMobileMenu} />
                  <NavItem view="position-settings" icon={Briefcase} label="Quản lý Vị trí" onClick={closeMobileMenu} />
                  <NavItem view="shift-settings" icon={Settings} label="Cài đặt ca làm" onClick={closeMobileMenu} />
                  <NavItem view="shift-approval" icon={ClipboardCheck} label="Duyệt đăng ký ca" onClick={closeMobileMenu} />
                  <NavItem view="staff-schedule" icon={Calendar} label="Lịch làm việc" onClick={closeMobileMenu} />
                  <NavItem view="staff-management" icon={Users} label="Quản lý nhân viên" onClick={closeMobileMenu} />
                  <NavItem view="admin-forgot-checkin-requests" icon={ClipboardCheck} label="Duyệt xin quên checkin/out" onClick={closeMobileMenu} />
                  <NavItem view="settings" icon={Settings} label="Cài đặt IP" onClick={closeMobileMenu} />
                  <NavItem view="app-settings" icon={Settings} label="Cài đặt hệ thống" onClick={closeMobileMenu} />
                </>
              )}
            </nav>

            {/* Logout */}
            <div className="p-4 border-t border-slate-100">
              <button 
                onClick={() => { onLogout(); closeMobileMenu(); }}
                className="flex items-center w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
              >
                <LogOut size={20} className="mr-3" />
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 mt-14 md:mt-0 pb-20 md:pb-8">
        <div className="w-full">
          {children}
        </div>
      </main>
      
      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 w-full bg-white border-t border-slate-200 flex justify-around py-2 px-1 z-10 shadow-lg">
        <button 
          onClick={() => onNavigate('dashboard')} 
          className={`flex flex-col items-center p-2 rounded-xl min-w-[60px] transition ${
            currentView === 'dashboard' ? 'text-blue-600 bg-blue-50' : 'text-slate-400'
          }`}
        >
          <LayoutDashboard size={22}/>
          <span className="text-[10px] mt-1 font-medium">Tổng quan</span>
        </button>
        
         {user.role === UserRole.ADMIN ? (
          <>
            <button 
              onClick={() => onNavigate('shift-approval')} 
              className={`flex flex-col items-center p-2 rounded-xl min-w-[60px] transition ${
                currentView === 'shift-approval' ? 'text-blue-600 bg-blue-50' : 'text-slate-400'
              }`}
            >
              <ClipboardCheck size={22}/>
              <span className="text-[10px] mt-1 font-medium">Duyệt ca</span>
            </button>
            <button 
              onClick={() => onNavigate('staff-management')} 
              className={`flex flex-col items-center p-2 rounded-xl min-w-[60px] transition ${
                currentView === 'staff-management' ? 'text-blue-600 bg-blue-50' : 'text-slate-400'
              }`}
            >
              <Users size={22}/>
              <span className="text-[10px] mt-1 font-medium">Nhân viên</span>
            </button>
          </>
         ) : (
          <>
            <button 
              onClick={() => onNavigate('tracker')} 
              className={`flex flex-col items-center p-2 rounded-xl min-w-[60px] transition ${
                currentView === 'tracker' ? 'text-blue-600 bg-blue-50' : 'text-slate-400'
              }`}
            >
              <Clock size={22}/>
              <span className="text-[10px] mt-1 font-medium">Chấm công</span>
            </button>
            <button 
              onClick={() => onNavigate('my-schedule')} 
              className={`flex flex-col items-center p-2 rounded-xl min-w-[60px] transition ${
                currentView === 'my-schedule' ? 'text-blue-600 bg-blue-50' : 'text-slate-400'
              }`}
            >
              <Calendar size={22}/>
              <span className="text-[10px] mt-1 font-medium">Lịch làm việc</span>
            </button>
            <button 
              onClick={() => onNavigate('shift-registration')} 
              className={`flex flex-col items-center p-2 rounded-xl min-w-[60px] transition ${
                currentView === 'shift-registration' ? 'text-blue-600 bg-blue-50' : 'text-slate-400'
              }`}
            >
              <CalendarPlus size={22}/>
              <span className="text-[10px] mt-1 font-medium">Đăng ký</span>
            </button>
          </>
         )}
        
        <button 
          onClick={() => onNavigate('history')} 
          className={`flex flex-col items-center p-2 rounded-xl min-w-[60px] transition ${
            currentView === 'history' ? 'text-blue-600 bg-blue-50' : 'text-slate-400'
          }`}
        >
          <History size={22}/>
          <span className="text-[10px] mt-1 font-medium">Lịch sử</span>
        </button>
        
        <button 
          onClick={() => setMobileMenuOpen(true)} 
          className="flex flex-col items-center p-2 rounded-xl min-w-[60px] text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
        >
          <Menu size={22}/>
          <span className="text-[10px] mt-1 font-medium">Menu</span>
        </button>
      </div>

      {/* CSS Animation for slide-in */}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in {
          animation: slideIn 0.25s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

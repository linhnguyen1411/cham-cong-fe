import React, { useState, useMemo } from 'react';
import { AlertTriangle, Clock, Filter, TrendingUp, Search, X, Plus } from 'lucide-react';
import { CreateUserModal } from './CreateUserModal';

interface User {
  id: string;
  username: string;
  fullName: string;
  role: string;
}

interface WorkSession {
  id: string;
  userId: string;
  startTime: number;
  endTime: number | null;
  duration: number;
  dateStr: string;
  isOnTime: boolean;
  minutesLate: number;
  isEarlyCheckout: boolean;
  minutesBeforeEnd: number;
}

type DateFilterType = 'today' | 'month' | 'week' | 'month30' | 'all';
type AttendanceFilterType = 'all' | 'late' | 'early' | 'good';

interface StaffStats {
  userId: string;
  username: string;
  fullName: string;
  totalSessions: number;
  onTimeCount: number;
  lateCount: number;
  totalMinutesLate: number;
  earlyCheckoutCount: number;
  totalMinutesEarlyCheckout: number;
  totalHours: number;
  avgHours: number;
  onTimeRate: number;
}

interface AdminDashboardProps {
  allUsers: User[];
  sessions: WorkSession[];
  dateFilter?: DateFilterType;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  allUsers, 
  sessions, 
  dateFilter = 'week' 
}) => {
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilterType>('all');
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Calculate stats per staff
  const staffStats = useMemo(() => {
    const stats = new Map<string, StaffStats>();

    // Initialize stats for all staff
    allUsers.forEach(user => {
      if (user.role !== 'admin') {
        stats.set(user.id, {
          userId: user.id,
          username: user.username,
          fullName: user.fullName,
          totalSessions: 0,
          onTimeCount: 0,
          lateCount: 0,
          totalMinutesLate: 0,
          earlyCheckoutCount: 0,
          totalMinutesEarlyCheckout: 0,
          totalHours: 0,
          avgHours: 0,
          onTimeRate: 0
        });
      }
    });

    // Calculate from sessions based on dateFilter
    const now = new Date();
    let startDateStr: string;

    if (dateFilter === 'today') {
      startDateStr = now.toISOString().split('T')[0];
    } else if (dateFilter === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      startDateStr = monthStart.toISOString().split('T')[0];
    } else if (dateFilter === 'week') {
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startDateStr = weekStart.toISOString().split('T')[0];
    } else if (dateFilter === 'month30') {
      const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDateStr = monthStart.toISOString().split('T')[0];
    } else {
      startDateStr = '2000-01-01';
    }

    sessions.forEach(s => {
      if (!s.endTime) return;
      if (s.dateStr < startDateStr) return;

      const stat = stats.get(s.userId);
      if (!stat) return;

      stat.totalSessions++;
      stat.totalHours += s.duration / 3600;

      // FIX: Count on-time correctly - check both boolean and string
      const isOnTime = s.isOnTime === true || s.isOnTime === 'true' || s.isOnTime === 1;
      if (isOnTime) {
        stat.onTimeCount++;
      }
      
      // Count late separately
      const minutesLate = Number(s.minutesLate) || 0;
      if (!isOnTime && minutesLate > 0) {
        stat.lateCount++;
        stat.totalMinutesLate += minutesLate;
      }

      // Count early checkout - check both boolean and string
      const isEarlyCheckout = s.isEarlyCheckout === true || s.isEarlyCheckout === 'true' || s.isEarlyCheckout === 1;
      if (isEarlyCheckout) {
        stat.earlyCheckoutCount++;
        stat.totalMinutesEarlyCheckout += Number(s.minutesBeforeEnd) || 0;
      }
    });

    // Calculate averages and rates
    stats.forEach(stat => {
      if (stat.totalSessions > 0) {
        stat.avgHours = stat.totalHours / stat.totalSessions;
        stat.onTimeRate = Math.round((stat.onTimeCount / stat.totalSessions) * 100);
      }
    });

    return Array.from(stats.values());
  }, [allUsers, sessions, dateFilter]);

  // Filter staff
  const filteredStaff = useMemo(() => {
    let result = staffStats;

    if (attendanceFilter === 'late') {
      result = result.filter(s => s.lateCount > 0);
    } else if (attendanceFilter === 'early') {
      result = result.filter(s => s.earlyCheckoutCount > 0);
    } else if (attendanceFilter === 'good') {
      result = result.filter(s => s.onTimeRate >= 80 && s.totalSessions > 0);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(s => 
        s.fullName.toLowerCase().includes(query) || 
        s.username.toLowerCase().includes(query)
      );
    }

    return result.sort((a, b) => {
      if (attendanceFilter === 'late') return b.totalMinutesLate - a.totalMinutesLate;
      if (attendanceFilter === 'early') return b.totalMinutesEarlyCheckout - a.totalMinutesEarlyCheckout;
      return b.onTimeRate - a.onTimeRate;
    });
  }, [staffStats, attendanceFilter, searchQuery]);

  const selectedStaffSessions = useMemo(() => {
    if (!selectedStaffId) return [];
    
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
    
    return sessions
      .filter(s => s.userId === selectedStaffId && s.endTime && s.dateStr >= sevenDaysAgoStr)
      .sort((a, b) => b.startTime - a.startTime);
  }, [selectedStaffId, sessions]);

  const getStatusBadge = (stat: StaffStats) => {
    if (stat.totalSessions === 0) {
      return { text: '⚪ Chưa có dữ liệu', color: 'bg-slate-100 text-slate-600' };
    }
    if (stat.onTimeRate >= 90) {
      return { text: '🟢 Xuất sắc', color: 'bg-green-100 text-green-800' };
    } else if (stat.onTimeRate >= 80) {
      return { text: '🟢 Tốt', color: 'bg-green-100 text-green-700' };
    } else if (stat.onTimeRate >= 60) {
      return { text: '🟡 Trung bình', color: 'bg-yellow-100 text-yellow-800' };
    } else if (stat.onTimeRate >= 40) {
      return { text: '🟠 Cần cải thiện', color: 'bg-orange-100 text-orange-800' };
    }
    return { text: '🔴 Cảnh báo', color: 'bg-red-100 text-red-800' };
  };

  const getDateFilterLabel = () => {
    switch(dateFilter) {
      case 'today': return 'Hôm nay';
      case 'week': return '7 ngày gần nhất';
      case 'month': return 'Tháng này';
      case 'month30': return '30 ngày gần nhất';
      case 'all': return 'Toàn bộ';
      default: return '7 ngày gần nhất';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">
              Tổng quan nhân viên
            </h3>
            <p className="text-sm text-slate-500">
              Hiển thị: {getDateFilterLabel()}
            </p>
          </div>
          <button
            onClick={() => setIsCreateUserModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition"
          >
            <Plus size={20} />
            Tạo Người Dùng
          </button>
        </div>
        
        <div className="mb-4 relative">
          <Search size={18} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên hoặc username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:outline-none text-slate-700 placeholder-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          )}
        </div>
        
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setAttendanceFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              attendanceFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            <Filter size={16} className="inline mr-2" />
            Tất cả ({staffStats.length})
          </button>
          <button
            onClick={() => setAttendanceFilter('good')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              attendanceFilter === 'good'
                ? 'bg-green-600 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            <TrendingUp size={16} className="inline mr-2" />
            Tốt ≥80% ({staffStats.filter(s => s.onTimeRate >= 80 && s.totalSessions > 0).length})
          </button>
          <button
            onClick={() => setAttendanceFilter('late')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              attendanceFilter === 'late'
                ? 'bg-red-600 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            <AlertTriangle size={16} className="inline mr-2" />
            Đi muộn ({staffStats.filter(s => s.lateCount > 0).length})
          </button>
          <button
            onClick={() => setAttendanceFilter('early')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              attendanceFilter === 'early'
                ? 'bg-yellow-600 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            <Clock size={16} className="inline mr-2" />
            Về sớm ({staffStats.filter(s => s.earlyCheckoutCount > 0).length})
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Nhân viên</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">Tổng ca</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">Đúng giờ</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">Tỷ lệ</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">Muộn</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">Về sớm</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">TB/ngày</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">Trạng thái</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((stat, index) => {
                const status = getStatusBadge(stat);
                return (
                  <tr key={stat.userId} className="border-b border-slate-200 hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {index < 3 && stat.totalSessions > 0 && (
                          <span className="text-lg">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                          </span>
                        )}
                        <div>
                          <p className="font-semibold text-slate-800">{stat.fullName}</p>
                          <p className="text-xs text-slate-500">{stat.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-block bg-slate-100 px-3 py-1 rounded-full text-sm font-medium">
                        {stat.totalSessions}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                        {stat.onTimeCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-lg font-bold text-blue-600">
                        {stat.onTimeRate}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {stat.lateCount > 0 ? (
                        <div>
                          <span className="inline-block bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                            {stat.lateCount}
                          </span>
                          <p className="text-xs text-red-600 mt-1">{stat.totalMinutesLate}p</p>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {stat.earlyCheckoutCount > 0 ? (
                        <div>
                          <span className="inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                            {stat.earlyCheckoutCount}
                          </span>
                          <p className="text-xs text-yellow-600 mt-1">{stat.totalMinutesEarlyCheckout}p</p>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-slate-800">
                      {stat.avgHours > 0 ? `${stat.avgHours.toFixed(1)}h` : '—'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
                        {status.text}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelectedStaffId(selectedStaffId === stat.userId ? null : stat.userId)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm underline"
                      >
                        {selectedStaffId === stat.userId ? 'Ẩn' : 'Xem'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredStaff.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            Không có dữ liệu cho bộ lọc này
          </div>
        )}
      </div>

      {selectedStaffId && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
            <h4 className="font-bold text-slate-800">
              Chi tiết ca làm (7 ngày) - {staffStats.find(s => s.userId === selectedStaffId)?.fullName}
            </h4>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Ngày</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Giờ vào</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700">Giờ ra</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">Thời lượng</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {selectedStaffSessions.map((session) => (
                  <tr key={session.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm">
                      {new Date(session.startTime).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {new Date(session.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {session.endTime ? new Date(session.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-medium">
                      {Math.round(session.duration / 60)}p
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2 flex-wrap">
                        {session.isOnTime ? (
                          <span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                            ✓ Đúng giờ
                          </span>
                        ) : (
                          <span className="inline-block bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium">
                            ✗ Muộn {session.minutesLate}p
                          </span>
                        )}
                        {session.isEarlyCheckout && (
                          <span className="inline-block bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium">
                            ⏱ Sớm {session.minutesBeforeEnd}p
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedStaffSessions.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              Không có ca làm nào trong 7 ngày này
            </div>
          )}
        </div>
      )}

      <CreateUserModal
        isOpen={isCreateUserModalOpen}
        onClose={() => setIsCreateUserModalOpen(false)}
        onSuccess={() => {
          setRefreshTrigger(prev => prev + 1);
          // Trigger a refresh of users in parent component
          window.location.reload();
        }}
      />
    </div>
  );
};
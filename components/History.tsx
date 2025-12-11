import React, { useState, useEffect } from 'react';
import { WorkSession, FilterType, User, UserRole } from '../types';
import * as api from '../services/api';
import { Calendar, Filter, Download, Eye } from 'lucide-react';
import { MotivationQuote } from './MotivationQuote';
import { CheckoutReportDetail } from './CheckoutReportDetail';

interface HistoryProps {
  user: User;
}

export const History: React.FC<HistoryProps> = ({ user }) => {
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [filter, setFilter] = useState<FilterType>(FilterType.WEEK);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<WorkSession | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    let data: WorkSession[] = [];
    if (user.role === UserRole.ADMIN) {
        data = await api.getAllHistory();
    } else {
        data = await api.getUserHistory(user.id);
    }
    setSessions(data);
    setLoading(false);
  };

  const getFilteredSessions = () => {
    const now = new Date();
    // Reset time part for date comparison
    now.setHours(0,0,0,0);
    
    return sessions.filter(session => {
      const sessionDate = new Date(session.startTime);
      sessionDate.setHours(0,0,0,0);
      
      switch (filter) {
        case FilterType.TODAY:
          return sessionDate.getTime() === now.getTime();
        case FilterType.WEEK:
          const oneWeekAgo = new Date(now);
          oneWeekAgo.setDate(now.getDate() - 7);
          return sessionDate >= oneWeekAgo;
        case FilterType.MONTH:
          const oneMonthAgo = new Date(now);
          oneMonthAgo.setMonth(now.getMonth() - 1);
          return sessionDate >= oneMonthAgo;
        default:
          return true;
      }
    });
  };

  const filteredSessions = getFilteredSessions();

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}g ${mins}p`;
  };

  const formatDateTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('vi-VN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <MotivationQuote />
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Lịch sử chấm công</h2>
          <p className="text-slate-500 text-sm mt-1">Xem lại hoạt động ra vào của {user.role === UserRole.ADMIN ? 'toàn bộ nhân viên' : 'bạn'}</p>
        </div>
        
        <div className="flex items-center gap-2">
            <div className="relative">
                <Filter size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <select 
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as FilterType)}
                    className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                    <option value={FilterType.TODAY}>Hôm nay</option>
                    <option value={FilterType.WEEK}>7 ngày qua</option>
                    <option value={FilterType.MONTH}>30 ngày qua</option>
                    <option value={FilterType.ALL}>Tất cả</option>
                </select>
            </div>
            {/* Mock Export */}
            <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200">
                <Download size={18} />
            </button>
        </div>
      </div>

      <div className="overflow-x-auto -mx-6 px-6">
        <table className="w-full text-left whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Ngày</th>
              {user.role === UserRole.ADMIN && <th className="px-6 py-4">Nhân viên</th>}
              <th className="px-6 py-4">Bắt đầu</th>
              <th className="px-6 py-4">Kết thúc</th>
              <th className="px-6 py-4">Tổng giờ</th>
              <th className="px-6 py-4">Trạng thái</th>
              <th className="px-6 py-4">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
               <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">Đang tải dữ liệu...</td></tr>
            ) : filteredSessions.length === 0 ? (
               <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">Không có dữ liệu trong khoảng thời gian này.</td></tr>
            ) : (
              filteredSessions.map((session) => (
                <tr key={session.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-slate-700 font-medium flex items-center">
                    <Calendar size={16} className="mr-2 text-slate-400" />
                    {new Date(session.startTime).toLocaleDateString('vi-VN')}
                  </td>
                  {user.role === UserRole.ADMIN && (
                      <td className="px-6 py-4 text-slate-600">
                          {session.userName || 'Unknown'}
                      </td>
                  )}
                  <td className="px-6 py-4 text-slate-600 font-mono text-sm">
                    {new Date(session.startTime).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-mono text-sm">
                    {session.endTime 
                        ? new Date(session.endTime).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) 
                        : '--:--'}
                  </td>
                  <td className="px-6 py-4 text-slate-800 font-bold">
                    {session.duration > 0 ? formatDuration(session.duration) : '-'}
                  </td>
                  <td className="px-6 py-4">
                    {session.endTime ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Hoàn thành
                        </span>
                    ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 animate-pulse">
                            Đang làm việc
                        </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {session.endTime && (
                      <button
                        onClick={() => {
                          setSelectedSession(session);
                          setShowDetail(true);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition text-sm font-medium whitespace-nowrap"
                      >
                        <Eye size={14} />
                        Xem chi tiết
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </div>

      {/* Checkout Report Detail Modal */}
      {selectedSession && (
        <CheckoutReportDetail
          session={selectedSession}
          isOpen={showDetail}
          onClose={() => {
            setShowDetail(false);
            setSelectedSession(null);
          }}
        />
      )}
    </div>
  );
};
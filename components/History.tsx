import React, { useState, useEffect } from 'react';
import { WorkSession, FilterType, User, UserRole, ForgotCheckinRequest } from '../types';
import * as api from '../services/api';
import { Calendar, Filter, Download, Eye } from 'lucide-react';
import { MotivationQuote } from './MotivationQuote';
import { CheckoutReportDetail } from './CheckoutReportDetail';
import * as XLSX from 'xlsx';

interface HistoryProps {
  user: User;
}

export const History: React.FC<HistoryProps> = ({ user }) => {
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [filter, setFilter] = useState<FilterType>(FilterType.WEEK);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<WorkSession | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

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
        case FilterType.THIS_MONTH:
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          monthStart.setHours(0,0,0,0);
          return sessionDate >= monthStart;
        case FilterType.DATE_RANGE:
          if (!dateFrom || !dateTo) return false;
          const fromDate = new Date(dateFrom);
          fromDate.setHours(0,0,0,0);
          const toDate = new Date(dateTo);
          toDate.setHours(23,59,59,999);
          return sessionDate >= fromDate && sessionDate <= toDate;
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

  const formatDurationHours = (seconds: number): number => {
    return Math.round((seconds / 3600) * 100) / 100; // Round to 2 decimal places
  };

  const exportToExcel = async () => {
    const sessionsToExport = getFilteredSessions();
    if (sessionsToExport.length === 0) {
      alert('Không có dữ liệu để xuất!');
      return;
    }

    // Sort sessions theo nhân viên (tên), sau đó theo thời gian bắt đầu
    const sortedSessions = [...sessionsToExport].sort((a, b) => {
      // So sánh theo tên nhân viên (alphabetically)
      const nameA = (a.userName || 'N/A').toLowerCase();
      const nameB = (b.userName || 'N/A').toLowerCase();
      if (nameA !== nameB) {
        return nameA.localeCompare(nameB, 'vi');
      }
      // Nếu cùng tên, sort theo thời gian bắt đầu (cũ nhất trước)
      return a.startTime - b.startTime;
    });

    // Sheet 1: Chi tiết từng ca làm việc
    const detailData = sortedSessions.map(session => {
      const startDate = new Date(session.startTime);
      const endDate = session.endTime ? new Date(session.endTime) : null;
      
      return {
        'Ngày': startDate.toLocaleDateString('vi-VN'),
        'Nhân viên': session.userName || 'N/A',
        'Ca làm việc': session.shiftName || 'N/A',
        'Giờ vào': startDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        'Giờ ra': endDate ? endDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Chưa checkout',
        'Tổng giờ': session.duration > 0 ? formatDurationHours(session.duration) : 0,
        'Tổng phút': session.duration > 0 ? Math.floor(session.duration / 60) : 0,
        'Trạng thái': session.forgotCheckout ? 'Quên checkout' : (session.endTime ? 'Hoàn thành' : 'Đang làm việc'),
        'Đúng giờ': session.isOnTime !== false ? 'Có' : 'Không',
        'Muộn (phút)': session.minutesLate || 0,
        'Quên checkout': session.forgotCheckout ? 'Có' : 'Không',
        'Ghi chú': session.notes || '',
        'Tóm tắt công việc': session.workSummary || '',
        'Thách thức': session.challenges || '',
        'Đề xuất': session.suggestions || ''
      };
    });

    // Sheet 2: Tổng hợp bảng lương theo nhân viên
    const summaryMap = new Map<string, {
      userName: string;
      totalSessions: number;
      totalHours: number;
      totalMinutes: number;
      completedSessions: number;
      lateCount: number;
      forgotCheckoutCount: number;
    }>();

    sortedSessions.forEach(session => {
      const userName = session.userName || 'N/A';
      
      if (!summaryMap.has(userName)) {
        summaryMap.set(userName, {
          userName,
          totalSessions: 0,
          totalHours: 0,
          totalMinutes: 0,
          completedSessions: 0,
          lateCount: 0,
          forgotCheckoutCount: 0
        });
      }

      const summary = summaryMap.get(userName)!;
      summary.totalSessions++;
      
      if (session.duration > 0) {
        summary.totalHours += formatDurationHours(session.duration);
        summary.totalMinutes += Math.floor(session.duration / 60);
      }
      
      // Chỉ tính ca hoàn thành nếu có endTime VÀ không phải quên checkout
      if (session.endTime && !session.forgotCheckout) {
        summary.completedSessions++;
      }
      
      if (session.isOnTime === false) {
        summary.lateCount++;
      }
      
      if (session.forgotCheckout) {
        summary.forgotCheckoutCount++;
      }
    });

    // Sort summary data theo tên nhân viên (alphabetically)
    const summaryData = Array.from(summaryMap.values())
      .sort((a, b) => {
        const nameA = (a.userName || 'N/A').toLowerCase();
        const nameB = (b.userName || 'N/A').toLowerCase();
        return nameA.localeCompare(nameB, 'vi');
      })
      .map(summary => ({
        'Nhân viên': summary.userName,
        'Tổng số ca': summary.totalSessions,
        'Số ca hoàn thành': summary.completedSessions,
        'Tổng giờ làm việc': Math.round(summary.totalHours * 100) / 100,
        'Tổng phút làm việc': summary.totalMinutes,
        'Số lần muộn': summary.lateCount,
        'Số lần quên checkout': summary.forgotCheckoutCount,
        'Giờ trung bình/ca': summary.totalSessions > 0 
          ? Math.round((summary.totalHours / summary.totalSessions) * 100) / 100 
          : 0
      }));

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Add detail sheet
    const wsDetail = XLSX.utils.json_to_sheet(detailData);
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Chi tiết ca làm việc');

    // Add summary sheet
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Tổng hợp bảng lương');

    // Add forgot checkin requests sheet
    try {
      const requests = await api.getForgotCheckinRequests();
      const requestsData = requests
        .sort((a, b) => {
          const nameA = (a.userName || 'N/A').toLowerCase();
          const nameB = (b.userName || 'N/A').toLowerCase();
          if (nameA !== nameB) {
            return nameA.localeCompare(nameB, 'vi');
          }
          return new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime();
        })
        .map(req => ({
          'Ngày yêu cầu': new Date(req.requestDate).toLocaleDateString('vi-VN'),
          'Nhân viên': req.userName || 'N/A',
          'Loại': req.requestType === 'checkin' ? 'Quên checkin' : 'Quên checkout',
          'Lý do': req.reason,
          'Trạng thái': req.status === 'approved' ? 'Đã duyệt' : req.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt',
          'Người duyệt': req.approvedByName || '',
          'Ngày duyệt': req.approvedAt ? new Date(req.approvedAt).toLocaleString('vi-VN') : '',
          'Lý do từ chối': req.rejectedReason || '',
          'Ngày tạo': req.createdAt ? new Date(req.createdAt).toLocaleString('vi-VN') : ''
        }));

      if (requestsData.length > 0) {
        const wsRequests = XLSX.utils.json_to_sheet(requestsData);
        XLSX.utils.book_append_sheet(wb, wsRequests, 'Form xin quên checkin/out');
      }
    } catch (err) {
      console.error('Error loading forgot checkin requests:', err);
    }

    // Generate filename
    const now = new Date();
    const dateStr = now.toLocaleDateString('vi-VN').replace(/\//g, '-');
    const getFilterText = () => {
      if (filter === FilterType.DATE_RANGE && dateFrom && dateTo) {
        const from = new Date(dateFrom).toLocaleDateString('vi-VN').replace(/\//g, '-');
        const to = new Date(dateTo).toLocaleDateString('vi-VN').replace(/\//g, '-');
        return `${from}_${to}`;
      }
      return filter === FilterType.TODAY ? 'Hom-nay' :
             filter === FilterType.WEEK ? '7-ngay' :
             filter === FilterType.MONTH ? '30-ngay' :
             filter === FilterType.THIS_MONTH ? 'Thang-nay' : 'Tat-ca';
    };
    const filterText = getFilterText();
    const filename = `Lich-su-lam-viec-${filterText}-${dateStr}.xlsx`;

    // Export
    XLSX.writeFile(wb, filename);
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
                    onChange={(e) => {
                      const newFilter = e.target.value as FilterType;
                      setFilter(newFilter);
                      if (newFilter !== FilterType.DATE_RANGE) {
                        setDateFrom('');
                        setDateTo('');
                      }
                    }}
                    className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                    <option value={FilterType.TODAY}>Hôm nay</option>
                    <option value={FilterType.WEEK}>7 ngày qua</option>
                    <option value={FilterType.MONTH}>30 ngày qua</option>
                    <option value={FilterType.THIS_MONTH}>Tháng này</option>
                    <option value={FilterType.DATE_RANGE}>Chọn khoảng ngày</option>
                    <option value={FilterType.ALL}>Tất cả</option>
                </select>
                {filter === FilterType.DATE_RANGE && (
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-2 mt-2 md:mt-0">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Từ ngày</label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div className="mt-6 md:mt-0">
                      <span className="text-gray-500">→</span>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Đến ngày</label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        min={dateFrom}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>
                )}
            </div>
            {/* Export Button */}
            <button 
              onClick={exportToExcel}
              disabled={loading || filteredSessions.length === 0}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Tải xuống bảng lương"
            >
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
                <tr 
                  key={session.id} 
                  className={`transition-colors ${
                    session.forgotCheckout 
                      ? 'bg-red-50 hover:bg-red-100' 
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <td className={`px-6 py-4 font-medium flex items-center ${
                    session.forgotCheckout ? 'text-red-700' : 'text-slate-700'
                  }`}>
                    <Calendar size={16} className={`mr-2 ${
                      session.forgotCheckout ? 'text-red-400' : 'text-slate-400'
                    }`} />
                    {new Date(session.startTime).toLocaleDateString('vi-VN')}
                  </td>
                  {user.role === UserRole.ADMIN && (
                      <td className={`px-6 py-4 ${
                        session.forgotCheckout ? 'text-red-600' : 'text-slate-600'
                      }`}>
                          {session.userName || 'Unknown'}
                      </td>
                  )}
                  <td className={`px-6 py-4 font-mono text-sm ${
                    session.forgotCheckout ? 'text-red-600' : 'text-slate-600'
                  }`}>
                    {new Date(session.startTime).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                  </td>
                  <td className={`px-6 py-4 font-mono text-sm ${
                    session.forgotCheckout ? 'text-red-600' : 'text-slate-600'
                  }`}>
                    {session.endTime 
                        ? new Date(session.endTime).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) 
                        : '--:--'}
                  </td>
                  <td className={`px-6 py-4 font-bold ${
                    session.forgotCheckout ? 'text-red-800' : 'text-slate-800'
                  }`}>
                    {session.duration > 0 ? formatDuration(session.duration) : '-'}
                  </td>
                  <td className="px-6 py-4">
                    {session.forgotCheckout ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Quên checkout
                        </span>
                    ) : session.endTime ? (
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
                    {session.endTime && !session.forgotCheckout && (
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
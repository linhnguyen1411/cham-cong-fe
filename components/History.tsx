import React, { useState, useEffect } from 'react';
import { WorkSession, FilterType, User, UserRole, ForgotCheckinRequest } from '../types';
import * as api from '../services/api';
import { usePermissions } from '../hooks/usePermissions';
import { Calendar, Filter, Download, Eye, Edit2, X, Save } from 'lucide-react';
import { MotivationQuote } from './MotivationQuote';
import { CheckoutReportDetail } from './CheckoutReportDetail';
import * as XLSX from 'xlsx';

interface HistoryProps {
  user: User;
}

export const History: React.FC<HistoryProps> = ({ user }) => {
  const { isSuperAdmin: histIsSuperAdmin, isAdmin: histIsAdmin, canManageTeam: histCanManage } = usePermissions(user);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [filter, setFilter] = useState<FilterType>(FilterType.WEEK);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<WorkSession | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>(
    histIsAdmin ? 'all' : user.id
  );
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');
  const [editingSession, setEditingSession] = useState<WorkSession | null>(null);
  const [editForm, setEditForm] = useState({
    startTime: '',
    endTime: '',
    workSummary: '',
    challenges: '',
    suggestions: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadAvailableUsers();
  }, [user]);

  useEffect(() => {
    loadData();
  }, [user, selectedUserId]);

  const loadAvailableUsers = async () => {
    // Chỉ load users cho admin và manager
    if (histIsAdmin || histCanManage) {
      setLoadingUsers(true);
      try {
        let users: User[] = [];
        if (histIsAdmin) {
          // Admin/Super Admin: load tất cả users
          users = await api.getUsers();
        } else if (histCanManage) {
          // Manager: load users trong team
          users = await api.getMyTeam();
        }
        // Sắp xếp theo tên
        users.sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
        setAvailableUsers(users);
      } catch (err) {
        // Error loading users
      } finally {
        setLoadingUsers(false);
      }
    }
  };

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      let data: WorkSession[] = [];
      if (selectedUserId === 'all' || selectedUserId === '') {
        data = await api.getAllHistory();
      } else if (selectedUserId === user.id) {
        data = await api.getUserHistory(user.id);
      } else {
        data = await api.getUserHistory(selectedUserId);
      }
      setSessions(data);
    } catch (err: any) {
      setLoadError(err?.message || 'Không thể tải dữ liệu');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredSessions = () => {
    const now = new Date();
    // Reset time part for date comparison
    now.setHours(0,0,0,0);
    
    // Priority: Date range picker > Filter selection
    // If dateFrom is selected, use date range logic
    if (dateFrom) {
      return sessions.filter(session => {
        try {
          if (!session.startTime || isNaN(session.startTime)) return false;
          const sessionDate = new Date(session.startTime);
          if (isNaN(sessionDate.getTime())) return false;
          sessionDate.setHours(0,0,0,0);
          
          const fromDate = new Date(dateFrom);
          if (isNaN(fromDate.getTime())) return false;
          fromDate.setHours(0,0,0,0);
          
          if (dateTo) {
            // Both start and end selected: filter by range
            const toDate = new Date(dateTo);
            if (isNaN(toDate.getTime())) return false;
            toDate.setHours(23,59,59,999);
            return sessionDate >= fromDate && sessionDate <= toDate;
          } else {
            // Only start selected: from start to now
            return sessionDate >= fromDate && sessionDate <= now;
          }
        } catch (e) {
          return false;
        }
      });
    }
    
    // No date picker: use filter selection
    return sessions.filter(session => {
      try {
        if (!session.startTime || isNaN(session.startTime)) return false;
        const sessionDate = new Date(session.startTime);
        if (isNaN(sessionDate.getTime())) return false;
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
          default:
            return true;
        }
      } catch (e) {
        return false;
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

  /** Chuyển timestamp sang "YYYY-MM-DDTHH:mm" theo múi giờ VN (UTC+7) cho input datetime-local */
  const formatTimestampForDatetimeLocalVN = (timestamp: number): string => {
    const d = new Date(timestamp);
    const s = d.toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    const [datePart, timePart] = s.split(' ');
    const [y, m, day] = datePart.split('-');
    const [h, min] = timePart.split(':');
    return `${y}-${m}-${day}T${h}:${min}`;
  };

  /** Parse "YYYY-MM-DDTHH:mm" như giờ VN (UTC+7) và trả về ISO string */
  const parseDatetimeLocalAsVN = (val: string): string => {
    if (!val || !val.includes('T')) return '';
    const vnString = `${val}+07:00`;
    const d = new Date(vnString);
    return isNaN(d.getTime()) ? '' : d.toISOString();
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
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      
      try {
        if (session.startTime && !isNaN(session.startTime)) {
          startDate = new Date(session.startTime);
          if (isNaN(startDate.getTime())) startDate = null;
        }
        if (session.endTime && !isNaN(session.endTime)) {
          endDate = new Date(session.endTime);
          if (isNaN(endDate.getTime())) endDate = null;
        }
      } catch (e) {
        // Ignore errors, use null
      }
      
      return {
        'Ngày': startDate ? startDate.toLocaleDateString('vi-VN') : 'Invalid date',
        'Nhân viên': session.userName || 'N/A',
        'Ca làm việc': session.shiftName || 'N/A',
        'Giờ vào': startDate ? startDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--',
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
      // Priority: Date range picker
      if (dateFrom) {
        if (dateTo) {
          const from = new Date(dateFrom).toLocaleDateString('vi-VN').replace(/\//g, '-');
          const to = new Date(dateTo).toLocaleDateString('vi-VN').replace(/\//g, '-');
          return `${from}_${to}`;
        } else {
          const from = new Date(dateFrom).toLocaleDateString('vi-VN').replace(/\//g, '-');
          const to = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-');
          return `${from}_${to}`;
        }
      }
      // Use filter selection
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
          <p className="text-slate-500 text-sm mt-1">
            {(() => {
              if (selectedUserId === 'all' || selectedUserId === '') {
                return 'Xem lại hoạt động ra vào của tất cả nhân viên';
              } else if (selectedUserId === user.id) {
                return 'Xem lại hoạt động ra vào của bạn';
              } else {
                return `Xem lại hoạt động ra vào của ${availableUsers.find(u => u.id === selectedUserId)?.fullName || 'nhân viên'}`;
              }
            })()}
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row items-stretch md:items-end gap-3 flex-wrap">
          {/* User selector - chỉ hiển thị cho admin và manager */}
          {(histIsAdmin || histCanManage) && (
            <div className="flex flex-col min-w-[200px] w-full md:w-[220px] shrink-0">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Chọn nhân viên</label>
              <input
                type="text"
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                placeholder="Tìm kiếm..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white h-[38px] mb-1.5"
              />
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white h-[38px] appearance-none cursor-pointer"
                disabled={loadingUsers}
                style={{ minHeight: 38 }}
              >
                {histIsAdmin && (
                  <option value="all">Tất cả nhân viên</option>
                )}
                <option value={user.id}>Cá nhân (tôi)</option>
                {(() => {
                  const filtered = availableUsers.filter(u => {
                    if (userSearchTerm.trim() === '') return true;
                    const searchLower = userSearchTerm.toLowerCase().trim();
                    const fullName = (u.fullName || '').toLowerCase();
                    const username = (u.username || '').toLowerCase();
                    const positionName = (u.positionName || '').toLowerCase();
                    const departmentName = (u.departmentName || '').toLowerCase();
                    return (
                      fullName.includes(searchLower) ||
                      username.includes(searchLower) ||
                      positionName.includes(searchLower) ||
                      departmentName.includes(searchLower)
                    );
                  }).filter(u => u.id !== user.id);
                  if (filtered.length === 0 && userSearchTerm.trim()) {
                    return <option value="" disabled>Không tìm thấy nhân viên</option>;
                  }
                  return filtered.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} {u.positionName ? `(${u.positionName})` : ''} {u.departmentName ? `- ${u.departmentName}` : ''}
                    </option>
                  ));
                })()}
              </select>
            </div>
          )}
            <div className="flex flex-col shrink-0">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Bộ lọc</label>
                <div className="relative">
                  <Filter size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <select 
                      value={filter}
                      onChange={(e) => {
                        const newFilter = e.target.value as FilterType;
                        setFilter(newFilter);
                        setDateFrom('');
                        setDateTo('');
                      }}
                      className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white h-[38px] min-w-[140px]"
                  >
                    <option value={FilterType.TODAY}>Hôm nay</option>
                    <option value={FilterType.WEEK}>7 ngày qua</option>
                    <option value={FilterType.MONTH}>30 ngày qua</option>
                    <option value={FilterType.THIS_MONTH}>Tháng này</option>
                    <option value={FilterType.ALL}>Tất cả</option>
                  </select>
                </div>
            </div>
            
            {/* Date Range Picker - Separate */}
            <div className="flex items-end gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Từ ngày</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    // Clear end date if start date is cleared
                    if (!e.target.value) {
                      setDateTo('');
                    }
                  }}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white h-[38px]"
                  placeholder="Chọn ngày bắt đầu"
                />
              </div>
              <div className="flex items-end pb-2">
                <span className="text-slate-400 text-lg">→</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Đến ngày</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  min={dateFrom || undefined}
                  disabled={!dateFrom}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-100 disabled:cursor-not-allowed h-[38px]"
                  placeholder="Chọn ngày kết thúc"
                />
              </div>
            </div>
            
            {/* Export Button */}
            <button 
              onClick={exportToExcel}
              disabled={loading || filteredSessions.length === 0}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors h-[42px] w-[42px] flex items-center justify-center"
              title="Tải xuống bảng lương"
            >
                <Download size={18} />
            </button>
        </div>
      </div>

      {loadError && (
        <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {loadError}
        </div>
      )}

      <div className="overflow-x-auto -mx-6 px-6">
        <table className="w-full text-left whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Ngày</th>
              {(histIsAdmin || histCanManage) && (selectedUserId === 'all' || selectedUserId !== user.id) && (
                <th className="px-6 py-4">Nhân viên</th>
              )}
              <th className="px-6 py-4">Bắt đầu</th>
              <th className="px-6 py-4">Kết thúc</th>
              <th className="px-6 py-4">Tổng giờ</th>
              <th className="px-6 py-4">Trạng thái</th>
              <th className="px-6 py-4">Chi tiết</th>
              {(histIsAdmin || histCanManage) && (
                <th className="px-6 py-4">Thao tác</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
               <tr><td colSpan={(() => {
                 const showUserColumn = (histIsAdmin || histCanManage) && (selectedUserId === 'all' || selectedUserId !== user.id);
                 const showActionColumn = histIsAdmin || histCanManage;
                 return showUserColumn && showActionColumn ? 8 : showUserColumn || showActionColumn ? 7 : 6;
               })()} className="px-6 py-8 text-center text-slate-400">Đang tải dữ liệu...</td></tr>
            ) : filteredSessions.length === 0 ? (
               <tr><td colSpan={(() => {
                 const showUserColumn = (histIsAdmin || histCanManage) && (selectedUserId === 'all' || selectedUserId !== user.id);
                 const showActionColumn = histIsAdmin || histCanManage;
                 return showUserColumn && showActionColumn ? 8 : showUserColumn || showActionColumn ? 7 : 6;
               })()} className="px-6 py-8 text-center text-slate-400">Không có dữ liệu trong khoảng thời gian này.</td></tr>
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
                    {(() => {
                      try {
                        if (!session.startTime || isNaN(session.startTime)) return 'Invalid date';
                        const date = new Date(session.startTime);
                        if (isNaN(date.getTime())) return 'Invalid date';
                        return date.toLocaleDateString('vi-VN');
                      } catch (e) {
                        return 'Invalid date';
                      }
                    })()}
                  </td>
                  {(histIsAdmin || histCanManage) && (selectedUserId === 'all' || selectedUserId !== user.id) && (
                      <td className={`px-6 py-4 ${
                        session.forgotCheckout ? 'text-red-600' : 'text-slate-600'
                      }`}>
                          {session.userName || 'Unknown'}
                      </td>
                  )}
                  <td className={`px-6 py-4 font-mono text-sm ${
                    session.forgotCheckout ? 'text-red-600' : 'text-slate-600'
                  }`}>
                    {(() => {
                      try {
                        if (!session.startTime || isNaN(session.startTime)) return '--:--';
                        const date = new Date(session.startTime);
                        if (isNaN(date.getTime())) return '--:--';
                        return date.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
                      } catch (e) {
                        return '--:--';
                      }
                    })()}
                  </td>
                  <td className={`px-6 py-4 font-mono text-sm ${
                    session.forgotCheckout ? 'text-red-600' : 'text-slate-600'
                  }`}>
                    {(() => {
                      try {
                        if (!session.endTime || isNaN(session.endTime)) return '--:--';
                        const date = new Date(session.endTime);
                        if (isNaN(date.getTime())) return '--:--';
                        return date.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
                      } catch (e) {
                        return '--:--';
                      }
                    })()}
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
                  {(histIsAdmin || histCanManage) && (
                    <td className="px-6 py-4">
                      <button
                        onClick={() => {
                          setEditingSession(session);
                          setEditForm({
                            startTime: formatTimestampForDatetimeLocalVN(session.startTime),
                            endTime: session.endTime ? formatTimestampForDatetimeLocalVN(session.endTime) : '',
                            workSummary: session.workSummary || '',
                            challenges: session.challenges || '',
                            suggestions: session.suggestions || '',
                            notes: session.notes || ''
                          });
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-yellow-50 text-yellow-600 hover:bg-yellow-100 transition text-sm font-medium whitespace-nowrap"
                      >
                        <Edit2 size={14} />
                        Sửa
                      </button>
                    </td>
                  )}
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

      {/* Edit Work Session Modal */}
      {editingSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white p-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Chỉnh sửa ca làm việc</h2>
                <p className="text-yellow-100 text-sm mt-1">
                  {editingSession.userName} - {(() => {
                    try {
                      if (!editingSession.startTime || isNaN(editingSession.startTime)) return 'Invalid date';
                      const date = new Date(editingSession.startTime);
                      if (isNaN(date.getTime())) return 'Invalid date';
                      return date.toLocaleDateString('vi-VN');
                    } catch (e) {
                      return 'Invalid date';
                    }
                  })()}
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingSession(null);
                  setEditForm({
                    startTime: '',
                    endTime: '',
                    workSummary: '',
                    challenges: '',
                    suggestions: '',
                    notes: ''
                  });
                }}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Giờ vào <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={editForm.startTime}
                  onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Giờ ra</label>
                <input
                  type="datetime-local"
                  value={editForm.endTime}
                  onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
                <p className="text-xs text-gray-500 mt-1">Để trống nếu chưa checkout</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tóm tắt công việc</label>
                <textarea
                  value={editForm.workSummary}
                  onChange={(e) => setEditForm({ ...editForm, workSummary: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Nhập tóm tắt công việc đã làm..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thách thức</label>
                <textarea
                  value={editForm.challenges}
                  onChange={(e) => setEditForm({ ...editForm, challenges: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Nhập các thách thức gặp phải..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Đề xuất</label>
                <textarea
                  value={editForm.suggestions}
                  onChange={(e) => setEditForm({ ...editForm, suggestions: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Nhập các đề xuất cải thiện..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Nhập ghi chú khác..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={async () => {
                    if (!editForm.startTime) {
                      alert('Vui lòng nhập giờ vào');
                      return;
                    }

                    setSaving(true);
                    try {
                      const startTimeISO = parseDatetimeLocalAsVN(editForm.startTime);
                      if (!startTimeISO) {
                        alert('Giờ vào không hợp lệ');
                        setSaving(false);
                        return;
                      }
                      
                      const endTimeISO = editForm.endTime ? parseDatetimeLocalAsVN(editForm.endTime) : null;
                      
                      await api.adminUpdateWorkSession(editingSession.id, {
                        startTime: startTimeISO,
                        endTime: endTimeISO,
                        workSummary: editForm.workSummary || undefined,
                        challenges: editForm.challenges || undefined,
                        suggestions: editForm.suggestions || undefined,
                        notes: editForm.notes || undefined
                      });
                      
                      await loadData();
                      setEditingSession(null);
                      setEditForm({
                        startTime: '',
                        endTime: '',
                        workSummary: '',
                        challenges: '',
                        suggestions: '',
                        notes: ''
                      });
                      alert('Đã cập nhật ca làm việc thành công!');
                    } catch (err: any) {
                      alert(err.message || 'Có lỗi xảy ra khi cập nhật');
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Save size={16} />
                  {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
                <button
                  onClick={() => {
                    setEditingSession(null);
                    setEditForm({
                      startTime: '',
                      endTime: '',
                      workSummary: '',
                      challenges: '',
                      suggestions: '',
                      notes: ''
                    });
                  }}
                  disabled={saving}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
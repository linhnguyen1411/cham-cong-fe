import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Check, X, CheckCheck, Users, Calendar, Loader2, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { User, ShiftRegistration, ShiftRegistrationStatus } from '../types';
import { 
  getShiftRegistrations, 
  getPendingRegistrations,
  approveShiftRegistration, 
  rejectShiftRegistration,
  bulkApproveShiftRegistrations 
} from '../services/api';

interface Props {
  user: User;
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const WEEKDAY_FULL = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

const ShiftApproval: React.FC<Props> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState<ShiftRegistration[]>([]);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedWeek, setSelectedWeek] = useState<string>('');

  useEffect(() => {
    loadRegistrations();
  }, [filter]);

  const loadRegistrations = async () => {
    try {
      setLoading(true);
      let data: ShiftRegistration[];
      
      if (filter === 'pending') {
        data = await getPendingRegistrations();
      } else {
        data = await getShiftRegistrations();
      }
      
      setRegistrations(data);
      setSelectedIds([]);
      
      // Set default week to the first week with registrations
      if (data.length > 0 && !selectedWeek) {
        const weeks = [...new Set(data.map(r => r.weekStart))].sort();
        if (weeks.length > 0) {
          setSelectedWeek(weeks[0]);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setError('');
    setProcessing(id);
    
    try {
      await approveShiftRegistration(id, user.id);
      setSuccess('Đã duyệt đăng ký');
      loadRegistrations();
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: string) => {
    const note = prompt('Lý do từ chối (tùy chọn):');
    if (note === null) return;
    
    setError('');
    setProcessing(id);
    
    try {
      await rejectShiftRegistration(id, user.id, note || undefined);
      setSuccess('Đã từ chối đăng ký');
      loadRegistrations();
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra');
    } finally {
      setProcessing(null);
    }
  };

  const handleApproveAllForUser = async (userPendingRegs: ShiftRegistration[]) => {
    if (userPendingRegs.length === 0) return;
    
    setError('');
    setProcessing(`approve-all-${userPendingRegs[0].userId}`);
    
    try {
      const ids = userPendingRegs.map(r => r.id);
      const result = await bulkApproveShiftRegistrations(ids, user.id);
      setSuccess(`Đã duyệt ${result.approved.length} đăng ký của ${userPendingRegs[0].userName}`);
      if (result.errors.length > 0) {
        setError(`Có ${result.errors.length} lỗi khi duyệt`);
      }
      loadRegistrations();
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra');
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectAllForUser = async (userPendingRegs: ShiftRegistration[]) => {
    if (userPendingRegs.length === 0) return;
    
    const note = prompt(`Lý do từ chối tất cả đăng ký của ${userPendingRegs[0].userName} (tùy chọn):`);
    if (note === null) return;
    
    setError('');
    setProcessing(`reject-all-${userPendingRegs[0].userId}`);
    
    try {
      // Reject từng đăng ký một
      const promises = userPendingRegs.map(reg => 
        rejectShiftRegistration(reg.id, user.id, note || undefined)
      );
      await Promise.all(promises);
      setSuccess(`Đã từ chối ${userPendingRegs.length} đăng ký của ${userPendingRegs[0].userName}. Nhân viên có thể đăng ký lại.`);
      loadRegistrations();
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra');
    } finally {
      setProcessing(null);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    
    setError('');
    setProcessing('bulk');
    
    try {
      const result = await bulkApproveShiftRegistrations(selectedIds, user.id);
      setSuccess(`Đã duyệt ${result.approved.length} đăng ký`);
      if (result.errors.length > 0) {
        setError(`Có ${result.errors.length} lỗi`);
      }
      loadRegistrations();
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra');
    } finally {
      setProcessing(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const pendingIds = getPendingRegistrationsForWeek()
      .filter(r => r.status === ShiftRegistrationStatus.PENDING)
      .map(r => r.id);
    
    if (selectedIds.length === pendingIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingIds);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getDate()}/${date.getMonth() + 1}`;
  };

  const getWeekDates = (weekStart: string): Date[] => {
    const start = new Date(weekStart);
    start.setHours(0, 0, 0, 0);
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const formatDateForAPI = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Group registrations by user and week
  const getRegistrationsForWeek = (weekStart: string) => {
    return registrations.filter(r => r.weekStart === weekStart);
  };

  const getPendingRegistrationsForWeek = () => {
    if (!selectedWeek) return [];
    return getRegistrationsForWeek(selectedWeek);
  };

  // Group by user
  const groupByUser = (regs: ShiftRegistration[]) => {
    const grouped: Record<string, ShiftRegistration[]> = {};
    regs.forEach(reg => {
      const key = `${reg.userId}-${reg.userName}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(reg);
    });
    return grouped;
  };

  const getStatusBadge = (status: ShiftRegistrationStatus, isMobile: boolean = false) => {
    if (isMobile) {
      // Mobile: không hiển thị badge, chỉ dùng màu
      return null;
    }
    switch (status) {
      case ShiftRegistrationStatus.PENDING:
        return <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] rounded">Chờ</span>;
      case ShiftRegistrationStatus.APPROVED:
        // Desktop: không hiển thị "OK" vì màu xanh đã biết là ok
        return null;
      case ShiftRegistrationStatus.REJECTED:
        return <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] rounded">Từ chối</span>;
    }
  };

  // Get shift abbreviation for mobile (S = sáng, C = chiều)
  const getShiftAbbreviation = (shiftName?: string): string => {
    if (!shiftName) return '';
    const name = shiftName.toLowerCase();
    if (name.includes('sáng') || name.includes('sang')) return 'S';
    if (name.includes('chiều') || name.includes('chieu')) return 'C';
    return shiftName.charAt(0).toUpperCase();
  };

  // Get all unique weeks
  const allWeeks = [...new Set(registrations.map(r => r.weekStart))].sort();
  const currentWeekIndex = selectedWeek ? allWeeks.indexOf(selectedWeek) : -1;

  const navigateWeek = (direction: 'prev' | 'next') => {
    if (currentWeekIndex === -1) return;
    const newIndex = direction === 'prev' 
      ? Math.max(0, currentWeekIndex - 1)
      : Math.min(allWeeks.length - 1, currentWeekIndex + 1);
    setSelectedWeek(allWeeks[newIndex]);
  };

  const weekRegs = selectedWeek ? getRegistrationsForWeek(selectedWeek) : [];
  const userGroups = groupByUser(weekRegs);
  const weekDates = selectedWeek ? getWeekDates(selectedWeek) : [];

  const getRegsForUserAndDay = (userId: string, dateStr: string): ShiftRegistration[] => {
    return weekRegs.filter(r => r.userId === userId && r.workDate === dateStr);
  };

  const pendingCount = registrations.filter(r => r.status === ShiftRegistrationStatus.PENDING).length;
  const weekPendingCount = weekRegs.filter(r => r.status === ShiftRegistrationStatus.PENDING).length;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
            <ClipboardCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Duyệt Đăng ký Ca</h1>
            <p className="text-gray-500 text-sm">Xét duyệt đăng ký ca làm việc của nhân viên</p>
          </div>
        </div>
        
        {pendingCount > 0 && (
          <div className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-full font-medium">
            {pendingCount} chờ duyệt
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-600 rounded-lg">
          {success}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 bg-white p-4 rounded-xl shadow-sm border flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filter}
              onChange={e => setFilter(e.target.value as 'pending' | 'all')}
              className="px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="pending">Chờ duyệt</option>
              <option value="all">Tất cả</option>
            </select>
          </div>
          
          {selectedWeek && allWeeks.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateWeek('prev')}
                disabled={currentWeekIndex === 0}
                className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <select
                value={selectedWeek}
                onChange={e => setSelectedWeek(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                {allWeeks.map(week => (
                  <option key={week} value={week}>
                    Tuần {formatDate(week)}
                  </option>
                ))}
              </select>
              <button
                onClick={() => navigateWeek('next')}
                disabled={currentWeekIndex === allWeeks.length - 1}
                className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          
          {filter === 'pending' && weekPendingCount > 0 && (
            <button
              onClick={toggleSelectAll}
              className="text-sm text-purple-600 hover:text-purple-700"
            >
              {selectedIds.length === weekPendingCount ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
          )}
        </div>
        
        {selectedIds.length > 0 && (
          <button
            onClick={handleBulkApprove}
            disabled={processing === 'bulk'}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {processing === 'bulk' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCheck className="w-4 h-4" />
            )}
            Duyệt {selectedIds.length} đăng ký
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : !selectedWeek || weekRegs.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <ClipboardCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            {filter === 'pending' ? 'Không có đăng ký chờ duyệt' : 'Chưa có đăng ký nào'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: Table View */}
          <div className="hidden lg:block bg-white rounded-xl shadow-sm border overflow-x-auto">
            <table className="w-full border-collapse min-w-[800px]">
              {/* Table Header - Days */}
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="p-3 font-semibold text-gray-700 border-r border-b text-left w-[150px]">Nhân viên</th>
                  {WEEKDAYS.map((day, idx) => {
                    const date = weekDates[idx];
                    const isToday = date && date.toDateString() === new Date().toDateString();
                    return (
                      <th
                        key={day}
                        className={`p-2 text-center border-r border-b w-[70px] ${isToday ? 'bg-indigo-50' : ''}`}
                      >
                        <div className={`text-xs font-medium ${isToday ? 'text-indigo-600' : 'text-gray-600'}`}>
                          {day}
                        </div>
                        {date && (
                          <div className={`text-sm font-bold ${isToday ? 'text-indigo-600' : 'text-gray-900'}`}>
                            {date.getDate()}
                          </div>
                        )}
                      </th>
                    );
                  })}
                  <th className="p-3 font-semibold text-gray-700 border-b text-center w-[100px]">Thao tác</th>
                </tr>
              </thead>

              {/* Table Body - Users */}
              <tbody>
                {Object.entries(userGroups).map(([userKey, userRegs]) => {
                  const userId = userRegs[0].userId;
                  const userName = userRegs[0].userName;
                  const userPendingRegs = userRegs.filter(r => r.status === ShiftRegistrationStatus.PENDING);
                  const hasPending = userPendingRegs.length > 0;
                  
                  return (
                    <tr key={userKey} className="hover:bg-gray-50">
                      {/* User Name Column */}
                      <td className="p-3 border-r border-b">
                        <div className="flex items-center gap-2 min-w-0">
                          <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="font-medium text-gray-900 truncate flex-1">{userName}</span>
                          {hasPending && (
                            <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] rounded flex-shrink-0">
                              {userPendingRegs.length}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Day Columns */}
                      {WEEKDAYS.map((_, dayIdx) => {
                        const dateStr = formatDateForAPI(weekDates[dayIdx]);
                        const dayRegs = getRegsForUserAndDay(userId, dateStr);
                        
                        return (
                          <td key={dayIdx} className="p-1 border-r border-b w-[70px]">
                            {dayRegs.length > 0 ? (
                              <div className="space-y-0.5">
                                {dayRegs.map(reg => (
                                  <div
                                    key={reg.id}
                                    className={`px-1 py-0.5 rounded text-[10px] text-center ${
                                      reg.status === ShiftRegistrationStatus.APPROVED 
                                        ? 'bg-green-100 text-green-800 border border-green-300' 
                                        : reg.status === ShiftRegistrationStatus.REJECTED
                                        ? 'bg-red-100 text-red-800 border border-red-300'
                                        : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                                    }`}
                                    style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                  >
                                    <div className="font-medium truncate" style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {reg.shiftName}
                                    </div>
                                    {reg.status !== ShiftRegistrationStatus.APPROVED && (
                                      <div className="mt-0.5">
                                        {getStatusBadge(reg.status, false)}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center h-full min-h-[40px]">
                                <span className="text-gray-300 text-sm">—</span>
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Action Column - at the end of each user row */}
                      <td className="p-2 border-b w-[100px]">
                        {filter === 'pending' && hasPending ? (
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => handleApproveAllForUser(userPendingRegs)}
                              disabled={processing === `approve-all-${userId}`}
                              className="w-full p-2 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                              title="Duyệt tất cả đăng ký"
                            >
                              {processing === `approve-all-${userId}` ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Đang duyệt...</span>
                                </>
                              ) : (
                                <>
                                  <CheckCheck className="w-4 h-4" />
                                  <span>Duyệt</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleRejectAllForUser(userPendingRegs)}
                              disabled={processing === `reject-all-${userId}`}
                              className="w-full p-2 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                              title="Từ chối tất cả và cho đăng ký lại"
                            >
                              {processing === `reject-all-${userId}` ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Đang từ chối...</span>
                                </>
                              ) : (
                                <>
                                  <X className="w-4 h-4" />
                                  <span>Từ chối</span>
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center text-gray-300 text-xs py-2">
                            —
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: Card View */}
          <div className="lg:hidden space-y-4">
            {Object.entries(userGroups).map(([userKey, userRegs]) => {
              const userId = userRegs[0].userId;
              const userName = userRegs[0].userName;
              const userPendingRegs = userRegs.filter(r => r.status === ShiftRegistrationStatus.PENDING);
              const hasPending = userPendingRegs.length > 0;
              
              return (
                <div key={userKey} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  {/* User Header */}
                  <div className="p-3 bg-gradient-to-r from-blue-50 to-cyan-50 border-b flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-gray-900 flex-1">{userName}</span>
                    {hasPending && (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">
                        {userPendingRegs.length} chờ
                      </span>
                    )}
                  </div>

                  {/* Week Schedule */}
                  <div className="p-3">
                    <div className="grid grid-cols-7 gap-1 mb-3">
                      {WEEKDAYS.map((day, dayIdx) => {
                        const date = weekDates[dayIdx];
                        const dateStr = formatDateForAPI(date);
                        const dayRegs = getRegsForUserAndDay(userId, dateStr);
                        const isToday = date && date.toDateString() === new Date().toDateString();
                        
                        return (
                          <div key={dayIdx} className={`text-center ${isToday ? 'bg-indigo-50 rounded' : ''}`}>
                            <div className={`text-[10px] font-medium ${isToday ? 'text-indigo-600' : 'text-gray-600'}`}>
                              {day}
                            </div>
                            {date && (
                              <div className={`text-xs font-bold ${isToday ? 'text-indigo-600' : 'text-gray-900'}`}>
                                {date.getDate()}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Shifts by Day */}
                    <div className="space-y-2">
                      {WEEKDAYS.map((day, dayIdx) => {
                        const date = weekDates[dayIdx];
                        const dateStr = formatDateForAPI(date);
                        const dayRegs = getRegsForUserAndDay(userId, dateStr);
                        
                        if (dayRegs.length === 0) return null;
                        
                        return (
                          <div key={dayIdx} className="flex items-center gap-2">
                            <div className="w-12 text-xs font-medium text-gray-600">
                              {day} {date.getDate()}
                            </div>
                            <div className="flex-1 flex flex-wrap gap-1">
                              {dayRegs.map(reg => (
                                <div
                                  key={reg.id}
                                  className={`px-2 py-1 rounded text-xs font-medium ${
                                    reg.status === ShiftRegistrationStatus.APPROVED 
                                      ? 'bg-green-100 text-green-800 border border-green-300' 
                                      : reg.status === ShiftRegistrationStatus.REJECTED
                                      ? 'bg-red-100 text-red-800 border border-red-300'
                                      : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                                  }`}
                                >
                                  {getShiftAbbreviation(reg.shiftName)}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Empty days indicator */}
                    {weekDates.filter((date, idx) => {
                      const dateStr = formatDateForAPI(date);
                      return getRegsForUserAndDay(userId, dateStr).length === 0;
                    }).length > 0 && (
                      <div className="mt-2 text-xs text-gray-500 text-center">
                        Ngày không đăng ký: {weekDates.filter((date, idx) => {
                          const dateStr = formatDateForAPI(date);
                          return getRegsForUserAndDay(userId, dateStr).length === 0;
                        }).map((date, idx) => `${WEEKDAYS[idx]} ${date.getDate()}`).join(', ')}
                      </div>
                    )}

                    {/* Actions */}
                    {filter === 'pending' && hasPending && (
                      <div className="mt-3 pt-3 border-t flex gap-2">
                        <button
                          onClick={() => handleApproveAllForUser(userPendingRegs)}
                          disabled={processing === `approve-all-${userId}`}
                          className="flex-1 p-2 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {processing === `approve-all-${userId}` ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Đang duyệt...</span>
                            </>
                          ) : (
                            <>
                              <CheckCheck className="w-4 h-4" />
                              <span>Duyệt</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleRejectAllForUser(userPendingRegs)}
                          disabled={processing === `reject-all-${userId}`}
                          className="flex-1 p-2 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {processing === `reject-all-${userId}` ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Đang từ chối...</span>
                            </>
                          ) : (
                            <>
                              <X className="w-4 h-4" />
                              <span>Từ chối</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default ShiftApproval;

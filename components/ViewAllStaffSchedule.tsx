import React, { useState, useEffect } from 'react';
import { Calendar, Users, Loader2, Phone, X as XIcon, Plus, Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import { User, ShiftRegistration, Position, UserRole as UserRoleEnum, UserStatus } from '../types';
import { 
  getShiftRegistrations, 
  getWorkShifts, 
  getUsers, 
  getPositions,
  adminQuickAddShiftRegistration,
  adminQuickDeleteShiftRegistration
} from '../services/api';

interface Props {
  user: User;
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const WEEKDAY_FULL = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

const ViewAllStaffSchedule: React.FC<Props> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState<ShiftRegistration[]>([]);
  const [availableShifts, setAvailableShifts] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [error, setError] = useState('');
  const [modalData, setModalData] = useState<{
    date: string;
    dateLabel: string;
    shiftName: string;
    shiftId: string;
    positionId?: string;
    staff: Array<{ 
      name: string; 
      phone?: string;
      userId: string;
      registrationId: string;
    }>;
  } | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [addingUser, setAddingUser] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addFormData, setAddFormData] = useState({
    userId: '',
    shiftId: '',
    date: ''
  });
  const isAdmin = user.role === UserRoleEnum.ADMIN;

  useEffect(() => {
    // Initialize with current week
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() + diff);
    currentMonday.setHours(0, 0, 0, 0);
    const weekStart = formatDateForAPI(currentMonday);
    setSelectedWeek(weekStart);
  }, []);

  useEffect(() => {
    if (selectedWeek) {
      loadData();
    }
  }, [selectedWeek]);

  const loadData = async () => {
    if (!selectedWeek) return;
    
    try {
      setLoading(true);
      setError('');
      
      // Load all shifts, users, and positions (only once)
      if (availableShifts.length === 0 || allUsers.length === 0) {
        const [shifts, users, positionsData] = await Promise.all([
          getWorkShifts(),
          getUsers(),
          getPositions()
        ]);
        setAvailableShifts(shifts);
        setAllUsers(users);
        setPositions(positionsData);
      }
      
      // Load approved registrations for selected week
      const regs = await getShiftRegistrations({
        weekStart: selectedWeek,
        status: 'approved'
      });
      setRegistrations(regs);
    } catch (err: any) {
      setError(err.message || 'Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    if (!selectedWeek) return;
    
    const currentWeekStart = new Date(selectedWeek);
    currentWeekStart.setHours(0, 0, 0, 0);
    
    const newWeekStart = new Date(currentWeekStart);
    if (direction === 'prev') {
      newWeekStart.setDate(currentWeekStart.getDate() - 7);
    } else {
      newWeekStart.setDate(currentWeekStart.getDate() + 7);
    }
    
    setSelectedWeek(formatDateForAPI(newWeekStart));
  };

  const goToCurrentWeek = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() + diff);
    currentMonday.setHours(0, 0, 0, 0);
    setSelectedWeek(formatDateForAPI(currentMonday));
  };

  const formatDateForAPI = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

  const formatDate = (date: Date) => {
    return `${date.getDate()}/${date.getMonth() + 1}`;
  };

  const getRegsForDayAndShift = (dateStr: string, shiftId: string, positionId?: string): ShiftRegistration[] => {
    let regs = registrations.filter(r => r.workDate === dateStr && r.workShiftId === shiftId);
    
    // Filter by position if specified
    if (positionId) {
      if (positionId === 'no-position') {
        regs = regs.filter(reg => {
          const user = allUsers.find(u => u.id === reg.userId);
          return !user?.positionId;
        });
      } else {
        regs = regs.filter(reg => {
          const user = allUsers.find(u => u.id === reg.userId);
          return user?.positionId === positionId;
        });
      }
    }
    
    return regs;
  };

  const getStaffDetailsForDayAndShift = (dateStr: string, shiftId: string, positionId?: string): Array<{ 
    name: string; 
    phone?: string;
    userId: string;
    registrationId: string;
  }> => {
    const regs = getRegsForDayAndShift(dateStr, shiftId, positionId);
    return regs.map(reg => {
      const user = allUsers.find(u => u.id === reg.userId);
      return {
        name: reg.userName || user?.fullName || '',
        phone: user?.phone,
        userId: reg.userId,
        registrationId: reg.id
      };
    });
  };
  
  const getActiveStaff = (): User[] => {
    return allUsers.filter(u => 
      u.role === UserRoleEnum.STAFF && 
      u.status !== UserStatus.DEACTIVE
    );
  };

  const getUsersByPosition = (positionId?: string): User[] => {
    const activeStaff = getActiveStaff();
    if (!positionId || positionId === 'no-position') {
      return activeStaff.filter(u => !u.positionId);
    }
    return activeStaff.filter(u => u.positionId === positionId);
  };
  
  const getPositionSortOrder = (positionName: string): number => {
    const name = positionName.toLowerCase();
    if (name.includes('phục vụ') || name.includes('phuc vu')) return 1;
    if (name.includes('bếp') || name.includes('bep')) return 2;
    if (name === 'chưa phân vị trí' || name === 'chua phan vi tri') return 999;
    return 10;
  };
  
  const getAllPositionsWithNull = (): Array<Position & { id: string; name: string }> => {
    const activeStaff = getActiveStaff();
    const result: Array<Position & { id: string; name: string }> = [...positions];
    
    const usersWithoutPosition = activeStaff.filter(u => !u.positionId);
    if (usersWithoutPosition.length > 0) {
      result.push({
        id: 'no-position',
        name: 'Chưa phân vị trí',
        description: undefined,
        branchId: undefined,
        branchName: undefined,
        departmentId: undefined,
        departmentName: undefined,
        level: 0,
        usersCount: usersWithoutPosition.length
      } as Position & { id: string; name: string });
    }
    
    return result.sort((a, b) => {
      const orderA = getPositionSortOrder(a.name);
      const orderB = getPositionSortOrder(b.name);
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name, 'vi');
    });
  };

  const handleQuickAdd = async () => {
    if (!isAdmin || !addFormData.userId || !addFormData.shiftId || !addFormData.date) {
      setError('Vui lòng chọn đầy đủ thông tin');
      return;
    }
    
    setAddingUser(`${addFormData.userId}-${addFormData.shiftId}-${addFormData.date}`);
    setError('');
    
    try {
      await adminQuickAddShiftRegistration({
        userId: addFormData.userId,
        workShiftId: addFormData.shiftId,
        workDate: addFormData.date
      });
      setShowAddModal(false);
      setAddFormData({ userId: '', shiftId: '', date: '' });
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Không thể thêm nhân viên');
    } finally {
      setAddingUser(null);
    }
  };

  const handleQuickDelete = async (userId: string, shiftId: string, dateStr: string, userName: string, shiftName: string, dateLabel: string) => {
    if (!isAdmin) return;
    
    if (!confirm(`Bạn có chắc chắn muốn xóa ${userName} khỏi ${shiftName} - ${dateLabel}?`)) {
      return;
    }
    
    setDeletingUser(`${userId}-${shiftId}-${dateStr}`);
    setError('');
    
    try {
      await adminQuickDeleteShiftRegistration({
        userId,
        workShiftId: shiftId,
        workDate: dateStr
      });
      await loadData();
      
      // Close modal if the deleted user was shown
      if (modalData && modalData.staff.some(s => s.userId === userId)) {
        const updatedStaff = modalData.staff.filter(s => s.userId !== userId);
        if (updatedStaff.length === 0) {
          setModalData(null);
        } else {
          setModalData({ ...modalData, staff: updatedStaff });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Không thể xóa nhân viên');
    } finally {
      setDeletingUser(null);
    }
  };

  const weekDates = selectedWeek ? getWeekDates(selectedWeek) : [];
  const activeStaff = getActiveStaff();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error && !error.includes('Vui lòng')) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg">
        {error}
        <button onClick={() => setError('')} className="ml-2 text-red-400 hover:text-red-600">✕</button>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <style>{`
        @media print {
          @page {
            margin: 1cm;
            size: A4 landscape;
          }
          body * {
            visibility: hidden;
          }
          .print-container, .print-container * {
            visibility: visible !important;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
          }
          .no-print {
            display: none !important;
            visibility: hidden !important;
          }
          /* Ensure mobile view is visible on screen (not print) */
          @media screen {
            .lg\\:hidden {
              display: block !important;
            }
          }
          .print-header {
            margin-bottom: 20px;
            page-break-inside: avoid;
          }
          .print-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .print-week-info {
            margin-bottom: 20px;
            font-weight: 600;
          }
          .print-container div.hidden {
            display: block !important;
            visibility: visible !important;
          }
          .print-container div.lg\\:block {
            display: block !important;
            visibility: visible !important;
          }
          .print-container [class*="hidden"] {
            display: block !important;
            visibility: visible !important;
          }
          .print-container table {
            border-collapse: collapse !important;
            width: 100% !important;
            display: table !important;
            visibility: visible !important;
          }
          .print-container thead {
            display: table-header-group !important;
            visibility: visible !important;
          }
          .print-container tbody {
            display: table-row-group !important;
            visibility: visible !important;
          }
          .print-container tr {
            display: table-row !important;
            visibility: visible !important;
            page-break-inside: avoid;
          }
          .print-container th, .print-container td {
            border: 1px solid #000 !important;
            padding: 8px !important;
            text-align: left !important;
            display: table-cell !important;
            visibility: visible !important;
          }
          .print-container th {
            background-color: #f3f4f6 !important;
            font-weight: bold !important;
          }
          .print-container button {
            display: none !important;
          }
          .print-only {
            display: none !important;
          }
          @media print {
            .print-only {
              display: block !important;
            }
            .no-print {
              display: none !important;
            }
          }
        }
      `}</style>
      <div className="flex items-center justify-between mb-6 no-print">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lịch làm việc</h1>
            <p className="text-gray-500 text-sm">
              {isAdmin ? 'Xem và quản lý lịch làm việc của tất cả nhân viên' : 'Xem lịch làm việc của tất cả nhân viên'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            <Printer size={20} />
            <span>In</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus size={20} />
              <span>Thêm ca làm việc</span>
            </button>
          )}
        </div>
      </div>

      {error && error.includes('Vui lòng') && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm no-print">
          {error}
        </div>
      )}

      <div className="print-container">
        {/* Week Info with Navigation */}
        {selectedWeek && (
          <div className="mb-4 p-4 bg-white rounded-xl shadow-sm border print-header">
            <div className="flex items-center justify-between mb-2 no-print">
              <button
                onClick={() => navigateWeek('prev')}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                title="Tuần trước"
              >
                <ChevronLeft size={24} className="text-gray-600" />
              </button>
              <div className="text-center flex-1">
                <div className="font-semibold text-gray-900 print-week-info">
                  Tuần từ {formatDate(weekDates[0])} đến {formatDate(weekDates[6])} {weekDates[0].getFullYear()}
                </div>
                <button
                  onClick={goToCurrentWeek}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-700 underline no-print"
                >
                  Về tuần hiện tại
                </button>
              </div>
              <button
                onClick={() => navigateWeek('next')}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                title="Tuần sau"
              >
                <ChevronRight size={24} className="text-gray-600" />
              </button>
            </div>
          </div>
        )}

        {/* Schedule Grid - Desktop */}
        <div className="hidden lg:block bg-white rounded-xl shadow-sm border overflow-x-auto print-table-wrapper">
        <table className="w-full border-collapse min-w-[800px] print-table">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="p-3 font-semibold text-gray-700 border-r border-b text-left w-[150px]">Vị trí</th>
              {WEEKDAYS.map((day, idx) => {
                const date = weekDates[idx];
                const isToday = date && date.toDateString() === new Date().toDateString();
                return (
                  <th
                    key={idx}
                    className={`p-2 text-center border-r border-b w-[100px] ${isToday ? 'bg-blue-50' : ''}`}
                  >
                    <div className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-gray-600'}`}>
                      {day}
                    </div>
                    {date && (
                      <div className={`text-sm font-bold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                        {date.getDate()}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {getAllPositionsWithNull().map((position) => (
              <tr key={position.id} className="hover:bg-gray-50">
                <td className="p-3 border-r border-b font-medium text-gray-900">
                  {position.name}
                </td>
                {WEEKDAYS.map((_, dayIdx) => {
                  const date = weekDates[dayIdx];
                  const dateStr = date ? formatDateForAPI(date) : '';
                  return (
                    <td key={dayIdx} className="p-2 border-r border-b">
                      <div className="space-y-2">
                        {availableShifts.map((shift) => {
                          const staffDetails = getStaffDetailsForDayAndShift(dateStr, shift.id, position.id);
                          
                          return (
                            <div key={shift.id} className="text-xs mb-2">
                              <div className="font-semibold text-gray-700 mb-1">{shift.name}</div>
                              <div className="space-y-1">
                                {staffDetails.map((staff) => (
                                  <div
                                    key={staff.userId}
                                    className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition group"
                                  >
                                    <span
                                      className="flex-1 cursor-pointer"
                                      onClick={() => {
                                        setModalData({
                                          date: dateStr,
                                          dateLabel: `${WEEKDAY_FULL[dayIdx]} ${formatDate(date)}`,
                                          shiftName: shift.name,
                                          shiftId: shift.id,
                                          positionId: position.id,
                                          staff: staffDetails
                                        });
                                      }}
                                    >
                                      {staff.name}
                                    </span>
                                    {isAdmin && (
                                      <button
                                        onClick={() => handleQuickDelete(staff.userId, shift.id, dateStr, staff.name, shift.name, `${WEEKDAY_FULL[dayIdx]} ${formatDate(date)}`)}
                                        disabled={deletingUser === `${staff.userId}-${shift.id}-${dateStr}`}
                                        className="opacity-0 group-hover:opacity-100 transition p-0.5 hover:bg-red-200 rounded text-red-600 disabled:opacity-50"
                                        title="Xóa nhân viên khỏi ca"
                                      >
                                        <XIcon size={12} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Mobile View */}
      <div className="lg:hidden space-y-4">
        {getAllPositionsWithNull().map((position) => (
          <div key={position.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-3 bg-gradient-to-r from-blue-50 to-cyan-50 border-b">
              <div className="font-semibold text-gray-900">{position.name}</div>
            </div>
            <div className="p-3 space-y-3">
              {WEEKDAYS.map((day, dayIdx) => {
                const date = weekDates[dayIdx];
                const dateStr = date ? formatDateForAPI(date) : '';
                return (
                  <div key={dayIdx} className="border rounded-lg p-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-bold text-gray-900">{day}</div>
                        <div className="text-sm font-bold text-gray-900">{date ? date.getDate() : ''}</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {availableShifts.map((shift) => {
                        const staffDetails = getStaffDetailsForDayAndShift(dateStr, shift.id, position.id);
                        
                        return (
                          <div key={shift.id}>
                            <div className="text-xs font-semibold text-gray-700 mb-1">{shift.name}</div>
                            <div className="flex flex-wrap gap-1 mb-1">
                              {staffDetails.map((staff) => (
                                <div
                                  key={staff.userId}
                                  className="relative group px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded"
                                >
                                  {staff.name}
                                  {isAdmin && (
                                    <button
                                      onClick={() => handleQuickDelete(staff.userId, shift.id, dateStr, staff.name, shift.name, `${WEEKDAY_FULL[dayIdx]} ${formatDate(date)}`)}
                                      disabled={deletingUser === `${staff.userId}-${shift.id}-${dateStr}`}
                                      className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] disabled:opacity-50"
                                      title="Xóa"
                                    >
                                      <XIcon size={8} />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {showAddModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setShowAddModal(false); setAddFormData({ userId: '', shiftId: '', date: '' }); }}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full m-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Thêm ca làm việc nhanh</h3>
              <button
                onClick={() => { setShowAddModal(false); setAddFormData({ userId: '', shiftId: '', date: '' }); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XIcon size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nhân viên</label>
                <select
                  value={addFormData.userId}
                  onChange={(e) => setAddFormData({ ...addFormData, userId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Chọn nhân viên --</option>
                  {activeStaff.map(u => (
                    <option key={u.id} value={u.id}>{u.fullName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ca làm việc</label>
                <select
                  value={addFormData.shiftId}
                  onChange={(e) => setAddFormData({ ...addFormData, shiftId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Chọn ca --</option>
                  {availableShifts.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ngày</label>
                <select
                  value={addFormData.date}
                  onChange={(e) => setAddFormData({ ...addFormData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Chọn ngày --</option>
                  {weekDates.map((date, idx) => (
                    <option key={idx} value={formatDateForAPI(date)}>
                      {WEEKDAY_FULL[idx]} {formatDate(date)}/{date.getMonth() + 1}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowAddModal(false); setAddFormData({ userId: '', shiftId: '', date: '' }); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Hủy
                </button>
                <button
                  onClick={handleQuickAdd}
                  disabled={!addFormData.userId || !addFormData.shiftId || !addFormData.date || addingUser !== null}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {addingUser ? 'Đang thêm...' : 'Thêm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Staff Details */}
      {modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setModalData(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full m-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                {modalData.shiftName} - {modalData.dateLabel}
              </h3>
              <button
                onClick={() => setModalData(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              <div className="space-y-2">
                {modalData.staff.map((staff) => (
                  <div key={staff.userId} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{staff.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {staff.phone && (
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Phone className="w-3 h-3" />
                          {staff.phone}
                        </div>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => {
                            handleQuickDelete(staff.userId, modalData.shiftId, modalData.date, staff.name, modalData.shiftName, modalData.dateLabel);
                          }}
                          disabled={deletingUser === `${staff.userId}-${modalData.shiftId}-${modalData.date}`}
                          className="p-1 hover:bg-red-100 rounded text-red-600 disabled:opacity-50"
                          title="Xóa nhân viên khỏi ca"
                        >
                          <XIcon size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewAllStaffSchedule;

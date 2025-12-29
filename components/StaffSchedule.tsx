import React, { useState, useEffect } from 'react';
import { Calendar, Users, ChevronLeft, ChevronRight, Loader2, X, Phone, GripVertical, Edit, Trash2, Save } from 'lucide-react';
import { User, ShiftRegistration, ShiftRegistrationStatus, Position, UserRole, UserStatus } from '../types';
import { 
  getShiftRegistrations, 
  getWorkShifts, 
  getUsers, 
  getPositions,
  adminUpdateShiftRegistration,
  adminDeleteShiftRegistration
} from '../services/api';

interface Props {
  user: User;
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const WEEKDAY_FULL = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

const StaffSchedule: React.FC<Props> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState<ShiftRegistration[]>([]);
  const [availableShifts, setAvailableShifts] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [error, setError] = useState('');
  const [modalData, setModalData] = useState<{
    date: string;
    dateLabel: string;
    shiftName: string;
    shiftId: string;
    staff: Array<{ 
      name: string; 
      phone?: string;
      userId: string;
      registrationId: string;
    }>;
  } | null>(null);
  const [positionOrder, setPositionOrder] = useState<string[]>([]);
  const [draggedPositionId, setDraggedPositionId] = useState<string | null>(null);
  const [editingRegistration, setEditingRegistration] = useState<{
    id: string;
    userId: string;
    workShiftId: string;
    workDate: string;
    note?: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedWeek]);

  // Load position order from localStorage
  useEffect(() => {
    const savedOrder = localStorage.getItem('positionOrder');
    if (savedOrder) {
      try {
        setPositionOrder(JSON.parse(savedOrder));
      } catch (e) {
        console.error('Failed to parse position order:', e);
      }
    }
  }, []);

  // Save position order to localStorage
  const savePositionOrder = (order: string[]) => {
    setPositionOrder(order);
    localStorage.setItem('positionOrder', JSON.stringify(order));
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Load all shifts, users, and positions
      const [shifts, users, positionsData] = await Promise.all([
        getWorkShifts(),
        getUsers(),
        getPositions()
      ]);
      setAvailableShifts(shifts);
      setAllUsers(users);
      setPositions(positionsData);
      
      // Load approved registrations for selected week
      if (selectedWeek) {
        const regs = await getShiftRegistrations({
          weekStart: selectedWeek,
          status: 'approved'
        });
        setRegistrations(regs);
      } else {
        // Default to current week
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const currentMonday = new Date(today);
        currentMonday.setDate(today.getDate() + diff);
        currentMonday.setHours(0, 0, 0, 0);
        
        const weekStart = formatDateForAPI(currentMonday);
        setSelectedWeek(weekStart);
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
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
        // Filter for users without position
        regs = regs.filter(reg => {
          const user = allUsers.find(u => u.id === reg.userId);
          return !user?.positionId;
        });
      } else {
        // Filter for users with specific position
        regs = regs.filter(reg => {
          const user = allUsers.find(u => u.id === reg.userId);
          return user?.positionId === positionId;
        });
      }
    }
    
    return regs;
  };

  const getStaffCountForDayAndShift = (dateStr: string, shiftId: string, positionId?: string): number => {
    return getRegsForDayAndShift(dateStr, shiftId, positionId).length;
  };

  const getStaffNamesForDayAndShift = (dateStr: string, shiftId: string, positionId?: string): string[] => {
    return getRegsForDayAndShift(dateStr, shiftId, positionId).map(r => r.userName || '');
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
  
  // Get active staff only (exclude admin and deactive users)
  const getActiveStaff = (): User[] => {
    return allUsers.filter(u => 
      u.role === UserRole.STAFF && 
      u.status !== UserStatus.DEACTIVE
    );
  };

  // Get users by position
  const getUsersByPosition = (positionId?: string): User[] => {
    const activeStaff = getActiveStaff();
    if (!positionId || positionId === 'no-position') {
      return activeStaff.filter(u => !u.positionId);
    }
    return activeStaff.filter(u => u.positionId === positionId);
  };
  
  // Get position sort order (phục vụ -> bếp -> others -> chưa phân vị trí)
  const getPositionSortOrder = (positionName: string): number => {
    const name = positionName.toLowerCase();
    if (name.includes('phục vụ') || name.includes('phuc vu')) return 1;
    if (name.includes('bếp') || name.includes('bep')) return 2;
    if (name === 'chưa phân vị trí' || name === 'chua phan vi tri') return 999;
    return 10; // Other positions
  };
  
  // Get all positions including "No Position" (null), sorted
  const getAllPositionsWithNull = (): Array<Position & { id: string; name: string }> => {
    const activeStaff = getActiveStaff();
    const result: Array<Position & { id: string; name: string }> = [...positions];
    
    // Add "No Position" if there are active staff without position
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
    
    // Sort positions: use saved order if available, otherwise use default sort
    if (positionOrder.length > 0) {
      const ordered: Array<Position & { id: string; name: string }> = [];
      const unordered: Array<Position & { id: string; name: string }> = [];
      
      // Add positions in saved order
      positionOrder.forEach(id => {
        const pos = result.find(p => p.id === id);
        if (pos) ordered.push(pos);
      });
      
      // Add positions not in saved order
      result.forEach(pos => {
        if (!positionOrder.includes(pos.id)) {
          unordered.push(pos);
        }
      });
      
      // Sort unordered by default order
      unordered.sort((a, b) => {
        const orderA = getPositionSortOrder(a.name);
        const orderB = getPositionSortOrder(b.name);
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name, 'vi');
      });
      
      return [...ordered, ...unordered];
    }
    
    // Default sort: phục vụ -> bếp -> others -> chưa phân vị trí
    return result.sort((a, b) => {
      const orderA = getPositionSortOrder(a.name);
      const orderB = getPositionSortOrder(b.name);
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name, 'vi');
    });
  };

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, positionId: string) => {
    setDraggedPositionId(positionId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', positionId);
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent, targetPositionId: string) => {
    e.preventDefault();
    if (!draggedPositionId || draggedPositionId === targetPositionId) {
      setDraggedPositionId(null);
      return;
    }

    const allPositions = getAllPositionsWithNull();
    const currentOrder = positionOrder.length > 0 
      ? positionOrder.filter(id => allPositions.some(p => p.id === id))
      : allPositions.map(p => p.id);

    const draggedIndex = currentOrder.indexOf(draggedPositionId);
    const targetIndex = currentOrder.indexOf(targetPositionId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedPositionId(null);
      return;
    }

    // Reorder
    const newOrder = [...currentOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedPositionId);

    // Add any missing positions
    allPositions.forEach(pos => {
      if (!newOrder.includes(pos.id)) {
        newOrder.push(pos.id);
      }
    });

    savePositionOrder(newOrder);
    setDraggedPositionId(null);
  };

  const handleCellClick = (dateStr: string, dateLabel: string, shiftName: string, shiftId: string, positionId?: string) => {
    const staff = getStaffDetailsForDayAndShift(dateStr, shiftId, positionId);
    if (staff.length > 0) {
      setModalData({ date: dateStr, dateLabel, shiftName, shiftId, staff });
    }
  };

  const handleEditRegistration = (registrationId: string, userId: string, workShiftId: string, workDate: string, note?: string) => {
    setEditingRegistration({
      id: registrationId,
      userId,
      workShiftId,
      workDate,
      note: note || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingRegistration) return;
    
    setSaving(true);
    setError('');
    
    try {
      await adminUpdateShiftRegistration(editingRegistration.id, {
        workShiftId: editingRegistration.workShiftId,
        workDate: editingRegistration.workDate,
        note: editingRegistration.note
      });
      
      setEditingRegistration(null);
      await loadData();
      
      // Reload modal data if open
      if (modalData) {
        const staff = getStaffDetailsForDayAndShift(modalData.date, modalData.shiftId);
        if (staff.length > 0) {
          setModalData({ ...modalData, staff });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Không thể cập nhật đăng ký');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRegistration = async (registrationId: string) => {
    if (!confirm('Bạn chắc chắn muốn xóa đăng ký ca này?')) return;
    
    setSaving(true);
    setError('');
    
    try {
      await adminDeleteShiftRegistration(registrationId);
      await loadData();
      
      // Reload modal data if open
      if (modalData) {
        const staff = getStaffDetailsForDayAndShift(modalData.date, modalData.shiftId);
        if (staff.length > 0) {
          setModalData({ ...modalData, staff });
        } else {
          setModalData(null);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Không thể xóa đăng ký');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeShift = (newShiftId: string) => {
    if (!editingRegistration) return;
    setEditingRegistration({ ...editingRegistration, workShiftId: newShiftId });
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    if (!selectedWeek) return;
    
    const currentDate = new Date(selectedWeek);
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === 'prev' ? -7 : 7));
    
    setSelectedWeek(formatDateForAPI(newDate));
  };

  const weekDates = selectedWeek ? getWeekDates(selectedWeek) : [];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Lịch Làm Việc Nhân Viên</h1>
            <p className="text-gray-500 text-sm">Xem số nhân viên làm việc theo từng ca</p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Week Navigation */}
      <div className="flex items-center justify-between bg-white rounded-xl p-3 md:p-4 mb-4 shadow-sm border">
        <button
          onClick={() => navigateWeek('prev')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
        </button>
        
        <div className="text-center">
          <div className="font-semibold text-sm md:text-base text-gray-900">
            {selectedWeek && weekDates.length > 0 && (
              <>
                {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
              </>
            )}
          </div>
          <div className="text-xs md:text-sm text-gray-500">
            Tuần {selectedWeek && formatDate(weekDates[0])}
          </div>
        </div>
        
        <button
          onClick={() => navigateWeek('next')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : !selectedWeek || weekDates.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Chưa có dữ liệu</p>
        </div>
      ) : (
        <>
          {/* Desktop: Multiple Tables by Position */}
          <div className="hidden md:block space-y-6">
            {getAllPositionsWithNull().map((position) => {
              const positionUsers = getUsersByPosition(position.id === 'no-position' ? undefined : position.id);
              const hasUsers = positionUsers.length > 0;
              
              const isDragging = draggedPositionId === position.id;
              
              return (
                <div 
                  key={position.id} 
                  className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-opacity ${
                    isDragging ? 'opacity-50' : ''
                  }`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, position.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, position.id)}
                >
                  {/* Position Header */}
                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b p-4 flex items-center gap-3 cursor-move hover:bg-blue-100 transition-colors">
                    <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="flex-1">
                      <h2 className="text-lg font-bold text-gray-900">{position.name}</h2>
                      <p className="text-sm text-gray-600 mt-1">
                        {positionUsers.length} nhân viên
                      </p>
                    </div>
                  </div>
                  
                  {hasUsers ? (
                    <>
                      {/* Table Header */}
                      <div className="grid grid-cols-8 border-b bg-gray-50 sticky top-0 z-10">
                        <div className="p-3 font-semibold text-gray-700 border-r">Ca</div>
                        {WEEKDAYS.map((day, idx) => {
                          const date = weekDates[idx];
                          const isToday = date && date.toDateString() === new Date().toDateString();
                          return (
                            <div
                              key={day}
                              className={`p-3 text-center border-r ${isToday ? 'bg-indigo-50' : ''}`}
                            >
                              <div className={`text-xs font-medium ${isToday ? 'text-indigo-600' : 'text-gray-600'}`}>
                                {day}
                              </div>
                              {date && (
                                <div className={`text-sm font-bold ${isToday ? 'text-indigo-600' : 'text-gray-900'}`}>
                                  {date.getDate()}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Table Body */}
                      <div className="divide-y">
                        {availableShifts.map((shift) => (
                          <div key={shift.id} className="grid grid-cols-8 hover:bg-gray-50">
                            {/* Shift Name */}
                            <div className="p-3 border-r font-medium text-gray-900 flex items-center">
                              {shift.name}
                            </div>

                            {/* Day Columns */}
                            {WEEKDAYS.map((_, dayIdx) => {
                              const dateStr = formatDateForAPI(weekDates[dayIdx]);
                              const date = weekDates[dayIdx];
                              const positionId = position.id === 'no-position' ? undefined : position.id;
                              const count = getStaffCountForDayAndShift(dateStr, String(shift.id), positionId);
                              const staffNames = getStaffNamesForDayAndShift(dateStr, String(shift.id), positionId);
                              const staffDetails = getStaffDetailsForDayAndShift(dateStr, String(shift.id), positionId);
                              const dateLabel = `${WEEKDAY_FULL[dayIdx]}, ${formatDate(date)}`;
                              
                              return (
                                <div 
                                  key={dayIdx} 
                                  className="p-3 border-r text-center relative group"
                                >
                                  {count > 0 ? (
                                    <button
                                      onClick={() => handleCellClick(dateStr, dateLabel, shift.name, String(shift.id), positionId)}
                                      className="w-full flex flex-col items-center gap-1 hover:bg-blue-50 rounded-lg p-2 transition-colors cursor-pointer"
                                      title={`Click để xem chi tiết${user.role === UserRole.ADMIN ? ' và chỉnh sửa' : ''}`}
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <Users className="w-4 h-4 text-blue-600" />
                                        <span className="font-bold text-blue-600 text-lg">{count}</span>
                                      </div>
                                      <div className="text-xs text-gray-600 max-w-full">
                                        <div className="truncate">
                                          {staffNames.slice(0, 2).join(', ')}
                                          {staffNames.length > 2 && ` +${staffNames.length - 2}`}
                                        </div>
                                      </div>
                                      {/* Tooltip on hover */}
                                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-20 pointer-events-none">
                                        <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg max-w-xs">
                                          <div className="space-y-1 max-h-48 overflow-y-auto">
                                            {staffDetails.map((staff, idx) => (
                                              <div key={idx} className="whitespace-nowrap">
                                                {staff.name}
                                              </div>
                                            ))}
                                          </div>
                                          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                                            <div className="border-4 border-transparent border-t-gray-900"></div>
                                          </div>
                                        </div>
                                      </div>
                                    </button>
                                  ) : (
                                    <div className="text-gray-300 text-sm">—</div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center text-gray-400">
                      Không có nhân viên trong vị trí này
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile: List View by Position */}
          <div className="md:hidden space-y-4">
            {getAllPositionsWithNull().map((position) => {
              const positionUsers = getUsersByPosition(position.id === 'no-position' ? undefined : position.id);
              const hasUsers = positionUsers.length > 0;
              
              const isDragging = draggedPositionId === position.id;
              
              return (
                <div 
                  key={position.id} 
                  className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-opacity ${
                    isDragging ? 'opacity-50' : ''
                  }`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, position.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, position.id)}
                >
                  {/* Position Header */}
                  <div className="p-3 bg-gradient-to-r from-blue-50 to-cyan-50 border-b flex items-center gap-2 cursor-move active:bg-blue-100 transition-colors">
                    <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{position.name}</h3>
                      <p className="text-xs text-gray-600 mt-1">
                        {positionUsers.length} nhân viên
                      </p>
                    </div>
                  </div>
                  
                  {hasUsers ? (
                    <div className="divide-y">
                      {availableShifts.map((shift) => (
                        <div key={shift.id} className="border-b last:border-b-0">
                          <div className="p-3 bg-gray-50">
                            <h4 className="font-semibold text-gray-900 text-sm">{shift.name}</h4>
                          </div>
                          
                          <div className="divide-y">
                            {WEEKDAYS.map((day, dayIdx) => {
                              const date = weekDates[dayIdx];
                              const dateStr = formatDateForAPI(date);
                              const positionId = position.id === 'no-position' ? undefined : position.id;
                              const count = getStaffCountForDayAndShift(dateStr, String(shift.id), positionId);
                              const staffNames = getStaffNamesForDayAndShift(dateStr, String(shift.id), positionId);
                              const isToday = date && date.toDateString() === new Date().toDateString();
                              
                              return (
                                <div
                                  key={dayIdx}
                                  className={`p-3 ${isToday ? 'bg-indigo-50' : ''}`}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div>
                                      <div className="font-medium text-gray-900 text-sm">{WEEKDAY_FULL[dayIdx]}</div>
                                      <div className="text-xs text-gray-500">{formatDate(date)}</div>
                                    </div>
                                    {count > 0 && (
                                      <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 rounded-full">
                                        <Users className="w-3 h-3 text-blue-600" />
                                        <span className="font-bold text-blue-600 text-sm">{count}</span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {count > 0 ? (
                                    <button
                                      onClick={() => {
                                        const dateLabel = `${WEEKDAY_FULL[dayIdx]}, ${formatDate(date)}`;
                                        handleCellClick(dateStr, dateLabel, shift.name, String(shift.id), positionId);
                                      }}
                                      className="w-full text-left text-xs text-gray-700 hover:bg-blue-50 rounded-lg p-2 transition-colors"
                                    >
                                      <div className="font-medium mb-1">Nhân viên ({count}):</div>
                                      <div className="space-y-0.5">
                                        {staffNames.slice(0, 3).map((name, idx) => (
                                          <div key={idx} className="text-gray-600">• {name}</div>
                                        ))}
                                        {staffNames.length > 3 && (
                                          <div className="text-blue-600 text-xs font-medium">
                                            Xem thêm {staffNames.length - 3} nhân viên...
                                          </div>
                                        )}
                                      </div>
                                    </button>
                                  ) : (
                                    <div className="text-gray-400 text-xs text-center py-1">
                                      Không có nhân viên
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-gray-400 text-sm">
                      Không có nhân viên trong vị trí này
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal for Staff Details */}
      {modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-cyan-50 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{modalData.shiftName}</h3>
                <p className="text-sm text-gray-600">{modalData.dateLabel}</p>
              </div>
              <button
                onClick={() => {
                  setModalData(null);
                  setEditingRegistration(null);
                }}
                className="p-2 hover:bg-white/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-3 text-sm font-medium text-gray-700">
                Danh sách nhân viên ({modalData.staff.length}):
              </div>
              <div className="space-y-3">
                {modalData.staff.map((staff, idx) => {
                  const isEditing = editingRegistration?.id === staff.registrationId;
                  const registration = registrations.find(r => r.id === staff.registrationId);
                  
                  return (
                    <div
                      key={idx}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="font-medium text-gray-900">{staff.name}</div>
                          
                          {/* Edit Shift */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Ca làm việc
                            </label>
                            <select
                              value={editingRegistration.workShiftId}
                              onChange={(e) => handleChangeShift(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              {availableShifts.map(shift => (
                                <option key={shift.id} value={shift.id}>
                                  {shift.name} ({shift.startTime} - {shift.endTime})
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          {/* Edit Note */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Ghi chú
                            </label>
                            <textarea
                              value={editingRegistration.note || ''}
                              onChange={(e) => setEditingRegistration({ ...editingRegistration, note: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              rows={2}
                              placeholder="Ghi chú (tùy chọn)"
                            />
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveEdit}
                              disabled={saving}
                              className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              {saving ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Đang lưu...
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4" />
                                  Lưu
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => setEditingRegistration(null)}
                              disabled={saving}
                              className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium disabled:opacity-50"
                            >
                              Hủy
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 mb-1">{staff.name}</div>
                              {staff.phone ? (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Phone className="w-4 h-4" />
                                  <a
                                    href={`tel:${staff.phone}`}
                                    className="hover:text-blue-600 hover:underline"
                                  >
                                    {staff.phone}
                                  </a>
                                </div>
                              ) : (
                                <div className="text-sm text-gray-400">Chưa có số điện thoại</div>
                              )}
                              {registration?.note && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Ghi chú: {registration.note}
                                </div>
                              )}
                            </div>
                            
                            {/* Admin Actions */}
                            {user.role === UserRole.ADMIN && (
                              <div className="flex gap-1 ml-2">
                                <button
                                  onClick={() => handleEditRegistration(
                                    staff.registrationId,
                                    staff.userId,
                                    modalData.shiftId,
                                    modalData.date,
                                    registration?.note
                                  )}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                                  title="Sửa ca làm việc"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteRegistration(staff.registrationId)}
                                  disabled={saving}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded transition disabled:opacity-50"
                                  title="Xóa đăng ký"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => {
                  setModalData(null);
                  setEditingRegistration(null);
                }}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffSchedule;


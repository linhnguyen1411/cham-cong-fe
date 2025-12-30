import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Check, X, AlertCircle, Send, Loader2, Zap } from 'lucide-react';
import { User, WorkShift, ShiftRegistration as ShiftReg, ShiftRegistrationStatus } from '../types';
import { 
  getMyShiftRegistrations, 
  getAvailableShifts, 
  bulkCreateShiftRegistrations,
  deleteShiftRegistration 
} from '../services/api';

interface Props {
  user: User;
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const WEEKDAY_FULL = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

const ShiftRegistration: React.FC<Props> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [currentWeekRegs, setCurrentWeekRegs] = useState<ShiftReg[]>([]);
  const [nextWeekRegs, setNextWeekRegs] = useState<ShiftReg[]>([]);
  const [canRegisterNextWeek, setCanRegisterNextWeek] = useState(false);
  const [availableShifts, setAvailableShifts] = useState<WorkShift[]>([]);
  
  // Selected shifts: Array of arrays - mỗi ngày có thể có nhiều ca
  const [selectedShifts, setSelectedShifts] = useState<string[][]>([
    [], [], [], [], [], [], []
  ]);
  
  const [viewingWeek, setViewingWeek] = useState<'current' | 'next'>('next');

  useEffect(() => {
    loadData();
  }, [user.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [regsData, shiftsData] = await Promise.all([
        getMyShiftRegistrations(user.id),
        getAvailableShifts(user.id)
      ]);
      
      setCurrentWeekRegs(regsData.currentWeek);
      setNextWeekRegs(regsData.nextWeek);
      setCanRegisterNextWeek(regsData.canRegisterNextWeek);
      setAvailableShifts(shiftsData);
      
      initSelectedShifts(regsData.nextWeek);
    } catch (err: any) {
      setError(err.message || 'Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to format date as YYYY-MM-DD in local timezone
  const formatDateForAPI = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const initSelectedShifts = (regs: ShiftReg[], preserveCurrent: boolean = false) => {
    const nextMonday = getNextMonday();
    const weekDates = getWeekDates(nextMonday);
    
    // Nếu preserveCurrent = true, giữ lại selectedShifts hiện tại
    // Nếu không, reset về mảng rỗng
    const newSelected: string[][] = preserveCurrent 
      ? selectedShifts.map(day => [...day]) // Copy current state
      : [[], [], [], [], [], [], []];
    
    // QUAN TRỌNG: Load TẤT CẢ pending và approved vào selectedShifts
    // Để khi submit sẽ gửi lại TẤT CẢ các ca đã đăng ký
    // Backend sẽ xóa tất cả pending và tạo lại từ selectedShifts
    const pendingAndApprovedRegs = regs.filter(reg => 
      reg.status === ShiftRegistrationStatus.PENDING || 
      reg.status === ShiftRegistrationStatus.APPROVED
    );
    
    // Xóa các ca rejected khỏi selectedShifts (nếu có)
    const rejectedRegs = regs.filter(reg => 
      reg.status === ShiftRegistrationStatus.REJECTED
    );
    
    rejectedRegs.forEach(reg => {
      const dayIndex = weekDates.findIndex(d => formatDateForAPI(d) === reg.workDate);
      if (dayIndex >= 0 && dayIndex < 7) {
        newSelected[dayIndex] = newSelected[dayIndex].filter(id => id !== reg.workShiftId);
      }
    });
    
    // Load TẤT CẢ pending và approved vào selectedShifts
    pendingAndApprovedRegs.forEach(reg => {
      // Tìm dayIndex bằng cách so sánh date string
      const dayIndex = weekDates.findIndex(d => formatDateForAPI(d) === reg.workDate);
      if (dayIndex >= 0 && dayIndex < 7) {
        if (!newSelected[dayIndex].includes(reg.workShiftId)) {
          newSelected[dayIndex].push(reg.workShiftId);
        }
      }
    });
    
    setSelectedShifts(newSelected);
  };

  const getNextMonday = () => {
    const today = new Date();
    // Set time to local midnight to avoid timezone issues
    today.setHours(0, 0, 0, 0);
    
    // Get current week's Monday
    const currentMonday = new Date(today);
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    currentMonday.setDate(today.getDate() + diff);
    currentMonday.setHours(0, 0, 0, 0);
    
    // Next Monday is 7 days after current Monday
    const nextMonday = new Date(currentMonday);
    nextMonday.setDate(currentMonday.getDate() + 7);
    nextMonday.setHours(0, 0, 0, 0);
    
    return nextMonday;
  };

  const getCurrentMonday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const getDayIndex = (date: Date, monday: Date) => {
    const diff = Math.floor((date.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const formatDate = (date: Date) => {
    return `${date.getDate()}/${date.getMonth() + 1}`;
  };

  const getWeekDates = (monday: Date) => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      d.setHours(0, 0, 0, 0); // Ensure midnight
      return d;
    });
  };

  const handleShiftToggle = (dayIndex: number, shiftId: string) => {
    const newSelected = selectedShifts.map((day, idx) => {
      if (idx === dayIndex) {
        if (day.includes(shiftId)) {
          return day.filter(id => id !== shiftId);
        } else {
          return [...day, shiftId];
        }
      }
      return day;
    });
    setSelectedShifts(newSelected);
  };

  const handleShiftAdd = (dayIndex: number, shiftId: string) => {
    // Force add vào selectedShifts (không toggle)
    const newSelected = selectedShifts.map((day, idx) => {
      if (idx === dayIndex) {
        if (!day.includes(shiftId)) {
          return [...day, shiftId];
        }
      }
      return day;
    });
    setSelectedShifts(newSelected);
  };

  const handleRegisterFullWeek = (shiftId: string, replace: boolean = false) => {
    if (!shiftId) {
      setError('Vui lòng chọn ca để đăng ký cả tuần');
      return;
    }
    
    const shiftName = availableShifts.find(s => s.id === shiftId)?.name || 'ca';
    
    console.log('handleRegisterFullWeek called:', { shiftId, shiftName, replace, currentSelected: selectedShifts });
    
    // Set ca này cho tất cả 7 ngày
    const newSelected = selectedShifts.map((dayShifts, dayIndex) => {
      if (replace) {
        // Replace: Chỉ giữ lại ca này
        return [shiftId];
      } else {
        // Append: Thêm ca này nếu chưa có
        if (!dayShifts.includes(shiftId)) {
          return [...dayShifts, shiftId];
        }
        return dayShifts;
      }
    });
    
    console.log('New selected shifts:', newSelected);
    
    setSelectedShifts(newSelected);
    setError(''); // Clear error
    setSuccess(`Đã ${replace ? 'chọn' : 'thêm'} ca "${shiftName}" cho cả tuần`);
    
    // Auto clear success message after 2 seconds
    setTimeout(() => setSuccess(''), 2000);
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    
    const nextMonday = getNextMonday();
    const registrations: Array<{ workShiftId: string; workDate: string }> = [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentWeekStart = new Date(today);
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    currentWeekStart.setDate(today.getDate() + diff);
    currentWeekStart.setHours(0, 0, 0, 0);
    
    const nextWeekStart = new Date(currentWeekStart);
    nextWeekStart.setDate(currentWeekStart.getDate() + 7);
    
    selectedShifts.forEach((dayShifts, dayIndex) => {
      dayShifts.forEach(shiftId => {
        if (shiftId) {
          // Tính toán ngày chính xác
          const date = new Date(nextMonday);
          date.setDate(nextMonday.getDate() + dayIndex);
          date.setHours(0, 0, 0, 0);
          
          // Validate: Chỉ cho phép đăng ký cho tuần tới (next week)
          // Không cho phép đăng ký cho tuần cũ hoặc quá khứ
          if (date < nextWeekStart) {
            console.warn('Skipping invalid date (before next week):', formatDateForAPI(date));
            return; // Skip dates before next week
          }
          
          // Format date as YYYY-MM-DD in local timezone
          const dateStr = formatDateForAPI(date);
          
          registrations.push({
            workShiftId: shiftId,
            workDate: dateStr
          });
        }
      });
    });
    
    // Debug: Log registrations before submit
    const monday = getNextMonday();
    const dates = getWeekDates(monday);
    
    console.log('Preparing to submit:', {
      today: formatDateForAPI(today),
      nextMonday: formatDateForAPI(nextMonday),
      totalRegistrations: registrations.length,
      registrations: registrations.map(r => {
        const dayIndex = dates.findIndex(d => formatDateForAPI(d) === r.workDate);
        const dateObj = new Date(r.workDate + 'T00:00:00');
        return {
          date: r.workDate,
          shiftId: r.workShiftId,
          dayName: dayIndex >= 0 ? WEEKDAY_FULL[dayIndex] : 'Unknown',
          dayIndex: dayIndex,
          isPast: dateObj < today,
          isNextWeek: dateObj >= nextMonday
        };
      })
    });
    
    if (registrations.length === 0) {
      setError('Vui lòng chọn ít nhất 1 ca làm việc');
      return;
    }
    
    try {
      setSubmitting(true);
      
      // Backend sẽ xử lý xóa và tạo trong transaction (all-or-nothing)
      // Không cần xóa ở frontend nữa
      console.log('Submitting registrations:', registrations);
      
      const result = await bulkCreateShiftRegistrations(user.id, registrations);
      
      console.log('Registration result:', result);
      
      // Check for validation errors (from validate_bulk_registration)
      // These are returned when validation fails before creating any registrations
      // Response structure: { errors: [...], error_count: X, success_count: 0 }
      if (result.errors && Array.isArray(result.errors) && result.errors.length > 0) {
        // Check if these are validation errors (have 'type' field)
        const validationErrors = result.errors.filter((err: any) => 
          err && typeof err === 'object' && (err.type === 'user_off_limit' || err.type === 'shift_off_limit')
        );
        
        if (validationErrors.length > 0) {
          // Format error messages nicely
          const errorMessages = validationErrors.map((err: any) => {
            if (err.type === 'user_off_limit') {
              return err.message || 'Bạn chỉ được off tối đa 1 buổi/tuần';
            } else if (err.type === 'shift_off_limit') {
              // Backend đã format message đẹp rồi, chỉ cần hiển thị
              return err.message || 'Ca này đã đủ số người off';
            }
            return err.message || 'Lỗi validation';
          });
          
          setError(errorMessages.join('\n\n'));
          setSubmitting(false);
          return;
        }
      }
      
      if (result.errorCount > 0) {
        // Format error messages đẹp hơn
        const errorMessages = result.errors.map((err: any) => {
          const workDate = err.work_date || 'Unknown';
          const shiftId = err.work_shift_id;
          const shiftName = availableShifts.find(s => String(s.id) === String(shiftId))?.name || `Ca #${shiftId}`;
          
          // Parse và format ngày để hiển thị đúng
          let displayDate = workDate;
          try {
            const parts = workDate.split('-');
            if (parts.length === 3) {
              const year = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10);
              const day = parseInt(parts[2], 10);
              displayDate = `${day}/${month}/${year}`;
            }
          } catch (e) {
            console.warn('Failed to parse date:', workDate, e);
          }
          
          // Parse error message - backend đã format sẵn
          let errorMsg = '';
          if (err.errors && Array.isArray(err.errors)) {
            errorMsg = err.errors.join(', ');
          } else if (typeof err === 'string') {
            errorMsg = err;
          } else if (err.error) {
            errorMsg = err.error;
          } else {
            errorMsg = 'Lỗi không xác định';
          }
          
          return `${displayDate} (${shiftName}): ${errorMsg}`;
        });
        
        setError(`Có ${result.errorCount} lỗi:\n\n${errorMessages.join('\n')}`);
      } else {
        setSuccess(`Đã đăng ký ${result.successCount} ca thành công!`);
      }
      
      // Clear selected shifts trước khi reload
      setSelectedShifts([[], [], [], [], [], [], []]);
      
      // Reload data to show updated registrations
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: ShiftRegistrationStatus) => {
    switch (status) {
      case ShiftRegistrationStatus.PENDING:
        return <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] rounded">Chờ</span>;
      case ShiftRegistrationStatus.APPROVED:
        return <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded">OK</span>;
      case ShiftRegistrationStatus.REJECTED:
        return <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] rounded">Từ chối</span>;
    }
  };

  const monday = viewingWeek === 'current' ? getCurrentMonday() : getNextMonday();
  const weekDates = getWeekDates(monday);
  const registrations = viewingWeek === 'current' ? currentWeekRegs : nextWeekRegs;

  const getRegsForDay = (dayIndex: number): ShiftReg[] => {
    // Use local date format to match what we send to API
    const date = formatDateForAPI(weekDates[dayIndex]);
    return registrations.filter(r => r.workDate === date);
  };

  const getTotalSelectedCount = () => {
    return selectedShifts.reduce((total, day) => total + day.length, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 md:p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
          <Calendar className="w-5 h-5 md:w-6 md:h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Đăng ký Ca làm việc</h1>
          <p className="text-xs md:text-sm text-gray-500">Có thể đăng ký nhiều ca trong 1 ngày</p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-red-800 mb-2">Không thể đăng ký ca</h4>
              <div className="text-red-700 text-sm space-y-2">
                {error.split('\n\n').map((msg, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">•</span>
                    <span className="flex-1">{msg.replace(/⚠️\s*/g, '')}</span>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => setError('')}
              className="text-red-400 hover:text-red-600 flex-shrink-0 p-1 rounded hover:bg-red-100 transition"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-600 rounded-lg text-sm">
          <Check className="w-4 h-4 inline mr-2" />
          {success}
        </div>
      )}

      {/* Week Selector */}
      <div className="flex items-center justify-between bg-white rounded-xl p-3 md:p-4 mb-4 shadow-sm border">
        <button
          onClick={() => setViewingWeek('current')}
          disabled={viewingWeek === 'current'}
          className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50"
        >
          <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
        </button>
        
        <div className="text-center">
          <div className="font-semibold text-sm md:text-base text-gray-900">
            {viewingWeek === 'current' ? 'Tuần này' : 'Tuần tới'}
          </div>
          <div className="text-xs md:text-sm text-gray-500">
            {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
          </div>
        </div>
        
        <button
          onClick={() => setViewingWeek('next')}
          disabled={viewingWeek === 'next'}
          className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50"
        >
          <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
        </button>
      </div>

      {/* Quick Actions - Mobile Friendly */}
      {availableShifts.length > 0 && viewingWeek === 'next' && canRegisterNextWeek && (
        <div className="mb-4 p-3 md:p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs md:text-sm font-medium text-gray-700">Đăng ký nhanh:</p>
            {getTotalSelectedCount() > 0 && (
              <span className="text-xs md:text-sm font-semibold text-indigo-600">
                {getTotalSelectedCount()} ca
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {availableShifts.map((shift) => (
              <button
                key={shift.id}
                onClick={() => {
                  console.log('Registering full week for shift:', shift.id, shift.name);
                  handleRegisterFullWeek(shift.id, false);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Zap className="w-3 h-3" />
                {shift.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mobile: List View, Desktop: Grid View */}
      <div className="md:hidden space-y-3">
        {/* Mobile List View */}
        {weekDates.map((date, dayIdx) => {
          const dayRegs = getRegsForDay(dayIdx);
          const isViewingNext = viewingWeek === 'next';
          const hasApprovedRegs = dayRegs.some(r => r.status === ShiftRegistrationStatus.APPROVED);
          const selectedForDay = selectedShifts[dayIdx] || [];
          const isToday = date.toDateString() === new Date().toDateString();
          
          return (
            <div
              key={dayIdx}
              className={`bg-white rounded-xl p-4 shadow-sm border ${isToday ? 'border-indigo-300 bg-indigo-50' : ''}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-bold text-gray-900">{WEEKDAY_FULL[dayIdx]}</div>
                  <div className="text-sm text-gray-500">{formatDate(date)}</div>
                </div>
                {selectedForDay.length > 0 && (
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
                    {selectedForDay.length} ca
                  </span>
                )}
              </div>
              
              {/* Hiển thị tất cả các ca dưới dạng buttons với màu theo trạng thái */}
              {isViewingNext && canRegisterNextWeek ? (
                <div className="grid grid-cols-2 gap-2">
                  {availableShifts.map((shift) => {
                    // Tìm registration cho ca này
                    const reg = dayRegs.find(r => r.workShiftId === shift.id);
                    const isSelected = selectedForDay.includes(shift.id);
                    
                    // Xác định trạng thái và màu sắc
                    let buttonClass = '';
                    let isDisabled = false;
                    let onClickHandler: () => void = () => {};
                    
                    // Logic màu sắc: ưu tiên approved (disabled), sau đó isSelected
                    // Nếu toggle ra khỏi selectedShifts → trắng (không hiển thị pending)
                    if (reg && reg.status === ShiftRegistrationStatus.APPROVED) {
                      // Đã xác nhận: xanh lá, không thể thay đổi (bất kể isSelected)
                      buttonClass = 'bg-green-600 text-white';
                      isDisabled = true;
                    } else if (isSelected) {
                      // Đã chọn trong selectedShifts: xanh dương (sẽ submit)
                      // Nếu có pending → vẫn xanh dương (sẽ submit lại)
                      buttonClass = 'bg-indigo-600 text-white shadow-md hover:bg-indigo-700';
                      onClickHandler = () => handleShiftToggle(dayIdx, shift.id);
                    } else {
                      // Chưa chọn: trắng (bất kể có pending hay không)
                      // Nếu có pending nhưng toggle ra → trắng (sẽ bị xóa khi submit)
                      buttonClass = 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50';
                      onClickHandler = () => handleShiftToggle(dayIdx, shift.id);
                    }
                    
                    return (
                      <button
                        key={shift.id}
                        onClick={onClickHandler}
                        disabled={isDisabled}
                        className={`p-2.5 rounded-lg text-sm font-medium transition-all ${buttonClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {shift.name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center text-gray-400 text-sm py-4">Chưa có ca</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop: Grid View */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b bg-gray-50">
          {WEEKDAYS.map((day, idx) => {
            const date = weekDates[idx];
            const isToday = date.toDateString() === new Date().toDateString();
            return (
              <div
                key={day}
                className={`p-3 text-center border-r last:border-r-0 ${isToday ? 'bg-indigo-50' : ''}`}
              >
                <div className={`text-sm font-medium ${isToday ? 'text-indigo-600' : 'text-gray-600'}`}>
                  {day}
                </div>
                <div className={`text-lg font-bold ${isToday ? 'text-indigo-600' : 'text-gray-900'}`}>
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="grid grid-cols-7">
          {WEEKDAYS.map((_, dayIdx) => {
            const dayRegs = getRegsForDay(dayIdx);
            const isViewingNext = viewingWeek === 'next';
            const hasApprovedRegs = dayRegs.some(r => r.status === ShiftRegistrationStatus.APPROVED);
            const selectedForDay = selectedShifts[dayIdx] || [];
            
            return (
              <div
                key={dayIdx}
                className="p-2 border-r last:border-r-0 border-b"
              >
                {/* Hiển thị tất cả các ca dưới dạng buttons với màu theo trạng thái */}
                {isViewingNext && canRegisterNextWeek ? (
                  <div className="space-y-1">
                    {availableShifts.map((shift) => {
                      // Tìm registration cho ca này
                      const reg = dayRegs.find(r => r.workShiftId === shift.id);
                      const isSelected = selectedForDay.includes(shift.id);
                      
                      // Xác định trạng thái và màu sắc
                      let buttonClass = '';
                      let isDisabled = false;
                      let onClickHandler: () => void = () => {};
                      
                      // Logic màu sắc: ưu tiên approved (disabled), sau đó isSelected
                      // Nếu toggle ra khỏi selectedShifts → trắng/xanh nhạt (không hiển thị pending)
                      if (reg && reg.status === ShiftRegistrationStatus.APPROVED) {
                        // Đã xác nhận: xanh lá, không thể thay đổi (bất kể isSelected)
                        buttonClass = 'bg-green-600 text-white';
                        isDisabled = true;
                      } else if (isSelected) {
                        // Đã chọn trong selectedShifts: xanh dương (sẽ submit)
                        // Nếu có pending → vẫn xanh dương (sẽ submit lại)
                        buttonClass = 'bg-indigo-600 text-white shadow-md hover:bg-indigo-700';
                        onClickHandler = () => handleShiftToggle(dayIdx, shift.id);
                      } else {
                        // Chưa chọn: xanh nhạt (bất kể có pending hay không)
                        // Nếu có pending nhưng toggle ra → xanh nhạt (sẽ bị xóa khi submit)
                        buttonClass = 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200';
                        onClickHandler = () => handleShiftToggle(dayIdx, shift.id);
                      }
                      
                      return (
                        <button
                          key={shift.id}
                          onClick={onClickHandler}
                          disabled={isDisabled}
                          className={`w-full p-1.5 rounded text-xs transition-all ${buttonClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {shift.name}
                        </button>
                      );
                    })}
                    {selectedForDay.length > 0 && (
                      <div className="text-[10px] text-indigo-600 font-medium mt-1 text-center">
                        {selectedForDay.length} ca
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center text-gray-300 text-xs py-2">
                    —
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Submit Button */}
      {viewingWeek === 'next' && canRegisterNextWeek && (
        <div className="mt-4 md:mt-6 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
          <div className="text-sm text-gray-600 text-center md:text-left">
            {getTotalSelectedCount() > 0 ? (
              <span className="font-medium text-indigo-600">
                Đã chọn {getTotalSelectedCount()} ca cho tuần tới
              </span>
            ) : (
              <span>Chưa chọn ca nào</span>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || getTotalSelectedCount() === 0}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-medium hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            Gửi đăng ký ({getTotalSelectedCount()} ca)
          </button>
        </div>
      )}

      {/* Info for non-registration period */}
      {viewingWeek === 'next' && !canRegisterNextWeek && (
        <div className="mt-4 md:mt-6 p-3 md:p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
          <AlertCircle className="w-4 h-4 inline mr-2" />
          Chỉ có thể đăng ký ca cho tuần tới vào <strong>thứ 6</strong> hàng tuần.
        </div>
      )}
    </div>
  );
};

export default ShiftRegistration;

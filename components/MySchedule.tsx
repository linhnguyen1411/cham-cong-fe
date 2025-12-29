import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Loader2, Clock, Check, X } from 'lucide-react';
import { User, ShiftRegistration } from '../types';
import { getMyShiftRegistrations, getWorkShifts } from '../services/api';

interface Props {
  user: User;
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const WEEKDAY_FULL = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

const MySchedule: React.FC<Props> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [currentWeekRegs, setCurrentWeekRegs] = useState<ShiftRegistration[]>([]);
  const [nextWeekRegs, setNextWeekRegs] = useState<ShiftRegistration[]>([]);
  const [availableShifts, setAvailableShifts] = useState<any[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<'current' | 'next'>('current');
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [user.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [regsData, shiftsData] = await Promise.all([
        getMyShiftRegistrations(user.id),
        getWorkShifts()
      ]);
      
      setCurrentWeekRegs(regsData.currentWeek);
      setNextWeekRegs(regsData.nextWeek);
      setAvailableShifts(shiftsData);
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

  const getCurrentWeekStart = (): Date => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const getNextWeekStart = (): Date => {
    const currentMonday = getCurrentWeekStart();
    const nextMonday = new Date(currentMonday);
    nextMonday.setDate(currentMonday.getDate() + 7);
    return nextMonday;
  };

  const getWeekDates = (weekStart: Date): Date[] => {
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const formatDate = (date: Date): string => {
    return `${date.getDate()}/${date.getMonth() + 1}`;
  };

  const getRegistrationsForDate = (dateStr: string, registrations: ShiftRegistration[]): ShiftRegistration[] => {
    return registrations.filter(reg => reg.workDate === dateStr);
  };

  const getShiftName = (shiftId: string): string => {
    const shift = availableShifts.find(s => s.id === shiftId);
    return shift?.name || 'Ca làm việc';
  };

  const getShiftTime = (shiftId: string): string => {
    const shift = availableShifts.find(s => s.id === shiftId);
    if (shift) {
      return `${shift.startTime} - ${shift.endTime}`;
    }
    return '';
  };

  const weekStart = selectedWeek === 'current' ? getCurrentWeekStart() : getNextWeekStart();
  const weekDates = getWeekDates(weekStart);
  const registrations = selectedWeek === 'current' ? currentWeekRegs : nextWeekRegs;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Lịch Làm Việc Của Tôi</h1>
            <p className="text-gray-500 text-sm">Xem lịch làm việc tuần hiện tại và tuần tới</p>
          </div>
        </div>
      </div>

      {/* Week Selector */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedWeek('current')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                selectedWeek === 'current'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tuần hiện tại
            </button>
            <button
              onClick={() => setSelectedWeek('next')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                selectedWeek === 'next'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tuần tới
            </button>
          </div>

          <div className="text-center">
            <div className="font-semibold text-gray-900">
              {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
            </div>
            <div className="text-sm text-gray-500">
              {selectedWeek === 'current' ? 'Tuần này' : 'Tuần sau'}
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Schedule Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-8 border-b bg-gray-50">
            <div className="p-3 font-semibold text-gray-700 border-r">Ngày</div>
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
            {availableShifts.length > 0 ? (
              availableShifts.map((shift) => {
                const shiftRegs = registrations.filter(reg => reg.workShiftId === shift.id);
                
                return (
                  <div key={shift.id} className="grid grid-cols-8 hover:bg-gray-50">
                    {/* Shift Name */}
                    <div className="p-3 border-r font-medium text-gray-900 flex items-center">
                      <div>
                        <div className="font-semibold">{shift.name}</div>
                        <div className="text-xs text-gray-500">{shift.startTime} - {shift.endTime}</div>
                      </div>
                    </div>

                    {/* Day Columns */}
                    {WEEKDAYS.map((_, dayIdx) => {
                      const dateStr = formatDateForAPI(weekDates[dayIdx]);
                      const dateRegs = getRegistrationsForDate(dateStr, shiftRegs);
                      const hasRegistration = dateRegs.length > 0;
                      const reg = dateRegs[0];
                      const isApproved = reg?.status === 'approved';
                      const isPending = reg?.status === 'pending';
                      const isRejected = reg?.status === 'rejected';
                      
                      return (
                        <div key={dayIdx} className="p-3 border-r text-center">
                          {hasRegistration ? (
                            <div className="flex flex-col items-center gap-1">
                              {isApproved && (
                                <div className="w-full px-2 py-1.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                                  <Check className="w-3 h-3 inline mr-1" />
                                  Đã duyệt
                                </div>
                              )}
                              {isPending && (
                                <div className="w-full px-2 py-1.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                                  <Clock className="w-3 h-3 inline mr-1" />
                                  Chờ duyệt
                                </div>
                              )}
                              {isRejected && (
                                <div className="w-full px-2 py-1.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                                  <X className="w-3 h-3 inline mr-1" />
                                  Từ chối
                                </div>
                              )}
                              {reg?.note && (
                                <div className="text-xs text-gray-500 mt-1 truncate w-full" title={reg.note}>
                                  {reg.note}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-gray-300 text-sm">—</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-gray-400">
                Chưa có ca làm việc nào được cấu hình
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      {!loading && registrations.length > 0 && (
        <div className="mt-4 bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-blue-900">Tóm tắt</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Tổng số ca</div>
              <div className="text-lg font-bold text-gray-900">{registrations.length}</div>
            </div>
            <div>
              <div className="text-gray-600">Đã duyệt</div>
              <div className="text-lg font-bold text-green-600">
                {registrations.filter(r => r.status === 'approved').length}
              </div>
            </div>
            <div>
              <div className="text-gray-600">Chờ duyệt</div>
              <div className="text-lg font-bold text-yellow-600">
                {registrations.filter(r => r.status === 'pending').length}
              </div>
            </div>
            <div>
              <div className="text-gray-600">Từ chối</div>
              <div className="text-lg font-bold text-red-600">
                {registrations.filter(r => r.status === 'rejected').length}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MySchedule;


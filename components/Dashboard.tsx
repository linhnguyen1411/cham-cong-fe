import React, { useEffect, useState } from 'react';
import { User, WorkSession, UserRole, WorkShift } from '../types';
import * as api from '../services/api';
import { AdminDashboard } from './AdminDashboard';
import { MotivationQuote } from './MotivationQuote';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, LineChart, Line
} from 'recharts';
import { TrendingUp, Clock, CalendarCheck, Users, AlertTriangle, CheckCircle, Settings, Calendar } from 'lucide-react';

interface DashboardProps {
  user: User;
  onShowSettings?: (component: 'shifts' | 'users') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onShowSettings }) => {
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<'today' | 'month' | 'week' | 'month30' | 'all'>('all');
  const [stats, setStats] = useState<any[]>([]); // Daily hours
  const [pieData, setPieData] = useState<any[]>([]); // Productivity breakdown
  const [lineData, setLineData] = useState<any[]>([]); // Check-in trends
  const [topEmployees, setTopEmployees] = useState<any[]>([]); // Admin only
  const [topOnTimeEmployees, setTopOnTimeEmployees] = useState<any[]>([]); // Top on-time employees
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  
  const [summary, setSummary] = useState({ 
    totalHours: 0, 
    workDays: 0, 
    avgHours: 0,
    onTimeRate: 0,
    lateCount: 0,
    totalMinutesLate: 0,
    earlyCheckoutCount: 0,
    totalMinutesEarlyCheckout: 0
  });

  useEffect(() => {
    loadStats();
  }, [user, dateFilter]);

  const loadStats = async () => {
    setLoading(true);
    let sessions: WorkSession[] = [];
    let allUsers: User[] = [];
    let workShifts: WorkShift[] = [];

    if (user.role === UserRole.ADMIN) {
        sessions = await api.getAllHistory();
        allUsers = await api.getUsers();
        workShifts = await api.getWorkShifts();
        setShifts(workShifts);
    } else {
        sessions = await api.getUserHistory(user.id);
    }

    // Use default shift if none configured
    const defaultShift = workShifts.length > 0 ? workShifts[0] : { 
      startTime: '08:00', 
      endTime: '17:00', 
      lateThreshold: 30 
    };

    const now = new Date();
    
    // Get today's date string in YYYY-MM-DD format (UTC)
    const getTodayDateStr = (): string => {
      return now.toISOString().split('T')[0];
    };
    
    // Get date string N days ago
    const getDateStrNDaysAgo = (days: number): string => {
      const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      return d.toISOString().split('T')[0];
    };
    
    // Determine date range based on dateFilter
    let chartStartDate: Date;
    let statsStartDate: Date;
    let statsStartDateStr: string; // For comparing with dateStr (YYYY-MM-DD)
    
    if (dateFilter === 'today') {
      statsStartDateStr = getTodayDateStr();
      chartStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      statsStartDate = chartStartDate;
    } else if (dateFilter === 'month') {
      statsStartDateStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      chartStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
      statsStartDate = chartStartDate;
    } else if (dateFilter === 'week') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      statsStartDateStr = sevenDaysAgo.toISOString().split('T')[0];
      chartStartDate = sevenDaysAgo;
      statsStartDate = sevenDaysAgo;
    } else if (dateFilter === 'month30') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      statsStartDateStr = thirtyDaysAgo.toISOString().split('T')[0];
      chartStartDate = thirtyDaysAgo;
      statsStartDate = thirtyDaysAgo;
    } else {
      // 'all'
      statsStartDateStr = '2000-01-01';
      chartStartDate = new Date(2000, 0, 1);
      statsStartDate = chartStartDate;
    }

    // Filter for chart display
    const chartDays = new Map<string, number>();
    const chartDaysCheckIn: any[] = [];
    
    // Initialize chart days keys - show last 7 days for week/month filters, or appropriate range
    let displayDays = 7;
    if (dateFilter === 'today') {
      displayDays = 1;
    } else if (dateFilter === 'month') {
      displayDays = 31;
    } else if (dateFilter === 'month30') {
      displayDays = 30;
    }
    
    for(let i = displayDays - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        if (d < chartStartDate) continue;
        
        const dateStr = d.toISOString().split('T')[0];
        chartDays.set(dateStr, 0);
        
        chartDaysCheckIn.push({
          date: d.toLocaleDateString('vi-VN', {weekday: 'short'}),
          dateStr: dateStr,
          time: null
        });
    }

    // Stats Calculation Variables - ALL filtered by dateFilter
    let totalDurationAll = 0;
    let onTimeCount = 0;
    let lateCount = 0;
    let earlyCheckoutCount = 0;
    let totalCount = 0;
    let totalMinutesLate = 0;
    let totalMinutesEarlyCheckout = 0;
    
    // Breakdown for Pie Chart
    let under8 = 0;
    let standard = 0; // 8-9h
    let over9 = 0;

    // Admin: Employee Aggregation
    const empMap = new Map<string, number>();

    sessions.forEach(s => {
        // Only process finished sessions for stats
        if (!s.endTime) return;

        // CRITICAL: Check if session is within stats date range FIRST
        if (s.dateStr < statsStartDateStr) return; // Skip if outside date range

        // If we reach here, session is within date range
        
        // Add to chart display
        if(chartDays.has(s.dateStr)) {
            // Add to daily total
            chartDays.set(s.dateStr, (chartDays.get(s.dateStr) || 0) + s.duration);
            
            // Check-in time trend
            const startDate = new Date(s.startTime);
            const hour = startDate.getHours() + startDate.getMinutes() / 60;
            
            const dayIdx = chartDaysCheckIn.findIndex(d => d.dateStr === s.dateStr);
            if (dayIdx !== -1 && !chartDaysCheckIn[dayIdx].time) {
               chartDaysCheckIn[dayIdx].time = parseFloat(hour.toFixed(1));
            }
        }

        // Employee ranking (Admin)
        if (user.role === UserRole.ADMIN) {
            empMap.set(s.userId, (empMap.get(s.userId) || 0) + s.duration);
        }

        // Evaluate check-in time based on isOnTime from API
        if (s.isOnTime) {
            onTimeCount++;
        } else {
            lateCount++;
            totalMinutesLate += s.minutesLate || 0;
        }
        
        // Check early checkout
        if (s.isEarlyCheckout) {
            earlyCheckoutCount++;
            totalMinutesEarlyCheckout += s.minutesBeforeEnd || 0;
        }

        // Count all stats (now only within date range)
        totalDurationAll += s.duration;
        totalCount++;

        const hours = s.duration / 3600;
        if (hours < 8) under8++;
        else if (hours <= 9) standard++;
        else over9++;
    });

    // Finalize Daily Bar Chart Data
    const chartData = Array.from(chartDays.entries()).map(([date, seconds]) => ({
        date: new Date(date).toLocaleDateString('vi-VN', {weekday: 'short'}),
        hours: parseFloat((seconds / 3600).toFixed(1))
    }));

    // Finalize Pie Data
    const pData = [
      { name: 'Dưới 8h', value: under8, color: '#f59e0b' }, // Amber
      { name: 'Đạt chuẩn (8-9h)', value: standard, color: '#22c55e' }, // Green
      { name: 'OT (>9h)', value: over9, color: '#3b82f6' }, // Blue
    ].filter(d => d.value > 0);

    // Finalize Top Employees by Hours (Admin)
    const topEmps = Array.from(empMap.entries()).map(([uid, seconds]) => {
        const u = allUsers.find(user => user.id === uid);
        return {
            name: u?.fullName || u?.username || 'Nhân viên',
            hours: parseFloat((seconds / 3600).toFixed(1))
        };
    }).sort((a, b) => b.hours - a.hours).slice(0, 5); // Top 5

    // Finalize Top On-Time Employees (Admin)
    const empOnTimeMap = new Map<string, { onTime: number, total: number, name: string, daysWorked: Set<string> }>();
    allUsers.forEach(u => {
        empOnTimeMap.set(u.id, { onTime: 0, total: 0, name: u.fullName || u.username, daysWorked: new Set() });
    });

    sessions.forEach(s => {
        if (!s.endTime) return;
        // Use dateStr for accurate date comparison (avoid timezone issues)
        if (s.dateStr < statsStartDateStr) return;

        const stat = empOnTimeMap.get(s.userId);
        if (!stat) return;

        stat.total++;
        stat.daysWorked.add(s.dateStr); // Track unique days
        if (s.isOnTime) {
            stat.onTime++;
        }
    });

    const topOnTimeEmps = Array.from(empOnTimeMap.entries())
        .filter(([_, stat]) => stat.total > 0)
        .map(([uid, stat]) => ({
            name: stat.name,
            rate: Math.round((stat.onTime / stat.total) * 100),
            count: stat.daysWorked.size // Use unique days, not total sessions
        }))
        .sort((a, b) => b.rate - a.rate)
        .slice(0, 5); // Top 5

    setStats(chartData);
    setPieData(pData);
    setLineData(chartDaysCheckIn.map(d => ({ ...d, time: d.time || 0 })));
    setTopEmployees(topEmps);
    setTopOnTimeEmployees(topOnTimeEmps);
    setAllUsers(allUsers);
    setSessions(sessions);
    
    setSummary({
        totalHours: parseFloat((totalDurationAll / 3600).toFixed(1)),
        workDays: totalCount,
        avgHours: totalCount ? parseFloat((totalDurationAll / 3600 / totalCount).toFixed(1)) : 0,
        onTimeRate: totalCount ? Math.round((onTimeCount / totalCount) * 100) : 0,
        lateCount: lateCount,
        totalMinutesLate: totalMinutesLate,
        earlyCheckoutCount: earlyCheckoutCount,
        totalMinutesEarlyCheckout: totalMinutesEarlyCheckout
    });
    setLoading(false);
  };

  const StatCard = ({ title, value, icon: Icon, color, subtext }: any) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center hover:shadow-md transition-shadow">
        <div className={`p-4 rounded-full mr-4 ${color} bg-opacity-10`}>
            <Icon size={24} className={color.replace('bg-', 'text-')} />
        </div>
        <div>
            <p className="text-sm text-slate-500 font-medium">{title}</p>
            <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
            {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
        </div>
    </div>
  );

  if (loading) return <div className="p-10 text-center text-slate-500">Đang tính toán số liệu...</div>;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
        {user.role === UserRole.ADMIN ? (
            <>
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Admin Dashboard</h2>
                        <p className="text-slate-500">Quản lý và giám sát nhân viên</p>
                    </div>
                    <button
                      onClick={() => onShowSettings?.('shifts')}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      <Settings size={16} />
                      Cài đặt ca
                    </button>
                </div>

                {/* Date Filter */}
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => setDateFilter('today')}
                        className={`px-3 py-2 rounded-lg font-medium text-sm transition flex items-center gap-1 ${
                            dateFilter === 'today'
                                ? 'bg-purple-600 text-white'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                    >
                        <Calendar size={14} />
                        Hôm nay
                    </button>
                    <button
                        onClick={() => setDateFilter('month')}
                        className={`px-3 py-2 rounded-lg font-medium text-sm transition flex items-center gap-1 ${
                            dateFilter === 'month'
                                ? 'bg-purple-600 text-white'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                    >
                        <Calendar size={14} />
                        Tháng này
                    </button>
                    <button
                        onClick={() => setDateFilter('week')}
                        className={`px-3 py-2 rounded-lg font-medium text-sm transition flex items-center gap-1 ${
                            dateFilter === 'week'
                                ? 'bg-purple-600 text-white'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                    >
                        <Calendar size={14} />
                        7 ngày
                    </button>
                    <button
                        onClick={() => setDateFilter('month30')}
                        className={`px-3 py-2 rounded-lg font-medium text-sm transition flex items-center gap-1 ${
                            dateFilter === 'month30'
                                ? 'bg-purple-600 text-white'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                    >
                        <Calendar size={14} />
                        30 ngày
                    </button>
                    <button
                        onClick={() => setDateFilter('all')}
                        className={`px-3 py-2 rounded-lg font-medium text-sm transition flex items-center gap-1 ${
                            dateFilter === 'all'
                                ? 'bg-purple-600 text-white'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                    >
                        <Calendar size={14} />
                        Tất cả
                    </button>
                </div>

                {/* Admin Stats Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <StatCard 
                        title="Tổng giờ làm (công ty)" 
                        value={`${summary.totalHours}h`} 
                        icon={Clock} 
                        color="text-blue-600 bg-blue-600" 
                    />
                    <StatCard 
                        title={`Tổng ca (${dateFilter === 'today' ? 'hôm nay' : dateFilter === 'month' ? 'tháng này' : dateFilter === 'week' ? '7 ngày' : dateFilter === 'month30' ? '30 ngày' : 'tất cả'})`}
                        value={summary.workDays} 
                        icon={CalendarCheck} 
                        color="text-purple-600 bg-purple-600" 
                    />
                    <StatCard 
                        title="Số lần muộn" 
                        value={summary.lateCount} 
                        icon={AlertTriangle} 
                        color="text-red-600 bg-red-600" 
                        subtext={summary.lateCount > 0 ? `${summary.totalMinutesLate}p tổng` : 'Không có'}
                    />
                    <StatCard 
                        title="Số lần về sớm" 
                        value={summary.earlyCheckoutCount} 
                        icon={Clock} 
                        color="text-yellow-600 bg-yellow-600" 
                        subtext={summary.earlyCheckoutCount > 0 ? `${summary.totalMinutesEarlyCheckout}p tổng` : 'Không có'}
                    />
                </div>

                {/* Top On-Time Employees */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-6 rounded-xl shadow-sm border border-emerald-200">
                    <h3 className="text-lg font-bold text-emerald-900 mb-4 flex items-center gap-2">
                        <CheckCircle size={20} className="text-emerald-600" />
                        🌟 Vinh danh: Top nhân viên đúng giờ
                    </h3>
                    {topOnTimeEmployees.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            {topOnTimeEmployees.map((emp, idx) => (
                                <div key={idx} className="bg-white p-4 rounded-lg border border-emerald-200 text-center hover:shadow-md transition">
                                    <div className="text-2xl font-bold mb-1">
                                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                                    </div>
                                    <p className="font-semibold text-slate-800 text-sm mb-2">{emp.name}</p>
                                    <div className="text-emerald-600 font-bold text-xl mb-1">{emp.rate}%</div>
                                    <p className="text-xs text-slate-500">({emp.count} ngày)</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-slate-600 text-center py-4">Chưa có dữ liệu</p>
                    )}
                </div>

                {/* Charts Grid for Admin */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Bar Chart - Tổng giờ làm */}
                    <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
                            <TrendingUp size={20} className="mr-2 text-blue-500"/>
                            Tổng giờ làm việc ({dateFilter === 'today' ? 'Hôm nay' : dateFilter === 'week' ? '7 ngày' : dateFilter === 'month' ? 'Tháng này' : dateFilter === 'month30' ? '30 ngày' : 'Tất cả'})
                        </h3>
                        <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                    <Bar dataKey="hours" name="Giờ làm" radius={[4, 4, 0, 0]} barSize={40}>
                                        {stats.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.hours >= 8 ? '#3b82f6' : '#94a3b8'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Pie Chart - Phân bổ thời gian */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col">
                        <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center">
                            <Users size={20} className="mr-2 text-purple-500"/>
                            Phân bổ thời gian
                        </h3>
                        <div className="flex-1 min-h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" height={36}/>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Second Row Charts for Admin */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Check-in Time Trend */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
                            <Clock size={20} className="mr-2 text-orange-500"/>
                            Xu hướng giờ check-in
                        </h3>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={lineData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10}/>
                                    <YAxis domain={[6, 11]} hide={false} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} label={{ value: 'Giờ', angle: -90, position: 'insideLeft' }}/>
                                    <Tooltip formatter={(value: number) => `${Math.floor(value)}:${Math.round((value % 1) * 60).toString().padStart(2, '0')}`} />
                                    <Line type="monotone" dataKey="time" stroke="#f97316" strokeWidth={3} dot={{r: 4, fill: '#f97316', strokeWidth: 2, stroke: '#fff'}} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-xs text-center text-slate-400 mt-2">Biểu đồ giờ check-in trung bình</p>
                    </div>

                    {/* Top Employees by Hours */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
                            <Users size={20} className="mr-2 text-indigo-500"/>
                            Top nhân viên chăm chỉ
                        </h3>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={topEmployees} margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9"/>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} interval={0} />
                                    <Tooltip cursor={{fill: 'transparent'}} />
                                    <Bar dataKey="hours" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20}>
                                        <Cell fill="#4f46e5" />
                                        <Cell fill="#6366f1" />
                                        <Cell fill="#818cf8" />
                                        <Cell fill="#a5b4fc" />
                                        <Cell fill="#c7d2fe" />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Admin Staff List */}
                <AdminDashboard allUsers={allUsers} sessions={sessions} dateFilter={dateFilter} />
            </>
        ) : (
            <>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Tổng quan báo cáo</h2>
                        <p className="text-slate-500">Thống kê hoạt động cá nhân trong 7 ngày qua</p>
                    </div>
                </div>

                {/* Top Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <StatCard 
                        title="Tổng giờ làm" 
                        value={`${summary.totalHours}h`} 
                        icon={Clock} 
                        color="text-blue-600 bg-blue-600" 
                    />
                    <StatCard 
                        title="Số ca làm" 
                        value={summary.workDays} 
                        icon={CalendarCheck} 
                        color="text-purple-600 bg-purple-600" 
                    />
                    <StatCard 
                        title="Trung bình/ngày" 
                        value={`${summary.avgHours}h`} 
                        icon={TrendingUp} 
                        color="text-green-600 bg-green-600" 
                    />
                     <StatCard 
                        title="Đi làm đúng giờ" 
                        value={`${summary.onTimeRate}%`} 
                        icon={CheckCircle} 
                        color="text-orange-500 bg-orange-500" 
                        subtext={`Check-in trước ${shifts.length > 0 ? shifts[0].startTime : '08:00'} + ${shifts.length > 0 ? shifts[0].lateThreshold : 30}p`}
                    />
                </div>

                {/* Additional Stats - Late & Early Checkout */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard 
                        title="Số lần đi muộn" 
                        value={summary.lateCount} 
                        icon={AlertTriangle} 
                        color="text-red-600 bg-red-600" 
                        subtext={summary.lateCount > 0 ? `Tổng ${summary.totalMinutesLate}p muộn` : 'Không có'}
                    />
                    <StatCard 
                        title="Số lần về sớm" 
                        value={summary.earlyCheckoutCount} 
                        icon={Clock} 
                        color="text-yellow-600 bg-yellow-600" 
                        subtext={summary.earlyCheckoutCount > 0 ? `Tổng ${summary.totalMinutesEarlyCheckout}p sớm` : 'Không có'}
                    />
                    <StatCard 
                        title="Trạng thái chung" 
                        value={summary.onTimeRate >= 80 ? '✓ Tốt' : summary.onTimeRate >= 50 ? '⚠ Trung bình' : '✗ Kém'} 
                        icon={CheckCircle} 
                        color={summary.onTimeRate >= 80 ? 'text-green-600 bg-green-600' : summary.onTimeRate >= 50 ? 'text-yellow-600 bg-yellow-600' : 'text-red-600 bg-red-600'}
                        subtext={`Dựa trên ${Math.min(7, summary.workDays)} ngày gần nhất`}
                    />
                </div>

                {/* Charts - Same for both admin & staff */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Main Bar Chart */}
                    <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
                            <TrendingUp size={20} className="mr-2 text-blue-500"/>
                            {user.role === UserRole.ADMIN ? 'Tổng giờ làm việc (7 ngày)' : 'Số giờ làm việc (7 ngày)'}
                        </h3>
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                    <Bar dataKey="hours" name="Giờ làm" radius={[4, 4, 0, 0]} barSize={40}>
                                        {stats.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.hours >= 8 ? '#3b82f6' : '#94a3b8'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Pie Chart - Productivity Breakdown */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col">
                        <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center">
                            <Users size={20} className="mr-2 text-purple-500"/>
                            Phân bổ thời gian
                        </h3>
                        <div className="flex-1 min-h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" height={36}/>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                     {/* Check-in Time Trend */}
                     <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
                            <Clock size={20} className="mr-2 text-orange-500"/>
                            Xu hướng giờ check-in
                        </h3>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={lineData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10}/>
                                    <YAxis domain={[6, 11]} hide={false} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} label={{ value: 'Giờ', angle: -90, position: 'insideLeft' }}/>
                                    <Tooltip formatter={(value: number) => `${Math.floor(value)}:${Math.round((value % 1) * 60).toString().padStart(2, '0')}`} />
                                    <Line type="monotone" dataKey="time" stroke="#f97316" strokeWidth={3} dot={{r: 4, fill: '#f97316', strokeWidth: 2, stroke: '#fff'}} />
                                    <Line type="monotone" dataKey={() => 8.5} stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={1} dot={false} activeDot={false} name="Quy định (8:30)" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-xs text-center text-slate-400 mt-2">Đường kẻ đứt: Mốc 8:30 sáng</p>
                    </div>

                    {/* Admin: Top Employees / Staff: Motivational Quote */}
                    {user.role === UserRole.ADMIN ? (
                         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
                                <Users size={20} className="mr-2 text-indigo-500"/>
                                Top nhân viên chăm chỉ (7 ngày)
                            </h3>
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                     <BarChart layout="vertical" data={topEmployees} margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9"/>
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} interval={0} />
                                        <Tooltip cursor={{fill: 'transparent'}} />
                                        <Bar dataKey="hours" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20}>
                                            <Cell fill="#4f46e5" />
                                            <Cell fill="#6366f1" />
                                            <Cell fill="#818cf8" />
                                            <Cell fill="#a5b4fc" />
                                            <Cell fill="#c7d2fe" />
                                        </Bar>
                                     </BarChart>
                                </ResponsiveContainer>
                            </div>
                         </div>
                    ) : (
                        <div className="flex items-center justify-center">
                            <MotivationQuote />
                        </div>
                    )}
                </div>
            </>
        )}
    </div>
  );
};
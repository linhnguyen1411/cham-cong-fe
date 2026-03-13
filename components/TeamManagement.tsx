import React, { useState, useEffect } from 'react';
import { Users, ClipboardCheck, Check, X, Calendar, Clock, UserCheck, Loader2, Plus, Edit, Trash2, Save, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 10;

interface PaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onChange: (page: number) => void;
}
const Pagination: React.FC<PaginationProps> = ({ total, page, pageSize, onChange }) => {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
      <span className="text-sm text-gray-500">
        {start}–{end} / {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .reduce<(number | '...')[]>((acc, p, idx, arr) => {
            if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
            acc.push(p);
            return acc;
          }, [])
          .map((p, idx) =>
            p === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-1 text-gray-400 text-sm">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onChange(p as number)}
                className={`w-8 h-8 rounded text-sm font-medium transition ${
                  p === page
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-200 text-gray-700'
                }`}
              >
                {p}
              </button>
            )
          )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
import { User, ShiftRegistration, ForgotCheckinRequest, WorkScheduleType, Position, Department, UserStatus, UserRole } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { 
  getMyTeam, 
  getMyTeamShiftRegistrations,
  getMyTeamForgotCheckinRequests,
  approveShiftRegistration,
  rejectShiftRegistration,
  approveForgotCheckinRequest,
  rejectForgotCheckinRequest,
  getPositions,
  getDepartments,
  updateStaff,
  softDeleteUser
} from '../services/api';
import { CreateUserModal } from './CreateUserModal';

interface Props {
  user: User;
}

type TabType = 'team' | 'shift-registrations' | 'forgot-checkin';

const TeamManagement: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<TabType>('team');
  const [loading, setLoading] = useState(true);
  
  // Team data
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [editingMember, setEditingMember] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<Partial<User>>({});
  const [savingMember, setSavingMember] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  
  // Shift registrations
  const [shiftRegistrations, setShiftRegistrations] = useState<ShiftRegistration[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [processingReg, setProcessingReg] = useState<string | null>(null);
  
  // Forgot checkin requests
  const [forgotCheckinRequests, setForgotCheckinRequests] = useState<ForgotCheckinRequest[]>([]);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Pagination
  const [teamPage, setTeamPage] = useState(1);
  const [shiftPage, setShiftPage] = useState(1);
  const [forgotPage, setForgotPage] = useState(1);

  useEffect(() => {
    loadData();
    setTeamPage(1);
    setShiftPage(1);
    setForgotPage(1);
  }, [activeTab, selectedWeek, filterStatus]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'team') {
        const members = await getMyTeam();
        setTeamMembers(members);
        // Load reference data for editing/creating (only needed for managers/admin)
        if (user.canManageTeam) {
          const [pos, depts] = await Promise.all([getPositions(), getDepartments()]);
          const managedDeptIds = user.managedDepartmentIds || [];
          const managedPosIds = user.managedPositionIds || [];
          const isDeptManagerOnly = user.isDepartmentManager && user.role !== UserRole.ADMIN;
          const isPosManagerOnly = user.isPositionManager && user.role !== UserRole.ADMIN;

          if (isPosManagerOnly && managedPosIds.length > 0) {
            const filteredPos = pos.filter(p => managedPosIds.includes(p.id));
            const deptIdsFromPos = Array.from(new Set(filteredPos.map(p => p.departmentId).filter(Boolean))) as string[];
            setPositions(filteredPos);
            setDepartments(deptIdsFromPos.length > 0 ? depts.filter(d => deptIdsFromPos.includes(d.id)) : depts);
          } else {
            setDepartments(isDeptManagerOnly && managedDeptIds.length > 0 ? depts.filter(d => managedDeptIds.includes(d.id)) : depts);
            setPositions(isDeptManagerOnly && managedDeptIds.length > 0 ? pos.filter(p => !p.departmentId || managedDeptIds.includes(p.departmentId)) : pos);
          }
        }
      } else if (activeTab === 'shift-registrations') {
        const regs = await getMyTeamShiftRegistrations(selectedWeek || undefined);
        setShiftRegistrations(regs);
      } else if (activeTab === 'forgot-checkin') {
        const requests = await getMyTeamForgotCheckinRequests();
        setForgotCheckinRequests(requests);
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
      alert('Không thể tải dữ liệu: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const { isAdmin: teamIsAdmin, managesDepts, managesPositions } = usePermissions(user);
  const canCrudTeam = managesDepts || managesPositions || teamIsAdmin;

  const openEditMember = (member: User) => {
    setEditingMember(member);
    setEditForm({
      fullName: member.fullName,
      phone: member.phone,
      address: member.address,
      birthday: member.birthday,
      workAddress: member.workAddress,
      departmentId: member.departmentId,
      positionId: member.positionId,
      workScheduleType: member.workScheduleType || WorkScheduleType.BOTH_SHIFTS
    });
  };

  const saveMember = async () => {
    if (!editingMember) return;
    setSavingMember(true);
    try {
      const updated = await updateStaff(editingMember.id, editForm);
      setTeamMembers(prev => prev.map(m => m.id === updated.id ? updated : m));
      setEditingMember(updated);
      alert('Đã cập nhật nhân viên');
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setSavingMember(false);
    }
  };

  const removeMember = async (member: User) => {
    if (!confirm(`Xoá mềm nhân viên "${member.fullName}"?`)) return;
    try {
      await softDeleteUser(member.id);
      setTeamMembers(prev => prev.filter(m => m.id !== member.id));
      alert('Đã xoá mềm');
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    }
  };

  const handleApproveShift = async (id: string) => {
    setProcessingReg(id);
    try {
      await approveShiftRegistration(id);
      await loadData();
      alert('Đã duyệt đăng ký ca');
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setProcessingReg(null);
    }
  };

  const handleRejectShift = async (id: string) => {
    const note = prompt('Lý do từ chối (tùy chọn):');
    if (note === null) return;
    
    setProcessingReg(id);
    try {
      await rejectShiftRegistration(id, undefined, note || undefined);
      await loadData();
      alert('Đã từ chối đăng ký ca');
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setProcessingReg(null);
    }
  };

  const handleApproveForgotCheckin = async (id: string) => {
    setProcessingRequest(id);
    try {
      await approveForgotCheckinRequest(id);
      await loadData();
      alert('Đã duyệt yêu cầu');
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleRejectForgotCheckin = async (id: string) => {
    const reason = prompt('Lý do từ chối (tùy chọn):');
    if (reason === null) return;
    
    setProcessingRequest(id);
    try {
      await rejectForgotCheckinRequest(id, reason || undefined);
      await loadData();
      alert('Đã từ chối yêu cầu');
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setProcessingRequest(null);
    }
  };

  // Chuyển Date → "YYYY-MM-DD" theo local timezone (tránh lệch 1 ngày với toISOString)
  const toLocalDateStr = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getWeekOptions = () => {
    const weeks: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = -2; i <= 2; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i * 7);
      const weekStart = new Date(date);
      // Tính thứ 2 của tuần (getDay: 0=CN,1=T2,...,6=T7)
      const diff = weekStart.getDay() === 0 ? -6 : 1 - weekStart.getDay();
      weekStart.setDate(weekStart.getDate() + diff);
      weeks.push(toLocalDateStr(weekStart));
    }
    // Loại trùng
    return Array.from(new Set(weeks));
  };

  const formatDate = (dateStr: string) => {
    // "YYYY-MM-DD" → parse as local date to avoid UTC midnight shift
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
  };

  const filteredForgotCheckinRequests = forgotCheckinRequests.filter(req => {
    if (filterStatus === 'all') return true;
    return req.status === filterStatus;
  });

  const activeTeamMembers = teamMembers.filter(m => m.status !== UserStatus.DEACTIVE);
  const pagedTeam = activeTeamMembers.slice((teamPage - 1) * PAGE_SIZE, teamPage * PAGE_SIZE);
  const pagedShift = shiftRegistrations.slice((shiftPage - 1) * PAGE_SIZE, shiftPage * PAGE_SIZE);
  const pagedForgot = filteredForgotCheckinRequests.slice((forgotPage - 1) * PAGE_SIZE, forgotPage * PAGE_SIZE);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <UserCheck className="w-7 h-7 text-blue-600" />
          Quản lý Team
        </h1>
        <p className="text-gray-500 text-sm mt-1">Quản lý nhân viên và duyệt các yêu cầu trong team của bạn</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('team')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'team'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4 inline mr-2" />
          Nhân viên ({activeTeamMembers.length})
        </button>
        <button
          onClick={() => setActiveTab('shift-registrations')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'shift-registrations'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Calendar className="w-4 h-4 inline mr-2" />
          Đăng ký ca
        </button>
        <button
          onClick={() => setActiveTab('forgot-checkin')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'forgot-checkin'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ClipboardCheck className="w-4 h-4 inline mr-2" />
          Quên checkin/out ({forgotCheckinRequests.filter(r => r.status === 'pending').length})
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {/* Team Members Tab */}
          {activeTab === 'team' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-gray-900">Danh sách nhân viên trong team</h2>
                  {canCrudTeam && (
                    <button
                      onClick={() => setShowCreateUserModal(true)}
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <Plus className="w-4 h-4" />
                      Thêm nhân viên
                    </button>
                  )}
                </div>
              </div>
              {activeTeamMembers.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Chưa có nhân viên nào trong team</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tên</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vị trí</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Khối</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chi nhánh</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                        {canCrudTeam && (
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thao tác</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {pagedTeam.map((member) => (
                        <tr key={member.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{member.fullName}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">@{member.username}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{member.positionName || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{member.departmentName || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{member.branchName || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              member.status === 'active' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {member.status === 'active' ? 'Hoạt động' : 'Ngừng hoạt động'}
                            </span>
                          </td>
                          {canCrudTeam && (
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => openEditMember(member)}
                                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-1"
                                >
                                  <Edit className="w-3 h-3" />
                                  Sửa
                                </button>
                                {member.status !== UserStatus.DEACTIVE && (
                                  <button
                                    onClick={() => removeMember(member)}
                                    className="px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 inline-flex items-center gap-1"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Xoá
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pagination total={activeTeamMembers.length} page={teamPage} pageSize={PAGE_SIZE} onChange={setTeamPage} />
                </div>
              )}
            </div>
          )}

          {/* Shift Registrations Tab */}
          {activeTab === 'shift-registrations' && (
            <div className="space-y-4">
              {/* Week selector */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">Chọn tuần:</label>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tất cả (tuần này + tuần tới)</option>
                  {getWeekOptions().map(week => {
                    const [wy, wm, wd] = week.split('-').map(Number);
                    const weekEnd = new Date(wy, wm - 1, wd + 6);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const diff = today.getDay() === 0 ? -6 : 1 - today.getDay();
                    const thisMonday = new Date(today);
                    thisMonday.setDate(today.getDate() + diff);
                    const nextMonday = new Date(thisMonday);
                    nextMonday.setDate(thisMonday.getDate() + 7);
                    const isCurrentWeek = toLocalDateStr(thisMonday) === week;
                    const isNextWeek = toLocalDateStr(nextMonday) === week;
                    const label = isCurrentWeek ? ' (tuần này)' : isNextWeek ? ' (tuần tới)' : '';
                    return (
                      <option key={week} value={week}>
                        {formatDate(week)} - {formatDate(toLocalDateStr(weekEnd))}{label}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Registrations list */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="font-semibold text-gray-900">Đăng ký ca làm việc</h2>
                </div>
                {shiftRegistrations.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>Chưa có đăng ký ca nào</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nhân viên</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ngày</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ca</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {pagedShift.map((reg) => (
                          <tr key={reg.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{reg.userName}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{formatDate(reg.workDate)}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{reg.shiftName || '-'}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                reg.status === 'approved' 
                                  ? 'bg-green-100 text-green-700'
                                  : reg.status === 'rejected'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {reg.status === 'approved' ? 'Đã duyệt' : reg.status === 'rejected' ? 'Đã từ chối' : 'Chờ duyệt'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {reg.status === 'pending' && (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleApproveShift(reg.id)}
                                    disabled={processingReg === reg.id}
                                    className="px-3 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                                  >
                                    {processingReg === reg.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Check className="w-3 h-3" />
                                    )}
                                    Duyệt
                                  </button>
                                  <button
                                    onClick={() => handleRejectShift(reg.id)}
                                    disabled={processingReg === reg.id}
                                    className="px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                                  >
                                    <X className="w-3 h-3" />
                                    Từ chối
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Pagination total={shiftRegistrations.length} page={shiftPage} pageSize={PAGE_SIZE} onChange={setShiftPage} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Forgot Checkin Requests Tab */}
          {activeTab === 'forgot-checkin' && (
            <div className="space-y-4">
              {/* Filter */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">Lọc theo trạng thái:</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Tất cả</option>
                  <option value="pending">Chờ duyệt</option>
                  <option value="approved">Đã duyệt</option>
                  <option value="rejected">Đã từ chối</option>
                </select>
              </div>

              {/* Requests list */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="font-semibold text-gray-900">Yêu cầu quên checkin/checkout</h2>
                </div>
                {filteredForgotCheckinRequests.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>Chưa có yêu cầu nào</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nhân viên</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ngày</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loại</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thời gian</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lý do</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {pagedForgot.map((req) => (
                          <tr key={req.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{req.userName}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{formatDate(req.requestDate)}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                req.requestType === 'checkin' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                              }`}>
                                {req.requestType === 'checkin' ? 'Check-in' : 'Check-out'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">{req.requestTime || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{req.reason || '-'}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                req.status === 'approved' 
                                  ? 'bg-green-100 text-green-700'
                                  : req.status === 'rejected'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {req.status === 'approved' ? 'Đã duyệt' : req.status === 'rejected' ? 'Đã từ chối' : 'Chờ duyệt'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {req.status === 'pending' && (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleApproveForgotCheckin(req.id)}
                                    disabled={processingRequest === req.id}
                                    className="px-3 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                                  >
                                    {processingRequest === req.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Check className="w-3 h-3" />
                                    )}
                                    Duyệt
                                  </button>
                                  <button
                                    onClick={() => handleRejectForgotCheckin(req.id)}
                                    disabled={processingRequest === req.id}
                                    className="px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                                  >
                                    <X className="w-3 h-3" />
                                    Từ chối
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Pagination total={filteredForgotCheckinRequests.length} page={forgotPage} pageSize={PAGE_SIZE} onChange={setForgotPage} />
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Create user (for department managers/admin) */}
      <CreateUserModal
        isOpen={showCreateUserModal}
        onClose={() => setShowCreateUserModal(false)}
        onSuccess={() => {
          setShowCreateUserModal(false);
          loadData();
        }}
        currentUser={user}
      />

      {/* Edit member modal */}
      {editingMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Sửa nhân viên</h3>
              <button
                onClick={() => { setEditingMember(null); setEditForm({}); }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên</label>
                <input
                  value={editForm.fullName || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, fullName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                  <input
                    value={editForm.phone || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày sinh</label>
                  <input
                    type="date"
                    value={editForm.birthday || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, birthday: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ làm việc</label>
                <input
                  value={editForm.workAddress || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, workAddress: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Department / Position (restricted by BE + filtered lists) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Khối</label>
                  <select
                    value={editForm.departmentId || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, departmentId: e.target.value || undefined, positionId: undefined }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Chưa phân --</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vị trí</label>
                  <select
                    value={editForm.positionId || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, positionId: e.target.value || undefined }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Chưa phân --</option>
                    {positions
                      .filter(p => !editForm.departmentId || !p.departmentId || p.departmentId === editForm.departmentId)
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loại lịch làm việc</label>
                <select
                  value={editForm.workScheduleType || WorkScheduleType.BOTH_SHIFTS}
                  onChange={(e) => setEditForm(prev => ({ ...prev, workScheduleType: e.target.value as WorkScheduleType }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value={WorkScheduleType.BOTH_SHIFTS}>2 ca (Sáng + Chiều)</option>
                  <option value={WorkScheduleType.MORNING_ONLY}>Chỉ ca sáng</option>
                  <option value={WorkScheduleType.AFTERNOON_ONLY}>Chỉ ca chiều</option>
                </select>
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => { setEditingMember(null); setEditForm({}); }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                disabled={savingMember}
              >
                Hủy
              </button>
              <button
                onClick={saveMember}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2 disabled:opacity-50"
                disabled={savingMember}
              >
                <Save className="w-4 h-4" />
                {savingMember ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;



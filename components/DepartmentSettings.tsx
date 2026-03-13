import React, { useState, useEffect } from 'react';
import { Department, WorkShift, User, Branch, UserRole } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import * as api from '../services/api';
import { 
  Building, Plus, Edit, Trash2, Save, X, Clock, Users, ChevronRight, ChevronDown, UserCog, Building2, CalendarDays
} from 'lucide-react';

const DAYS_OF_WEEK = [
  { wday: 1, label: 'T2' },
  { wday: 2, label: 'T3' },
  { wday: 3, label: 'T4' },
  { wday: 4, label: 'T5' },
  { wday: 5, label: 'T6' },
  { wday: 6, label: 'T7' },
  { wday: 0, label: 'CN' },
];

const WORK_DAYS_PRESETS = [
  { label: 'T2 - T6', days: [1, 2, 3, 4, 5] },
  { label: 'T2 - T7', days: [1, 2, 3, 4, 5, 6] },
  { label: 'Cả tuần', days: [0, 1, 2, 3, 4, 5, 6] },
];

const formatWorkDays = (workDays: number[] | undefined): string => {
  if (!workDays || workDays.length === 0) return 'Chưa thiết lập';
  const sorted = [...workDays].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
  return sorted.map(d => DAYS_OF_WEEK.find(x => x.wday === d)?.label ?? '').filter(Boolean).join(', ');
};

interface DepartmentSettingsProps {
  currentUser: User;
}

export const DepartmentSettings: React.FC<DepartmentSettingsProps> = ({ currentUser }) => {
  const { isSuperAdmin, isBranchAdmin, isDepartmentHead, isAdmin, managesDepts } = usePermissions(currentUser);
  // department_head với managed departments cũng có quyền xem khối của mình
  const hasAccess = isAdmin || isDepartmentHead || managesDepts;
  const canCreateDept = isAdmin; // chỉ super_admin và branch_admin mới tạo được khối mới

  // Hooks phải được khai báo TRƯỚC conditional return (React Rules of Hooks)
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [deptShifts, setDeptShifts] = useState<Record<string, WorkShift[]>>({});
  const [branches, setBranches] = useState<Branch[]>([]);
  
  // Department form
  const [showForm, setShowForm] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: '', description: '', managerId: '', branchId: '', workDays: [1, 2, 3, 4, 5] as number[] });
  const [saving, setSaving] = useState(false);
  const [formUsers, setFormUsers] = useState<User[]>([]);

  // Shift form for department
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [editingShift, setEditingShift] = useState<WorkShift | null>(null);
  const [shiftForm, setShiftForm] = useState({ 
    name: '', startTime: '08:00', endTime: '17:00', lateThreshold: 30 
  });
  const [shiftForDept, setShiftForDept] = useState<string | null>(null);
  
  // Manager assignment
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [managerForDept, setManagerForDept] = useState<Department | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [assigningManager, setAssigningManager] = useState(false);

  useEffect(() => {
    loadDepartments();
    if (isSuperAdmin) {
      api.getBranches().then(setBranches).catch(() => {});
    }
  }, []);

  const loadDepartments = async () => {
    setLoading(true);
    const data = await api.getDepartments();
    setDepartments(data);
    setLoading(false);
  };

  const loadDeptShifts = async (deptId: string) => {
    const shifts = await api.getWorkShifts(deptId);
    setDeptShifts(prev => ({ ...prev, [deptId]: shifts }));
  };

  const toggleExpand = async (deptId: string) => {
    if (expandedDept === deptId) {
      setExpandedDept(null);
    } else {
      setExpandedDept(deptId);
      if (!deptShifts[deptId]) {
        await loadDeptShifts(deptId);
      }
    }
  };

  const handleSaveDept = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingDept) {
        const updateData: any = {
          name: form.name,
          description: form.description,
          managerId: form.managerId || null,
          workDays: form.workDays,
        };
        if (isSuperAdmin) {
          updateData.branchId = form.branchId || null;
        }
        const updated = await api.updateDepartment(editingDept.id, updateData);
        setDepartments(prev => prev.map(d => d.id === updated.id ? updated : d));
      } else {
        const createData: any = {
          name: form.name,
          description: form.description,
          managerId: form.managerId || undefined,
          workDays: form.workDays,
        };
        if (isSuperAdmin && form.branchId) {
          createData.branchId = form.branchId;
        }
        const created = await api.createDepartment(createData);
        setDepartments(prev => [...prev, created]);
      }
      setShowForm(false);
      setEditingDept(null);
      setForm({ name: '', description: '', managerId: '', branchId: '', workDays: [1, 2, 3, 4, 5] });
      await loadDepartments();
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
    setSaving(false);
  };

  const handleDeleteDept = async (dept: Department) => {
    if (!confirm(`Xóa khối "${dept.name}"? Các ca làm việc thuộc khối này cũng sẽ bị xóa.`)) return;
    try {
      await api.deleteDepartment(dept.id);
      setDepartments(prev => prev.filter(d => d.id !== dept.id));
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  const handleSaveShift = async () => {
    if (!shiftForm.name.trim() || !shiftForDept) return;
    setSaving(true);
    try {
      const shiftData = {
        ...shiftForm,
        departmentId: shiftForDept
      };
      
      if (editingShift) {
        const updated = await api.updateWorkShift(editingShift.id, shiftData);
        setDeptShifts(prev => ({
          ...prev,
          [shiftForDept]: prev[shiftForDept].map(s => s.id === updated.id ? updated : s)
        }));
      } else {
        const created = await api.createWorkShift(shiftData as any);
        setDeptShifts(prev => ({
          ...prev,
          [shiftForDept]: [...(prev[shiftForDept] || []), created]
        }));
        // Update shift count
        setDepartments(prev => prev.map(d => 
          d.id === shiftForDept 
            ? { ...d, shiftsCount: (d.shiftsCount || 0) + 1 }
            : d
        ));
      }
      setShowShiftForm(false);
      setEditingShift(null);
      setShiftForm({ name: '', startTime: '08:00', endTime: '17:00', lateThreshold: 30 });
      setShiftForDept(null);
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
    setSaving(false);
  };

  const handleAssignManager = async () => {
    if (!managerForDept || !selectedManagerId) return;
    
    setAssigningManager(true);
    try {
      if (selectedManagerId === '') {
        // Remove manager
        await api.removeDepartmentManager(managerForDept.id);
      } else {
        // Assign manager
        await api.assignDepartmentManager(managerForDept.id, selectedManagerId);
      }
      await loadDepartments();
      setShowManagerModal(false);
      setManagerForDept(null);
      setSelectedManagerId('');
    } catch (e: any) {
      alert('Lỗi: ' + (e.message || 'Không thể gán quản lý'));
    }
    setAssigningManager(false);
  };

  const handleDeleteShift = async (shift: WorkShift, deptId: string) => {
    if (!confirm(`Xóa ca "${shift.name}"?`)) return;
    try {
      await api.deleteWorkShift(shift.id);
      setDeptShifts(prev => ({
        ...prev,
        [deptId]: prev[deptId].filter(s => s.id !== shift.id)
      }));
      // Update shift count
      setDepartments(prev => prev.map(d => 
        d.id === deptId 
          ? { ...d, shiftsCount: Math.max(0, (d.shiftsCount || 0) - 1) }
          : d
      ));
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  // Guard sau hooks (tránh vi phạm React Rules of Hooks)
  if (!hasAccess) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 flex items-center gap-2">
          <Building size={18} />
          Bạn không có quyền truy cập quản lý khối.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Building size={24} className="text-purple-600" />
              Quản lý Khối
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Thiết lập các khối làm việc và ca làm việc cho từng khối
            </p>
          </div>
          
          {canCreateDept && (
            <button
              onClick={async () => {
                setShowForm(true);
                setEditingDept(null);
                const defaultBranchId = isBranchAdmin
                  ? (currentUser.managedBranchIds?.[0] || '')
                  : '';
                setForm({ name: '', description: '', managerId: '', branchId: defaultBranchId, workDays: [1, 2, 3, 4, 5] });
                try {
                  const users = await api.getAllStaff();
                  setFormUsers(users.filter(u => u.status !== 'deactive'));
                } catch (e: any) {
                  console.error('Error loading users:', e);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              <Plus size={18} />
              Thêm khối mới
            </button>
          )}
        </div>
      </div>

      {/* Department List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-400">
            Đang tải...
          </div>
        ) : departments.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-400">
            <Building size={48} className="mx-auto mb-4 text-slate-300" />
            <p>Chưa có khối nào. Thêm khối mới để bắt đầu.</p>
          </div>
        ) : (
          departments.map(dept => (
            <div key={dept.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Department Header */}
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition"
                onClick={() => toggleExpand(dept.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedDept === dept.id ? (
                    <ChevronDown size={20} className="text-slate-400" />
                  ) : (
                    <ChevronRight size={20} className="text-slate-400" />
                  )}
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Building size={20} className="text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{dept.name}</h3>
                    {dept.branchName && (
                      <p className="text-xs text-purple-600 flex items-center gap-1 mt-0.5">
                        <Building2 size={11} />
                        {dept.branchName}
                      </p>
                    )}
                    <p className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5">
                      <CalendarDays size={11} />
                      {formatWorkDays(dept.workDays)}
                    </p>
                    {dept.description && (
                      <p className="text-sm text-slate-500 mt-0.5">{dept.description}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    {dept.managerName && (
                      <span className="flex items-center gap-1 text-blue-600">
                        <UserCog size={16} />
                        QL: {dept.managerName}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users size={16} />
                      {dept.usersCount || 0} nhân viên
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={16} />
                      {dept.shiftsCount || 0} ca
                    </span>
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={async () => {
                        setEditingDept(dept);
                        setForm({ 
                          name: dept.name, 
                          description: dept.description || '',
                          managerId: dept.managerId || '',
                          branchId: dept.branchId || '',
                          workDays: dept.workDays ?? [1, 2, 3, 4, 5],
                        });
                        try {
                          const users = await api.getAllStaff();
                          setFormUsers(users.filter(u => u.status !== 'deactive'));
                        } catch (e: any) {
                          console.error('Error loading users:', e);
                        }
                        setShowForm(true);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteDept(dept)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded: Manager & Shifts */}
              {expandedDept === dept.id && (
                <div className="border-t border-slate-100 p-4 bg-slate-50 space-y-4">
                  {/* Manager Section */}
                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-slate-700 flex items-center gap-2">
                        <UserCog size={18} className="text-blue-600" />
                        Quản lý khối
                      </h4>
                      <button
                      onClick={async () => {
                        setManagerForDept(dept);
                        setSelectedManagerId(dept.managerId || '');
                        // Load users for manager selection
                        try {
                          const users = await api.getAllStaff();
                          setAvailableUsers(users.filter(u => u.status !== 'deactive'));
                        } catch (e: any) {
                          alert('Không thể tải danh sách nhân viên');
                        }
                        setShowManagerModal(true);
                      }}
                        className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                      >
                        {dept.managerId ? <Edit size={14} /> : <Plus size={14} />}
                        {dept.managerId ? 'Thay đổi' : 'Chọn quản lý'}
                      </button>
                    </div>
                    {dept.managerId ? (
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <div>
                          <p className="font-medium text-slate-800">{dept.managerName}</p>
                          {dept.managerUsername && (
                            <p className="text-sm text-slate-500">@{dept.managerUsername}</p>
                          )}
                        </div>
                        <button
                          onClick={async () => {
                            if (window.confirm('Bạn có chắc muốn gỡ quản lý khỏi khối này?')) {
                              try {
                                await api.removeDepartmentManager(dept.id);
                                await loadDepartments();
                              } catch (e: any) {
                                alert('Lỗi: ' + e.message);
                              }
                            }
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <p className="text-slate-400 text-sm py-2">Chưa có quản lý được chỉ định</p>
                    )}
                  </div>
                  
                  {/* Shifts Section */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-slate-700">Ca làm việc của khối</h4>
                      <button
                        onClick={() => {
                          setShiftForDept(dept.id);
                          setEditingShift(null);
                          setShiftForm({ name: '', startTime: '08:00', endTime: '17:00', lateThreshold: 30 });
                          setShowShiftForm(true);
                        }}
                        className="flex items-center gap-1 px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                      >
                        <Plus size={14} />
                        Thêm ca
                      </button>
                    </div>
                    
                    {!deptShifts[dept.id] ? (
                      <p className="text-slate-400 text-center py-4">Đang tải...</p>
                    ) : deptShifts[dept.id].length === 0 ? (
                      <p className="text-slate-400 text-center py-4">Chưa có ca làm việc</p>
                    ) : (
                      <div className="space-y-2">
                        {deptShifts[dept.id].map(shift => (
                          <div 
                            key={shift.id} 
                            className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200"
                          >
                            <div className="flex items-center gap-3">
                              <Clock size={18} className="text-purple-500" />
                              <div>
                                <p className="font-medium text-slate-800">{shift.name}</p>
                                <p className="text-sm text-slate-500">
                                  {shift.startTime} - {shift.endTime} | Trễ cho phép: {shift.lateThreshold} phút
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setShiftForDept(dept.id);
                                  setEditingShift(shift);
                                  setShiftForm({
                                    name: shift.name,
                                    startTime: shift.startTime,
                                    endTime: shift.endTime,
                                    lateThreshold: shift.lateThreshold
                                  });
                                  setShowShiftForm(true);
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteShift(shift, dept.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Department Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">
                {editingDept ? 'Sửa khối' : 'Thêm khối mới'}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Chi nhánh - Super Admin chọn, Branch Admin hiển thị cố định */}
              {isSuperAdmin ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                    <Building2 size={14} className="text-purple-500" />
                    Chi nhánh
                  </label>
                  <select
                    value={form.branchId}
                    onChange={e => setForm(prev => ({ ...prev, branchId: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">-- Chưa gắn chi nhánh --</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Chọn chi nhánh mà khối này thuộc về
                  </p>
                </div>
              ) : isBranchAdmin && currentUser.managedBranchIds?.length ? (
                <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-100 rounded-lg">
                  <Building2 size={16} className="text-purple-500 shrink-0" />
                  <div>
                    <p className="text-xs text-purple-600 font-medium">Chi nhánh</p>
                    <p className="text-sm text-slate-800">
                      {/* Show branch name from branches or fallback */}
                      {editingDept?.branchName || 'Chi nhánh của bạn'}
                    </p>
                  </div>
                  <span className="ml-auto text-xs text-purple-400">Tự động</span>
                </div>
              ) : null}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tên khối *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="VD: Khối văn phòng, Khối công trình..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Mô tả về khối này..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              {/* Lịch làm việc trong tuần */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                  <CalendarDays size={14} className="text-emerald-500" />
                  Lịch làm việc trong tuần *
                </label>
                {/* Preset buttons */}
                <div className="flex gap-2 mb-2">
                  {WORK_DAYS_PRESETS.map(preset => {
                    const isActive = JSON.stringify([...preset.days].sort()) === JSON.stringify([...form.workDays].sort());
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, workDays: preset.days }))}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition ${isActive ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-500'}`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                {/* Day toggles */}
                <div className="flex gap-1.5 flex-wrap">
                  {DAYS_OF_WEEK.map(({ wday, label }) => {
                    const active = form.workDays.includes(wday);
                    return (
                      <button
                        key={wday}
                        type="button"
                        onClick={() => setForm(prev => ({
                          ...prev,
                          workDays: active
                            ? prev.workDays.filter(d => d !== wday)
                            : [...prev.workDays, wday]
                        }))}
                        className={`w-10 h-10 rounded-lg text-sm font-semibold border-2 transition ${
                          active
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-white text-slate-400 border-slate-200 hover:border-emerald-300'
                        } ${wday === 0 ? 'text-red-500 ' + (active ? 'bg-red-500 border-red-500' : '') : ''}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-400 mt-1">Nhân viên thuộc khối này sẽ được tạo lịch theo các ngày đã chọn</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quản lý khối</label>
                <select
                  value={form.managerId}
                  onChange={e => setForm(prev => ({ ...prev, managerId: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">-- Không chọn --</option>
                  {formUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} {u.username && `(@${u.username})`}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Chọn quản lý cho khối này (có thể để trống)</p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveDept}
                disabled={saving || !form.name.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
              >
                <Save size={18} />
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Form Modal */}
      {showShiftForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">
                {editingShift ? 'Sửa ca làm việc' : 'Thêm ca làm việc'}
              </h3>
              <button onClick={() => setShowShiftForm(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tên ca *</label>
                <input
                  type="text"
                  value={shiftForm.name}
                  onChange={e => setShiftForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="VD: Ca sáng, Ca chiều, Ca tối..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Giờ bắt đầu</label>
                  <input
                    type="time"
                    value={shiftForm.startTime}
                    onChange={e => setShiftForm(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Giờ kết thúc</label>
                  <input
                    type="time"
                    value={shiftForm.endTime}
                    onChange={e => setShiftForm(prev => ({ ...prev, endTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Thời gian trễ cho phép (phút)
                </label>
                <input
                  type="number"
                  value={shiftForm.lateThreshold}
                  onChange={e => setShiftForm(prev => ({ ...prev, lateThreshold: Number(e.target.value) }))}
                  min={0}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Nhân viên check-in sau thời gian này sẽ bị tính là đi trễ
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowShiftForm(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveShift}
                disabled={saving || !shiftForm.name.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
              >
                <Save size={18} />
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manager Assignment Modal */}
      {showManagerModal && managerForDept && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">
                Chọn quản lý cho khối "{managerForDept.name}"
              </h3>
              <button onClick={() => {
                setShowManagerModal(false);
                setManagerForDept(null);
                setSelectedManagerId('');
              }} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Quản lý khối</label>
                <select
                  value={selectedManagerId}
                  onChange={(e) => setSelectedManagerId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Không chọn --</option>
                  {availableUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.fullName} {user.username && `(@${user.username})`}
                    </option>
                  ))}
                </select>
                {selectedManagerId && (
                  <p className="mt-2 text-sm text-slate-500">
                    Đang chọn: {availableUsers.find(u => u.id === selectedManagerId)?.fullName}
                  </p>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowManagerModal(false);
                  setManagerForDept(null);
                  setSelectedManagerId('');
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Hủy
              </button>
              <button
                onClick={handleAssignManager}
                disabled={assigningManager}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                <Save size={18} />
                {assigningManager ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

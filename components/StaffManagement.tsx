import React, { useState, useEffect } from 'react';
import { User, UserRole, UserStatus, Branch, Department, Position, WorkScheduleType, Role } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import * as api from '../services/api';
import { CreateUserModal } from './CreateUserModal';
import { 
  Users, Search, Filter, Edit, Eye, X, Building2, MapPin, Phone, 
  Calendar, Mail, UserCog, Plus, Trash2, Save, ChevronLeft, Layers, Briefcase 
} from 'lucide-react';

interface Props {
  currentUser: User;
}

export const StaffManagement: React.FC<Props> = ({ currentUser }) => {
  const [staff, setStaff] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBranch, setFilterBranch] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');

  // Detail/Edit modal
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<User>>({});
  const [editRoleId, setEditRoleId] = useState<string>('');
  const [editManagedBranchIds, setEditManagedBranchIds] = useState<string[]>([]);
  const [editManagedDeptIds, setEditManagedDeptIds] = useState<string[]>([]);
  const [editManagedPosIds, setEditManagedPosIds] = useState<string[]>([]);
  const [passwordForm, setPasswordForm] = useState({ password: '', passwordConfirmation: '' });
  const [saving, setSaving] = useState(false);
  
  // Branch management modal
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [branchForm, setBranchForm] = useState({ name: '', address: '', description: '', managerId: '' });
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchFormUsers, setBranchFormUsers] = useState<User[]>([]);
  const [showBranchManagerModal, setShowBranchManagerModal] = useState(false);
  const [branchForManager, setBranchForManager] = useState<Branch | null>(null);
  const [selectedBranchManagerId, setSelectedBranchManagerId] = useState<string>('');
  const [assigningBranchManager, setAssigningBranchManager] = useState(false);
  
  // Create user modal
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);

  const { isSuperAdmin, isBranchAdmin, myBranchId, myBranchName } = usePermissions(currentUser);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [staffData, branchData, departmentData, positionData, roleData] = await Promise.all([
      api.getAllStaff(isSuperAdmin),
      isSuperAdmin ? api.getBranches() : Promise.resolve([]),
      api.getDepartments(),
      api.getPositions(),
      api.getRoles()
    ]);
    setStaff(staffData);
    setBranches(branchData);
    setDepartments(
      isSuperAdmin
        ? departmentData
        : departmentData.filter(d => !d.branchId || d.branchId === myBranchId)
    );
    setPositions(positionData);
    setRoles(roleData);
    setLoading(false);
  };

  const filteredStaff = staff.filter(s => {
    const matchSearch = s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       s.username.toLowerCase().includes(searchTerm.toLowerCase());
    const matchBranch = filterBranch === 'all' || s.branchId === filterBranch || 
                       (filterBranch === 'none' && !s.branchId);
    const matchDepartment = filterDepartment === 'all' || s.departmentId === filterDepartment || 
                       (filterDepartment === 'none' && !s.departmentId);
    const matchRole = filterRole === 'all' || 
                     (filterRole === 'admin' && s.role === UserRole.ADMIN) ||
                     (filterRole === 'staff' && s.role === UserRole.STAFF);
    // Non-super-admin: luôn chỉ thấy active users
    if (!isSuperAdmin && s.status === UserStatus.DEACTIVE) return false;
    const matchStatus = filterStatus === 'all' ||
                       (filterStatus === 'active' && s.status !== UserStatus.DEACTIVE) ||
                       (filterStatus === 'deactive' && s.status === UserStatus.DEACTIVE);
    return matchSearch && matchBranch && matchDepartment && matchRole && matchStatus;
  });

  // Tính toán thống kê
  const stats = {
    total: staff.length,
    admin: staff.filter(s => s.role === UserRole.ADMIN).length,
    staff: staff.filter(s => s.role === UserRole.STAFF).length,
    active: staff.filter(s => s.status !== UserStatus.DEACTIVE).length,
    deactive: staff.filter(s => s.status === UserStatus.DEACTIVE).length
  };

  // Roles mà user hiện tại được phép gán cho người khác (theo phân cấp)
  const assignableRoles = roles.filter(r => {
    if (isSuperAdmin) return true;
    if (isBranchAdmin) return !['super_admin', 'branch_admin'].includes(r.name);
    return false;
  });

  // Tên hiển thị đẹp cho từng role
  const roleDisplayName = (name: string) => {
    const map: Record<string, string> = {
      super_admin: 'Quản trị hệ thống',
      branch_admin: 'Quản lý chi nhánh',
      department_head: 'Quản lý khối',
      position_manager: 'Quản lý vị trí',
      staff: 'Nhân viên'
    };
    return map[name] || name;
  };

  // Branches có thể gán làm managed (cho super_admin thì all, branch_admin chỉ chi nhánh mình)
  const assignableBranches = isSuperAdmin
    ? branches
    : branches.filter(b => currentUser.managedBranchIds?.includes(String(b.id)));

  const assignableDepts = isSuperAdmin
    ? departments
    : departments.filter(d => !d.branchId || d.branchId === myBranchId);

  const assignablePositions = isSuperAdmin
    ? positions
    : positions.filter(p => {
        const dept = departments.find(d => String(d.id) === String(p.departmentId));
        return !dept?.branchId || dept?.branchId === myBranchId;
      });

  // Scope hiện tại của role được chọn để quyết định show section nào
  const selectedRoleName = roles.find(r => String(r.id) === editRoleId)?.name || '';
  const showBranchScope = isSuperAdmin && ['branch_admin'].includes(selectedRoleName);
  const showDeptScope = (isSuperAdmin || isBranchAdmin) && ['department_head'].includes(selectedRoleName);
  const showPosScope = (isSuperAdmin || isBranchAdmin) && ['position_manager'].includes(selectedRoleName);

  const toggleId = (ids: string[], id: string) =>
    ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];

  const handleViewDetail = (user: User) => {
    setSelectedStaff(user);
    setEditForm(user);
    setEditRoleId(user.roleId ? String(user.roleId) : '');
    setEditManagedBranchIds(user.managedBranchIds || []);
    setEditManagedDeptIds(user.managedDepartmentIds || []);
    setEditManagedPosIds(user.managedPositionIds || []);
    setPasswordForm({ password: '', passwordConfirmation: '' });
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!selectedStaff) return;
    
    // Validate password if provided
    if (passwordForm.password) {
      if (passwordForm.password.length < 6) {
        alert('Mật khẩu phải có ít nhất 6 ký tự');
        return;
      }
      if (passwordForm.password !== passwordForm.passwordConfirmation) {
        alert('Mật khẩu xác nhận không khớp');
        return;
      }
    }
    
    setSaving(true);
    try {
      const updateData: any = { ...editForm };
      if (passwordForm.password) {
        updateData.password = passwordForm.password;
      }
      // role_id từ dropdown roles thật
      if (editRoleId) updateData.roleId = editRoleId;
      // managed scope (chỉ gửi khi admin/super_admin)
      if (isSuperAdmin || isBranchAdmin) {
        updateData.managedBranchIds = editManagedBranchIds;
        updateData.managedDepartmentIds = editManagedDeptIds;
        updateData.managedPositionIds = editManagedPosIds;
      }
      const updated = await api.updateStaff(selectedStaff.id, updateData);
      setStaff(prev => prev.map(s => s.id === updated.id ? updated : s));
      setSelectedStaff(updated);
      setEditManagedBranchIds(updated.managedBranchIds || []);
      setEditManagedDeptIds(updated.managedDepartmentIds || []);
      setEditManagedPosIds(updated.managedPositionIds || []);
      setPasswordForm({ password: '', passwordConfirmation: '' });
      setIsEditing(false);
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
    setSaving(false);
  };

  const handleCreateBranch = async () => {
    try {
      const createData: any = {
        name: branchForm.name,
        address: branchForm.address,
        description: branchForm.description
      };
      if (branchForm.managerId) {
        createData.managerId = branchForm.managerId;
      }
      const newBranch = await api.createBranch(createData);
      await loadData(); // Reload để có manager info
      setBranchForm({ name: '', address: '', description: '', managerId: '' });
      setShowBranchModal(false);
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  const handleUpdateBranch = async () => {
    if (!editingBranch) return;
    try {
      const updateData: any = {
        name: branchForm.name,
        address: branchForm.address,
        description: branchForm.description
      };
      if (branchForm.managerId) {
        updateData.managerId = branchForm.managerId;
      } else {
        // Nếu không chọn manager, có thể gỡ manager hiện tại
        updateData.managerId = null;
      }
      const updated = await api.updateBranch(editingBranch.id, updateData);
      await loadData(); // Reload để có manager info
      setEditingBranch(null);
      setBranchForm({ name: '', address: '', description: '', managerId: '' });
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };
  
  const handleAssignBranchManager = async () => {
    if (!branchForManager) return;
    
    setAssigningBranchManager(true);
    try {
      if (selectedBranchManagerId === '') {
        await api.removeBranchManager(branchForManager.id);
      } else {
        await api.assignBranchManager(branchForManager.id, selectedBranchManagerId);
      }
      await loadData();
      setShowBranchManagerModal(false);
      setBranchForManager(null);
      setSelectedBranchManagerId('');
    } catch (e: any) {
      alert('Lỗi: ' + (e.message || 'Không thể gán quản lý'));
    }
    setAssigningBranchManager(false);
  };

  const handleDeleteBranch = async (branch: Branch) => {
    if (!confirm(`Xóa chi nhánh "${branch.name}"?`)) return;
    try {
      await api.deleteBranch(branch.id);
      setBranches(prev => prev.filter(b => b.id !== branch.id));
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  const handleDeactivateStaff = async (user: User) => {
    if (!confirm(`Xác nhận đánh dấu nhân viên "${user.fullName}" đã nghỉ việc?\n\nLưu ý: Toàn bộ lịch làm việc tương lai của nhân viên sẽ bị huỷ.`)) return;
    try {
      const updated = await api.deactivateStaff(user.id);
      setStaff(prev => prev.map(s => s.id === updated.id ? updated : s));
      if (selectedStaff?.id === user.id) {
        setSelectedStaff(updated);
      }
      alert('Đã đánh dấu nhân viên nghỉ việc và huỷ lịch làm việc tương lai');
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  const handleReactivateStaff = async (user: User) => {
    if (!confirm(`Khôi phục tài khoản nhân viên "${user.fullName}"?`)) return;
    try {
      const updated = await api.reactivateStaff(user.id);
      setStaff(prev => prev.map(s => s.id === updated.id ? updated : s));
      if (selectedStaff?.id === user.id) {
        setSelectedStaff(updated);
      }
      alert('Đã khôi phục tài khoản nhân viên');
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Users size={24} className="text-blue-600" />
              Quản lý tài khoản
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Tất cả tài khoản trong hệ thống
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateUserModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <Plus size={18} />
              Tạo tài khoản mới
            </button>
            <button
              onClick={async () => {
                setShowBranchModal(true);
                setEditingBranch(null);
                setBranchForm({ name: '', address: '', description: '', managerId: '' });
                // Load users for manager selection
                try {
                  const users = await api.getAllStaff();
                  setBranchFormUsers(users.filter(u => u.status !== 'deactive'));
                } catch (e: any) {
                  console.error('Error loading users:', e);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Building2 size={18} />
              Quản lý chi nhánh
            </button>
          </div>
        </div>
        
        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <div className="text-sm text-blue-600 font-medium">Tổng tài khoản</div>
            <div className="text-2xl font-bold text-blue-700 mt-1">{stats.total}</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
            <div className="text-sm text-purple-600 font-medium">Admin</div>
            <div className="text-2xl font-bold text-purple-700 mt-1">{stats.admin}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 border border-green-100">
            <div className="text-sm text-green-600 font-medium">Nhân viên</div>
            <div className="text-2xl font-bold text-green-700 mt-1">{stats.staff}</div>
          </div>
          <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
            <div className="text-sm text-emerald-600 font-medium">Đang làm việc</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{stats.active}</div>
          </div>
          {isSuperAdmin && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <div className="text-sm text-gray-600 font-medium">Đã nghỉ việc</div>
              <div className="text-2xl font-bold text-gray-700 mt-1">{stats.deactive}</div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên, username..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex gap-2 flex-wrap">
            {isSuperAdmin ? (
              <select
                value={filterBranch}
                onChange={e => setFilterBranch(e.target.value)}
                className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tất cả chi nhánh</option>
                <option value="none">Chưa phân chi nhánh</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            ) : myBranchName ? (
              <span className="px-3 py-2 bg-blue-50 text-blue-700 text-sm rounded-lg border border-blue-200 flex items-center gap-1">
                <Building2 className="w-4 h-4" />
                {myBranchName}
              </span>
            ) : null}
            
            <select
              value={filterDepartment}
              onChange={e => setFilterDepartment(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tất cả khối</option>
              <option value="none">Chưa phân khối</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            
            <select
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tất cả vai trò</option>
              <option value="admin">Admin</option>
              <option value="staff">Nhân viên</option>
            </select>
            
            {isSuperAdmin && (
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Đang làm việc</option>
                <option value="deactive">Đã nghỉ việc</option>
                <option value="all">Tất cả trạng thái</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Staff List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4 text-left">Nhân viên</th>
                <th className="px-6 py-4 text-left">Chi nhánh</th>
                <th className="px-6 py-4 text-left">Khối</th>
                <th className="px-6 py-4 text-left">Vị trí</th>
                <th className="px-6 py-4 text-left">Vai trò</th>
                <th className="px-6 py-4 text-left">Liên hệ</th>
                <th className="px-6 py-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    Đang tải...
                  </td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    Không tìm thấy nhân viên
                  </td>
                </tr>
              ) : (
                filteredStaff.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center">
                          {user.avatar ? (
                            <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Users size={18} className="text-slate-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{user.fullName}</p>
                          <p className="text-sm text-slate-500">@{user.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.branchName ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm">
                          <Building2 size={14} />
                          {user.branchName}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">Chưa phân</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {user.departmentName ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded text-sm">
                          <Layers size={14} />
                          {user.departmentName}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">Chưa phân</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {user.positionName ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-sm">
                          <Briefcase size={14} />
                          {user.positionName}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">Chưa phân</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                        user.role === UserRole.ADMIN 
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {user.role === UserRole.ADMIN ? '👑 Admin' : '👤 Nhân viên'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {user.phone || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleViewDetail(user)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Xem chi tiết"
                        >
                          <Eye size={18} />
                        </button>
                        {user.status !== UserStatus.DEACTIVE && (
                          <button
                            onClick={() => handleDeactivateStaff(user)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Đánh dấu nghỉ việc"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                        {user.status === UserStatus.DEACTIVE && isSuperAdmin && (
                          <button
                            onClick={() => handleReactivateStaff(user)}
                            className="px-2 py-1 bg-green-100 text-green-700 hover:bg-green-200 text-xs rounded transition font-medium"
                            title="Khôi phục tài khoản"
                          >
                            Khôi phục
                          </button>
                        )}
                        {user.status === UserStatus.DEACTIVE && !isSuperAdmin && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded">
                            Đã nghỉ
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff Detail Modal */}
      {selectedStaff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isEditing && (
                  <button onClick={() => setIsEditing(false)} className="p-1 hover:bg-slate-100 rounded">
                    <ChevronLeft size={20} />
                  </button>
                )}
                <h3 className="text-lg font-bold text-slate-800">
                  {isEditing ? 'Chỉnh sửa thông tin' : 'Chi tiết nhân viên'}
                </h3>
              </div>
              <button onClick={() => setSelectedStaff(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Avatar & Basic Info */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center">
                  {selectedStaff.avatar ? (
                    <img src={selectedStaff.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Users size={32} className="text-slate-400" />
                  )}
                </div>
                <div>
                  <h4 className="text-xl font-bold text-slate-800">{selectedStaff.fullName}</h4>
                  <p className="text-slate-500">@{selectedStaff.username}</p>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Họ tên</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.fullName || ''}
                      onChange={e => setEditForm(prev => ({ ...prev, fullName: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-slate-800">{selectedStaff.fullName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Vai trò</label>
                  {isEditing && assignableRoles.length > 0 ? (
                    <select
                      value={editRoleId}
                      onChange={e => {
                        setEditRoleId(e.target.value);
                        // Reset scope khi đổi role
                        setEditManagedBranchIds([]);
                        setEditManagedDeptIds([]);
                        setEditManagedPosIds([]);
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Chọn vai trò --</option>
                      {assignableRoles.map(r => (
                        <option key={r.id} value={r.id}>{roleDisplayName(r.name)}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-slate-800">
                      {roleDisplayName(selectedStaff.roleName || '') || (selectedStaff.role === UserRole.ADMIN ? 'Admin' : 'Nhân viên')}
                    </p>
                  )}
                </div>

                {/* Phạm vi quản lý chi nhánh (hiện khi đang chọn role branch_admin, hoặc user đang có managed branches) */}
                {(showBranchScope || (selectedStaff.managedBranchIds?.length ?? 0) > 0) ? (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                      <Building2 size={14} /> Quản lý chi nhánh
                    </label>
                    {isEditing ? (
                      <div className="grid grid-cols-2 gap-2 p-3 border border-slate-200 rounded-lg bg-slate-50">
                        {assignableBranches.map(b => (
                          <label key={b.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editManagedBranchIds.includes(String(b.id))}
                              onChange={() => setEditManagedBranchIds(prev => toggleId(prev, String(b.id)))}
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm text-slate-700">{b.name}</span>
                          </label>
                        ))}
                        {assignableBranches.length === 0 && <p className="text-slate-400 text-sm col-span-2">Không có chi nhánh</p>}
                      </div>
                    ) : (
                      <p className="text-slate-800">
                        {selectedStaff.managedBranchNames?.join(', ') || 'Chưa phân'}
                      </p>
                    )}
                  </div>
                ) : null}

                {/* Phạm vi quản lý khối (role = department_head) */}
                {(showDeptScope && isEditing) || (!isEditing && (selectedStaff.managedDepartmentIds?.length ?? 0) > 0) ? (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                      <Layers size={14} /> Quản lý khối
                    </label>
                    {isEditing ? (
                      <div className="grid grid-cols-2 gap-2 p-3 border border-slate-200 rounded-lg bg-slate-50">
                        {assignableDepts.map(d => (
                          <label key={d.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editManagedDeptIds.includes(String(d.id))}
                              onChange={() => setEditManagedDeptIds(prev => toggleId(prev, String(d.id)))}
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm text-slate-700">{d.name}</span>
                          </label>
                        ))}
                        {assignableDepts.length === 0 && <p className="text-slate-400 text-sm col-span-2">Không có khối</p>}
                      </div>
                    ) : (
                      <p className="text-slate-800">
                        {selectedStaff.managedDepartmentNames?.join(', ') || 'Chưa phân'}
                      </p>
                    )}
                  </div>
                ) : null}

                {/* Phạm vi quản lý vị trí (role = position_manager) */}
                {(showPosScope && isEditing) || (!isEditing && (selectedStaff.managedPositionIds?.length ?? 0) > 0) ? (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                      <Briefcase size={14} /> Quản lý vị trí
                    </label>
                    {isEditing ? (
                      <div className="grid grid-cols-2 gap-2 p-3 border border-slate-200 rounded-lg bg-slate-50">
                        {assignablePositions.map(p => (
                          <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editManagedPosIds.includes(String(p.id))}
                              onChange={() => setEditManagedPosIds(prev => toggleId(prev, String(p.id)))}
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm text-slate-700">{p.name}</span>
                          </label>
                        ))}
                        {assignablePositions.length === 0 && <p className="text-slate-400 text-sm col-span-2">Không có vị trí</p>}
                      </div>
                    ) : (
                      <p className="text-slate-800">
                        {selectedStaff.managedPositionNames?.join(', ') || 'Chưa phân'}
                      </p>
                    )}
                  </div>
                ) : null}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Chi nhánh làm việc</label>
                  {isEditing && isSuperAdmin ? (
                    <select
                      value={editForm.branchId || ''}
                      onChange={e => setEditForm(prev => ({ ...prev, branchId: e.target.value || undefined }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Chưa phân chi nhánh</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-slate-800">{selectedStaff.branchName || 'Chưa phân'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Khối</label>
                  {isEditing ? (
                    <select
                      value={editForm.departmentId || ''}
                      onChange={e => setEditForm(prev => ({ ...prev, departmentId: e.target.value || undefined }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Chưa phân khối</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-slate-800">{selectedStaff.departmentName || 'Chưa phân'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Vị trí</label>
                  {isEditing ? (
                    <select
                      value={editForm.positionId || ''}
                      onChange={e => setEditForm(prev => ({ ...prev, positionId: e.target.value || undefined }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Chưa phân vị trí</option>
                      {positions
                        .filter(p => !editForm.departmentId || !p.departmentId || p.departmentId === editForm.departmentId)
                        .map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                  ) : (
                    <p className="text-slate-800">{selectedStaff.positionName || 'Chưa phân'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ca làm việc</label>
                  {isEditing ? (
                    <select
                      value={editForm.workScheduleType || WorkScheduleType.BOTH_SHIFTS}
                      onChange={e => setEditForm(prev => ({ ...prev, workScheduleType: e.target.value as WorkScheduleType }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={WorkScheduleType.BOTH_SHIFTS}>2 ca (Sáng + Chiều)</option>
                      <option value={WorkScheduleType.MORNING_ONLY}>Chỉ ca sáng</option>
                      <option value={WorkScheduleType.AFTERNOON_ONLY}>Chỉ ca chiều</option>
                    </select>
                  ) : (
                    <p className="text-slate-800">
                      {editForm.workScheduleType === WorkScheduleType.MORNING_ONLY ? 'Chỉ ca sáng' :
                       editForm.workScheduleType === WorkScheduleType.AFTERNOON_ONLY ? 'Chỉ ca chiều' :
                       '2 ca (Sáng + Chiều)'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Địa chỉ làm việc</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.workAddress || ''}
                      onChange={e => setEditForm(prev => ({ ...prev, workAddress: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Địa chỉ nơi làm việc"
                    />
                  ) : (
                    <p className="text-slate-800">{selectedStaff.workAddress || selectedStaff.branchAddress || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Số điện thoại</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editForm.phone || ''}
                      onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-slate-800">{selectedStaff.phone || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ngày sinh</label>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editForm.birthday || ''}
                      onChange={e => setEditForm(prev => ({ ...prev, birthday: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-slate-800">
                      {selectedStaff.birthday 
                        ? new Date(selectedStaff.birthday).toLocaleDateString('vi-VN')
                        : '-'}
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Địa chỉ cá nhân</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.address || ''}
                      onChange={e => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-slate-800">{selectedStaff.address || '-'}</p>
                  )}
                </div>

                {/* Password fields - only show when editing */}
                {isEditing && (
                  <>
                    <div className="md:col-span-2 border-t border-slate-200 pt-4 mt-2">
                      <h4 className="text-sm font-semibold text-slate-700 mb-3">Đổi mật khẩu (tùy chọn)</h4>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu mới</label>
                      <input
                        type="password"
                        value={passwordForm.password}
                        onChange={e => setPasswordForm(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Để trống nếu không đổi mật khẩu"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Xác nhận mật khẩu</label>
                      <input
                        type="password"
                        value={passwordForm.passwordConfirmation}
                        onChange={e => setPasswordForm(prev => ({ ...prev, passwordConfirmation: e.target.value }))}
                        placeholder="Nhập lại mật khẩu mới"
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                          passwordForm.password && passwordForm.passwordConfirmation && passwordForm.password !== passwordForm.passwordConfirmation
                            ? 'border-red-300 focus:ring-red-500'
                            : 'border-slate-200 focus:ring-blue-500'
                        }`}
                      />
                      {passwordForm.password && passwordForm.passwordConfirmation && passwordForm.password !== passwordForm.passwordConfirmation && (
                        <p className="text-red-500 text-xs mt-1">Mật khẩu không khớp</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              {isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    <Save size={18} />
                    {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <Edit size={18} />
                  Chỉnh sửa
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Branch Management Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Building2 size={20} className="text-blue-600" />
                Quản lý chi nhánh
              </h3>
              <button onClick={() => { setShowBranchModal(false); setEditingBranch(null); }} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Add/Edit Branch Form */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-4">
                <h4 className="font-medium text-slate-700">
                  {editingBranch ? 'Sửa chi nhánh' : 'Thêm chi nhánh mới'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Tên chi nhánh *"
                    value={branchForm.name}
                    onChange={e => setBranchForm(prev => ({ ...prev, name: e.target.value }))}
                    className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Địa chỉ *"
                    value={branchForm.address}
                    onChange={e => setBranchForm(prev => ({ ...prev, address: e.target.value }))}
                    className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Mô tả (tùy chọn)"
                  value={branchForm.description}
                  onChange={e => setBranchForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quản lý chi nhánh</label>
                  <select
                    value={branchForm.managerId}
                    onChange={e => setBranchForm(prev => ({ ...prev, managerId: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Không chọn --</option>
                    {branchFormUsers.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.fullName} {user.username && `(@${user.username})`}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Chọn quản lý cho chi nhánh này (có thể để trống)
                  </p>
                </div>
                <div className="flex gap-2">
                  {editingBranch ? (
                    <>
                      <button
                        onClick={() => { 
                          setEditingBranch(null); 
                          setBranchForm({ name: '', address: '', description: '', managerId: '' }); 
                        }}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={handleUpdateBranch}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                      >
                        <Save size={16} />
                        Cập nhật
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleCreateBranch}
                      disabled={!branchForm.name || !branchForm.address}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      <Plus size={16} />
                      Thêm chi nhánh
                    </button>
                  )}
                </div>
              </div>

              {/* Branch List */}
              <div className="space-y-2">
                <h4 className="font-medium text-slate-700">Danh sách chi nhánh ({branches.length})</h4>
                {branches.length === 0 ? (
                  <p className="text-slate-400 text-center py-4">Chưa có chi nhánh nào</p>
                ) : (
                  <div className="space-y-2">
                    {branches.map(branch => (
                      <div key={branch.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
                        <div className="flex-1">
                          <p className="font-medium text-slate-800">{branch.name}</p>
                          <p className="text-sm text-slate-500 flex items-center gap-1">
                            <MapPin size={14} />
                            {branch.address}
                          </p>
                          {branch.description && (
                            <p className="text-sm text-slate-400 mt-1">{branch.description}</p>
                          )}
                          {branch.managerName && (
                            <p className="text-sm text-blue-600 flex items-center gap-1 mt-1">
                              <UserCog size={14} />
                              Quản lý: {branch.managerName} {branch.managerUsername && `(@${branch.managerUsername})`}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              setBranchForManager(branch);
                              setSelectedBranchManagerId(branch.managerId || '');
                              // Load users for manager selection
                              try {
                                const users = await api.getAllStaff();
                                // Set available users in component state if needed
                              } catch (e: any) {
                                alert('Không thể tải danh sách nhân viên');
                              }
                              setShowBranchManagerModal(true);
                            }}
                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg"
                            title="Gán quản lý"
                          >
                            <UserCog size={16} />
                          </button>
                          <button
                            onClick={async () => {
                              setEditingBranch(branch);
                              setBranchForm({ 
                                name: branch.name, 
                                address: branch.address, 
                                description: branch.description || '',
                                managerId: branch.managerId || ''
                              });
                              // Load users for manager selection if not loaded
                              if (branchFormUsers.length === 0) {
                                try {
                                  const users = await api.getAllStaff();
                                  setBranchFormUsers(users.filter(u => u.status !== 'deactive'));
                                } catch (e: any) {
                                  console.error('Error loading users:', e);
                                }
                              }
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteBranch(branch)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Branch Manager Assignment Modal */}
      {showBranchManagerModal && branchForManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">
                Chọn quản lý cho chi nhánh "{branchForManager.name}"
              </h3>
              <button onClick={() => {
                setShowBranchManagerModal(false);
                setBranchForManager(null);
                setSelectedBranchManagerId('');
              }} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Quản lý chi nhánh</label>
                <select
                  value={selectedBranchManagerId}
                  onChange={(e) => setSelectedBranchManagerId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Không chọn --</option>
                  {staff.filter(u => u.status !== 'deactive').map(user => (
                    <option key={user.id} value={user.id}>
                      {user.fullName} {user.username && `(@${user.username})`}
                    </option>
                  ))}
                </select>
                {selectedBranchManagerId && (
                  <p className="mt-2 text-sm text-slate-500">
                    Đang chọn: {staff.find(u => u.id === selectedBranchManagerId)?.fullName}
                  </p>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowBranchManagerModal(false);
                  setBranchForManager(null);
                  setSelectedBranchManagerId('');
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Hủy
              </button>
              <button
                onClick={handleAssignBranchManager}
                disabled={assigningBranchManager}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                <Save size={18} />
                {assigningBranchManager ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={showCreateUserModal}
        onClose={() => setShowCreateUserModal(false)}
        onSuccess={() => {
          loadData();
          setShowCreateUserModal(false);
        }}
        currentUser={currentUser}
      />
    </div>
  );
};

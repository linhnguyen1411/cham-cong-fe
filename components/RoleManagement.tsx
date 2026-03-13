import React, { useEffect, useState } from 'react';
import { Role, Permission, User, UserStatus } from '../types';
import * as api from '../services/api';
import { usePermissions } from '../hooks/usePermissions';
import { Plus, Edit2, Trash2, Shield, CheckSquare, Users, X, Loader2, UserCheck, UserX, ChevronRight } from 'lucide-react';

interface RoleManagementProps {
  user: User;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Quản trị hệ thống',
  branch_admin: 'Admin Chi nhánh',
  department_head: 'Quản lý khối',
  position_manager: 'Quản lý vị trí',
  staff: 'Nhân viên',
};

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  super_admin: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  branch_admin: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  department_head: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  position_manager: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  staff: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' },
};

const RoleManagement: React.FC<RoleManagementProps> = ({ user }) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<{ permissions: Permission[], grouped: Record<string, Permission[]> }>({ permissions: [], grouped: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showUsersPanel, setShowUsersPanel] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({ name: '', description: '' });

  // Users panel state
  const [roleUsers, setRoleUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersRole, setUsersRole] = useState<Role | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [rolesData, permissionsData] = await Promise.all([
        api.getRoles(),
        api.getPermissions()
      ]);
      setRoles(rolesData);
      setPermissions(permissionsData);
    } catch (err: any) {
      setError(err.message || 'Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setFormData({ name: '', description: '' });
    setEditingRole(null);
    setShowForm(true);
  };

  const handleEdit = (role: Role) => {
    setFormData({ name: role.name, description: role.description || '' });
    setEditingRole(role);
    setShowForm(true);
  };

  const handleDelete = async (role: Role) => {
    if (role.isSystem) {
      alert('Không thể xóa role hệ thống');
      return;
    }
    if (!window.confirm(`Bạn có chắc muốn xóa role "${role.name}"?`)) return;
    try {
      await api.deleteRole(role.id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Không thể xóa role');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRole) {
        // System roles: chỉ gửi description
        const payload = editingRole.isSystem
          ? { description: formData.description }
          : formData;
        await api.updateRole(editingRole.id, payload);
      } else {
        await api.createRole(formData);
      }
      setShowForm(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Không thể lưu role');
    }
  };

  const handleAssignPermissions = (role: Role) => {
    setSelectedRole(role);
    setSelectedPermissionIds(new Set(role.permissions?.map(p => p.id) || []));
    setShowPermissionModal(true);
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    try {
      await api.assignPermissionsToRole(selectedRole.id, Array.from(selectedPermissionIds));
      setShowPermissionModal(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Không thể lưu permissions');
    }
  };

  const togglePermission = (permissionId: string) => {
    const newSet = new Set(selectedPermissionIds);
    if (newSet.has(permissionId)) {
      newSet.delete(permissionId);
    } else {
      newSet.add(permissionId);
    }
    setSelectedPermissionIds(newSet);
  };

  const handleViewUsers = async (role: Role) => {
    setUsersRole(role);
    setShowUsersPanel(true);
    setUsersLoading(true);
    try {
      const users = await api.getUsersByRole(role.id);
      setRoleUsers(users);
    } catch {
      setRoleUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  const { isSuperAdmin } = usePermissions(user);

  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Chỉ super admin mới có quyền truy cập trang này.
        </div>
      </div>
    );
  }

  const activeUsers = roleUsers.filter(u => u.status !== UserStatus.DEACTIVE);
  const deactiveUsers = roleUsers.filter(u => u.status === UserStatus.DEACTIVE);

  return (
    <div className="flex gap-6 p-6 h-full min-h-0">
      {/* Main content */}
      <div className={`flex-1 min-w-0 transition-all duration-300 ${showUsersPanel ? 'max-w-[calc(100%-380px)]' : ''}`}>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Shield className="w-6 h-6 text-blue-600" />
              Quản lý Vai trò và Quyền
            </h1>
            <p className="text-gray-500 mt-1">Tạo và phân quyền cho các vai trò trong hệ thống</p>
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            Tạo Role
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader2 size={24} className="animate-spin mr-2" /> Đang tải...
          </div>
        ) : (
          <div className="grid gap-4">
            {roles.map(role => {
              const color = ROLE_COLORS[role.name] || ROLE_COLORS.staff;
              const isActive = usersRole?.id === role.id && showUsersPanel;
              return (
                <div
                  key={role.id}
                  className={`bg-white rounded-xl border-2 p-5 hover:shadow-md transition ${
                    isActive ? 'border-blue-400 shadow-md' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-lg font-bold text-gray-900">
                          {ROLE_LABELS[role.name] || role.name}
                        </h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${color.bg} ${color.text}`}>
                          {role.name}
                        </span>
                        {role.isSystem && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">Hệ thống</span>
                        )}
                      </div>
                      {role.description && (
                        <p className="text-gray-500 text-sm mb-3">{role.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1 text-gray-500">
                          <CheckSquare size={14} />
                          {role.permissionsCount || 0} quyền
                        </span>
                        <button
                          onClick={() => handleViewUsers(role)}
                          className={`flex items-center gap-1 font-medium transition ${
                            isActive
                              ? 'text-blue-600'
                              : 'text-gray-500 hover:text-blue-600'
                          }`}
                        >
                          <Users size={14} />
                          {role.usersCount || 0} người dùng
                          <ChevronRight size={12} className={`transition-transform ${isActive ? 'rotate-90' : ''}`} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      <button
                        onClick={() => handleViewUsers(role)}
                        className={`p-2 rounded-lg transition ${
                          isActive ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'
                        }`}
                        title="Xem người dùng"
                      >
                        <Users size={18} />
                      </button>
                      <button
                        onClick={() => handleAssignPermissions(role)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Phân quyền"
                      >
                        <CheckSquare size={18} />
                      </button>
                      <button
                        onClick={() => handleEdit(role)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                        title={role.isSystem ? 'Sửa mô tả (role hệ thống: không thể đổi tên)' : 'Sửa'}
                      >
                        <Edit2 size={18} />
                      </button>
                      {!role.isSystem && (
                        <button
                          onClick={() => handleDelete(role)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                          title="Xóa"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Users Side Panel */}
      {showUsersPanel && usersRole && (
        <div className="w-[360px] shrink-0 bg-white rounded-xl border-2 border-blue-200 shadow-lg flex flex-col max-h-[calc(100vh-120px)] sticky top-0">
          {/* Panel header */}
          <div className="p-4 border-b flex items-center justify-between bg-blue-50 rounded-t-xl">
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 truncate">
                {ROLE_LABELS[usersRole.name] || usersRole.name}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {usersLoading ? 'Đang tải...' : `${roleUsers.length} người dùng`}
              </p>
            </div>
            <button
              onClick={() => { setShowUsersPanel(false); setUsersRole(null); }}
              className="p-1.5 hover:bg-blue-100 rounded-lg transition shrink-0 ml-2"
            >
              <X size={18} className="text-gray-500" />
            </button>
          </div>

          {/* Panel body */}
          <div className="flex-1 overflow-y-auto p-3">
            {usersLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <Loader2 size={22} className="animate-spin mr-2" />
                Đang tải...
              </div>
            ) : roleUsers.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Users size={36} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Chưa có người dùng nào với vai trò này</p>
              </div>
            ) : (
              <div className="space-y-1">
                {/* Active users */}
                {activeUsers.length > 0 && (
                  <>
                    <div className="flex items-center gap-1.5 px-1 py-2 text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                      <UserCheck size={12} />
                      Đang hoạt động ({activeUsers.length})
                    </div>
                    {activeUsers.map(u => (
                      <UserRow key={u.id} user={u} />
                    ))}
                  </>
                )}
                {/* Deactive users */}
                {deactiveUsers.length > 0 && (
                  <>
                    <div className="flex items-center gap-1.5 px-1 py-2 mt-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-t">
                      <UserX size={12} />
                      Đã nghỉ ({deactiveUsers.length})
                    </div>
                    {deactiveUsers.map(u => (
                      <UserRow key={u.id} user={u} deactive />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Role Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full m-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="text-lg font-bold text-gray-900">
                {editingRole ? 'Sửa Role' : 'Tạo Role Mới'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {editingRole?.isSystem ? (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                  <span className="mt-0.5">⚠️</span>
                  <span>Role hệ thống: chỉ có thể sửa <strong>mô tả</strong>, không thể đổi tên.</span>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên Role</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
                  Hủy
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                  {editingRole ? 'Cập nhật' : 'Tạo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permission Assignment Modal */}
      {showPermissionModal && selectedRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPermissionModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full m-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">
                  Phân quyền: <span className="text-blue-600">{ROLE_LABELS[selectedRole.name] || selectedRole.name}</span>
                </h3>
                <span className="text-sm text-gray-500">{selectedPermissionIds.size} quyền được chọn</span>
              </div>
            </div>
            <div className="p-4 space-y-4">
              {Object.entries(permissions.grouped).map(([resource, perms]) => {
                const allSelected = perms.every(p => selectedPermissionIds.has(p.id));
                return (
                  <div key={resource} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-900 capitalize">{resource}</h4>
                      <button
                        onClick={() => {
                          const newSet = new Set(selectedPermissionIds);
                          if (allSelected) {
                            perms.forEach(p => newSet.delete(p.id));
                          } else {
                            perms.forEach(p => newSet.add(p.id));
                          }
                          setSelectedPermissionIds(newSet);
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {perms.map(perm => (
                        <label key={perm.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedPermissionIds.has(perm.id)}
                            onChange={() => togglePermission(perm.id)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{perm.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-3 pt-4 border-t sticky bottom-0 bg-white pb-1">
                <button type="button" onClick={() => setShowPermissionModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">
                  Hủy
                </button>
                <button onClick={handleSavePermissions} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                  Lưu quyền
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component: một dòng user trong panel
const UserRow: React.FC<{ user: User; deactive?: boolean }> = ({ user, deactive }) => (
  <div className={`flex items-center gap-3 p-2.5 rounded-lg ${deactive ? 'opacity-50' : 'hover:bg-gray-50'}`}>
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 overflow-hidden shrink-0 flex items-center justify-center">
      {user.avatar && !user.avatar.includes('ui-avatars.com') ? (
        <img src={user.avatar} alt={user.fullName} className="w-full h-full object-cover" />
      ) : (
        <span className="text-white text-xs font-bold">
          {user.fullName?.charAt(0)?.toUpperCase() || '?'}
        </span>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 truncate">{user.fullName}</p>
      <p className="text-xs text-gray-400 truncate">@{user.username}</p>
    </div>
    <div className="shrink-0 text-right">
      {user.branchName && (
        <p className="text-xs text-gray-400 truncate max-w-[80px]">{user.branchName}</p>
      )}
      {deactive && (
        <span className="text-xs text-red-400">Đã nghỉ</span>
      )}
    </div>
  </div>
);

export default RoleManagement;

import React, { useEffect, useState } from 'react';
import { Role, Permission, User } from '../types';
import * as api from '../services/api';
import { Plus, Edit2, Trash2, Shield, CheckSquare, Square } from 'lucide-react';

interface RoleManagementProps {
  user: User;
}

const RoleManagement: React.FC<RoleManagementProps> = ({ user }) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<{ permissions: Permission[], grouped: Record<string, Permission[]> }>({ permissions: [], grouped: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

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
    if (!window.confirm(`Bạn có chắc muốn xóa role "${role.name}"?`)) {
      return;
    }
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
        await api.updateRole(editingRole.id, formData);
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

  // Check if user is super admin
  const isSuperAdmin = user.roleName === 'super_admin' || user.role?.toLowerCase() === 'super_admin';

  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Chỉ super admin mới có quyền truy cập trang này.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
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
        <div className="text-center py-8 text-gray-500">Đang tải...</div>
      ) : (
        <div className="grid gap-4">
          {roles.map(role => (
            <div key={role.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold text-gray-900">{role.name}</h3>
                    {role.isSystem && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">Hệ thống</span>
                    )}
                  </div>
                  {role.description && (
                    <p className="text-gray-600 text-sm mb-2">{role.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>{role.permissionsCount || 0} quyền</span>
                    <span>{role.usersCount || 0} người dùng</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAssignPermissions(role)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Phân quyền"
                  >
                    <CheckSquare size={20} />
                  </button>
                  {!role.isSystem && (
                    <>
                      <button
                        onClick={() => handleEdit(role)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                        title="Sửa"
                      >
                        <Edit2 size={20} />
                      </button>
                      <button
                        onClick={() => handleDelete(role)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Xóa"
                      >
                        <Trash2 size={20} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên Role</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  disabled={!!editingRole?.isSystem}
                />
              </div>
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
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
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
            <div className="p-4 border-b sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-900">
                Phân quyền cho Role: {selectedRole.name}
              </h3>
            </div>
            <div className="p-4 space-y-4">
              {Object.entries(permissions.grouped).map(([resource, perms]) => (
                <div key={resource} className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 capitalize">{resource}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {perms.map(perm => (
                      <label
                        key={perm.id}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
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
              ))}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowPermissionModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSavePermissions}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Lưu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleManagement;


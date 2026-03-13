import React, { useState, useEffect } from 'react';
import { Briefcase, Plus, Edit2, Trash2, X, Check, Users, Building2, Layers, UserCog } from 'lucide-react';
import { Position, Branch, Department, PositionLevel, User, UserRole } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { getPositions, createPosition, updatePosition, deletePosition, getBranches, getDepartments, getAllStaff, assignPositionManager, removePositionManager } from '../services/api';

interface Props {
  currentUser: User;
}

const PositionSettings: React.FC<Props> = ({ currentUser }) => {
  const { isSuperAdmin, isBranchAdmin, myBranchId, myBranchName } = usePermissions(currentUser);
  const [positions, setPositions] = useState<Position[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [error, setError] = useState('');
  
  // Filters
  const [filterBranch, setFilterBranch] = useState<string>('');
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    branchId: '',
    departmentId: '',
    managerId: ''
  });
  
  // Manager assignment
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [positionForManager, setPositionForManager] = useState<Position | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [assigningManager, setAssigningManager] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Chỉ reload positions khi filter thay đổi SAU lần mount đầu tiên
  const isFirstRender = React.useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    loadPositions();
  }, [filterBranch, filterDepartment]);

  const loadData = async () => {
    try {
      setLoading(true);
      let branchesData: Branch[] = [];
      let departmentsData: Department[] = [];
      let usersData: User[] = [];

      if (isSuperAdmin) {
        [branchesData, departmentsData, usersData] = await Promise.all([
          getBranches(),
          getDepartments(),
          getAllStaff()
        ]);
      } else if (isBranchAdmin) {
        [departmentsData, usersData] = await Promise.all([
          getDepartments(),
          getAllStaff()
        ]);
        if (myBranchId) {
          departmentsData = departmentsData.filter(d => !d.branchId || d.branchId === myBranchId);
          usersData = usersData.filter(u => !u.branchId || u.branchId === myBranchId);
        }
      } else {
        usersData = await getAllStaff();
      }

      // Load positions cùng lúc với data khác (1 lần duy nhất)
      const positionsData = await getPositions(filterBranch || undefined, filterDepartment || undefined);

      setBranches(branchesData);
      setDepartments(departmentsData);
      setAvailableUsers(usersData.filter(u => u.status !== 'deactive'));
      setPositions(positionsData);
    } catch (err) {
      setError('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const loadPositions = async () => {
    try {
      setLoading(true);
      const data = await getPositions(
        filterBranch || undefined,
        filterDepartment || undefined
      );
      setPositions(data);
    } catch (err) {
      setError('Không thể tải danh sách vị trí');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      if (editingPosition) {
        await updatePosition(editingPosition.id, formData);
      } else {
        // level mặc định (cấp bậc thuộc về user, không phải vị trí)
        await createPosition({ ...formData, level: PositionLevel.STAFF_LEVEL });
      }
      setShowModal(false);
      resetForm();
      loadPositions();
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra');
    }
  };

  const handleEdit = (position: Position) => {
    setEditingPosition(position);
    setFormData({
      name: position.name,
      description: position.description || '',
      branchId: position.branchId || '',
      departmentId: position.departmentId || '',
      managerId: position.managerId || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (position: Position) => {
    if (!confirm(`Xóa vị trí "${position.name}"?`)) return;
    
    try {
      await deletePosition(position.id);
      loadPositions();
    } catch (err: any) {
      setError(err.message || 'Không thể xóa vị trí');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      branchId: isBranchAdmin && !isSuperAdmin ? myBranchId : '',
      departmentId: '',
      managerId: ''
    });
    setEditingPosition(null);
  };
  
  const handleAssignManager = async () => {
    if (!positionForManager) return;
    
    setAssigningManager(true);
    try {
      if (selectedManagerId === '') {
        await removePositionManager(positionForManager.id);
      } else {
        await assignPositionManager(positionForManager.id, selectedManagerId);
      }
      await loadPositions();
      setShowManagerModal(false);
      setPositionForManager(null);
      setSelectedManagerId('');
    } catch (e: any) {
      setError('Lỗi: ' + (e.message || 'Không thể gán quản lý'));
    }
    setAssigningManager(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quản lý Vị trí</h1>
            <p className="text-gray-500 text-sm">Tạo và quản lý vị trí nhân viên theo chi nhánh/phòng ban</p>
          </div>
        </div>
        <button
          onClick={async () => {
            resetForm();
            // Load users if not loaded
            if (availableUsers.length === 0) {
              try {
                const users = await getAllStaff();
                setAvailableUsers(users.filter(u => u.status !== 'deactive'));
              } catch (e) {
                console.error('Error loading users:', e);
              }
            }
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Thêm vị trí
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        {isSuperAdmin && (
          <select
            value={filterBranch}
            onChange={e => setFilterBranch(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Tất cả chi nhánh</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
        {isBranchAdmin && !isSuperAdmin && myBranchName && (
          <span className="px-3 py-2 bg-blue-50 text-blue-700 text-sm rounded-lg border border-blue-200 flex items-center gap-1">
            <Building2 className="w-4 h-4" />
            Chi nhánh: {myBranchName}
          </span>
        )}
        <select
          value={filterDepartment}
          onChange={e => setFilterDepartment(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Tất cả phòng ban</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Positions Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Đang tải...</div>
      ) : positions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Chưa có vị trí nào</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {positions.map(position => (
              <div
                key={position.id}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <Briefcase className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{position.name}</h3>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(position)}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(position)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {position.description && (
                  <p className="text-sm text-gray-500 mb-3">{position.description}</p>
                )}
                
                <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-3">
                  {position.branchName && (
                    <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full">
                      <Building2 className="w-3 h-3" />
                      {position.branchName}
                    </span>
                  )}
                  {position.departmentName && (
                    <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full">
                      <Layers className="w-3 h-3" />
                      {position.departmentName}
                    </span>
                  )}
                  <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full">
                    <Users className="w-3 h-3" />
                    {position.usersCount || 0} người
                  </span>
                  {position.managerName && (
                    <span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                      <UserCog className="w-3 h-3" />
                      QL: {position.managerName}
                    </span>
                  )}
                </div>
                
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={async () => {
                      setPositionForManager(position);
                      setSelectedManagerId(position.managerId || '');
                      setShowManagerModal(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    <UserCog className="w-3 h-3" />
                    {position.managerId ? 'Đổi QL' : 'Chọn QL'}
                  </button>
                </div>
              </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingPosition ? 'Sửa vị trí' : 'Thêm vị trí mới'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên vị trí *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="VD: Nhân viên kinh doanh"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mô tả
                </label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  placeholder="Mô tả công việc..."
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chi nhánh
                  </label>
                  {isSuperAdmin ? (
                    <select
                      value={formData.branchId}
                      onChange={e => setFormData({ ...formData, branchId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Chung --</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 flex items-center justify-between">
                      <span>{myBranchName || '(Chi nhánh của bạn)'}</span>
                      <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded">Tự động</span>
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phòng ban (Khối)
                  </label>
                  <select
                    value={formData.departmentId}
                    onChange={e => setFormData({ ...formData, departmentId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Chung --</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quản lý phòng ban/vị trí
                </label>
                <select
                  value={formData.managerId}
                  onChange={e => setFormData({ ...formData, managerId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Không chọn --</option>
                  {availableUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.fullName} {user.username && `(@${user.username})`}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Chọn quản lý cho vị trí/phòng ban này (có thể để trống)
                </p>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {editingPosition ? 'Cập nhật' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manager Assignment Modal */}
      {showManagerModal && positionForManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">
                Chọn quản lý cho "{positionForManager.name}"
              </h3>
              <button onClick={() => {
                setShowManagerModal(false);
                setPositionForManager(null);
                setSelectedManagerId('');
              }} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Quản lý phòng ban/vị trí</label>
                <select
                  value={selectedManagerId}
                  onChange={(e) => setSelectedManagerId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  setPositionForManager(null);
                  setSelectedManagerId('');
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Hủy
              </button>
              <button
                onClick={handleAssignManager}
                disabled={assigningManager}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {assigningManager ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PositionSettings;


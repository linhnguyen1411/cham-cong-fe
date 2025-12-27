import React, { useState, useEffect } from 'react';
import { Briefcase, Plus, Edit2, Trash2, X, Check, Users, Building2, Layers } from 'lucide-react';
import { Position, Branch, Department, PositionLevel } from '../types';
import { getPositions, createPosition, updatePosition, deletePosition, getBranches, getDepartments } from '../services/api';

const POSITION_LEVELS = [
  { value: PositionLevel.STAFF_LEVEL, label: 'Nhân viên', color: 'bg-gray-500' },
  { value: PositionLevel.TEAM_LEAD, label: 'Trưởng nhóm', color: 'bg-blue-500' },
  { value: PositionLevel.MANAGER, label: 'Trưởng phòng', color: 'bg-purple-500' },
  { value: PositionLevel.DIRECTOR, label: 'Giám đốc', color: 'bg-orange-500' },
  { value: PositionLevel.EXECUTIVE, label: 'Điều hành', color: 'bg-red-500' },
];

const PositionSettings: React.FC = () => {
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
    level: PositionLevel.STAFF_LEVEL
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadPositions();
  }, [filterBranch, filterDepartment]);

  const loadData = async () => {
    try {
      const [branchesData, departmentsData] = await Promise.all([
        getBranches(),
        getDepartments()
      ]);
      setBranches(branchesData);
      setDepartments(departmentsData);
      await loadPositions();
    } catch (err) {
      setError('Không thể tải dữ liệu');
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
        await createPosition(formData);
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
      level: position.level
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
      branchId: '',
      departmentId: '',
      level: PositionLevel.STAFF_LEVEL
    });
    setEditingPosition(null);
  };

  const getLevelInfo = (level: PositionLevel) => {
    return POSITION_LEVELS.find(l => l.value === level) || POSITION_LEVELS[0];
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
          onClick={() => { resetForm(); setShowModal(true); }}
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
          {positions.map(position => {
            const levelInfo = getLevelInfo(position.level);
            return (
              <div
                key={position.id}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 ${levelInfo.color} rounded-lg`}>
                      <Briefcase className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{position.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${levelInfo.color} text-white`}>
                        {levelInfo.label}
                      </span>
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
                
                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
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
                    {position.usersCount} người
                  </span>
                </div>
              </div>
            );
          })}
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
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cấp bậc
                </label>
                <select
                  value={formData.level}
                  onChange={e => setFormData({ ...formData, level: e.target.value as PositionLevel })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  {POSITION_LEVELS.map(level => (
                    <option key={level.value} value={level.value}>{level.label}</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chi nhánh
                  </label>
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
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phòng ban
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
    </div>
  );
};

export default PositionSettings;


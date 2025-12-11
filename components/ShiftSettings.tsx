import React, { useEffect, useState } from 'react';
import { WorkShift, Department } from '../types';
import * as api from '../services/api';
import { Plus, Edit2, Trash2, Clock, X, Layers } from 'lucide-react';

export const ShiftSettings: React.FC = () => {
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [formData, setFormData] = useState({
    name: '',
    startTime: '08:00',
    endTime: '17:00',
    lateThreshold: 30,
    departmentId: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [shiftsData, depsData] = await Promise.all([
      api.getWorkShifts(),
      api.getDepartments()
    ]);
    setShifts(shiftsData);
    setDepartments(depsData);
    setLoading(false);
  };

  const filteredShifts = shifts.filter(s => {
    if (filterDepartment === 'all') return true;
    if (filterDepartment === 'none') return !s.departmentId;
    return s.departmentId === filterDepartment;
  });

  const loadShifts = async () => {
    setLoading(true);
    const data = await api.getWorkShifts();
    setShifts(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.updateWorkShift(editingId, {
          name: formData.name,
          startTime: formData.startTime,
          endTime: formData.endTime,
          lateThreshold: formData.lateThreshold,
          departmentId: formData.departmentId || undefined
        });
      } else {
        await api.createWorkShift({
          name: formData.name,
          startTime: formData.startTime,
          endTime: formData.endTime,
          lateThreshold: formData.lateThreshold,
          departmentId: formData.departmentId || undefined
        });
      }
      resetForm();
      await loadData();
    } catch (error) {
      console.error('Error saving shift:', error);
      alert('Lỗi khi lưu ca làm việc');
    }
  };

  const handleEdit = (shift: WorkShift) => {
    setFormData({
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      lateThreshold: shift.lateThreshold,
      departmentId: shift.departmentId || ''
    });
    setEditingId(shift.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn chắc chắn muốn xóa ca làm việc này?')) {
      try {
        await api.deleteWorkShift(id);
        await loadData();
      } catch (error) {
        console.error('Error deleting shift:', error);
        alert('Lỗi khi xóa ca làm việc');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      startTime: '08:00',
      endTime: '17:00',
      lateThreshold: 30,
      departmentId: ''
    });
    setEditingId(null);
    setShowForm(false);
  };

  const getDepartmentName = (departmentId?: string) => {
    if (!departmentId) return 'Chưa phân khối';
    const dep = departments.find(d => d.id === departmentId);
    return dep?.name || 'Chưa phân khối';
  };

  if (loading) return <div className="p-4 text-center text-slate-500">Đang tải...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center">
            <Clock size={20} className="mr-2 text-blue-500" />
            Cài đặt ca làm việc
          </h3>
          <p className="text-sm text-slate-500 mt-1">Thiết lập thời gian làm việc theo từng khối</p>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={filterDepartment}
            onChange={e => setFilterDepartment(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">Tất cả khối</option>
            <option value="none">Chưa phân khối</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus size={18} />
              Thêm ca
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-slate-800">
              {editingId ? 'Sửa ca làm việc' : 'Thêm ca làm việc mới'}
            </h4>
            <button
              onClick={resetForm}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tên ca làm việc
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ví dụ: Ca sáng, Ca chiều"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Thuộc Khối
                </label>
                <select
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Chưa phân khối</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Giờ bắt đầu
                </label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Giờ kết thúc
                </label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Ngưỡng tính muộn (phút) - Mặc định 30 phút
              </label>
              <input
                type="number"
                value={formData.lateThreshold}
                onChange={(e) => setFormData({ ...formData, lateThreshold: parseInt(e.target.value) || 30 })}
                min="0"
                max="120"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">
                Nếu nhân viên check-in sau {formData.lateThreshold} phút sẽ bị tính muộn
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                {editingId ? 'Cập nhật' : 'Tạo mới'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition font-medium"
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Shifts List */}
      <div className="space-y-3">
        {filteredShifts.length === 0 ? (
          <div className="bg-slate-50 p-6 rounded-lg text-center text-slate-500 border border-slate-200">
            {filterDepartment === 'all' 
              ? 'Chưa có ca làm việc nào. Hãy thêm ca làm việc đầu tiên!'
              : 'Không có ca làm việc nào cho khối này.'}
          </div>
        ) : (
          filteredShifts.map((shift) => (
            <div key={shift.id} className="bg-white p-4 rounded-lg border border-slate-200 flex items-center justify-between hover:shadow-sm transition">
              <div className="flex items-center gap-4 flex-1">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Clock size={20} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-800">{shift.name}</h4>
                    {shift.departmentId && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">
                        <Layers size={12} />
                        {getDepartmentName(shift.departmentId)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600">
                    {shift.startTime} - {shift.endTime} • Muộn sau {shift.lateThreshold}p
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(shift)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  title="Sửa"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleDelete(shift.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Xóa"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

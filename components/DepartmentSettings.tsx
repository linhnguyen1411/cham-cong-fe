import React, { useState, useEffect } from 'react';
import { Department, WorkShift } from '../types';
import * as api from '../services/api';
import { 
  Building, Plus, Edit, Trash2, Save, X, Clock, Users, ChevronRight, ChevronDown
} from 'lucide-react';

export const DepartmentSettings: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [deptShifts, setDeptShifts] = useState<Record<string, WorkShift[]>>({});
  
  // Department form
  const [showForm, setShowForm] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  // Shift form for department
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [editingShift, setEditingShift] = useState<WorkShift | null>(null);
  const [shiftForm, setShiftForm] = useState({ 
    name: '', startTime: '08:00', endTime: '17:00', lateThreshold: 30 
  });
  const [shiftForDept, setShiftForDept] = useState<string | null>(null);

  useEffect(() => {
    loadDepartments();
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
        const updated = await api.updateDepartment(editingDept.id, form);
        setDepartments(prev => prev.map(d => d.id === updated.id ? updated : d));
      } else {
        const created = await api.createDepartment(form);
        setDepartments(prev => [...prev, created]);
      }
      setShowForm(false);
      setEditingDept(null);
      setForm({ name: '', description: '' });
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
          
          <button
            onClick={() => {
              setShowForm(true);
              setEditingDept(null);
              setForm({ name: '', description: '' });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <Plus size={18} />
            Thêm khối mới
          </button>
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
                    {dept.description && (
                      <p className="text-sm text-slate-500">{dept.description}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-4 text-sm text-slate-500">
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
                      onClick={() => {
                        setEditingDept(dept);
                        setForm({ name: dept.name, description: dept.description || '' });
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

              {/* Expanded: Shifts List */}
              {expandedDept === dept.id && (
                <div className="border-t border-slate-100 p-4 bg-slate-50">
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
    </div>
  );
};

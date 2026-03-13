import React, { useState, useEffect } from 'react';
import {
  Building2, Plus, Edit, Trash2, Save, X, UserCog, MapPin,
  Search, Users, ChevronLeft, Loader2, Phone, FileText
} from 'lucide-react';
import { Branch, User } from '../types';
import * as api from '../services/api';

interface Props {
  currentUser: User;
}

const EMPTY_FORM = { name: '', address: '', description: '', managerId: '' };

const BranchManagement: React.FC<Props> = ({ currentUser }) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allStaff, setAllStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Form tạo / chỉnh sửa chi nhánh
  const [showForm, setShowForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Modal gán quản lý
  const [managerModal, setManagerModal] = useState<Branch | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [assigningManager, setAssigningManager] = useState(false);

  // Detail panel
  const [detailBranch, setDetailBranch] = useState<Branch | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [branchData, staffData] = await Promise.all([
        api.getBranches(),
        api.getAllStaff()
      ]);
      setBranches(branchData);
      setAllStaff(staffData.filter(u => u.status !== 'deactive'));
    } catch (e: any) {
      alert('Lỗi tải dữ liệu: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredBranches = branches.filter(b =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openCreate = () => {
    setEditingBranch(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setForm({
      name: branch.name,
      address: branch.address || '',
      description: branch.description || '',
      managerId: branch.managerId || ''
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.address.trim()) {
      alert('Vui lòng nhập tên và địa chỉ chi nhánh');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        address: form.address.trim(),
        description: form.description.trim() || undefined
      };
      if (form.managerId) payload.managerId = form.managerId;

      if (editingBranch) {
        const updated = await api.updateBranch(editingBranch.id, payload);
        setBranches(prev => prev.map(b => b.id === updated.id ? updated : b));
        if (detailBranch?.id === updated.id) setDetailBranch(updated);
      } else {
        const created = await api.createBranch(payload);
        setBranches(prev => [...prev, created]);
      }
      setShowForm(false);
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (branch: Branch) => {
    if (!confirm(`Xoá chi nhánh "${branch.name}"?\n\nThao tác này không thể hoàn tác.`)) return;
    try {
      await api.deleteBranch(branch.id);
      setBranches(prev => prev.filter(b => b.id !== branch.id));
      if (detailBranch?.id === branch.id) setDetailBranch(null);
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  const openManagerModal = (branch: Branch) => {
    setManagerModal(branch);
    setSelectedManagerId(branch.managerId || '');
  };

  const handleAssignManager = async () => {
    if (!managerModal) return;
    setAssigningManager(true);
    try {
      let updated: Branch;
      if (selectedManagerId) {
        updated = await api.assignBranchManager(managerModal.id, selectedManagerId);
      } else {
        updated = await api.removeBranchManager(managerModal.id);
      }
      setBranches(prev => prev.map(b => b.id === updated.id ? updated : b));
      if (detailBranch?.id === updated.id) setDetailBranch(updated);
      setManagerModal(null);
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    } finally {
      setAssigningManager(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Building2 size={24} className="text-blue-600" />
              Quản lý Chi nhánh
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Chi nhánh công ty hoặc công ty thành viên
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={18} />
            Thêm chi nhánh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <div className="text-sm text-blue-600 font-medium">Tổng chi nhánh</div>
            <div className="text-2xl font-bold text-blue-700 mt-1">{branches.length}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 border border-green-100">
            <div className="text-sm text-green-600 font-medium">Có quản lý</div>
            <div className="text-2xl font-bold text-green-700 mt-1">
              {branches.filter(b => b.managerId).length}
            </div>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
            <div className="text-sm text-amber-600 font-medium">Tổng nhân viên</div>
            <div className="text-2xl font-bold text-amber-700 mt-1">
              {branches.reduce((sum, b) => sum + (b.usersCount || 0), 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên, địa chỉ..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Branch List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        ) : filteredBranches.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Building2 size={40} className="mx-auto mb-3 text-slate-300" />
            <p>{searchTerm ? 'Không tìm thấy chi nhánh phù hợp' : 'Chưa có chi nhánh nào'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-0 divide-y md:divide-y-0">
            {filteredBranches.map((branch, idx) => (
              <div
                key={branch.id}
                className={`p-5 hover:bg-slate-50 transition border-b border-slate-100 ${
                  idx % 3 !== 2 ? 'md:border-r' : ''
                }`}
              >
                {/* Branch card */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div
                    className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                    onClick={() => setDetailBranch(branch)}
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Building2 size={20} className="text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{branch.name}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                        <MapPin size={12} />
                        {branch.address || '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openManagerModal(branch)}
                      className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition"
                      title="Gán quản lý"
                    >
                      <UserCog size={16} />
                    </button>
                    <button
                      onClick={() => openEdit(branch)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Chỉnh sửa"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(branch)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="Xoá"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {branch.description && (
                  <p className="text-xs text-slate-500 mb-3 line-clamp-2">{branch.description}</p>
                )}

                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-slate-500">
                    <Users size={13} />
                    {branch.usersCount || 0} nhân viên
                  </span>
                  {branch.managerName ? (
                    <span className="flex items-center gap-1 text-emerald-600 font-medium">
                      <UserCog size={13} />
                      {branch.managerName}
                    </span>
                  ) : (
                    <span className="text-amber-500">Chưa có quản lý</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Building2 size={20} className="text-blue-600" />
                {editingBranch ? 'Chỉnh sửa chi nhánh' : 'Thêm chi nhánh mới'}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tên chi nhánh <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="VD: Chi nhánh Hà Nội, Công ty TNHH ABC..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Địa chỉ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  placeholder="Địa chỉ chi nhánh..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Mô tả về chi nhánh, loại hình hoạt động..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quản lý chi nhánh</label>
                <select
                  value={form.managerId}
                  onChange={e => setForm(p => ({ ...p, managerId: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Chưa chọn —</option>
                  {allStaff.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} (@{u.username})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-5 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                disabled={saving}
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? 'Đang lưu...' : editingBranch ? 'Cập nhật' : 'Tạo chi nhánh'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Manager Modal */}
      {managerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">
                Quản lý: <span className="text-blue-600">{managerModal.name}</span>
              </h3>
              <button onClick={() => setManagerModal(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">Chọn quản lý chi nhánh</label>
              <select
                value={selectedManagerId}
                onChange={e => setSelectedManagerId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Bỏ quản lý —</option>
                {allStaff.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} (@{u.username})
                  </option>
                ))}
              </select>
              {selectedManagerId && (
                <p className="text-sm text-slate-500 mt-2">
                  Đang chọn: <strong>{allStaff.find(u => u.id === selectedManagerId)?.fullName}</strong>
                </p>
              )}
            </div>

            <div className="p-5 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setManagerModal(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                disabled={assigningManager}
              >
                Hủy
              </button>
              <button
                onClick={handleAssignManager}
                disabled={assigningManager}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                <Save size={16} />
                {assigningManager ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branch Detail Panel */}
      {detailBranch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => setDetailBranch(null)} className="p-1 hover:bg-slate-100 rounded">
                  <ChevronLeft size={20} />
                </button>
                <h3 className="text-lg font-bold text-slate-800">{detailBranch.name}</h3>
              </div>
              <button onClick={() => setDetailBranch(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Building2 size={28} className="text-blue-600" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-800">{detailBranch.name}</h4>
                  <p className="text-sm text-slate-500">Chi nhánh / Công ty thành viên</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                  <MapPin size={18} className="text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-0.5">Địa chỉ</p>
                    <p className="text-sm text-slate-800">{detailBranch.address || '—'}</p>
                  </div>
                </div>

                {detailBranch.description && (
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                    <FileText size={18} className="text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-0.5">Mô tả</p>
                      <p className="text-sm text-slate-800">{detailBranch.description}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                  <UserCog size={18} className="text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-0.5">Quản lý</p>
                    {detailBranch.managerName ? (
                      <p className="text-sm text-slate-800 font-medium">
                        {detailBranch.managerName}
                        {detailBranch.managerUsername && (
                          <span className="text-slate-500 font-normal"> (@{detailBranch.managerUsername})</span>
                        )}
                      </p>
                    ) : (
                      <p className="text-sm text-amber-500">Chưa có quản lý</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                  <Users size={18} className="text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-0.5">Số nhân viên</p>
                    <p className="text-sm text-slate-800 font-medium">{detailBranch.usersCount || 0} người</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => { setDetailBranch(null); openEdit(detailBranch); }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Edit size={16} />
                Chỉnh sửa
              </button>
              <button
                onClick={() => { setDetailBranch(null); openManagerModal(detailBranch); }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                <UserCog size={16} />
                Gán quản lý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchManagement;

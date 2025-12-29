import React, { useState, useEffect } from 'react';
import { X, Loader } from 'lucide-react';
import { createUser, getBranches, getDepartments, getPositions } from '../services/api';
import { Branch, Department, Position, WorkScheduleType } from '../types';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    passwordConfirmation: '',
    fullName: '',
    role: 'staff' as 'admin' | 'staff',
    branchId: '',
    departmentId: '',
    positionId: '',
    workScheduleType: WorkScheduleType.BOTH_SHIFTS,
    workAddress: ''
  });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordMismatch, setPasswordMismatch] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [branchesData, departmentsData, positionsData] = await Promise.all([
        getBranches(),
        getDepartments(),
        getPositions()
      ]);
      setBranches(branchesData);
      setDepartments(departmentsData);
      setPositions(positionsData);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(null);

    // Check password mismatch
    if (name === 'passwordConfirmation' || name === 'password') {
      const password = name === 'password' ? value : formData.password;
      const passwordConfirmation = name === 'passwordConfirmation' ? value : formData.passwordConfirmation;
      setPasswordMismatch(password !== passwordConfirmation && passwordConfirmation !== '');
    }

    // Reset position when branch or department changes
    if (name === 'branchId' || name === 'departmentId') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        positionId: '' // Reset position
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.username.trim()) {
      setError('Vui lòng nhập tên đăng nhập');
      return;
    }
    if (!formData.fullName.trim()) {
      setError('Vui lòng nhập tên đầy đủ');
      return;
    }
    if (formData.password.length < 6) {
      setError('Mật khẩu phải tối thiểu 6 ký tự');
      return;
    }
    if (formData.password !== formData.passwordConfirmation) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoading(true);
    try {
      await createUser({
        username: formData.username,
        password: formData.password,
        passwordConfirmation: formData.passwordConfirmation,
        fullName: formData.fullName,
        role: formData.role,
        branchId: formData.branchId || undefined,
        departmentId: formData.departmentId || undefined,
        positionId: formData.positionId || undefined,
        workScheduleType: formData.workScheduleType,
        workAddress: formData.workAddress || undefined
      });
      setFormData({
        username: '',
        password: '',
        passwordConfirmation: '',
        fullName: '',
        role: 'staff',
        branchId: '',
        departmentId: '',
        positionId: '',
        workScheduleType: WorkScheduleType.BOTH_SHIFTS,
        workAddress: ''
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tạo người dùng');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b flex-shrink-0">
          <h2 className="text-xl font-semibold">Tạo Người Dùng Mới</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên Đăng Nhập
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="vd: john.doe"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên Đầy Đủ
            </label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleInputChange}
              placeholder="vd: Nguyễn Văn A"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mật Khẩu
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Tối thiểu 6 ký tự"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Xác Nhận Mật Khẩu
            </label>
            <input
              type="password"
              name="passwordConfirmation"
              value={formData.passwordConfirmation}
              onChange={handleInputChange}
              placeholder="Nhập lại mật khẩu"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                passwordMismatch ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
              }`}
              disabled={loading}
            />
            {passwordMismatch && (
              <p className="text-red-500 text-sm mt-1">Mật khẩu không khớp</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vai Trò
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="staff">Nhân Viên</option>
              <option value="admin">Quản Trị Viên</option>
            </select>
          </div>

          {formData.role === 'staff' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Chi Nhánh
                </label>
                <select
                  name="branchId"
                  value={formData.branchId}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading || loadingData}
                >
                  <option value="">-- Chọn chi nhánh --</option>
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Khối/Phòng Ban
                </label>
                <select
                  name="departmentId"
                  value={formData.departmentId}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading || loadingData}
                >
                  <option value="">-- Chọn khối/phòng ban --</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vị Trí
                </label>
                <select
                  name="positionId"
                  value={formData.positionId}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading || loadingData}
                >
                  <option value="">-- Chọn vị trí --</option>
                  {positions
                    .filter(pos => 
                      (!formData.branchId || pos.branchId === formData.branchId) &&
                      (!formData.departmentId || pos.departmentId === formData.departmentId)
                    )
                    .map(position => (
                      <option key={position.id} value={position.id}>{position.name}</option>
                    ))}
                </select>
                {formData.branchId && formData.departmentId && positions.filter(pos => 
                  pos.branchId === formData.branchId && pos.departmentId === formData.departmentId
                ).length === 0 && (
                  <p className="text-amber-600 text-sm mt-1">Không có vị trí nào cho chi nhánh và khối đã chọn</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Loại Lịch Làm Việc
                </label>
                <select
                  name="workScheduleType"
                  value={formData.workScheduleType}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  <option value={WorkScheduleType.BOTH_SHIFTS}>Cả ca sáng và ca chiều</option>
                  <option value={WorkScheduleType.MORNING_ONLY}>Chỉ ca sáng</option>
                  <option value={WorkScheduleType.AFTERNOON_ONLY}>Chỉ ca chiều</option>
                </select>
                <p className="text-gray-500 text-xs mt-1">
                  Lịch làm việc sẽ được tạo tự động cho tuần hiện tại dựa trên loại lịch này
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Địa Chỉ Làm Việc
                </label>
                <input
                  type="text"
                  name="workAddress"
                  value={formData.workAddress}
                  onChange={handleInputChange}
                  placeholder="vd: 123 Đường ABC, Quận XYZ"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50"
              disabled={loading}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              disabled={loading || passwordMismatch}
            >
              {loading && <Loader size={18} className="animate-spin" />}
              {loading ? 'Đang Tạo...' : 'Tạo Người Dùng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

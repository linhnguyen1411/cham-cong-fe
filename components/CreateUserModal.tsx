import React, { useState } from 'react';
import { X, Loader } from 'lucide-react';
import { createUser } from '../services/api';

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
    role: 'staff' as 'admin' | 'staff'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordMismatch, setPasswordMismatch] = useState(false);

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
      await createUser(formData);
      setFormData({
        username: '',
        password: '',
        passwordConfirmation: '',
        fullName: '',
        role: 'staff'
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
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">Tạo Người Dùng Mới</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

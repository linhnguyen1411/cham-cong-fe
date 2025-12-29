import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Plus, X, AlertCircle } from 'lucide-react';
import { AppSetting } from '../types';
import * as api from '../services/api';

interface Props {
  user: any;
}

export const Settings: React.FC<Props> = ({ user }) => {
  const [settings, setSettings] = useState<AppSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newIp, setNewIp] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await api.getSettings();
      setSettings(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải cài đặt');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const updated = await api.updateSettings(settings);
      setSettings(updated); // Cập nhật lại state với dữ liệu từ server
      setSuccess('Đã lưu cài đặt thành công');
    } catch (err: any) {
      const errorMessage = err.message || (err.errors && err.errors.join(', ')) || 'Không thể lưu cài đặt';
      setError(errorMessage);
      console.error('Error saving settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddIp = () => {
    if (!newIp.trim() || !settings) return;

    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(newIp.trim())) {
      setError('Địa chỉ IP không hợp lệ');
      return;
    }

    if (settings.allowedIps.includes(newIp.trim())) {
      setError('Địa chỉ IP đã tồn tại');
      return;
    }

    setSettings({
      ...settings,
      allowedIps: [...settings.allowedIps, newIp.trim()]
    });
    setNewIp('');
    setError('');
  };

  const handleRemoveIp = (ip: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      allowedIps: settings.allowedIps.filter(i => i !== ip)
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-slate-500">Đang tải...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-red-500">Không thể tải cài đặt</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <SettingsIcon className="text-blue-600" size={24} />
          <h2 className="text-xl font-bold text-slate-800">Cài đặt hệ thống</h2>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        <div className="space-y-6">
          {/* IP Whitelist */}
          <div>
            <label className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={settings.requireIpCheck}
                onChange={(e) => setSettings({ ...settings, requireIpCheck: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="font-medium text-slate-700">Yêu cầu kiểm tra IP khi chấm công</span>
            </label>
            <p className="text-sm text-slate-500 mb-4">
              Chỉ cho phép checkin/checkout từ các địa chỉ IP được phép
            </p>

            {settings.requireIpCheck && (
              <div className="mt-4">
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newIp}
                    onChange={(e) => setNewIp(e.target.value)}
                    placeholder="Nhập địa chỉ IP (ví dụ: 192.168.1.1)"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddIp()}
                  />
                  <button
                    onClick={handleAddIp}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Thêm
                  </button>
                </div>

                {settings.allowedIps.length > 0 ? (
                  <div className="space-y-2">
                    {settings.allowedIps.map((ip) => (
                      <div
                        key={ip}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                      >
                        <span className="font-mono text-slate-700">{ip}</span>
                        <button
                          onClick={() => handleRemoveIp(ip)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-lg text-slate-500 text-sm">
                    Chưa có địa chỉ IP nào được phép
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save size={16} />
              {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


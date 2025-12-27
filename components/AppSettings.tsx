import React, { useEffect, useState } from 'react';
import * as api from '../services/api';
import { Save, Settings, AlertCircle, Info } from 'lucide-react';

interface AppSettingsData {
  company_name?: string;
  require_ip_check?: boolean;
  allowed_ips?: string[];
  max_user_off_days_per_week?: number;
  max_user_off_shifts_per_week?: number;
  max_shift_off_count_per_day?: number;
}

export const AppSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AppSettingsData>({
    max_user_off_days_per_week: 1,
    max_user_off_shifts_per_week: 2,
    max_shift_off_count_per_day: 1
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getAppSettings();
      setSettings(data);
    } catch (error) {
      console.error('Error loading settings:', error);
      alert('Lỗi khi tải cài đặt');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateAppSettings(settings);
      alert('Đã lưu cài đặt thành công');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      alert('Lỗi khi lưu cài đặt: ' + (error.message || 'Unknown error'));
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-800">Cài đặt hệ thống</h1>
        </div>
      </div>

      {/* Settings Form */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-blue-600" />
          Giới hạn đăng ký ca
        </h2>

        <div className="space-y-6">
          {/* Max user off days per week */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Số ngày off tối đa/tuần (nhân viên ca sáng/chiều)
            </label>
            <input
              type="number"
              min="1"
              max="7"
              value={settings.max_user_off_days_per_week || 1}
              onChange={(e) => setSettings({ ...settings, max_user_off_days_per_week: parseInt(e.target.value) || 1 })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              Số ngày tối đa mà nhân viên làm ca sáng hoặc ca chiều có thể xin off trong 1 tuần
            </p>
          </div>

          {/* Max user off shifts per week */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Số ca off tối đa/tuần (nhân viên làm cả ngày)
            </label>
            <input
              type="number"
              min="1"
              max="14"
              value={settings.max_user_off_shifts_per_week || 2}
              onChange={(e) => setSettings({ ...settings, max_user_off_shifts_per_week: parseInt(e.target.value) || 2 })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              Số ca tối đa mà nhân viên làm cả ngày (2 ca) có thể xin off trong 1 tuần
            </p>
          </div>

          {/* Max shift off count per day */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Số người off tối đa/ca/ngày/vị trí
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={settings.max_shift_off_count_per_day || 1}
              onChange={(e) => setSettings({ ...settings, max_shift_off_count_per_day: parseInt(e.target.value) || 1 })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-slate-500 text-xs flex items-start gap-2 mt-2">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <span>
                Số người tối đa cùng vị trí có thể xin off cho cùng 1 ca trong 1 ngày. 
                Ví dụ: Nếu set = 1, thì mỗi ca/ngày/vị trí chỉ cho phép 1 người off.
              </span>
            </p>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t border-slate-200">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


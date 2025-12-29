import React, { useState, useEffect } from 'react';
import { FileText, Send, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { ForgotCheckinRequest } from '../types';
import * as api from '../services/api';

interface Props {
  user: any;
}

export const ForgotCheckinRequestForm: React.FC<Props> = ({ user }) => {
  const [requestDate, setRequestDate] = useState('');
  const [requestType, setRequestType] = useState<'checkin' | 'checkout'>('checkin');
  const [requestHour, setRequestHour] = useState('08');
  const [requestMinute, setRequestMinute] = useState('00');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [myRequests, setMyRequests] = useState<ForgotCheckinRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Generate hour options (0-23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  
  // Generate minute options (0-59, every minute)
  const minuteOptions = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  // Combine hour and minute to create requestTime
  const requestTime = `${requestHour}:${requestMinute}`;

  useEffect(() => {
    loadMyRequests();
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    setRequestDate(today);
  }, []);

  const loadMyRequests = async () => {
    try {
      setLoading(true);
      const data = await api.getMyForgotCheckinRequests();
      setMyRequests(data);
    } catch (err: any) {
      console.error('Error loading requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!requestDate || !requestTime || !reason.trim()) {
      setError('Vui lòng điền đầy đủ thông tin');
      return;
    }

    try {
      setSubmitting(true);
      await api.createForgotCheckinRequest({
        requestDate,
        requestType,
        requestTime,
        reason: reason.trim()
      });
      setSuccess('Đã gửi yêu cầu thành công');
      setReason('');
      loadMyRequests();
    } catch (err: any) {
      setError(err.message || 'Không thể gửi yêu cầu');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Đã duyệt</span>;
      case 'rejected':
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">Từ chối</span>;
      default:
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">Chờ duyệt</span>;
    }
  };

  const currentMonthCount = myRequests.filter(r => {
    const requestDate = new Date(r.requestDate);
    const now = new Date();
    return requestDate.getMonth() === now.getMonth() && requestDate.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="text-blue-600" size={24} />
          <h2 className="text-xl font-bold text-slate-800">Xin quên checkin/checkout</h2>
        </div>

        {currentMonthCount >= 3 && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle size={16} />
            <span>Bạn đã đạt giới hạn 3 lần xin quên checkin/checkout trong tháng này</span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
            <CheckCircle size={16} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Ngày quên checkin/checkout
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="date"
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                required
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Loại yêu cầu
            </label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as 'checkin' | 'checkout')}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="checkin">Quên checkin</option>
              <option value="checkout">Quên checkout</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Giờ {requestType === 'checkin' ? 'checkin' : 'checkout'} thực tế
            </label>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">Giờ</label>
                <select
                  value={requestHour}
                  onChange={(e) => setRequestHour(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {hourOptions.map((hour) => (
                    <option key={hour} value={hour}>
                      {hour}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">Phút</label>
                <select
                  value={requestMinute}
                  onChange={(e) => setRequestMinute(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {minuteOptions.map((minute) => (
                    <option key={minute} value={minute}>
                      {minute}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Đã chọn: {requestTime}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Lý do
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              required
              placeholder="Vui lòng giải thích lý do quên checkin/checkout..."
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={submitting || currentMonthCount >= 3}
              className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Send size={16} />
              {submitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
            </button>
          </div>
        </form>
      </div>

      {/* My Requests */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Yêu cầu của tôi</h3>
        {loading ? (
          <div className="text-slate-500 text-center py-4">Đang tải...</div>
        ) : myRequests.length === 0 ? (
          <div className="text-slate-500 text-center py-4">Chưa có yêu cầu nào</div>
        ) : (
          <div className="space-y-3">
            {myRequests.map((req) => (
              <div key={req.id} className="p-4 border border-slate-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-medium text-slate-700">
                      {req.requestType === 'checkin' ? 'Quên checkin' : 'Quên checkout'}
                    </span>
                    <span className="text-slate-500 ml-2">
                      - {new Date(req.requestDate).toLocaleDateString('vi-VN')}
                      {req.requestTime && ` lúc ${req.requestTime}`}
                    </span>
                  </div>
                  {getStatusBadge(req.status)}
                </div>
                <p className="text-sm text-slate-600 mb-2">{req.reason}</p>
                {req.rejectedReason && (
                  <p className="text-sm text-red-600">Lý do từ chối: {req.rejectedReason}</p>
                )}
                {req.approvedByName && (
                  <p className="text-xs text-slate-500">
                    Duyệt bởi: {req.approvedByName} - {req.approvedAt ? new Date(req.approvedAt).toLocaleString('vi-VN') : ''}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};


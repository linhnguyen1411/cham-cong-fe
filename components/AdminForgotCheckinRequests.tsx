import React, { useState, useEffect } from 'react';
import { FileCheck, Check, X, AlertCircle, Clock } from 'lucide-react';
import { ForgotCheckinRequest, User } from '../types';
import * as api from '../services/api';

interface Props {
  user: User;
}

export const AdminForgotCheckinRequests: React.FC<Props> = ({ user }) => {
  const [requests, setRequests] = useState<ForgotCheckinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    loadRequests();
  }, [filter]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      let data: ForgotCheckinRequest[];
      if (filter === 'pending') {
        data = await api.getPendingForgotCheckinRequests();
      } else {
        data = await api.getForgotCheckinRequests();
      }
      setRequests(data);
    } catch (err: any) {
      console.error('Error loading requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn duyệt yêu cầu này?')) return;

    try {
      await api.approveForgotCheckinRequest(id);
      loadRequests();
    } catch (err: any) {
      alert(err.message || 'Không thể duyệt yêu cầu');
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Nhập lý do từ chối:');
    if (!reason) return;

    try {
      await api.rejectForgotCheckinRequest(id, reason);
      loadRequests();
    } catch (err: any) {
      alert(err.message || 'Không thể từ chối yêu cầu');
    }
  };

  const filteredRequests = filter === 'all' 
    ? requests 
    : requests.filter(r => r.status === filter);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <Check size={12} />
            Đã duyệt
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <X size={12} />
            Từ chối
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock size={12} />
            Chờ duyệt
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileCheck className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold text-slate-800">Duyệt yêu cầu quên checkin/checkout</h2>
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="pending">Chờ duyệt</option>
            <option value="all">Tất cả</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Từ chối</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-8 text-slate-500">Đang tải...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-8 text-slate-500">Không có yêu cầu nào</div>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((req) => (
              <div key={req.id} className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-medium text-slate-800">{req.userName || 'Unknown'}</span>
                      {getStatusBadge(req.status)}
                    </div>
                    <div className="text-sm text-slate-600 mb-2">
                      <span className="font-medium">
                        {req.requestType === 'checkin' ? 'Quên checkin' : 'Quên checkout'}
                      </span>
                      {' - '}
                      <span>{new Date(req.requestDate).toLocaleDateString('vi-VN')}</span>
                      {req.requestTime && (
                        <span className="ml-2 font-mono">
                          lúc {req.requestTime}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-700 mb-2">{req.reason}</p>
                    {req.rejectedReason && (
                      <p className="text-sm text-red-600 mb-2">
                        <strong>Lý do từ chối:</strong> {req.rejectedReason}
                      </p>
                    )}
                    {req.approvedByName && (
                      <p className="text-xs text-slate-500">
                        Duyệt bởi: {req.approvedByName} - {req.approvedAt ? new Date(req.approvedAt).toLocaleString('vi-VN') : ''}
                      </p>
                    )}
                  </div>
                  {req.status === 'pending' && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleApprove(req.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                      >
                        <Check size={16} />
                        Duyệt
                      </button>
                      <button
                        onClick={() => handleReject(req.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                      >
                        <X size={16} />
                        Từ chối
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};


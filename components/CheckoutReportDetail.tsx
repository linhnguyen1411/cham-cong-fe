import React from 'react';
import { WorkSession } from '../types';
import { X, FileText, AlertCircle, Lightbulb, MessageSquare } from 'lucide-react';

interface CheckoutReportDetailProps {
  session: WorkSession;
  isOpen: boolean;
  onClose: () => void;
}

export const CheckoutReportDetail: React.FC<CheckoutReportDetailProps> = ({ session, isOpen, onClose }) => {
  if (!isOpen) return null;

  const formatTime = (timestamp: number | undefined) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}p`;
  };

  const hasReport = session.workSummary || session.challenges || session.suggestions || session.notes;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-slate-800 to-slate-900 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Chi tiết báo cáo ca làm việc</h2>
            <p className="text-slate-300 text-sm mt-1">Ngày {session.dateStr}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Time Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Check-in</p>
              <p className="text-lg font-bold text-slate-800">{formatTime(session.startTime)}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">Check-out</p>
              <p className="text-lg font-bold text-slate-800">{formatTime(session.endTime)}</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-1">Tổng thời gian</p>
              <p className="text-lg font-bold text-slate-800">{formatDuration(session.duration)}</p>
            </div>
            <div className={`p-4 rounded-lg border ${session.isOnTime ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${session.isOnTime ? 'text-emerald-600' : 'text-orange-600'}`}>
                Trạng thái
              </p>
              <p className={`text-lg font-bold ${session.isOnTime ? 'text-emerald-800' : 'text-orange-800'}`}>
                {session.isOnTime ? '✓ Đúng giờ' : `⚠ Muộn ${session.minutesLate}p`}
              </p>
            </div>
          </div>

          {/* Report Section */}
          <div className="border-t border-slate-200 pt-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
              <FileText size={20} className="text-slate-600" />
              Báo cáo công việc
            </h3>

            {hasReport ? (
              <div className="space-y-4">
                {/* Work Summary */}
                {session.workSummary && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">1</div>
                      Công việc hôm nay
                    </label>
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 text-slate-700 whitespace-pre-wrap">
                      {session.workSummary}
                    </div>
                  </div>
                )}

                {/* Challenges */}
                {session.challenges && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold">2</div>
                      Khó khăn gặp phải
                    </label>
                    <div className="p-4 bg-orange-50 rounded-lg border border-orange-200 text-slate-700 whitespace-pre-wrap">
                      {session.challenges}
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                {session.suggestions && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">3</div>
                      Đề xuất cải tiến
                    </label>
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-slate-700 whitespace-pre-wrap">
                      {session.suggestions}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {session.notes && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">4</div>
                      Ghi chú thêm
                    </label>
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200 text-slate-700 whitespace-pre-wrap">
                      {session.notes}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 bg-slate-50 rounded-lg text-center border border-slate-200">
                <FileText size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-slate-500">Chưa có báo cáo cho ca làm việc này</p>
              </div>
            )}
          </div>

          {/* Close Button */}
          <div className="flex justify-end pt-4 border-t border-slate-200">
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-lg bg-slate-200 text-slate-700 font-semibold hover:bg-slate-300 transition"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

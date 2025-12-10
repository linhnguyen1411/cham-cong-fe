
import React, { useState, useEffect } from 'react';
import { User, WorkSession } from '../types';
import * as api from '../services/api';
import { Play, Square, AlertCircle, Coffee, RefreshCw } from 'lucide-react';
import { CheckoutModal, CheckoutData } from './CheckoutModal';

interface TimeTrackerProps {
  user: User;
}

export const TimeTracker: React.FC<TimeTrackerProps> = ({ user }) => {
  const [currentSession, setCurrentSession] = useState<WorkSession | undefined>(undefined);
  const [elapsed, setElapsed] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [submittingCheckout, setSubmittingCheckout] = useState(false);

  const fetchActiveSession = async () => {
    setError(null);
    try {
        const active = await api.getCurrentSession(user.id);
        setCurrentSession(active);
    } catch (e: any) {
        setError(e.message || "Không thể tải trạng thái làm việc.");
    }
  };

  useEffect(() => {
    fetchActiveSession();
  }, [user.id]);

  useEffect(() => {
    let interval: any;
    if (currentSession && !currentSession.endTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const diff = Math.floor((now - currentSession.startTime) / 1000);
        setElapsed(diff);
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(interval);
  }, [currentSession]);

  const handleCheckIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await api.checkIn(user.id);
      setCurrentSession(session);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setLoading(false);
    setError(null);
    // Chỉ hiện modal, không call API ngay
    setShowCheckoutModal(true);
  };

  const handleCheckoutModalSubmit = async (checkoutData: CheckoutData) => {
    setSubmittingCheckout(true);
    setError(null);
    try {
      // Bây giờ mới call API checkout + save report
      await api.saveCheckoutReport(user.id, checkoutData);
      setCurrentSession(undefined);
      // Close modal on success
      setShowCheckoutModal(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingCheckout(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const todayStr = new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Xin chào, {user.username}!</h2>
        <p className="text-slate-500 text-lg">{todayStr}</p>
      </div>

      <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-md text-center border border-slate-100">
        
        {/* Timer Display */}
        <div className="mb-10">
          <div className={`text-6xl font-mono font-bold tracking-wider mb-2 ${currentSession ? 'text-blue-600' : 'text-slate-300'}`}>
            {currentSession ? formatTime(elapsed) : '00:00:00'}
          </div>
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">
            {currentSession ? 'Đang trong ca làm việc' : 'Chưa bắt đầu ca làm'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center items-center gap-6">
          {!currentSession ? (
            <button
              onClick={handleCheckIn}
              disabled={loading}
              className="group relative flex flex-col items-center justify-center w-32 h-32 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-green-200 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={32} className="mb-1 fill-current" />
              <span className="font-semibold">Check In</span>
              {loading && <div className="absolute inset-0 rounded-full border-4 border-white border-t-transparent animate-spin"></div>}
            </button>
          ) : (
            <button
              onClick={handleCheckOut}
              disabled={loading}
              className="group relative flex flex-col items-center justify-center w-32 h-32 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-red-200 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Square size={32} className="mb-1 fill-current" />
              <span className="font-semibold">Check Out</span>
              {loading && <div className="absolute inset-0 rounded-full border-4 border-white border-t-transparent animate-spin"></div>}
            </button>
          )}
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-lg flex flex-col items-center justify-center text-sm border border-red-100">
            <div className="flex items-center mb-2">
                <AlertCircle size={16} className="mr-2" />
                <span className="font-semibold">Lỗi kết nối</span>
            </div>
            <p className="text-center">{error}</p>
            {error.includes("Server") && (
                 <button 
                    onClick={fetchActiveSession}
                    className="mt-2 flex items-center text-xs bg-white border border-red-200 px-3 py-1 rounded-full hover:bg-red-50"
                 >
                    <RefreshCw size={12} className="mr-1"/> Thử lại
                 </button>
            )}
          </div>
        )}
      </div>

      {!currentSession && (
        <div className="mt-12 flex items-center text-slate-400">
          <Coffee className="mr-2" />
          <span className="italic">Hãy tận hưởng thời gian nghỉ ngơi!</span>
        </div>
      )}

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        onSubmit={handleCheckoutModalSubmit}
        isLoading={submittingCheckout}
      />
    </div>
  );
};

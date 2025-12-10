
import React, { useState } from 'react';
import { User, Lock, CheckSquare, Square, Wifi } from 'lucide-react';
import { BASE_URL } from '../services/api';

interface LoginProps {
  onLogin: (u: string, p: string, remember: boolean) => Promise<void>;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('staff');
  const [password, setPassword] = useState('123456');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await onLogin(username, password, rememberMe);
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in relative">
        
        <div className="p-8 text-center bg-slate-50 border-b border-slate-100">
          <h1 className="text-2xl font-bold text-blue-600 mb-2">TimeKeep Pro</h1>
          <p className="text-slate-500 text-sm">Đăng nhập hệ thống chấm công</p>
        </div>
        
        {/* Connection Info (Subtle) */}
        <div className="px-4 py-2 bg-slate-100 text-slate-400 text-[10px] flex justify-center items-center font-mono">
             <Wifi size={10} className="mr-1"/> Connecting to: {BASE_URL}
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 whitespace-pre-line break-words">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-3 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Tên đăng nhập"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                required
              />
            </div>
            
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-slate-400" size={20} />
              <input
                type="password"
                placeholder="Mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                required
              />
            </div>

            <div 
              className="flex items-center text-sm text-slate-600 cursor-pointer select-none"
              onClick={() => setRememberMe(!rememberMe)}
            >
              {rememberMe ? (
                <CheckSquare size={18} className="text-blue-600 mr-2" />
              ) : (
                <Square size={18} className="text-slate-400 mr-2" />
              )}
              Ghi nhớ đăng nhập
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full font-semibold py-3 rounded-xl shadow-lg transition-all hover:translate-y-[-1px] disabled:opacity-70 bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200"
          >
            {loading ? 'Đang kết nối...' : 'Đăng Nhập'}
          </button>
        </form>
      </div>
    </div>
  );
};

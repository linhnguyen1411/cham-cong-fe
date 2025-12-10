
import { User, WorkSession, AuthResponse, UserRole, WorkShift } from '../types';

const STORAGE_KEYS = {
  CURRENT_USER: 'timekeep_user'
};

// CẤU HÌNH URL API
// Ưu tiên:
// 1. window.API_BASE_URL (set từ server qua config.js)
// 2. process.env.REACT_APP_API_URL (environment variable)
// 3. Default localhost:3000
const getBaseUrl = () => {
  if (typeof window !== 'undefined' && (window as any).API_BASE_URL) {
    return (window as any).API_BASE_URL;
  }
  return (process.env.REACT_APP_API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
};

export const BASE_URL = getBaseUrl();
// If BASE_URL is just '/api', that's the Nginx proxy endpoint
// Otherwise append '/api/v1' for direct connection
const API_URL = BASE_URL === '/api' ? `${BASE_URL}/v1` : `${BASE_URL}/api/v1`;

// --- HELPERS ---

const getStoredAuth = (): AuthResponse | null => {
  try {
    const local = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (local) return JSON.parse(local);
    
    const session = sessionStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (session) return JSON.parse(session);
  } catch (error) {
    console.error("Error parsing stored auth:", error);
    return null;
  }
  return null;
};

const getHeaders = (): HeadersInit => {
  const auth = getStoredAuth();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // 'Accept': 'application/json' // Thường trình duyệt tự gửi, bỏ bớt để header gọn nhẹ
  };

  // Chỉ thêm header đặc biệt nếu dùng Ngrok để tránh preflight CORS phức tạp ở localhost thường
  if (BASE_URL.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = 'true'; 
  }

  if (auth && auth.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }

  return headers;
};

const handleResponse = async (response: Response) => {
    if (response.status === 401) {
        logout();
        throw new Error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
    }

    // Read response body ONCE into text first
    let responseText = '';
    try {
        responseText = await response.text();
    } catch (e) {
        throw new Error("Không thể đọc response từ server");
    }

    if (!response.ok) {
        let errorMessage = `Lỗi ${response.status}`;
        
        // Try to parse as JSON first
        try {
            const errData = JSON.parse(responseText);
            errorMessage = errData.message || errData.error || JSON.stringify(errData);
        } catch (e) {
            // Not JSON - check if it's HTML
            if (responseText.includes("<!DOCTYPE html>")) {
                errorMessage = `Lỗi Server (Trả về HTML thay vì JSON). Kiểm tra lại URL API: ${API_URL}`;
            } else {
                errorMessage = responseText || response.statusText;
            }
        }
        throw new Error(errorMessage);
    }

    // Parse JSON from the text we already read
    try {
        return responseText ? JSON.parse(responseText) : {};
    } catch (e) {
        console.error("JSON parse error:", e, "Response text:", responseText);
        throw new Error("Dữ liệu trả về không phải JSON hợp lệ.");
    }
};

const fetchAPI = async (endpoint: string, options: RequestInit = {}) => {
    const fullUrl = `${API_URL}${endpoint}`;
    
    try {
        const response = await fetch(fullUrl, {
            ...options,
            mode: 'cors', // Chế độ chuẩn
            headers: {
                ...getHeaders(),
                ...options.headers,
            }
        });
        return handleResponse(response);
    } catch (error: any) {
        console.error("Fetch Error:", error);
        
        if (error.message === 'Failed to fetch') {
             // Phân tích nguyên nhân phổ biến
             const isHttps = window.location.protocol === 'https:';
             const isHttp = fullUrl.startsWith('http://');
             
             let hint = `🔴 KHÔNG THỂ KẾT NỐI SERVER (${BASE_URL})\n`;
             
             if (isHttps && isHttp) {
                 hint += `⚠️ Nguyên nhân: Web đang chạy HTTPS nhưng gọi API HTTP (Mixed Content).`;
             } else {
                 hint += `1. Backend Rails chưa chạy (rails s)?\n` +
                         `2. Cấu hình CORS bên Rails chưa đúng?\n` +
                         `3. URL API bị sai?`;
             }
             throw new Error(hint);
        }
        throw error;
    }
};

// --- DATA MAPPERS ---

const mapUserFromApi = (data: any): User => ({
  id: String(data.id || data.user_id),
  username: data.username,
  fullName: data.full_name || data.fullName || data.username,
  role: (data.role && String(data.role).toLowerCase() === 'admin') ? UserRole.ADMIN : UserRole.STAFF,
  avatar: data.avatar || `https://ui-avatars.com/api/?name=${data.username}&background=random`
});

const mapSessionFromApi = (data: any): WorkSession => {
  if (!data || (!data.id && !data.start_time)) throw new Error("Invalid session data structure");
  
  const startTimeVal = data.start_time || data.startTime;
  const endTimeVal = data.end_time || data.endTime;
  const startTime = new Date(startTimeVal).getTime();
  const endTime = endTimeVal ? new Date(endTimeVal).getTime() : null;
  
  // Handle duration: nếu có duration_minutes từ Rails, convert thành giây
  let duration = 0;
  if (data.duration_minutes !== undefined && data.duration_minutes !== null) {
    duration = data.duration_minutes * 60; // Convert minutes to seconds
  } else if (data.duration) {
    duration = data.duration;
  } else if (endTime) {
    duration = Math.floor((endTime - startTime) / 1000);
  }
  
  const mapped = {
    id: String(data.id),
    userId: String(data.user_id || data.userId),
    startTime: startTime,
    endTime: endTime,
    duration: duration,
    dateStr: data.date_str || data.dateStr || new Date(startTime).toISOString().split('T')[0],
    workShiftId: data.work_shift_id ? String(data.work_shift_id) : undefined,
    isOnTime: data.is_on_time,
    minutesLate: data.minutes_late || 0,
    isEarlyCheckout: data.is_early_checkout || false,
    minutesBeforeEnd: data.minutes_before_end || 0,
    // Map checkout report fields
    workSummary: data.work_summary || undefined,
    challenges: data.challenges || undefined,
    suggestions: data.suggestions || undefined,
    notes: data.notes || undefined
  };
  
  return mapped;
};

// --- API IMPLEMENTATION ---

export const login = async (username: string, password: string, remember: boolean): Promise<AuthResponse> => {
    const data = await fetchAPI('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    });
    
    const userObj = data.user || data;
    const tokenStr = data.token || 'no-token';

    const authData: AuthResponse = {
        user: mapUserFromApi(userObj), 
        token: tokenStr
    };
    
    if (remember) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(authData));
        sessionStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    } else {
        sessionStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(authData));
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
    
    return authData;
};

export const logout = () => {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  sessionStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
};

export const getCurrentUser = (): AuthResponse | null => {
  return getStoredAuth();
};

export const getUsers = async (): Promise<User[]> => {
    try {
        const data = await fetchAPI('/users');
        const result = Array.isArray(data) ? data.map(mapUserFromApi) : (data?.users ? data.users.map(mapUserFromApi) : []);
        return result;
    } catch (e) {
        console.error("Get users failed:", e);
        return [];
    }
};

export const createUser = async (userData: {
    username: string;
    password: string;
    passwordConfirmation: string;
    fullName: string;
    role: 'admin' | 'staff';
}): Promise<User> => {
    const data = await fetchAPI('/users', {
        method: 'POST',
        body: JSON.stringify({
            user: {
                username: userData.username,
                password: userData.password,
                password_confirmation: userData.passwordConfirmation,
                full_name: userData.fullName,
                role: userData.role
            }
        })
    });
    return mapUserFromApi(data);
};

export const checkIn = async (userId: string): Promise<WorkSession> => {
    const data = await fetchAPI('/work_sessions', {
        method: 'POST',
        body: JSON.stringify({ work_session: { user_id: userId } })
    });
    return mapSessionFromApi(data);
};

export const checkOut = async (userId: string): Promise<WorkSession> => {
    const activeSession = await getCurrentSession(userId);
    if (!activeSession) throw new Error('Không tìm thấy ca làm việc đang hoạt động.');
    
    const data = await fetchAPI(`/work_sessions/${activeSession.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ work_session: {} }) 
    });
    
    return mapSessionFromApi(data);
};

export const saveCheckoutReport = async (userId: string, reportData: {
  workSummary: string;
  challenges: string;
  suggestions: string;
  notes: string;
}): Promise<any> => {
    const activeSession = await getCurrentSession(userId);
    if (!activeSession) throw new Error('Không tìm thấy ca làm việc.');
    
    const data = await fetchAPI(`/work_sessions/${activeSession.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
            work_session: {
                work_summary: reportData.workSummary,
                challenges: reportData.challenges,
                suggestions: reportData.suggestions,
                notes: reportData.notes
            }
        })
    });
    
    return data;
};

export const getCurrentSession = async (userId: string): Promise<WorkSession | undefined> => {
    try {
        const data = await fetchAPI(`/work_sessions/active?user_id=${userId}`);
        if (!data || Object.keys(data).length === 0) return undefined;
        return mapSessionFromApi(data);
    } catch (e: any) {
        if (e.message && (e.message.includes('404') || e.message.includes('null'))) {
            return undefined;
        }
        console.warn("Check active session failed:", e);
        return undefined;
    }
};

export const getUserHistory = async (userId: string): Promise<WorkSession[]> => {
    const data = await fetchAPI(`/work_sessions?user_id=${userId}`);
    return Array.isArray(data) ? data.map(mapSessionFromApi) : [];
};

export const getAllHistory = async (): Promise<WorkSession[]> => {
    const data = await fetchAPI('/work_sessions');
    const result = Array.isArray(data) ? data.map(mapSessionFromApi) : [];
    return result;
};

// --- WORK SHIFT MANAGEMENT (ADMIN) ---

const mapShiftFromApi = (data: any): WorkShift => ({
  id: String(data.id),
  name: data.name || 'Shift',
  startTime: data.start_time || data.startTime || '08:00',
  endTime: data.end_time || data.endTime || '17:00',
  lateThreshold: data.late_threshold || data.lateThreshold || 30,
  createdAt: data.created_at || data.createdAt
});

export const getWorkShifts = async (): Promise<WorkShift[]> => {
    try {
        const data = await fetchAPI('/work_shifts');
        const result = Array.isArray(data) ? data.map(mapShiftFromApi) : (data?.shifts ? data.shifts.map(mapShiftFromApi) : []);
        return result;
    } catch (e) {
        console.error("Get work shifts failed:", e);
        return [];
    }
};

export const createWorkShift = async (shift: Omit<WorkShift, 'id' | 'createdAt'>): Promise<WorkShift> => {
    const data = await fetchAPI('/work_shifts', {
        method: 'POST',
        body: JSON.stringify({ 
            work_shift: {
                name: shift.name,
                start_time: shift.startTime,
                end_time: shift.endTime,
                late_threshold: shift.lateThreshold
            }
        })
    });
    return mapShiftFromApi(data);
};

export const updateWorkShift = async (id: string, shift: Omit<WorkShift, 'id' | 'createdAt'>): Promise<WorkShift> => {
    const data = await fetchAPI(`/work_shifts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ 
            work_shift: {
                name: shift.name,
                start_time: shift.startTime,
                end_time: shift.endTime,
                late_threshold: shift.lateThreshold
            }
        })
    });
    return mapShiftFromApi(data);
};

export const deleteWorkShift = async (id: string): Promise<void> => {
    await fetchAPI(`/work_shifts/${id}`, {
        method: 'DELETE'
    });
};

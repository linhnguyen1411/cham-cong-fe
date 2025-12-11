
import { User, WorkSession, AuthResponse, UserRole, WorkShift, Branch, Department } from '../types';

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
  avatar: data.avatar_url || data.avatar || `https://ui-avatars.com/api/?name=${data.username}&background=random`,
  branchId: data.branch_id ? String(data.branch_id) : undefined,
  branchName: data.branch_name || undefined,
  branchAddress: data.branch_address || undefined,
  departmentId: data.department_id ? String(data.department_id) : undefined,
  departmentName: data.department_name || undefined,
  workAddress: data.work_address || undefined,
  address: data.address || undefined,
  phone: data.phone || undefined,
  birthday: data.birthday || undefined
});

const mapBranchFromApi = (data: any): Branch => ({
  id: String(data.id),
  name: data.name,
  address: data.address,
  description: data.description || undefined,
  usersCount: data.users_count || 0
});

const mapDepartmentFromApi = (data: any): Department => ({
  id: String(data.id),
  name: data.name,
  description: data.description || undefined,
  usersCount: data.users_count || 0,
  shiftsCount: data.shifts_count || 0
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
    userName: data.user_name || data.userName || undefined,
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

export const updateStoredUser = (updatedUser: Partial<User>) => {
  const auth = getStoredAuth();
  if (auth) {
    const newAuth = {
      ...auth,
      user: { ...auth.user, ...updatedUser }
    };
    // Update both storages
    if (localStorage.getItem(STORAGE_KEYS.CURRENT_USER)) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newAuth));
    }
    if (sessionStorage.getItem(STORAGE_KEYS.CURRENT_USER)) {
      sessionStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newAuth));
    }
  }
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
  departmentId: data.department_id ? String(data.department_id) : undefined,
  departmentName: data.department_name || undefined,
  createdAt: data.created_at || data.createdAt
});

export const getWorkShifts = async (departmentId?: string): Promise<WorkShift[]> => {
    try {
        const url = departmentId ? `/work_shifts?department_id=${departmentId}` : '/work_shifts';
        const data = await fetchAPI(url);
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
                late_threshold: shift.lateThreshold,
                department_id: shift.departmentId ? Number(shift.departmentId) : null
            }
        })
    });
    return mapShiftFromApi(data);
};

export const updateWorkShift = async (id: string, shift: Partial<WorkShift>): Promise<WorkShift> => {
    const data = await fetchAPI(`/work_shifts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ 
            work_shift: {
                name: shift.name,
                start_time: shift.startTime,
                end_time: shift.endTime,
                late_threshold: shift.lateThreshold,
                department_id: shift.departmentId ? Number(shift.departmentId) : null
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

// --- PROFILE API ---

export interface ProfileData {
  fullName: string;
  address?: string;
  phone?: string;
  birthday?: string;
}

export interface UserProfile extends ProfileData {
  id: string;
  username: string;
  role: UserRole;
  avatarUrl?: string;
}

export const getUserProfile = async (userId: string): Promise<UserProfile> => {
  const data = await fetchAPI(`/users/${userId}`);
  return {
    id: String(data.id),
    username: data.username,
    fullName: data.full_name || '',
    role: data.role === 'admin' ? UserRole.ADMIN : UserRole.STAFF,
    address: data.address || '',
    phone: data.phone || '',
    birthday: data.birthday || '',
    avatarUrl: data.avatar_url || ''
  };
};

export const updateProfile = async (userId: string, profile: ProfileData): Promise<UserProfile> => {
  const data = await fetchAPI(`/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      user: {
        full_name: profile.fullName,
        address: profile.address,
        phone: profile.phone,
        birthday: profile.birthday
      }
    })
  });
  return {
    id: String(data.id),
    username: data.username,
    fullName: data.full_name || '',
    role: data.role === 'admin' ? UserRole.ADMIN : UserRole.STAFF,
    address: data.address || '',
    phone: data.phone || '',
    birthday: data.birthday || '',
    avatarUrl: data.avatar_url || ''
  };
};

export const updatePassword = async (userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> => {
  return await fetchAPI(`/users/${userId}/update_password`, {
    method: 'PATCH',
    body: JSON.stringify({
      current_password: currentPassword,
      password: newPassword
    })
  });
};

export const uploadAvatar = async (userId: string, file: File): Promise<{ avatar_url: string }> => {
  const formData = new FormData();
  formData.append('avatar', file);

  const auth = getStoredAuth();
  const headers: Record<string, string> = {};
  if (auth?.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }

  const response = await fetch(`${API_URL}/users/${userId}/update_avatar`, {
    method: 'POST',
    headers,
    body: formData
  });


  const text = await response.text();
  
  if (!response.ok) {
    // Try to parse as JSON, otherwise use text as error
    try {
      const error = JSON.parse(text);
      throw new Error(error.error || 'Upload failed');
    } catch {
      throw new Error(text.includes('<html') ? 'Server error - vui lòng thử lại' : text);
    }
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid response from server');
  }
};

// --- BRANCH MANAGEMENT (ADMIN) ---

export const getBranches = async (): Promise<Branch[]> => {
  try {
    const data = await fetchAPI('/branches');
    return Array.isArray(data) ? data.map(mapBranchFromApi) : [];
  } catch (e) {
    console.error("Get branches failed:", e);
    return [];
  }
};

export const getBranch = async (id: string): Promise<Branch | null> => {
  try {
    const data = await fetchAPI(`/branches/${id}`);
    return mapBranchFromApi(data);
  } catch (e) {
    console.error("Get branch failed:", e);
    return null;
  }
};

export const createBranch = async (branch: Omit<Branch, 'id' | 'usersCount'>): Promise<Branch> => {
  const data = await fetchAPI('/branches', {
    method: 'POST',
    body: JSON.stringify({
      branch: {
        name: branch.name,
        address: branch.address,
        description: branch.description
      }
    })
  });
  return mapBranchFromApi(data);
};

export const updateBranch = async (id: string, branch: Partial<Branch>): Promise<Branch> => {
  const data = await fetchAPI(`/branches/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      branch: {
        name: branch.name,
        address: branch.address,
        description: branch.description
      }
    })
  });
  return mapBranchFromApi(data);
};

export const deleteBranch = async (id: string): Promise<void> => {
  await fetchAPI(`/branches/${id}`, { method: 'DELETE' });
};

// --- STAFF MANAGEMENT (ADMIN) ---

export const getAllStaff = async (): Promise<User[]> => {
  try {
    const data = await fetchAPI('/users');
    return Array.isArray(data) ? data.map(mapUserFromApi) : [];
  } catch (e) {
    console.error("Get all staff failed:", e);
    return [];
  }
};

export const getStaffById = async (id: string): Promise<User | null> => {
  try {
    const data = await fetchAPI(`/users/${id}`);
    return mapUserFromApi(data);
  } catch (e) {
    console.error("Get staff failed:", e);
    return null;
  }
};

export const updateStaff = async (id: string, userData: Partial<User>): Promise<User> => {
  const data = await fetchAPI(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      user: {
        full_name: userData.fullName,
        role: userData.role?.toLowerCase(),
        branch_id: userData.branchId ? Number(userData.branchId) : null,
        department_id: userData.departmentId ? Number(userData.departmentId) : null,
        work_address: userData.workAddress,
        address: userData.address,
        phone: userData.phone,
        birthday: userData.birthday
      }
    })
  });
  return mapUserFromApi(data);
};

// --- DEPARTMENT MANAGEMENT (ADMIN) ---

export const getDepartments = async (): Promise<Department[]> => {
  try {
    const data = await fetchAPI('/departments');
    return Array.isArray(data) ? data.map(mapDepartmentFromApi) : [];
  } catch (e) {
    console.error("Get departments failed:", e);
    return [];
  }
};

export const getDepartment = async (id: string): Promise<Department | null> => {
  try {
    const data = await fetchAPI(`/departments/${id}`);
    return mapDepartmentFromApi(data);
  } catch (e) {
    console.error("Get department failed:", e);
    return null;
  }
};

export const createDepartment = async (department: Omit<Department, 'id' | 'usersCount' | 'shiftsCount'>): Promise<Department> => {
  const data = await fetchAPI('/departments', {
    method: 'POST',
    body: JSON.stringify({
      department: {
        name: department.name,
        description: department.description
      }
    })
  });
  return mapDepartmentFromApi(data);
};

export const updateDepartment = async (id: string, department: Partial<Department>): Promise<Department> => {
  const data = await fetchAPI(`/departments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      department: {
        name: department.name,
        description: department.description
      }
    })
  });
  return mapDepartmentFromApi(data);
};

export const deleteDepartment = async (id: string): Promise<void> => {
  await fetchAPI(`/departments/${id}`, { method: 'DELETE' });
};

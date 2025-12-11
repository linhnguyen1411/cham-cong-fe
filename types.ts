export enum UserRole {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF'
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  description?: string;
  usersCount?: number;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  usersCount?: number;
  shiftsCount?: number;
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  avatar?: string;
  branchId?: string;
  branchName?: string;
  branchAddress?: string;
  departmentId?: string;
  departmentName?: string;
  workAddress?: string;
  address?: string;
  phone?: string;
  birthday?: string;
}

export interface WorkSession {
  id: string;
  userId: string;
  userName?: string;
  startTime: number; // timestamp
  endTime: number | null; // timestamp, null if currently active
  duration: number; // in seconds, 0 if active
  dateStr: string; // ISO date string YYYY-MM-DD for grouping
  workShiftId?: string;
  isOnTime?: boolean;
  minutesLate?: number;
  isEarlyCheckout?: boolean;
  minutesBeforeEnd?: number;
  workSummary?: string;
  challenges?: string;
  suggestions?: string;
  notes?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export enum FilterType {
  ALL = 'ALL',
  TODAY = 'TODAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH'
}

export interface WorkShift {
  id: string;
  name: string; // e.g., "Ca sáng", "Ca chiều"
  startTime: string; // HH:mm format, e.g., "08:00"
  endTime: string; // HH:mm format, e.g., "17:00"
  lateThreshold: number; // minutes after start time to consider as "late", default 30
  departmentId?: string;
  departmentName?: string;
  createdAt?: string;
}
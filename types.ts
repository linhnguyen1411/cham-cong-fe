export enum UserRole {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF'
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  avatar?: string;
}

export interface WorkSession {
  id: string;
  userId: string;
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
  createdAt?: string;
}
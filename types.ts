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

export interface Position {
  id: string;
  name: string;
  description?: string;
  branchId?: string;
  branchName?: string;
  departmentId?: string;
  departmentName?: string;
  level: PositionLevel;
  usersCount?: number;
}

export enum PositionLevel {
  STAFF_LEVEL = 'staff_level',
  TEAM_LEAD = 'team_lead',
  MANAGER = 'manager',
  DIRECTOR = 'director',
  EXECUTIVE = 'executive'
}

export interface ShiftRegistration {
  id: string;
  userId: string;
  userName?: string;
  workShiftId: string;
  shiftName?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  workDate: string;
  weekStart: string;
  status: ShiftRegistrationStatus;
  statusText?: string;
  note?: string;
  adminNote?: string;
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  createdAt?: string;
}

export enum ShiftRegistrationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export enum WorkScheduleType {
  BOTH_SHIFTS = 'both_shifts',
  MORNING_ONLY = 'morning_only',
  AFTERNOON_ONLY = 'afternoon_only'
}

export enum UserStatus {
  ACTIVE = 'active',
  DEACTIVE = 'deactive'
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  avatar?: string;
  status?: UserStatus;
  branchId?: string;
  branchName?: string;
  branchAddress?: string;
  departmentId?: string;
  departmentName?: string;
  positionId?: string;
  positionName?: string;
  positionLevel?: PositionLevel;
  workAddress?: string;
  address?: string;
  phone?: string;
  birthday?: string;
  workScheduleType?: WorkScheduleType;
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
  shiftName?: string;
  shiftRegistrationId?: string;
  isOnTime?: boolean;
  minutesLate?: number;
  isEarlyCheckout?: boolean;
  minutesBeforeEnd?: number;
  forgotCheckout?: boolean;
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

export interface AppSetting {
  id?: string;
  companyName: string;
  requireIpCheck: boolean;
  allowedIps: string[];
  maxUserOffDaysPerWeek?: number;
  maxUserOffShiftsPerWeek?: number;
  maxShiftOffCountPerDay?: number;
}

export interface ForgotCheckinRequest {
  id: string;
  userId: string;
  userName?: string;
  requestDate: string; // YYYY-MM-DD
  requestType: 'checkin' | 'checkout';
  requestTime?: string; // HH:mm format
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedReason?: string;
  createdAt?: string;
  updatedAt?: string;
}
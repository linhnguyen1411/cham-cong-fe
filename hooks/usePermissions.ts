import { User, UserRole } from '../types';

export interface Permissions {
  isSuperAdmin: boolean;
  isBranchAdmin: boolean;
  isDepartmentHead: boolean;
  isPositionManagerRole: boolean;
  isAdmin: boolean;           // super_admin OR branch_admin
  canManageTeam: boolean;     // any management role with team access
  managesDepts: boolean;      // has managed department assignments
  managesPositions: boolean;  // has managed position assignments
  myBranchId: string;
  myBranchName: string;
  can: (resource: string, action: string) => boolean;
}

/**
 * Single source of truth for all role and permission checks.
 * Replaces scattered inline role derivation across components.
 */
export function usePermissions(user: User): Permissions {
  const roleName = user.roleName?.toLowerCase() ?? '';

  const isSuperAdmin = user.isSuperAdmin === true || roleName === 'super_admin';
  const isBranchAdmin = user.isBranchAdmin === true || roleName === 'branch_admin';
  const isDepartmentHead = user.isDepartmentHead === true || roleName === 'department_head';
  const isPositionManagerRole = user.isPositionManagerRole === true || roleName === 'position_manager';
  const isAdmin = isSuperAdmin || isBranchAdmin || user.role === UserRole.ADMIN;
  const canManageTeam = user.canManageTeam === true;
  const managesDepts = !!(user.managedDepartmentIds?.length);
  const managesPositions = !!(user.managedPositionIds?.length);

  // Branch context for non-super admins
  const myBranchId = user.managedBranchIds?.[0] || user.branchId || '';
  const myBranchName = user.managedBranchNames?.[0] || user.branchName || '';

  /**
   * RBAC permission check — mirrors backend has_permission?
   * Super admin always returns true.
   * Others rely on the `permissions` array returned by the API.
   */
  const can = (resource: string, action: string): boolean => {
    if (isSuperAdmin) return true;
    return user.permissions?.includes(`${resource}:${action}`) ?? false;
  };

  return {
    isSuperAdmin,
    isBranchAdmin,
    isDepartmentHead,
    isPositionManagerRole,
    isAdmin,
    canManageTeam,
    managesDepts,
    managesPositions,
    myBranchId,
    myBranchName,
    can,
  };
}

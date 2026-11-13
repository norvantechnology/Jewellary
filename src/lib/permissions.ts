export type UserRole = "CUSTOMER" | "STAFF" | "ADMIN";

export type Permission =
  | "account:own"
  | "admin:dashboard"
  | "catalog:write"
  | "catalog:delete"
  | "inventory:adjust"
  | "orders:read"
  | "orders:update_status"
  | "orders:refund"
  | "orders:cancel_paid"
  | "customers:read"
  | "customers:read_full_pii"
  | "customers:change_role"
  | "customers:export"
  | "content:manage"
  | "enquiries:manage"
  | "customization:manage"
  | "chat:manage"
  | "settings:manage"
  | "audit:read"
  | "exports:operational";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  CUSTOMER: 0,
  STAFF: 1,
  ADMIN: 2,
};

export const PERMISSION_MATRIX: Record<Permission, readonly UserRole[]> = {
  "account:own": ["CUSTOMER", "STAFF", "ADMIN"],
  "admin:dashboard": ["STAFF", "ADMIN"],
  "catalog:write": ["STAFF", "ADMIN"],
  "catalog:delete": ["ADMIN"],
  "inventory:adjust": ["STAFF", "ADMIN"],
  "orders:read": ["STAFF", "ADMIN"],
  "orders:update_status": ["STAFF", "ADMIN"],
  "orders:refund": ["ADMIN"],
  "orders:cancel_paid": ["ADMIN"],
  "customers:read": ["STAFF", "ADMIN"],
  "customers:read_full_pii": ["ADMIN"],
  "customers:change_role": ["ADMIN"],
  "customers:export": ["ADMIN"],
  "content:manage": ["STAFF", "ADMIN"],
  "enquiries:manage": ["STAFF", "ADMIN"],
  "customization:manage": ["STAFF", "ADMIN"],
  "chat:manage": ["STAFF", "ADMIN"],
  "settings:manage": ["ADMIN"],
  "audit:read": ["ADMIN"],
  "exports:operational": ["STAFF", "ADMIN"],
};

/**
 * Checks whether a role is granted a specific capability per §7 Roles & Permissions.
 */
export function hasPermission(role: UserRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return PERMISSION_MATRIX[permission].includes(role);
}

/**
 * Checks whether a role satisfies a minimum role tier (CUSTOMER < STAFF < ADMIN).
 */
export function roleAtLeast(role: UserRole | null | undefined, minimumRole: UserRole): boolean {
  if (!role) return false;
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minimumRole];
}

/**
 * Ovasyt permission catalogue.
 *
 * Roles remain in place as permission *bundles* — the defaults below mirror the
 * `default_role_permission()` database function exactly. Effective access is
 * always: Super User => everything, else per-user override, else role default.
 * The database is the source of truth; this module powers the UI only.
 */

export type PermissionKey = string;

export interface PermissionDef {
  key: PermissionKey;
  label: string;
  /** Approval-style capability — configured alongside approval limits. */
  approval?: boolean;
}

export interface PermissionGroup {
  id: string;
  label: string;
  permissions: PermissionDef[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "requisitions",
    label: "Requisitions",
    permissions: [
      { key: "requisitions.view", label: "View requisitions" },
      { key: "requisitions.create", label: "Create requisitions" },
      { key: "requisitions.edit", label: "Edit requisitions" },
      { key: "requisitions.submit", label: "Submit requisitions" },
      { key: "requisitions.approve", label: "Approve requisitions", approval: true },
      { key: "requisitions.decline", label: "Decline requisitions", approval: true },
    ],
  },
  {
    id: "transactions",
    label: "Transactions",
    permissions: [
      { key: "transactions.view", label: "View transactions" },
      { key: "transactions.create", label: "Create transactions" },
      { key: "transactions.edit", label: "Edit transactions" },
      { key: "transactions.approve", label: "Approve transactions", approval: true },
      { key: "transactions.decline", label: "Decline transactions", approval: true },
    ],
  },
  {
    id: "expenses",
    label: "Expenses",
    permissions: [
      { key: "expenses.view", label: "View expenses" },
      { key: "expenses.create", label: "Create expenses" },
      { key: "expenses.edit", label: "Edit expenses" },
      { key: "expenses.delete", label: "Delete expenses" },
    ],
  },
  {
    id: "invoices",
    label: "Invoices",
    permissions: [
      { key: "invoices.view", label: "View invoices" },
      { key: "invoices.upload", label: "Upload invoices" },
      { key: "invoices.edit", label: "Edit invoices" },
      { key: "invoices.verify", label: "Verify invoices" },
    ],
  },
  {
    id: "suppliers",
    label: "Suppliers",
    permissions: [
      { key: "suppliers.view", label: "View suppliers" },
      { key: "suppliers.create", label: "Create suppliers" },
      { key: "suppliers.edit", label: "Edit suppliers" },
      { key: "suppliers.manage", label: "Manage supplier information" },
    ],
  },
  {
    id: "projects",
    label: "Projects",
    permissions: [
      { key: "projects.view", label: "View projects" },
      { key: "projects.create", label: "Create projects" },
      { key: "projects.edit", label: "Edit projects" },
    ],
  },
  {
    id: "donors",
    label: "Donors",
    permissions: [
      { key: "donors.view", label: "View donors" },
      { key: "donors.create", label: "Create donors" },
      { key: "donors.edit", label: "Edit donors" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    permissions: [
      { key: "reports.view", label: "View reports" },
      { key: "reports.export", label: "Export reports" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    permissions: [
      { key: "finance.view", label: "View financial information" },
      { key: "finance.manage", label: "Manage financial workflows" },
      { key: "finance.process", label: "Process financial actions" },
    ],
  },
  {
    id: "users",
    label: "Users & Permissions",
    permissions: [
      { key: "users.view", label: "View users" },
      { key: "users.invite", label: "Invite users" },
      { key: "users.edit", label: "Edit users" },
      { key: "users.manage_permissions", label: "Manage permissions" },
    ],
  },
];

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key),
);

export type AppRoleName = "EMPLOYEE" | "HOD" | "FINANCE" | "ADMIN" | "SUPPLIER";

/** Visible name of a role — ADMIN is presented as Super User. */
export const ROLE_LABELS: Record<AppRoleName, string> = {
  ADMIN: "Super User",
  FINANCE: "Finance Manager",
  HOD: "Head of Department",
  EMPLOYEE: "Team Member",
  SUPPLIER: "Supplier",
};

const FINANCE_DENIED = new Set([
  "users.invite",
  "users.edit",
  "users.manage_permissions",
]);

const HOD_ALLOWED = new Set([
  "requisitions.view", "requisitions.create", "requisitions.edit", "requisitions.submit",
  "requisitions.approve", "requisitions.decline",
  "transactions.view", "expenses.view", "expenses.create",
  "invoices.view", "invoices.upload",
  "suppliers.view", "projects.view", "donors.view",
  "reports.view", "reports.export", "users.view",
]);

const EMPLOYEE_ALLOWED = new Set([
  "requisitions.view", "requisitions.create", "requisitions.edit", "requisitions.submit",
  "expenses.view", "expenses.create", "invoices.view", "invoices.upload",
  "suppliers.view", "projects.view", "donors.view",
]);

const SUPPLIER_ALLOWED = new Set(["invoices.view", "invoices.upload", "suppliers.view"]);

/** Mirrors public.default_role_permission() in the database. */
export function defaultRolePermission(role: AppRoleName, key: PermissionKey): boolean {
  switch (role) {
    case "ADMIN":
      return true;
    case "FINANCE":
      return !FINANCE_DENIED.has(key);
    case "HOD":
      return HOD_ALLOWED.has(key);
    case "EMPLOYEE":
      return EMPLOYEE_ALLOWED.has(key);
    case "SUPPLIER":
      return SUPPLIER_ALLOWED.has(key);
    default:
      return false;
  }
}

/** Effective permission for a role plus per-user overrides. */
export function effectivePermission(
  role: AppRoleName | null,
  overrides: Record<string, boolean>,
  key: PermissionKey,
): boolean {
  if (role === "ADMIN") return true;
  if (key in overrides) return overrides[key];
  if (!role) return false;
  return defaultRolePermission(role, key);
}

export const APPROVAL_TYPES = [
  { key: "REQUISITION", label: "Requisition approval" },
  { key: "TRANSACTION", label: "Transaction approval" },
  { key: "REIMBURSEMENT", label: "Reimbursement approval" },
] as const;

export type ApprovalType = (typeof APPROVAL_TYPES)[number]["key"];

export interface ApprovalLimit {
  approval_type: string;
  max_amount: number | null;
  currency: string;
  unlimited: boolean;
}

/**
 * Can this user approve the amount?
 * Super Users are unrestricted, and an unconfigured/unlimited limit allows any amount.
 * Mirrors public.can_approve_amount().
 */
export function withinApprovalLimit(
  role: AppRoleName | null,
  limit: ApprovalLimit | undefined | null,
  amount: number,
): boolean {
  if (role === "ADMIN") return true;
  if (!limit) return true;
  if (limit.unlimited) return true;
  if (limit.max_amount === null || limit.max_amount === undefined) return true;
  return (amount || 0) <= limit.max_amount;
}

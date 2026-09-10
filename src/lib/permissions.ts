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
  /** Plain-language explanation shown under the toggle. */
  hint?: string;
  /** Approval-style capability — configured alongside approval limits. */
  approval?: boolean;
  /** Flags a permission that weakens separation of duties. */
  sensitive?: boolean;
}

export interface PermissionGroup {
  id: string;
  label: string;
  /** Short note shown on the right of the group heading. */
  note?: string;
  permissions: PermissionDef[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "requisitions",
    label: "Requisitions & capture",
    permissions: [
      { key: "requisitions.view", label: "View requisitions", hint: "See requests raised in their area" },
      { key: "requisitions.create", label: "Capture & submit requisitions", hint: "Raise a purchase request with quotes" },
      { key: "requisitions.submit", label: "Submit for approval", hint: "Send a captured request into the approval flow" },
      { key: "requisitions.edit", label: "Edit others' draft requisitions", hint: "Amend requests before they are submitted" },
      { key: "requisitions.decline", label: "Decline requisitions", hint: "Send a request back as declined", approval: true },
    ],
  },
  {
    id: "approvals",
    label: "Approvals",
    note: "the core control",
    permissions: [
      { key: "requisitions.approve", label: "Approve requisitions", hint: "Sign off spending within the limits below", approval: true },
      { key: "transactions.approve", label: "Approve transactions", hint: "Finalise a recorded transaction", approval: true },
      { key: "transactions.decline", label: "Decline transactions", hint: "Reject a transaction before it is recorded", approval: true },
    ],
  },
  {
    id: "transactions",
    label: "Transactions & expenses",
    permissions: [
      { key: "transactions.view", label: "View transactions", hint: "See recorded organisation spend" },
      { key: "transactions.create", label: "Create transactions", hint: "Record spend directly" },
      { key: "transactions.edit", label: "Edit transactions", hint: "Correct a recorded transaction" },
      { key: "expenses.view", label: "View expenses", hint: "Open the expense history" },
      { key: "expenses.create", label: "Capture expenses", hint: "Scan or upload an invoice or slip" },
      { key: "expenses.edit", label: "Edit expenses", hint: "Change a captured expense" },
      { key: "expenses.delete", label: "Delete expenses", hint: "Remove a captured expense entirely", sensitive: true },
    ],
  },
  {
    id: "invoices",
    label: "Invoices",
    permissions: [
      { key: "invoices.view", label: "View invoices", hint: "Open supplier invoices" },
      { key: "invoices.upload", label: "Upload invoices", hint: "Attach an invoice to a request" },
      { key: "invoices.edit", label: "Edit invoices", hint: "Correct invoice details" },
      { key: "invoices.verify", label: "Verify invoices", hint: "Confirm an invoice is correct and payable" },
    ],
  },
  {
    id: "finance",
    label: "Finance & payments",
    permissions: [
      { key: "finance.view", label: "View financial information", hint: "Organisation-wide financial data and analytics" },
      { key: "finance.manage", label: "Manage financial workflows", hint: "Quotes, VAT and supplier classification" },
      { key: "finance.process", label: "Process payments", hint: "Payment queues, batches and settlement", sensitive: true },
    ],
  },
  {
    id: "suppliers",
    label: "Suppliers",
    permissions: [
      { key: "suppliers.view", label: "View suppliers", hint: "See the supplier register" },
      { key: "suppliers.create", label: "Add suppliers", hint: "Invite or capture a new supplier" },
      { key: "suppliers.edit", label: "Edit suppliers", hint: "Change supplier details" },
      { key: "suppliers.manage", label: "Classify & verify suppliers", hint: "Preferred, registered or one-time status" },
    ],
  },
  {
    id: "funds",
    label: "Donor funds & projects",
    permissions: [
      { key: "projects.view", label: "View fund & project balances", hint: "See live remaining amounts" },
      { key: "projects.create", label: "Create projects", hint: "Set up new projects and budgets" },
      { key: "projects.edit", label: "Edit projects", hint: "Change project details and budgets" },
      { key: "donors.view", label: "View donors", hint: "See the donor register" },
      { key: "donors.create", label: "Add donor funds", hint: "Add funds and set grant amounts" },
      { key: "donors.edit", label: "Manage donor funds", hint: "Change donor fund rules and amounts" },
    ],
  },
  {
    id: "reports",
    label: "Reports & analytics",
    permissions: [
      { key: "reports.view", label: "View analytics & reports", hint: "Spend, approval and supplier insights" },
      { key: "reports.export", label: "Export reports", hint: "Download PDF and Excel packs" },
    ],
  },
  {
    id: "users",
    label: "Users & account",
    permissions: [
      { key: "users.view", label: "View users", hint: "See who is in the organisation" },
      { key: "users.invite", label: "Invite & manage users", hint: "Add people and set their access" },
      { key: "users.edit", label: "Organisation settings", hint: "Edit organisation details and structure" },
      { key: "users.manage_permissions", label: "Manage permissions", hint: "Change what other people can do", sensitive: true },
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

// Supervisors see the same essential information as Finance (including
// analytics) but cannot process payments or change other people's access.
const HOD_ALLOWED = new Set([
  "requisitions.view", "requisitions.create", "requisitions.edit", "requisitions.submit",
  "requisitions.approve", "requisitions.decline",
  "transactions.view", "expenses.view", "expenses.create",
  "invoices.view", "invoices.upload",
  "suppliers.view", "projects.view", "donors.view",
  "reports.view", "reports.export", "users.view",
  "finance.view",
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
  /** Maximum approvals allowed in the current calendar month (null = no cap). */
  max_approvals_per_month?: number | null;
  /** When the limit stops applying (null = permanent). */
  expires_at?: string | null;
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

/** Restriction dimensions — empty list for a dimension means unrestricted. */
export const SCOPE_TYPES = [
  { key: "PROJECT", label: "Projects" },
  { key: "DONOR", label: "Donor funds" },
  { key: "DEPARTMENT", label: "Departments" },
  { key: "EXPENSE_TYPE", label: "Expense types" },
] as const;

export type ScopeType = (typeof SCOPE_TYPES)[number]["key"];

/** How long a granted permission or limit stays active. */
export const EXPIRY_PRESETS = [
  { key: "PERMANENT", label: "Permanent", months: null },
  { key: "1M", label: "1 month", months: 1 },
  { key: "2M", label: "2 months", months: 2 },
  { key: "3M", label: "3 months", months: 3 },
  { key: "6M", label: "6 months", months: 6 },
  { key: "12M", label: "12 months", months: 12 },
] as const;

export type ExpiryPreset = (typeof EXPIRY_PRESETS)[number]["key"];

/** Turn an expiry preset into an ISO timestamp (null = never expires). */
export function expiryToIso(preset: ExpiryPreset): string | null {
  const found = EXPIRY_PRESETS.find((p) => p.key === preset);
  if (!found || found.months === null) return null;
  const d = new Date();
  d.setMonth(d.getMonth() + found.months);
  return d.toISOString();
}

/** True when an expiry timestamp has already passed. */
export function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}

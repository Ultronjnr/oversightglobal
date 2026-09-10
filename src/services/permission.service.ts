import { supabase } from "@/integrations/supabase/client";
import type { AppRoleName, ApprovalLimit, PermissionKey } from "@/lib/permissions";

export interface OrgUserRow {
  id: string;
  name: string;
  surname?: string | null;
  email: string;
  department?: string | null;
  role: AppRoleName;
}

/** Overrides keyed by permission key. Absent key = role default applies. */
export type PermissionOverrides = Record<string, boolean>;

async function currentOrgId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();
  return data?.organization_id ?? null;
}

/** Per-user permission overrides for one user. */
export async function getUserPermissionOverrides(
  userId: string,
): Promise<PermissionOverrides> {
  const { data, error } = await supabase
    .from("user_permissions")
    .select("permission_key, allowed, expires_at")
    .eq("user_id", userId);

  if (error || !data) return {};
  // Expired overrides fall back to the role default.
  return Object.fromEntries(
    data
      .filter((r) => !r.expires_at || new Date(r.expires_at).getTime() > Date.now())
      .map((r) => [r.permission_key, r.allowed]),
  );
}

/** Approval limits for one user, keyed by approval type. */
export async function getUserApprovalLimits(
  userId: string,
): Promise<Record<string, ApprovalLimit>> {
  const { data, error } = await supabase
    .from("user_approval_limits")
    .select("approval_type, max_amount, currency, unlimited, max_approvals_per_month, expires_at")
    .eq("user_id", userId);

  if (error || !data) return {};
  return Object.fromEntries(
    data.map((r) => [
      r.approval_type,
      {
        approval_type: r.approval_type,
        max_amount: r.max_amount === null ? null : Number(r.max_amount),
        currency: r.currency,
        unlimited: r.unlimited,
        max_approvals_per_month: r.max_approvals_per_month ?? null,
        expires_at: r.expires_at ?? null,
      } as ApprovalLimit,
    ]),
  );
}

async function logPermissionChange(entry: {
  organizationId: string;
  targetUserId: string;
  changeType: "PERMISSION" | "APPROVAL_LIMIT";
  subject: string;
  oldValue: string | null;
  newValue: string | null;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("permission_audit_log").insert({
    organization_id: entry.organizationId,
    changed_by: user.id,
    target_user_id: entry.targetUserId,
    change_type: entry.changeType,
    subject: entry.subject,
    old_value: entry.oldValue,
    new_value: entry.newValue,
  });
}

/** Set (or clear) a single permission override, writing an audit entry. */
export async function setUserPermission(
  userId: string,
  key: PermissionKey,
  allowed: boolean,
  previous: boolean,
  expiresAt: string | null = null,
): Promise<{ success: boolean; error?: string }> {
  const organizationId = await currentOrgId();
  if (!organizationId) return { success: false, error: "No organisation found" };

  const { error } = await supabase
    .from("user_permissions")
    .upsert(
      {
        organization_id: organizationId,
        user_id: userId,
        permission_key: key,
        allowed,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,permission_key" },
    );

  if (error) return { success: false, error: error.message };

  await logPermissionChange({
    organizationId,
    targetUserId: userId,
    changeType: "PERMISSION",
    subject: key,
    oldValue: String(previous),
    newValue: expiresAt
      ? `${allowed} (until ${new Date(expiresAt).toLocaleDateString("en-ZA")})`
      : String(allowed),
  });
  return { success: true };
}

/** Save an approval limit for a user, writing an audit entry. */
export async function setUserApprovalLimit(
  userId: string,
  approvalType: string,
  limit: {
    maxAmount: number | null;
    unlimited: boolean;
    currency: string;
    maxApprovalsPerMonth?: number | null;
    expiresAt?: string | null;
  },
  previous?: ApprovalLimit,
): Promise<{ success: boolean; error?: string }> {
  const organizationId = await currentOrgId();
  if (!organizationId) return { success: false, error: "No organisation found" };

  const { error } = await supabase
    .from("user_approval_limits")
    .upsert(
      {
        organization_id: organizationId,
        user_id: userId,
        approval_type: approvalType,
        max_amount: limit.unlimited ? null : limit.maxAmount,
        unlimited: limit.unlimited,
        currency: limit.currency,
        max_approvals_per_month: limit.maxApprovalsPerMonth ?? null,
        expires_at: limit.expiresAt ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,approval_type" },
    );

  if (error) return { success: false, error: error.message };

  await logPermissionChange({
    organizationId,
    targetUserId: userId,
    changeType: "APPROVAL_LIMIT",
    subject: approvalType,
    oldValue: previous
      ? previous.unlimited
        ? "unlimited"
        : String(previous.max_amount ?? "")
      : "not set",
    newValue: limit.unlimited ? "unlimited" : String(limit.maxAmount ?? ""),
  });
  return { success: true };
}

export interface PermissionAuditEntry {
  id: string;
  changed_by: string;
  target_user_id: string;
  change_type: string;
  subject: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export async function getPermissionAudit(
  targetUserId?: string,
): Promise<PermissionAuditEntry[]> {
  let query = supabase
    .from("permission_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (targetUserId) query = query.eq("target_user_id", targetUserId);
  const { data, error } = await query;
  if (error || !data) return [];
  return data as unknown as PermissionAuditEntry[];
}


/* ============ Restrictions (projects / donors / departments / expense types) ============ */

export interface PermissionScope {
  id: string;
  scope_type: string;
  scope_value: string;
  expires_at: string | null;
}

/** Active restrictions for a user. No rows for a type means unrestricted. */
export async function getUserScopes(userId: string): Promise<PermissionScope[]> {
  const { data, error } = await supabase
    .from("user_permission_scopes")
    .select("id, scope_type, scope_value, expires_at")
    .eq("user_id", userId);
  if (error || !data) return [];
  return data as PermissionScope[];
}

export async function addUserScope(
  userId: string,
  scopeType: string,
  scopeValue: string,
  expiresAt: string | null = null,
): Promise<{ success: boolean; error?: string }> {
  const organizationId = await currentOrgId();
  if (!organizationId) return { success: false, error: "No organisation found" };

  const { error } = await supabase.from("user_permission_scopes").upsert(
    {
      organization_id: organizationId,
      user_id: userId,
      scope_type: scopeType,
      scope_value: scopeValue,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,scope_type,scope_value" },
  );
  if (error) return { success: false, error: error.message };

  await logPermissionChange({
    organizationId,
    targetUserId: userId,
    changeType: "PERMISSION",
    subject: `restriction:${scopeType}`,
    oldValue: null,
    newValue: scopeValue,
  });
  return { success: true };
}

export async function removeUserScope(
  userId: string,
  scopeId: string,
): Promise<{ success: boolean; error?: string }> {
  const organizationId = await currentOrgId();
  const { error } = await supabase
    .from("user_permission_scopes")
    .delete()
    .eq("id", scopeId);
  if (error) return { success: false, error: error.message };
  if (organizationId) {
    await logPermissionChange({
      organizationId,
      targetUserId: userId,
      changeType: "PERMISSION",
      subject: "restriction:removed",
      oldValue: scopeId,
      newValue: null,
    });
  }
  return { success: true };
}

/* ============ Reporting hierarchy ============ */

export async function setReportsTo(
  userId: string,
  managerId: string | null,
): Promise<{ success: boolean; error?: string }> {
  if (managerId && managerId === userId) {
    return { success: false, error: "A person cannot report to themselves" };
  }
  const organizationId = await currentOrgId();
  const { error } = await supabase
    .from("profiles")
    .update({ reports_to: managerId })
    .eq("id", userId);
  if (error) return { success: false, error: error.message };
  if (organizationId) {
    await logPermissionChange({
      organizationId,
      targetUserId: userId,
      changeType: "PERMISSION",
      subject: "reports_to",
      oldValue: null,
      newValue: managerId,
    });
  }
  return { success: true };
}

export async function getReportsTo(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("reports_to")
    .eq("id", userId)
    .maybeSingle();
  return (data as { reports_to?: string | null } | null)?.reports_to ?? null;
}

/* ============ Approval trail ============ */

export interface ApprovalEvent {
  id: string;
  approver_id: string;
  approval_type: string;
  entity_id: string | null;
  entity_status: string | null;
  amount: number | null;
  created_at: string;
}

/** Approvals recorded for the organisation, newest first. */
export async function getApprovalEvents(options?: {
  entityId?: string;
  approverId?: string;
  limit?: number;
}): Promise<ApprovalEvent[]> {
  let query = supabase
    .from("approval_events")
    .select("id, approver_id, approval_type, entity_id, entity_status, amount, created_at")
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 50);
  if (options?.entityId) query = query.eq("entity_id", options.entityId);
  if (options?.approverId) query = query.eq("approver_id", options.approverId);
  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((r) => ({ ...r, amount: r.amount === null ? null : Number(r.amount) })) as ApprovalEvent[];
}

/** Approvals this user has already used in the current calendar month. */
export async function getMonthlyApprovalCount(
  userId: string,
  approvalType: string,
): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("approval_events")
    .select("id", { count: "exact", head: true })
    .eq("approver_id", userId)
    .eq("approval_type", approvalType)
    .gte("created_at", start.toISOString());
  return count ?? 0;
}

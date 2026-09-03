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
    .select("permission_key, allowed")
    .eq("user_id", userId);

  if (error || !data) return {};
  return Object.fromEntries(data.map((r) => [r.permission_key, r.allowed]));
}

/** Approval limits for one user, keyed by approval type. */
export async function getUserApprovalLimits(
  userId: string,
): Promise<Record<string, ApprovalLimit>> {
  const { data, error } = await supabase
    .from("user_approval_limits")
    .select("approval_type, max_amount, currency, unlimited")
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
    newValue: String(allowed),
  });
  return { success: true };
}

/** Save an approval limit for a user, writing an audit entry. */
export async function setUserApprovalLimit(
  userId: string,
  approvalType: string,
  limit: { maxAmount: number | null; unlimited: boolean; currency: string },
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

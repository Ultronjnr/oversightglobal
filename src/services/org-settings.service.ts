import { supabase } from "@/integrations/supabase/client";

export type AppRoleName = "EMPLOYEE" | "HOD" | "FINANCE" | "ADMIN" | "SUPPLIER";

/** Who is allowed to perform a configurable action. */
export type PermissionScope = "FINANCE_ADMIN" | "HOD_UP" | "ALL_STAFF";

export interface OrganizationSettings {
  organization_id: string;
  /** Who may set the Project / Donor funding source on a requisition. */
  funding_source_editors: PermissionScope;
  /** Require a VAT-bearing document before a transaction can be approved. */
  require_vat_document: boolean;
  /** Who may source suppliers / capture quotes on a requisition. */
  supplier_sourcing_roles: PermissionScope;
  /** Amount above which a requisition must go to Finance for approval. */
  finance_approval_threshold: number;
  updated_at?: string;
}

export const DEFAULT_ORG_SETTINGS: Omit<OrganizationSettings, "organization_id"> = {
  funding_source_editors: "FINANCE_ADMIN",
  require_vat_document: false,
  supplier_sourcing_roles: "FINANCE_ADMIN",
  finance_approval_threshold: 0,
};

export const PERMISSION_SCOPE_LABELS: Record<PermissionScope, string> = {
  FINANCE_ADMIN: "Finance & Admin only",
  HOD_UP: "HOD, Finance & Admin",
  ALL_STAFF: "All internal staff",
};

/**
 * Does the given role satisfy a configured permission scope?
 * Suppliers never satisfy an internal scope.
 */
export function scopeAllows(scope: PermissionScope, role: AppRoleName | null | undefined): boolean {
  if (!role || role === "SUPPLIER") return false;
  switch (scope) {
    case "ALL_STAFF":
      return true;
    case "HOD_UP":
      return role === "HOD" || role === "FINANCE" || role === "ADMIN";
    case "FINANCE_ADMIN":
    default:
      return role === "FINANCE" || role === "ADMIN";
  }
}

export async function getOrganizationSettings(
  organizationId: string,
): Promise<OrganizationSettings> {
  const { data, error } = await supabase
    .from("organization_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !data) {
    return { organization_id: organizationId, ...DEFAULT_ORG_SETTINGS };
  }
  return data as unknown as OrganizationSettings;
}

export async function updateOrganizationSettings(
  organizationId: string,
  updates: Partial<Omit<OrganizationSettings, "organization_id">>,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("organization_settings")
    .upsert(
      { organization_id: organizationId, ...updates },
      { onConflict: "organization_id" },
    );
  if (error) return { success: false, error: error.message };
  return { success: true };
}

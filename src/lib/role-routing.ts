import { supabase } from "@/integrations/supabase/client";

export type AppRoleName = "EMPLOYEE" | "HOD" | "FINANCE" | "ADMIN" | "SUPPLIER";

/** Portal home for each role. */
export const rolePortalMap: Record<string, string> = {
  EMPLOYEE: "/employee/portal",
  HOD: "/hod/portal",
  FINANCE: "/finance/portal",
  ADMIN: "/admin/portal",
  SUPPLIER: "/supplier/portal",
};

const ROLE_PRIORITY: AppRoleName[] = ["ADMIN", "FINANCE", "HOD", "SUPPLIER", "EMPLOYEE"];

/**
 * Resolve the single role a user should be routed with.
 * Users are expected to hold exactly one role, but legacy accounts may hold
 * more than one — never fail routing because of that, pick the highest.
 */
export async function fetchPrimaryRole(userId: string): Promise<AppRoleName | null> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error || !data || data.length === 0) return null;

  const roles = data.map((r) => r.role as AppRoleName);
  return ROLE_PRIORITY.find((r) => roles.includes(r)) || roles[0];
}

export function portalPathForRole(role?: string | null): string {
  return (role && rolePortalMap[role]) || "/dashboard";
}

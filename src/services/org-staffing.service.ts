import { supabase } from "@/integrations/supabase/client";

/**
 * How an organisation is staffed right now.
 *
 * The platform adapts its workflow to the people who actually exist:
 * a one-person organisation should never be forced through an
 * Employee -> HOD -> Finance approval chain.
 */
export interface OrgStaffing {
  /** Active internal (non-supplier) people in the organisation. */
  activeUsers: number;
  hasAdmin: boolean;
  hasFinance: boolean;
  hasHod: boolean;
  hasEmployee: boolean;
  /** Only one authorised person — the single-user workflow applies. */
  isSingleUser: boolean;
  /** Nobody else can approve, so the Super User handles everything. */
  adminActsAsFinance: boolean;
}

export const DEFAULT_ORG_STAFFING: OrgStaffing = {
  activeUsers: 0,
  hasAdmin: false,
  hasFinance: false,
  hasHod: false,
  hasEmployee: false,
  isSingleUser: false,
  adminActsAsFinance: false,
};

export async function getOrgStaffing(organizationId: string): Promise<OrgStaffing> {
  const { data, error } = await supabase.rpc("organization_staffing" as never, {
    _org_id: organizationId,
  } as never);

  if (error || !data) return DEFAULT_ORG_STAFFING;

  const raw = data as unknown as {
    active_users: number | null;
    has_admin: boolean | null;
    has_finance: boolean | null;
    has_hod: boolean | null;
    has_employee: boolean | null;
  };

  const activeUsers = Number(raw.active_users ?? 0);
  const hasFinance = raw.has_finance === true;
  const hasHod = raw.has_hod === true;

  return {
    activeUsers,
    hasAdmin: raw.has_admin === true,
    hasFinance,
    hasHod,
    hasEmployee: raw.has_employee === true,
    isSingleUser: activeUsers <= 1,
    adminActsAsFinance: !hasFinance,
  };
}

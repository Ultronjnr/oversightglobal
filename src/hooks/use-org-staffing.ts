import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEFAULT_ORG_STAFFING,
  getOrgStaffing,
  type OrgStaffing,
} from "@/services/org-staffing.service";

/**
 * Live view of how the current organisation is staffed, so screens can adapt
 * between the single-person workflow and the full multi-role approval chain.
 */
export function useOrgStaffing() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id ?? null;
  const [staffing, setStaffing] = useState<OrgStaffing>(DEFAULT_ORG_STAFFING);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!orgId) {
      setStaffing(DEFAULT_ORG_STAFFING);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setStaffing(await getOrgStaffing(orgId));
    setIsLoading(false);
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...staffing, isLoading, refresh: load };
}

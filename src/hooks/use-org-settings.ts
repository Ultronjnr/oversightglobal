import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEFAULT_ORG_SETTINGS,
  getOrganizationSettings,
  scopeAllows,
  type OrganizationSettings,
} from "@/services/org-settings.service";

/**
 * Loads the organization's configurable platform rules (Layer 9 admin settings)
 * and exposes role-aware permission helpers for the current user.
 */
export function useOrgSettings() {
  const { profile, role } = useAuth();
  const orgId = profile?.organization_id ?? null;
  const [settings, setSettings] = useState<OrganizationSettings>({
    organization_id: orgId ?? "",
    ...DEFAULT_ORG_SETTINGS,
  });
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!orgId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const data = await getOrganizationSettings(orgId);
    setSettings(data);
    setIsLoading(false);
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    settings,
    isLoading,
    refresh: load,
    canEditFundingSource: scopeAllows(settings.funding_source_editors, role),
    canSourceSuppliers: scopeAllows(settings.supplier_sourcing_roles, role),
  };
}

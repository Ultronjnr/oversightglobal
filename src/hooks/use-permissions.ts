import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  effectivePermission,
  withinApprovalLimit,
  type AppRoleName,
  type ApprovalLimit,
  type PermissionKey,
} from "@/lib/permissions";
import {
  getUserApprovalLimits,
  getUserPermissionOverrides,
  type PermissionOverrides,
} from "@/services/permission.service";

/**
 * Effective permissions for the signed-in user.
 * UI convenience only — the database enforces the same rules on every write.
 */
export function usePermissions() {
  const { user, role } = useAuth();
  const [overrides, setOverrides] = useState<PermissionOverrides>({});
  const [limits, setLimits] = useState<Record<string, ApprovalLimit>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setOverrides({});
      setLimits({});
      setIsLoading(false);
      return;
    }
    let active = true;
    setIsLoading(true);
    Promise.all([
      getUserPermissionOverrides(user.id),
      getUserApprovalLimits(user.id),
    ]).then(([o, l]) => {
      if (!active) return;
      setOverrides(o);
      setLimits(l);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [user?.id]);

  const can = useCallback(
    (key: PermissionKey) =>
      effectivePermission((role as AppRoleName) ?? null, overrides, key),
    [role, overrides],
  );

  const approvalLimit = useCallback(
    (approvalType: string): ApprovalLimit | undefined => limits[approvalType],
    [limits],
  );

  const canApproveAmount = useCallback(
    (approvalType: string, amount: number) =>
      withinApprovalLimit((role as AppRoleName) ?? null, limits[approvalType], amount),
    [role, limits],
  );

  return { can, canApproveAmount, approvalLimit, isLoading, isSuperUser: role === "ADMIN" };
}

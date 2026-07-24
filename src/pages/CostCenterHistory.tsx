import { useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { getPortalNavItems } from "@/lib/admin-nav";
import { CostCenterHistoryContent } from "@/components/finance/CostCenterHistoryContent";

export default function CostCenterHistory() {
  const { role } = useAuth();
  const navItems = useMemo(() => getPortalNavItems(role), [role]);
  return (
    <DashboardLayout title="Cost Center / Department History" navItems={navItems}>
      <CostCenterHistoryContent />
    </DashboardLayout>
  );
}
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { User, ClipboardList, BarChart3, ShoppingCart, X, Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PurchaseRequisitionTable } from "@/components/pr/PurchaseRequisitionTable";
import { PurchaseRequisitionModal } from "@/components/pr/PurchaseRequisitionModal";
import { getUserPurchaseRequisitions } from "@/services/pr.service";
import type { PurchaseRequisition } from "@/types/pr.types";
import { toast } from "sonner";

export default function EmployeePortal() {
  const navigate = useNavigate();
  const [showPRModal, setShowPRModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [stats, setStats] = useState({ total: 0, approved: 0, pending: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [showCleared, setShowCleared] = useState(false);

  const navItems = [
    { label: "My Portal", href: "/employee/portal", icon: <User className="h-4 w-4" /> },
    { label: "Purchase Requisition History", href: "/pr-history", icon: <ClipboardList className="h-4 w-4" /> },
  ];

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      const result = await getUserPurchaseRequisitions();
      if (result.success) {
        const prs = result.data as PurchaseRequisition[];
        const total = prs.length;
        const approved = prs.filter(
          (pr) => pr.status === "FINANCE_APPROVED" || pr.status === "HOD_APPROVED"
        ).length;
        const pending = prs.filter(
          (pr) =>
            pr.status === "PENDING_HOD_APPROVAL" || pr.status === "PENDING_FINANCE_APPROVAL"
        ).length;
        setStats({ total, approved, pending });
      }
      setIsLoading(false);
    };
    fetchStats();
  }, [refreshTrigger]);

  const handleFormSuccess = () => {
    setShowPRModal(false);
    setShowCleared(false);
    setRefreshTrigger((prev) => prev + 1);
    toast.success("Purchase requisition submitted successfully");
  };

  const handleClearDashboard = () => {
    setShowCleared(true);
    toast.success("Dashboard cleared");
  };

  const handleRefreshDashboard = () => {
    setShowCleared(false);
    setRefreshTrigger((prev) => prev + 1);
    toast.success("Dashboard refreshed");
  };

  return (
    <DashboardLayout title="Employee Dashboard" navItems={navItems}>
      <div className="space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            label="Total Submitted"
            value={stats.total}
            isLoading={isLoading}
          />
          <StatCard
            label="Approved"
            value={stats.approved}
            valueColor="success"
            isLoading={isLoading}
          />
          <StatCard
            label="Pending"
            value={stats.pending}
            valueColor="warning"
            isLoading={isLoading}
          />
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            className="bg-foreground text-background hover:bg-foreground/90 gap-2"
            onClick={() => navigate("/analytics")}
          >
            <BarChart3 className="h-4 w-4" />
            Procurement Analytics
          </Button>
          <Button
            variant="outline"
            className="gap-2 bg-white hover:bg-muted/50"
            onClick={() => setShowPRModal(true)}
          >
            <ShoppingCart className="h-4 w-4" />
            New Purchase Requisition
          </Button>
          <Button
            variant="outline"
            className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/5 bg-destructive/5"
            onClick={handleClearDashboard}
          >
            <X className="h-4 w-4" />
            Clear Dashboard
          </Button>
          <Button
            variant="outline"
            className="gap-2 text-success border-success/30 hover:bg-success/5 bg-success/5"
            onClick={handleRefreshDashboard}
          >
            <Plus className="h-4 w-4" />
            Refresh Dashboard
          </Button>
        </div>

        {/* Purchase Requisitions Section */}
        <SectionCard
          title="My Purchase Requisitions"
          icon={<FileText className="h-5 w-5" />}
        >
          {showCleared ? (
            <EmptyState
              icon={<FileText className="h-16 w-16" />}
              title="Dashboard Cleared"
              description="Your dashboard is now clean. All PRs are saved in Purchase Requisition History."
            />
          ) : (
            <PurchaseRequisitionTable refreshTrigger={refreshTrigger} />
          )}
        </SectionCard>
      </div>

      {/* PR Modal */}
      <PurchaseRequisitionModal 
        open={showPRModal} 
        onOpenChange={setShowPRModal}
        onSuccess={handleFormSuccess}
      />
    </DashboardLayout>
  );
}

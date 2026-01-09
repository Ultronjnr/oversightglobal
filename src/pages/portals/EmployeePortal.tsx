import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, FileText, ClipboardList, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PurchaseRequisitionForm } from "@/components/pr/PurchaseRequisitionForm";
import { PurchaseRequisitionTable } from "@/components/pr/PurchaseRequisitionTable";
import { getUserPurchaseRequisitions } from "@/services/pr.service";
import type { PurchaseRequisition } from "@/types/pr.types";

export default function EmployeePortal() {
  const [showForm, setShowForm] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [stats, setStats] = useState({ total: 0, approved: 0, pending: 0 });

  const navItems = [
    { label: "My Portal", href: "/employee/portal", icon: <User className="h-4 w-4" /> },
    { label: "PR History", href: "/employee/portal", icon: <ClipboardList className="h-4 w-4" /> },
  ];

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
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
    };
    fetchStats();
  }, [refreshTrigger]);

  const handleFormSuccess = () => {
    setShowForm(false);
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <DashboardLayout title="Employee Dashboard" navItems={navItems}>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="dashboard-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Submitted</p>
              <p className="text-3xl font-bold mt-1">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="dashboard-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Approved</p>
              <p className="text-3xl font-bold text-success mt-1">{stats.approved}</p>
            </CardContent>
          </Card>
          <Card className="dashboard-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-3xl font-bold text-warning mt-1">{stats.pending}</p>
            </CardContent>
          </Card>
        </div>

        {/* Create PR Button / Form */}
        <Card className="dashboard-card">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                New Purchase Requisition
              </CardTitle>
              <Button
                variant={showForm ? "outline" : "gradient"}
                size="sm"
                onClick={() => setShowForm(!showForm)}
              >
                {showForm ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Hide Form
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1" />
                    Create PR
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          {showForm && (
            <CardContent>
              <PurchaseRequisitionForm onSuccess={handleFormSuccess} />
            </CardContent>
          )}
        </Card>

        {/* PR History Table */}
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              My Purchase Requisitions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PurchaseRequisitionTable refreshTrigger={refreshTrigger} />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

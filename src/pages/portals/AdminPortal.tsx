import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import {User, Users, Building2, Settings, Shield, FileText, Mail, BarChart3, Truck, ReceiptText as Receipt} from "lucide-react";
import { CompanyProfileTab } from "@/components/admin/CompanyProfileTab";
import { UsersRolesTab } from "@/components/admin/UsersRolesTab";
import { DepartmentsTab } from "@/components/admin/DepartmentsTab";
import { InvitationsTab } from "@/components/admin/InvitationsTab";
import { AllPRsTab } from "@/components/admin/AllPRsTab";
import { SuppliersTab } from "@/components/admin/SuppliersTab";
import { AnalyticsTab } from "@/components/admin/AnalyticsTab";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { UsersPermissionsTab } from "@/components/admin/UsersPermissionsTab";
import { ReimbursementsTab } from "@/components/finance/ReimbursementsTab";
import { getAdminStats } from "@/services/admin.service";
import { adminNavItems } from "@/lib/admin-nav";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getOnboarding } from "@/services/onboarding.service";
import { OviFirstRunCard } from "@/components/onboarding/OviFirstRunCard";

export default function AdminPortal() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activePRs: 0,
    completedPRs: 0,
    verifiedSuppliers: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  useEffect(() => {
    fetchStats();
  }, []);

  // Route brand-new organisations through onboarding before the workspace.
  useEffect(() => {
    if (!profile?.organization_id) return;
    let active = true;
    getOnboarding(profile.organization_id).then((rec) => {
      if (active && !rec?.completed_at) {
        navigate("/onboarding", { replace: true });
      }
    });
    return () => {
      active = false;
    };
  }, [profile?.organization_id, navigate]);

  const fetchStats = async () => {
    try {
      const result = await getAdminStats();
      if (result.success) {
        setStats(result.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const tabPages: Record<string, { title: string; description: string; icon: ReactNode; content: ReactNode }> = {
    company: { title: "Company Profile", description: "Organisation details, branding and registration information.", icon: <Building2 className="h-5 w-5" />, content: <CompanyProfileTab /> },
    users: { title: "Users & Roles", description: "Manage platform users, roles and access levels.", icon: <Users className="h-5 w-5" />, content: <UsersRolesTab /> },
    departments: { title: "Cost Centers / Departments", description: "Departments, cost centers and their budgets.", icon: <Building2 className="h-5 w-5" />, content: <DepartmentsTab /> },
    invitations: { title: "Invitations", description: "Invite new users and track pending invitations.", icon: <Mail className="h-5 w-5" />, content: <InvitationsTab /> },
    prs: { title: "Purchase Requisitions", description: "Every requisition raised across the organisation.", icon: <FileText className="h-5 w-5" />, content: <AllPRsTab /> },
    suppliers: { title: "Suppliers", description: "Supplier register, verification and onboarding.", icon: <Truck className="h-5 w-5" />, content: <SuppliersTab /> },
    reimbursements: { title: "Reimbursements", description: "Staff reimbursement claims across the organisation.", icon: <Receipt className="h-5 w-5" />, content: <ReimbursementsTab role="ADMIN" /> },
    analytics: { title: "Analytics", description: "Spend, approval and supplier performance insights.", icon: <BarChart3 className="h-5 w-5" />, content: <AnalyticsTab /> },
    permissions: { title: "Users & Permissions", description: "Configure what each person can do and how much they may approve.", icon: <Shield className="h-5 w-5" />, content: <UsersPermissionsTab /> },
    settings: { title: "Settings", description: "Organisation-wide workflow and policy configuration.", icon: <Settings className="h-5 w-5" />, content: <SettingsTab /> },
  };

  const tabParam = searchParams.get("tab");
  const currentPage = tabParam ? tabPages[tabParam] : null;

  if (currentPage) {
    return (
      <DashboardLayout title={currentPage.title} navItems={adminNavItems}>
        <WorkspaceShell title={currentPage.title} description={currentPage.description} icon={currentPage.icon}>
          {currentPage.content}
        </WorkspaceShell>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Super User Dashboard" navItems={adminNavItems} showInsights>
      <div className="space-y-6">
        <OviFirstRunCard />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card className="dashboard-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-3xl font-bold mt-1">
                    {isLoading ? "-" : stats.totalUsers}
                  </p>
                </div>
                <Users className="h-8 w-8 text-primary/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="dashboard-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Verified Suppliers</p>
                  <p className="text-3xl font-bold mt-1">
                    {isLoading ? "-" : stats.verifiedSuppliers}
                  </p>
                </div>
                <Truck className="h-8 w-8 text-primary/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="dashboard-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active PRs</p>
                  <p className="text-3xl font-bold text-warning mt-1">
                    {isLoading ? "-" : stats.activePRs}
                  </p>
                </div>
                <Shield className="h-8 w-8 text-warning/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="dashboard-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-3xl font-bold text-success mt-1">
                    {isLoading ? "-" : stats.completedPRs}
                  </p>
                </div>
                <Shield className="h-8 w-8 text-success/50" />
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </DashboardLayout>
  );
}

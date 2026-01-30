import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Users,
  Building2,
  Settings,
  Shield,
  FileText,
  Mail,
  BarChart3,
  Truck,
} from "lucide-react";
import { CompanyProfileTab } from "@/components/admin/CompanyProfileTab";
import { UsersRolesTab } from "@/components/admin/UsersRolesTab";
import { InvitationsTab } from "@/components/admin/InvitationsTab";
import { AllPRsTab } from "@/components/admin/AllPRsTab";
import { SuppliersTab } from "@/components/admin/SuppliersTab";
import { AnalyticsTab } from "@/components/admin/AnalyticsTab";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { getAdminStats } from "@/services/admin.service";

export default function AdminPortal() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activePRs: 0,
    completedPRs: 0,
    verifiedSuppliers: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

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

  const navItems = [
    { label: "Dashboard", href: "/admin/portal", icon: <User className="h-4 w-4" /> },
  ];

  return (
    <DashboardLayout title="Admin Dashboard" navItems={navItems}>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

        {/* Tabs */}
        <Tabs defaultValue="company" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-2">
            <TabsTrigger value="company" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Company Profile
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users & Roles
            </TabsTrigger>
            <TabsTrigger value="invitations" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Invitations
            </TabsTrigger>
            <TabsTrigger value="prs" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Purchase Requisitions
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Suppliers
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company">
            <CompanyProfileTab />
          </TabsContent>

          <TabsContent value="users">
            <UsersRolesTab />
          </TabsContent>

          <TabsContent value="invitations">
            <InvitationsTab />
          </TabsContent>

          <TabsContent value="prs">
            <AllPRsTab />
          </TabsContent>

          <TabsContent value="suppliers">
            <SuppliersTab />
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsTab />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

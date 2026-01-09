import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { User, Users, Building2, Settings, Shield } from "lucide-react";

export default function AdminPortal() {
  const navItems = [
    { label: "Dashboard", href: "/admin/portal", icon: <User className="h-4 w-4" /> },
    { label: "Users", href: "/admin/users", icon: <Users className="h-4 w-4" /> },
    { label: "Organization", href: "/admin/organization", icon: <Building2 className="h-4 w-4" /> },
    { label: "Settings", href: "/admin/settings", icon: <Settings className="h-4 w-4" /> },
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
                  <p className="text-3xl font-bold mt-1">0</p>
                </div>
                <Users className="h-8 w-8 text-primary/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="dashboard-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Departments</p>
                  <p className="text-3xl font-bold mt-1">0</p>
                </div>
                <Building2 className="h-8 w-8 text-primary/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="dashboard-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active PRs</p>
                  <p className="text-3xl font-bold text-warning mt-1">0</p>
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
                  <p className="text-3xl font-bold text-success mt-1">0</p>
                </div>
                <Shield className="h-8 w-8 text-success/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="dashboard-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Organization Overview</h2>
            </div>
            
            {/* Empty state */}
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground mb-1">Welcome, Administrator</h3>
              <p className="text-sm text-muted-foreground">
                Manage your organization, users, and settings from here.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

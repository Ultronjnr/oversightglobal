import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { User, FileText, DollarSign, BarChart3 } from "lucide-react";

export default function FinancePortal() {
  const navItems = [
    { label: "My Portal", href: "/finance/portal", icon: <User className="h-4 w-4" /> },
    { label: "Pending Approvals", href: "/finance/approvals", icon: <DollarSign className="h-4 w-4" /> },
    { label: "Analytics", href: "/finance/analytics", icon: <BarChart3 className="h-4 w-4" /> },
  ];

  return (
    <DashboardLayout title="Finance Dashboard" navItems={navItems}>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="dashboard-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Pending Review</p>
              <p className="text-3xl font-bold text-warning mt-1">0</p>
            </CardContent>
          </Card>
          <Card className="dashboard-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Approved</p>
              <p className="text-3xl font-bold text-success mt-1">0</p>
            </CardContent>
          </Card>
          <Card className="dashboard-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-3xl font-bold text-primary mt-1">$0</p>
            </CardContent>
          </Card>
          <Card className="dashboard-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-3xl font-bold mt-1">0</p>
            </CardContent>
          </Card>
        </div>

        {/* Pending Approvals Section */}
        <Card className="dashboard-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-6">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Pending Financial Approvals</h2>
            </div>
            
            {/* Empty state */}
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground mb-1">No Pending Approvals</h3>
              <p className="text-sm text-muted-foreground">
                Requisitions requiring financial approval will appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

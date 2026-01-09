import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Truck, FileText, ClipboardList, Package, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function SupplierPortal() {
  const navItems = [
    { label: "Dashboard", href: "/supplier/portal", icon: <Truck className="h-4 w-4" /> },
    { label: "Quote Requests", href: "/supplier/quotes", icon: <ClipboardList className="h-4 w-4" /> },
    { label: "My Quotes", href: "/supplier/my-quotes", icon: <FileText className="h-4 w-4" /> },
  ];

  return (
    <DashboardLayout title="Supplier Dashboard" navItems={navItems}>
      <div className="space-y-6">
        {/* Verification Status */}
        <Card className="dashboard-card border-warning/30 bg-warning/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-warning/20">
                <CheckCircle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="font-medium">Account Verification Pending</p>
                <p className="text-sm text-muted-foreground">
                  Your account is pending verification. You'll be notified once approved.
                </p>
              </div>
              <Badge variant="outline" className="ml-auto border-warning text-warning">
                Pending
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="dashboard-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Quote Requests</p>
              <p className="text-3xl font-bold mt-1">0</p>
            </CardContent>
          </Card>
          <Card className="dashboard-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Quotes Submitted</p>
              <p className="text-3xl font-bold text-primary mt-1">0</p>
            </CardContent>
          </Card>
          <Card className="dashboard-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Accepted</p>
              <p className="text-3xl font-bold text-success mt-1">0</p>
            </CardContent>
          </Card>
          <Card className="dashboard-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-3xl font-bold mt-1">$0</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Quote Requests */}
        <Card className="dashboard-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-6">
              <Package className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Recent Quote Requests</h2>
            </div>
            
            {/* Empty state */}
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground mb-1">No Quote Requests</h3>
              <p className="text-sm text-muted-foreground">
                New quote requests from organizations will appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

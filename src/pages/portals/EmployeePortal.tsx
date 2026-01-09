import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { User, FileText, ClipboardList } from "lucide-react";

export default function EmployeePortal() {
  const navItems = [
    { label: "My Portal", href: "/employee/portal", icon: <User className="h-4 w-4" /> },
    { label: "Purchase Requisition History", href: "/employee/history", icon: <ClipboardList className="h-4 w-4" /> },
  ];

  return (
    <DashboardLayout title="Employee Dashboard" navItems={navItems}>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="dashboard-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Submitted</p>
              <p className="text-3xl font-bold mt-1">0</p>
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
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-3xl font-bold text-warning mt-1">0</p>
            </CardContent>
          </Card>
        </div>

        {/* Purchase Requisitions Section */}
        <Card className="dashboard-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-6">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">My Purchase Requisitions</h2>
            </div>
            
            {/* Empty state */}
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground mb-1">No Requisitions Yet</h3>
              <p className="text-sm text-muted-foreground">
                Your purchase requisitions will appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

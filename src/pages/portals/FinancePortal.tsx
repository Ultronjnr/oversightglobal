import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, DollarSign, BarChart3, Building2, FileText } from "lucide-react";
import { FinanceApprovalQueue } from "@/components/finance/FinanceApprovalQueue";
import { SupplierList } from "@/components/finance/SupplierList";
import { QuotesTable } from "@/components/finance/QuotesTable";
import { getFinancePendingPRs, getQuotes } from "@/services/finance.service";

export default function FinancePortal() {
  const [pendingCount, setPendingCount] = useState(0);
  const [quotesCount, setQuotesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [prsResult, quotesResult] = await Promise.all([
        getFinancePendingPRs(),
        getQuotes(),
      ]);

      if (prsResult.success) {
        setPendingCount(prsResult.data.length);
      }
      if (quotesResult.success) {
        setQuotesCount(quotesResult.data.filter(q => q.status === "SUBMITTED").length);
      }
    } finally {
      setIsLoading(false);
    }
  };

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
              <p className="text-3xl font-bold text-warning mt-1">
                {isLoading ? "-" : pendingCount}
              </p>
            </CardContent>
          </Card>
          <Card className="dashboard-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Pending Quotes</p>
              <p className="text-3xl font-bold text-primary mt-1">
                {isLoading ? "-" : quotesCount}
              </p>
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
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-3xl font-bold mt-1">0</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different sections */}
        <Tabs defaultValue="approvals" className="space-y-4">
          <TabsList>
            <TabsTrigger value="approvals" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Approvals
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Suppliers
            </TabsTrigger>
            <TabsTrigger value="quotes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Quotes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="approvals">
            <FinanceApprovalQueue />
          </TabsContent>

          <TabsContent value="suppliers">
            <SupplierList />
          </TabsContent>

          <TabsContent value="quotes">
            <QuotesTable />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

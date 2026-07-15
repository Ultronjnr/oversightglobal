import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlansTab } from "@/components/billing/PlansTab";
import { PaymentMethodTab } from "@/components/billing/PaymentMethodTab";
import { BillingHistoryTab } from "@/components/billing/BillingHistoryTab";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getPortalNavItems } from "@/lib/admin-nav";

export default function Billing() {
  const [tab, setTab] = useState("plans");
  const { role } = useAuth();
  return (
    <DashboardLayout title="Billing & Subscription" navItems={getPortalNavItems(role)}>
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Billing &amp; Subscription</h1>
          <p className="text-sm text-muted-foreground">
            Manage your organization's plan, payment card and billing history.
          </p>
        </div>
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="w-max sm:w-full flex sm:grid sm:grid-cols-3 mb-4">
              <TabsTrigger value="plans">Plans</TabsTrigger>
              <TabsTrigger value="card">Payment Method</TabsTrigger>
              <TabsTrigger value="history">Billing History</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="plans"><PlansTab /></TabsContent>
          <TabsContent value="card"><PaymentMethodTab /></TabsContent>
          <TabsContent value="history"><BillingHistoryTab /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlansTab } from "@/components/billing/PlansTab";
import { PaymentMethodTab } from "@/components/billing/PaymentMethodTab";
import { BillingHistoryTab } from "@/components/billing/BillingHistoryTab";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getPortalNavItems } from "@/lib/admin-nav";

export default function Billing() {
  const [tab, setTab] = useState("plans");
  const { role } = useAuth();
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    const status = params.get("checkout");
    if (!status) return;
    if (status === "success") {
      toast.success("Payment received — your subscription is being activated.");
      setTab("history");
    } else if (status === "cancelled") {
      toast.info("Checkout cancelled — no payment was taken.");
    } else if (status === "failed") {
      toast.error("Payment failed. Please try again or use another card.");
    }
    params.delete("checkout");
    params.delete("invoice");
    setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DashboardLayout title="Billing & Subscription" navItems={getPortalNavItems(role)}>
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="w-max sm:w-full flex sm:grid sm:grid-cols-3 mb-4">
              <TabsTrigger value="plans">Plans</TabsTrigger>
              <TabsTrigger value="card">Payment Method</TabsTrigger>
              <TabsTrigger value="history">Billing History</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="plans"><PlansTab onCheckout={() => setTab("card")} /></TabsContent>
          <TabsContent value="card"><PaymentMethodTab /></TabsContent>
          <TabsContent value="history"><BillingHistoryTab /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

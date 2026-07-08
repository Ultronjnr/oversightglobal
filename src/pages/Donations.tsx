import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DonationDashboardTab } from "@/components/donations/DonationDashboardTab";
import { DonorRegistryTab } from "@/components/donations/DonorRegistryTab";
import { DonationsTab } from "@/components/donations/DonationsTab";
import { FundingPoolsTab } from "@/components/donations/FundingPoolsTab";
import { ProjectsTab } from "@/components/donations/ProjectsTab";
import { ReceiptsTab } from "@/components/donations/ReceiptsTab";
import { ReportsTab } from "@/components/donations/ReportsTab";
import { BrandingTab } from "@/components/donations/BrandingTab";

export default function Donations() {
  const [tab, setTab] = useState("dashboard");
  return (
    <DashboardLayout title="Donations / 18A">
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Donation Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Donor registry, funding pools and Section 18A receipts.
          </p>
        </div>
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="w-max sm:w-full flex sm:grid sm:grid-cols-8 mb-4">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="donors">Donors</TabsTrigger>
              <TabsTrigger value="donations">Donations</TabsTrigger>
              <TabsTrigger value="pools">Funding</TabsTrigger>
              <TabsTrigger value="projects">Projects</TabsTrigger>
              <TabsTrigger value="receipts">Receipts</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
              <TabsTrigger value="branding">Branding</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="dashboard"><DonationDashboardTab /></TabsContent>
          <TabsContent value="donors"><DonorRegistryTab /></TabsContent>
          <TabsContent value="donations"><DonationsTab /></TabsContent>
          <TabsContent value="pools"><FundingPoolsTab /></TabsContent>
          <TabsContent value="projects"><ProjectsTab /></TabsContent>
          <TabsContent value="receipts"><ReceiptsTab /></TabsContent>
          <TabsContent value="reports"><ReportsTab /></TabsContent>
          <TabsContent value="branding"><BrandingTab /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
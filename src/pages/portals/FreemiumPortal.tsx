import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  FolderOpen,
  UserCog,
  Upload,
  Receipt,
  Landmark,
  Wallet,
  AlertTriangle,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

type View = "dashboard" | "documents" | "profile";

export default function FreemiumPortal() {
  const { profile } = useAuth();
  const [view, setView] = useState<View>("dashboard");

  const navItems = [
    { label: "Dashboard", key: "dashboard" as View, icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: "Document Storage", key: "documents" as View, icon: <FolderOpen className="h-4 w-4" /> },
    { label: "Profile Settings", key: "profile" as View, icon: <UserCog className="h-4 w-4" /> },
  ];

  const displayName = profile?.name
    ? `${profile.name}${profile.surname ? " " + profile.surname : ""}`
    : "there";

  const estimationCards = [
    {
      title: "VAT Estimation",
      description: "Estimate your VAT liability based on stored invoices.",
      icon: <Receipt className="h-5 w-5 text-primary" />,
    },
    {
      title: "Income Tax Estimation",
      description: "Get a quick view of your projected income tax.",
      icon: <Landmark className="h-5 w-5 text-primary" />,
    },
    {
      title: "PAYE Estimation",
      description: "Estimate Pay-As-You-Earn obligations.",
      icon: <Wallet className="h-5 w-5 text-primary" />,
    },
  ];

  return (
    <DashboardLayout title="Freemium Workspace" navItems={[]}>
      {/* Freemium-only nav tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {navItems.map((item) => {
          const active = view === item.key;
          return (
            <Button
              key={item.key}
              variant={active ? "default" : "outline"}
              size="sm"
              onClick={() => setView(item.key)}
              className="gap-2"
            >
              {item.icon}
              {item.label}
            </Button>
          );
        })}
      </div>

      {view === "dashboard" && (
        <div className="space-y-6">
          {/* 1. Welcome Section */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="py-8">
              <h2 className="text-2xl font-bold text-foreground">
                Welcome, {displayName}
              </h2>
              <p className="text-muted-foreground mt-2 max-w-2xl">
                Understand your financial position and avoid unnecessary tax losses.
              </p>
            </CardContent>
          </Card>

          {/* 2. Estimation Cards */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Tax Estimations
            </h3>
            <div className="grid gap-4 md:grid-cols-3">
              {estimationCards.map((card) => (
                <Card key={card.title} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-primary/10">{card.icon}</div>
                      <CardTitle className="text-base">{card.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{card.description}</p>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => toast.info(`${card.title} coming soon`)}
                    >
                      Calculate Estimate
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* 3. Quick Insight */}
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="py-5 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-warning/15">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Quick Insight</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You may be overpaying tax due to missing documentation.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 4. Upgrade Prompt */}
          <Card className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground border-0">
            <CardContent className="py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Sparkles className="h-6 w-6 mt-0.5" />
                <div>
                  <p className="font-semibold text-base">
                    Unlock full financial control and real-time tracking
                  </p>
                  <p className="text-sm opacity-90 mt-1">
                    Upgrade to Standard for PRs, approvals, suppliers and finance workflows.
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => toast.info("Upgrade flow coming soon")}
                className="gap-2"
              >
                Upgrade
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {view === "documents" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              Document Storage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-border rounded-xl p-10 text-center">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Drag & drop files here, or click to upload.
              </p>
              <Button onClick={() => toast.info("Upload coming soon")}>Upload document</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {view === "profile" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-primary" />
              Profile Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-w-xl">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input defaultValue={profile?.name || ""} />
              </div>
              <div>
                <Label>Surname</Label>
                <Input defaultValue={profile?.surname || ""} />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input defaultValue={profile?.email || ""} disabled />
            </div>
            <div>
              <Label>Phone</Label>
              <Input defaultValue={profile?.phone || ""} />
            </div>
            <Button onClick={() => toast.success("Profile saved")}>Save changes</Button>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}

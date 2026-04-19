import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { FreemiumDocumentStorage } from "@/components/freemium/FreemiumDocumentStorage";
import { FreemiumBusinessProfile } from "@/components/freemium/FreemiumBusinessProfile";
import { VatCountdownCard } from "@/components/freemium/VatCountdownCard";
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
  Building2,
  CalendarClock,
  CheckCircle2,
  XCircle,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

type View = "dashboard" | "documents" | "profile";

interface BusinessProfile {
  company_name: string;
  registration_number: string;
  company_type: string;
  vat_registered: boolean;
  vat_number: string | null;
  vat_cycle: string | null;
  next_vat_submission_date: string | null;
}

const DOC_LIMIT = 50;

export default function FreemiumPortal() {
  const { user, profile } = useAuth();
  const [view, setView] = useState<View>("dashboard");
  const [bp, setBp] = useState<BusinessProfile | null>(null);
  const [docCount, setDocCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  const handleUpgrade = async () => {
    if (!user || upgrading) return;
    setUpgrading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ tier: "STANDARD" })
      .eq("id", user.id);
    if (error) {
      setUpgrading(false);
      toast.error("Upgrade failed. Please try again.");
      return;
    }
    toast.success("You now have access to full system features");
    // Reload so AuthContext re-fetches the profile and routing picks up the new tier
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 800);
  };

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const [{ data: bpData }, { count }] = await Promise.all([
        supabase
          .from("freemium_business_profiles")
          .select(
            "company_name, registration_number, company_type, vat_registered, vat_number, vat_cycle, next_vat_submission_date"
          )
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("freemium_documents")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);
      setBp(bpData ?? null);
      setDocCount(count ?? 0);
      setLoading(false);
    };
    load();
  }, [user, view]);

  const displayName = profile?.name
    ? `${profile.name}${profile.surname ? " " + profile.surname : ""}`
    : "there";

  const companyName = bp?.company_name || "Your Company";
  const vatRegistered = !!bp?.vat_registered;
  const nextVatDate = bp?.next_vat_submission_date
    ? new Date(bp.next_vat_submission_date).toLocaleDateString("en-ZA", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Not set";

  const companyTypeLabel =
    bp?.company_type === "PTY_LTD"
      ? "PTY LTD"
      : bp?.company_type === "PLC"
      ? "PLC"
      : bp?.company_type === "NPO"
      ? "NPO"
      : "—";

  const vatCycleLabel =
    bp?.vat_cycle === "MONTHLY"
      ? "Monthly"
      : bp?.vat_cycle === "BI_MONTHLY"
      ? "Bi-Monthly"
      : "—";

  const docPct = Math.min(100, Math.round((docCount / DOC_LIMIT) * 100));

  const estimationCards = [
    {
      title: "VAT Estimate",
      description: "Estimate your VAT liability based on stored invoices.",
      icon: <Receipt className="h-5 w-5 text-primary" />,
    },
    {
      title: "Income Tax Estimate",
      description: "Get a quick view of your projected income tax.",
      icon: <Landmark className="h-5 w-5 text-primary" />,
    },
    {
      title: "PAYE Estimate",
      description: "Estimate Pay-As-You-Earn obligations.",
      icon: <Wallet className="h-5 w-5 text-primary" />,
    },
  ];

  return (
    <DashboardLayout title="Dashboard" navItems={[]}>
      {/* Top nav: Dashboard + Upgrade */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={view === "dashboard" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("dashboard")}
            className="gap-2"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Button>
          <Button
            variant={view === "documents" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("documents")}
            className="gap-2"
          >
            <FolderOpen className="h-4 w-4" />
            Document Storage
          </Button>
          <Button
            variant={view === "profile" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("profile")}
            className="gap-2"
          >
            <UserCog className="h-4 w-4" />
            Profile Settings
          </Button>
        </div>
        <Button
          variant="gradient"
          size="sm"
          onClick={handleUpgrade}
          disabled={upgrading}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          {upgrading ? "Upgrading..." : "Upgrade Plan"}
        </Button>
      </div>

      {view === "dashboard" && (
        <div className="space-y-6">
          {/* Overview Stats — same layout as Admin Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="dashboard-card">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Company</p>
                    <p className="text-lg font-bold mt-1 truncate" title={companyName}>
                      {loading ? "—" : companyName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{companyTypeLabel}</p>
                  </div>
                  <Building2 className="h-8 w-8 text-primary/50 shrink-0" />
                </div>
              </CardContent>
            </Card>

            <Card className="dashboard-card">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">VAT Status</p>
                    <p
                      className={`text-lg font-bold mt-1 ${
                        vatRegistered ? "text-success" : "text-muted-foreground"
                      }`}
                    >
                      {loading ? "—" : vatRegistered ? "Registered" : "Not Registered"}
                    </p>
                    {vatRegistered && bp?.vat_number && (
                      <p className="text-xs text-muted-foreground mt-1">{bp.vat_number}</p>
                    )}
                  </div>
                  {vatRegistered ? (
                    <CheckCircle2 className="h-8 w-8 text-success/50" />
                  ) : (
                    <XCircle className="h-8 w-8 text-muted-foreground/40" />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="dashboard-card">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Next VAT Submission</p>
                    <p className="text-lg font-bold mt-1 text-warning">
                      {loading ? "—" : nextVatDate}
                    </p>
                    {vatRegistered && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {vatCycleLabel} cycle
                      </p>
                    )}
                  </div>
                  <CalendarClock className="h-8 w-8 text-warning/50" />
                </div>
              </CardContent>
            </Card>

            <Card className="dashboard-card">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="w-full">
                    <p className="text-sm text-muted-foreground">Documents Used</p>
                    <p className="text-3xl font-bold mt-1">
                      {loading ? "—" : `${docCount} / ${DOC_LIMIT}`}
                    </p>
                    <Progress value={docPct} className="h-1.5 mt-2" />
                  </div>
                  <FileText className="h-8 w-8 text-primary/50 shrink-0 ml-3" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Welcome — compact strip to mirror Admin's clean stats→tabs rhythm */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="py-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Welcome back, {displayName}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Understand your financial position and avoid unnecessary tax losses.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* VAT Countdown */}
          <VatCountdownCard onSetDate={() => setView("profile")} />

          {/* Tabs: same Tabs component as Admin */}
          <Tabs defaultValue="estimations" className="space-y-4">
            <TabsList className="flex flex-wrap h-auto gap-2">
              <TabsTrigger value="estimations" className="flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Tax Estimations
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Documents
              </TabsTrigger>
              <TabsTrigger value="profile-summary" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Profile Summary
              </TabsTrigger>
            </TabsList>

            {/* Estimation Section */}
            <TabsContent value="estimations" className="space-y-4">
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
                        Calculate
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

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
            </TabsContent>

            {/* Documents Section */}
            <TabsContent value="documents">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FolderOpen className="h-5 w-5 text-primary" />
                      Document Storage
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {docCount} of {DOC_LIMIT} documents used
                    </p>
                  </div>
                  <Button onClick={() => setView("documents")} className="gap-2">
                    <Upload className="h-4 w-4" />
                    Upload Document
                  </Button>
                </CardHeader>
                <CardContent>
                  <Progress value={docPct} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-2">
                    {DOC_LIMIT - docCount} uploads remaining on the FREEMIUM plan.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Profile Summary */}
            <TabsContent value="profile-summary">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    Business Profile Summary
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setView("profile")}>
                    Edit
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <SummaryRow label="Company Name" value={bp?.company_name || "—"} />
                  <SummaryRow label="Company Type" value={companyTypeLabel} />
                  <SummaryRow
                    label="Registration Number"
                    value={bp?.registration_number || "—"}
                  />
                  <SummaryRow
                    label="VAT Registered"
                    value={
                      <Badge
                        variant="outline"
                        className={
                          vatRegistered
                            ? "bg-success/10 text-success border-success/20"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {vatRegistered ? "Yes" : "No"}
                      </Badge>
                    }
                  />
                  {vatRegistered && (
                    <>
                      <SummaryRow label="VAT Number" value={bp?.vat_number || "—"} />
                      <SummaryRow label="VAT Cycle" value={vatCycleLabel} />
                      <SummaryRow label="Next VAT Submission" value={nextVatDate} />
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Upgrade Prompt */}
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
                onClick={handleUpgrade}
                disabled={upgrading}
                className="gap-2"
              >
                {upgrading ? "Upgrading..." : "Upgrade"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {view === "documents" && <FreemiumDocumentStorage />}

      {view === "profile" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5 text-primary" />
                Profile Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-2xl">
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

          <FreemiumBusinessProfile />
        </div>
      )}
    </DashboardLayout>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

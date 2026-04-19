import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, FolderOpen, UserCog, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";

type View = "dashboard" | "documents" | "profile";

export default function FreemiumPortal() {
  const { profile } = useAuth();
  const [view, setView] = useState<View>("dashboard");

  const navItems = [
    { label: "Dashboard", href: "#dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: "Document Storage", href: "#documents", icon: <FolderOpen className="h-4 w-4" /> },
    { label: "Profile Settings", href: "#profile", icon: <UserCog className="h-4 w-4" /> },
  ];

  return (
    <DashboardLayout title="Freemium Workspace" navItems={[]}>
      {/* Simple in-page tabs (Freemium-only nav) */}
      <div className="flex flex-wrap gap-2 mb-6">
        {navItems.map((item) => {
          const key = item.href.replace("#", "") as View;
          const active = view === key;
          return (
            <Button
              key={key}
              variant={active ? "default" : "outline"}
              size="sm"
              onClick={() => setView(key)}
              className="gap-2"
            >
              {item.icon}
              {item.label}
            </Button>
          );
        })}
      </div>

      {view === "dashboard" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Welcome, {profile?.name || "there"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>You're on the <strong>Freemium</strong> plan.</p>
              <p>Store documents and manage your profile. Upgrade to Standard to unlock Purchase Requisitions, Approvals, Suppliers and Finance workflows.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Upgrade to Standard</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Get the full procurement suite: PRs, multi-stage approvals, supplier RFQs, invoice & payment tracking.
              </p>
              <Button onClick={() => toast.info("Upgrade flow coming soon")}>Upgrade now</Button>
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

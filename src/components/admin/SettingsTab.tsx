import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Shield, Globe, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { SUPPORTED_CURRENCIES, CURRENCY_LABELS, type CurrencyCode } from "@/lib/utils";
import { useOrgSettings } from "@/hooks/use-org-settings";
import {
  PERMISSION_SCOPE_LABELS,
  updateOrganizationSettings,
  type PermissionScope,
} from "@/services/org-settings.service";

const SCOPES: PermissionScope[] = ["FINANCE_ADMIN", "HOD_UP", "ALL_STAFF"];

export function SettingsTab() {
  const { profile } = useAuth();
  const { currency, refreshCurrency } = useCurrency();
  const [saving, setSaving] = useState(false);
  const { settings, isLoading: rulesLoading, refresh: refreshRules } = useOrgSettings();
  const [threshold, setThreshold] = useState("0");
  const [savingRules, setSavingRules] = useState(false);

  useEffect(() => {
    setThreshold(String(settings.finance_approval_threshold ?? 0));
  }, [settings.finance_approval_threshold]);

  const saveRule = async (
    updates: Parameters<typeof updateOrganizationSettings>[1],
  ) => {
    if (!profile?.organization_id) {
      toast.error("No organization found for your account.");
      return;
    }
    setSavingRules(true);
    const result = await updateOrganizationSettings(profile.organization_id, updates);
    setSavingRules(false);
    if (!result.success) {
      toast.error(result.error || "Failed to save setting.");
      return;
    }
    await refreshRules();
    toast.success("Setting saved.");
  };

  const handleCurrencyChange = async (value: string) => {
    if (!profile?.organization_id) {
      toast.error("No organization found for your account.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("organizations")
      .update({ currency: value })
      .eq("id", profile.organization_id);
    setSaving(false);
    if (error) {
      toast.error("Failed to update currency.");
      return;
    }
    await refreshCurrency();
    toast.success("Organization currency updated.");
  };

  return (
    <div className="space-y-6">
      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email notifications for new PRs</Label>
              <p className="text-sm text-muted-foreground">
                Receive email when a new PR is submitted
              </p>
            </div>
            <Switch />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Approval reminders</Label>
              <p className="text-sm text-muted-foreground">
                Get reminded about pending approvals
              </p>
            </div>
            <Switch />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Weekly summary</Label>
              <p className="text-sm text-muted-foreground">
                Receive a weekly summary of activity
              </p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Require approval for high-value PRs</Label>
              <p className="text-sm text-muted-foreground">
                PRs above a threshold require additional approval
              </p>
            </div>
            <Switch />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Two-factor authentication</Label>
              <p className="text-sm text-muted-foreground">
                Require 2FA for all users
              </p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-muted-foreground" />
            General
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label>Organization currency</Label>
              <p className="text-sm text-muted-foreground">
                Currency used across all screens and reports
              </p>
            </div>
            <Select
              value={currency}
              onValueChange={handleCurrencyChange}
              disabled={saving}
            >
              <SelectTrigger className="w-56 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_CURRENCIES.map((c: CurrencyCode) => (
                  <SelectItem key={c} value={c}>
                    {CURRENCY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Fiscal year: January - December</Label>
              <p className="text-sm text-muted-foreground">
                Financial reporting period
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

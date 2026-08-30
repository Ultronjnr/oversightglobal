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

      {/* Platform Rules (Layer 9) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
            Platform Rules
          </CardTitle>
          <CardDescription>
            Control who can do what across requisitions, funding and sourcing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label>Who can set Project / Donor on a requisition</Label>
              <p className="text-sm text-muted-foreground">
                Tagging a project reserves money against that project's budget
              </p>
            </div>
            <Select
              value={settings.funding_source_editors}
              onValueChange={(v) => saveRule({ funding_source_editors: v as PermissionScope })}
              disabled={rulesLoading || savingRules}
            >
              <SelectTrigger className="w-56 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {PERMISSION_SCOPE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label>Who can source suppliers and capture quotes</Label>
              <p className="text-sm text-muted-foreground">
                Applies to the supplier quotes action on a requisition
              </p>
            </div>
            <Select
              value={settings.supplier_sourcing_roles}
              onValueChange={(v) => saveRule({ supplier_sourcing_roles: v as PermissionScope })}
              disabled={rulesLoading || savingRules}
            >
              <SelectTrigger className="w-56 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {PERMISSION_SCOPE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label>Require a VAT document before approval</Label>
              <p className="text-sm text-muted-foreground">
                Finance must attach an invoice or receipt before a transaction is approved
              </p>
            </div>
            <Switch
              checked={settings.require_vat_document}
              onCheckedChange={(checked) => saveRule({ require_vat_document: checked })}
              disabled={rulesLoading || savingRules}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label>Finance approval threshold</Label>
              <p className="text-sm text-muted-foreground">
                Requisitions above this amount are flagged for Finance review (0 = always)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step="0.01"
                className="w-40 bg-white"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                disabled={rulesLoading || savingRules}
              />
              <button
                type="button"
                className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
                disabled={rulesLoading || savingRules}
                onClick={() =>
                  saveRule({ finance_approval_threshold: Number(threshold) || 0 })
                }
              >
                Save
              </button>
            </div>
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

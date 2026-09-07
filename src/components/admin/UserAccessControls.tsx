import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Network, ShieldAlert, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  addUserScope,
  getReportsTo,
  getUserScopes,
  removeUserScope,
  setReportsTo,
  type PermissionScope,
} from "@/services/permission.service";
import {
  EXPIRY_PRESETS,
  SCOPE_TYPES,
  expiryToIso,
  type ExpiryPreset,
} from "@/lib/permissions";

interface SimpleUser {
  id: string;
  name: string;
  surname?: string | null;
  email: string;
}

interface Option {
  value: string;
  label: string;
}

interface Props {
  user: SimpleUser;
  colleagues: SimpleUser[];
  /** Super Users are never restricted. */
  disabled?: boolean;
}

const NONE = "__none__";

export function UserAccessControls({ user, colleagues, disabled }: Props) {
  const [scopes, setScopes] = useState<PermissionScope[]>([]);
  const [manager, setManager] = useState<string | null>(null);
  const [options, setOptions] = useState<Record<string, Option[]>>({});
  const [expiry, setExpiry] = useState<ExpiryPreset>("PERMANENT");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([getUserScopes(user.id), getReportsTo(user.id)]).then(([s, m]) => {
      if (!active) return;
      setScopes(s);
      setManager(m);
    });
    return () => {
      active = false;
    };
  }, [user.id]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [projects, donors, departments, categories] = await Promise.all([
        supabase.from("donation_projects").select("id, name").order("name"),
        supabase.from("organization_donors").select("id, name").order("name"),
        supabase.from("departments").select("id, name").order("name"),
        supabase.from("categories").select("id, name").order("name"),
      ]);
      if (!active) return;
      setOptions({
        PROJECT: (projects.data ?? []).map((r) => ({ value: r.id, label: r.name })),
        DONOR: (donors.data ?? []).map((r) => ({ value: r.id, label: r.name })),
        DEPARTMENT: (departments.data ?? []).map((r) => ({ value: r.name, label: r.name })),
        EXPENSE_TYPE: (categories.data ?? []).map((r) => ({ value: r.id, label: r.name })),
      });
    })();
    return () => {
      active = false;
    };
  }, []);

  const labelFor = (type: string, value: string) =>
    options[type]?.find((o) => o.value === value)?.label ?? value;

  const add = async (type: string, value: string) => {
    if (disabled || !value) return;
    setBusy(true);
    const res = await addUserScope(user.id, type, value, expiryToIso(expiry));
    setBusy(false);
    if (!res.success) {
      toast.error(res.error || "Could not save restriction");
      return;
    }
    setScopes(await getUserScopes(user.id));
    toast.success("Restriction added");
  };

  const remove = async (scope: PermissionScope) => {
    if (disabled) return;
    setBusy(true);
    const res = await removeUserScope(user.id, scope.id);
    setBusy(false);
    if (!res.success) {
      toast.error(res.error || "Could not remove restriction");
      return;
    }
    setScopes((prev) => prev.filter((s) => s.id !== scope.id));
  };

  const saveManager = async (value: string) => {
    const managerId = value === NONE ? null : value;
    setBusy(true);
    const res = await setReportsTo(user.id, managerId);
    setBusy(false);
    if (!res.success) {
      toast.error(res.error || "Could not save reporting line");
      return;
    }
    setManager(managerId);
    toast.success("Reporting line saved");
  };

  return (
    <>
      <Card className="dashboard-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Network className="h-4 w-4" /> Reports to
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Anything above this person's approval authority escalates to their supervisor.
          </p>
        </CardHeader>
        <CardContent>
          <Select value={manager ?? NONE} onValueChange={saveManager} disabled={busy}>
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Nobody" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nobody</SelectItem>
              {colleagues
                .filter((c) => c.id !== user.id)
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.surname ?? ""} — {c.email}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="dashboard-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" /> Restrictions
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Leave a section empty to allow everything. Add entries to limit this person to
            those projects, donor funds, departments or expense types only.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="max-w-xs">
            <Label className="text-sm">Applies for</Label>
            <Select
              value={expiry}
              onValueChange={(v) => setExpiry(v as ExpiryPreset)}
              disabled={disabled}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_PRESETS.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {SCOPE_TYPES.map((type) => {
            const current = scopes.filter((s) => s.scope_type === type.key);
            const available = (options[type.key] ?? []).filter(
              (o) => !current.some((c) => c.scope_value === o.value),
            );
            return (
              <div key={type.key} className="border-b last:border-0 pb-4 last:pb-0">
                <Label className="text-sm">{type.label}</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {current.length === 0 && (
                    <Badge variant="secondary">All {type.label.toLowerCase()}</Badge>
                  )}
                  {current.map((s) => (
                    <Badge key={s.id} variant="outline" className="gap-1 pr-1">
                      {labelFor(type.key, s.scope_value)}
                      {s.expires_at && (
                        <span className="text-[10px] text-muted-foreground">
                          until {new Date(s.expires_at).toLocaleDateString("en-ZA")}
                        </span>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-4 w-4"
                        disabled={disabled || busy}
                        onClick={() => remove(s)}
                        aria-label="Remove restriction"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
                <Select
                  value=""
                  onValueChange={(v) => add(type.key, v)}
                  disabled={disabled || busy || available.length === 0}
                >
                  <SelectTrigger className="mt-2 max-w-sm">
                    <SelectValue placeholder={`Restrict to a specific ${type.label.toLowerCase().replace(/s$/, "")}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}

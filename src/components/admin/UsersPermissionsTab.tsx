import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ShieldCheck, Lock, Search, History } from "lucide-react";
import { getOrganizationUsers } from "@/services/admin.service";
import {
  getUserApprovalLimits,
  getUserPermissionOverrides,
  setUserApprovalLimit,
  setUserPermission,
  getPermissionAudit,
  type PermissionAuditEntry,
  type PermissionOverrides,
} from "@/services/permission.service";
import {
  APPROVAL_TYPES,
  PERMISSION_GROUPS,
  ROLE_LABELS,
  defaultRolePermission,
  effectivePermission,
  type AppRoleName,
  type ApprovalLimit,
} from "@/lib/permissions";
import { useCurrency } from "@/contexts/CurrencyContext";
import { cn } from "@/lib/utils";

interface OrgUser {
  id: string;
  name: string;
  surname?: string | null;
  email: string;
  department?: string | null;
  role: AppRoleName;
}

export function UsersPermissionsTab() {
  const { format, currency } = useCurrency();
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<OrgUser | null>(null);
  const [overrides, setOverrides] = useState<PermissionOverrides>({});
  const [limits, setLimits] = useState<Record<string, ApprovalLimit>>({});
  const [limitDrafts, setLimitDrafts] = useState<Record<string, string>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [audit, setAudit] = useState<PermissionAuditEntry[]>([]);

  useEffect(() => {
    getOrganizationUsers().then((res) => {
      if (res.success) {
        const list = res.data as unknown as OrgUser[];
        setUsers(list);
        setSelected((prev) => prev ?? list[0] ?? null);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    setLoadingDetail(true);
    Promise.all([
      getUserPermissionOverrides(selected.id),
      getUserApprovalLimits(selected.id),
      getPermissionAudit(selected.id),
    ]).then(([o, l, a]) => {
      if (!active) return;
      setOverrides(o);
      setLimits(l);
      setAudit(a);
      setLimitDrafts(
        Object.fromEntries(
          APPROVAL_TYPES.map((t) => [
            t.key,
            l[t.key] && !l[t.key].unlimited && l[t.key].max_amount !== null
              ? String(l[t.key].max_amount)
              : "",
          ]),
        ),
      );
      setLoadingDetail(false);
    });
    return () => {
      active = false;
    };
  }, [selected?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      `${u.name} ${u.surname ?? ""} ${u.email}`.toLowerCase().includes(q),
    );
  }, [users, search]);

  const isSuperUser = selected?.role === "ADMIN";

  const togglePermission = async (key: string, next: boolean) => {
    if (!selected || isSuperUser) return;
    const previous = effectivePermission(selected.role, overrides, key);
    setSaving(key);
    setOverrides((prev) => ({ ...prev, [key]: next }));
    const res = await setUserPermission(selected.id, key, next, previous);
    setSaving(null);
    if (!res.success) {
      setOverrides((prev) => ({ ...prev, [key]: previous }));
      toast.error(res.error || "Could not save permission");
      return;
    }
    toast.success(`${next ? "Granted" : "Revoked"} — ${key}`);
  };

  const saveLimit = async (type: string, unlimited: boolean) => {
    if (!selected || isSuperUser) return;
    const raw = limitDrafts[type]?.replace(/[^\d.]/g, "");
    const amount = raw ? Number(raw) : null;
    if (!unlimited && (amount === null || Number.isNaN(amount))) {
      toast.error("Enter a maximum amount, or choose unlimited");
      return;
    }
    setSaving(type);
    const res = await setUserApprovalLimit(
      selected.id,
      type,
      { maxAmount: amount, unlimited, currency },
      limits[type],
    );
    setSaving(null);
    if (!res.success) {
      toast.error(res.error || "Could not save approval limit");
      return;
    }
    setLimits((prev) => ({
      ...prev,
      [type]: {
        approval_type: type,
        max_amount: unlimited ? null : amount,
        currency,
        unlimited,
      },
    }));
    getPermissionAudit(selected.id).then(setAudit);
    toast.success("Approval limit saved");
  };

  if (loading) {
    return <Skeleton className="h-72 w-full" />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* User list */}
      <Card className="dashboard-card h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Organisation users</CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search users"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-1 max-h-[520px] overflow-y-auto">
          {filtered.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setSelected(u)}
              className={cn(
                "w-full text-left rounded-lg px-3 py-2 transition-colors",
                selected?.id === u.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted",
              )}
            >
              <p className="text-sm font-medium truncate">
                {u.name} {u.surname}
              </p>
              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              <Badge variant="secondary" className="mt-1 text-[10px]">
                {ROLE_LABELS[u.role] ?? u.role}
              </Badge>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">No users found</p>
          )}
        </CardContent>
      </Card>

      {/* Detail */}
      <div className="space-y-6">
        {!selected ? (
          <Card className="dashboard-card">
            <CardContent className="py-12 text-center text-muted-foreground">
              Select a user to configure their permissions.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="dashboard-card">
              <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {selected.name} {selected.surname}
                  </p>
                  <p className="text-sm text-muted-foreground">{selected.email}</p>
                  {selected.department && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Department: {selected.department}
                    </p>
                  )}
                </div>
                <Badge className="gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {ROLE_LABELS[selected.role] ?? selected.role}
                </Badge>
              </CardContent>
            </Card>

            {isSuperUser && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm flex items-start gap-2">
                <Lock className="h-4 w-4 mt-0.5 text-primary" />
                <span>
                  Super Users have full, unrestricted access to the organisation. Their
                  permissions and approval limits cannot be reduced.
                </span>
              </div>
            )}

            {/* Approval limits */}
            <Card className="dashboard-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Approval limits</CardTitle>
                <p className="text-sm text-muted-foreground">
                  The highest amount this person may approve. Enforced in the database —
                  approvals above the limit are rejected.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {APPROVAL_TYPES.map((t) => {
                  const lim = limits[t.key];
                  return (
                    <div
                      key={t.key}
                      className="flex flex-wrap items-end gap-3 border-b last:border-0 pb-4 last:pb-0"
                    >
                      <div className="min-w-[180px]">
                        <Label className="text-sm">{t.label}</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {isSuperUser
                            ? "Unrestricted"
                            : lim?.unlimited
                              ? "Unlimited"
                              : lim?.max_amount != null
                                ? `Current: ${format(lim.max_amount)}`
                                : "No limit configured"}
                        </p>
                      </div>
                      <div className="w-40">
                        <Input
                          inputMode="decimal"
                          placeholder="Max amount"
                          disabled={isSuperUser || loadingDetail}
                          value={limitDrafts[t.key] ?? ""}
                          onChange={(e) =>
                            setLimitDrafts((p) => ({ ...p, [t.key]: e.target.value }))
                          }
                        />
                      </div>
                      <Button
                        size="sm"
                        disabled={isSuperUser || saving === t.key}
                        onClick={() => saveLimit(t.key, false)}
                      >
                        Save limit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isSuperUser || saving === t.key}
                        onClick={() => saveLimit(t.key, true)}
                      >
                        Unlimited
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Permission groups */}
            {PERMISSION_GROUPS.map((group) => (
              <Card key={group.id} className="dashboard-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{group.label}</CardTitle>
                </CardHeader>
                <CardContent className="divide-y">
                  {group.permissions.map((perm) => {
                    const value = isSuperUser
                      ? true
                      : effectivePermission(selected.role, overrides, perm.key);
                    const isDefault = !(perm.key in overrides);
                    return (
                      <div
                        key={perm.key}
                        className="flex items-center justify-between py-2.5 gap-4"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium flex items-center gap-2">
                            {perm.label}
                            {perm.approval && (
                              <Badge variant="outline" className="text-[10px]">
                                Approval
                              </Badge>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isSuperUser
                              ? "Always allowed for Super Users"
                              : isDefault
                                ? `Role default (${defaultRolePermission(selected.role, perm.key) ? "allowed" : "blocked"})`
                                : "Customised for this user"}
                          </p>
                        </div>
                        <Switch
                          checked={value}
                          disabled={isSuperUser || saving === perm.key || loadingDetail}
                          onCheckedChange={(next) => togglePermission(perm.key, next)}
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}

            {/* Audit */}
            <Card className="dashboard-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" /> Recent permission changes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {audit.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {audit.map((a) => (
                      <li key={a.id} className="flex flex-wrap gap-2 justify-between border-b pb-2 last:border-0">
                        <span>
                          <strong>{a.subject}</strong>: {a.old_value ?? "—"} → {a.new_value ?? "—"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(a.created_at).toLocaleString("en-ZA")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

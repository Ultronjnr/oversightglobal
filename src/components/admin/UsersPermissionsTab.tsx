import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ShieldCheck,
  Lock,
  Search,
  History,
  Check,
  X as XIcon,
  SlidersHorizontal,
  ArrowLeft,
  RotateCcw,
} from "lucide-react";
import { getOrganizationUsers } from "@/services/admin.service";
import {
  getUserApprovalLimits,
  getUserPermissionOverrides,
  setUserApprovalLimit,
  setUserPermission,
  getPermissionAudit,
  resetUserToPreset,
  type PermissionAuditEntry,
  type PermissionOverrides,
} from "@/services/permission.service";
import {
  APPROVAL_TYPES,
  PERMISSION_GROUPS,
  ROLE_LABELS,
  ROLE_SUMMARIES,
  defaultRolePermission,
  effectivePermission,
  EXPIRY_PRESETS,
  expiryToIso,
  type AppRoleName,
  type ApprovalLimit,
  type ExpiryPreset,
} from "@/lib/permissions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAccessControls } from "@/components/admin/UserAccessControls";
import { ApprovalTrail } from "@/components/admin/ApprovalTrail";
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

const initials = (u: OrgUser) =>
  `${u.name?.[0] ?? ""}${u.surname?.[0] ?? ""}`.toUpperCase() || "?";

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
  const [grantExpiry, setGrantExpiry] = useState<ExpiryPreset>("PERMANENT");
  const [monthDrafts, setMonthDrafts] = useState<Record<string, string>>({});
  const [advanced, setAdvanced] = useState(false);

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

  const loadDetail = (userId: string) =>
    Promise.all([
      getUserPermissionOverrides(userId),
      getUserApprovalLimits(userId),
      getPermissionAudit(userId),
    ]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    setLoadingDetail(true);
    loadDetail(selected.id).then(([o, l, a]) => {
      if (!active) return;
      setOverrides(o);
      setLimits(l);
      setAudit(a);
      setMonthDrafts(
        Object.fromEntries(
          APPROVAL_TYPES.map((t) => [
            t.key,
            l[t.key]?.max_approvals_per_month != null
              ? String(l[t.key].max_approvals_per_month)
              : "",
          ]),
        ),
      );
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
  const isCustomised = Object.keys(overrides).length > 0;

  const togglePermission = async (key: string, next: boolean) => {
    if (!selected || isSuperUser) return;
    const previous = effectivePermission(selected.role, overrides, key);
    setSaving(key);
    setOverrides((prev) => ({ ...prev, [key]: next }));
    const res = await setUserPermission(
      selected.id,
      key,
      next,
      previous,
      next ? expiryToIso(grantExpiry) : null,
    );
    setSaving(null);
    if (!res.success) {
      setOverrides((prev) => ({ ...prev, [key]: previous }));
      toast.error(res.error || "Could not save permission");
      return;
    }
    toast.success(next ? "Access granted" : "Access removed");
  };

  const handleReset = async () => {
    if (!selected || isSuperUser) return;
    setSaving("reset");
    const res = await resetUserToPreset(selected.id);
    setSaving(null);
    if (!res.success) {
      toast.error(res.error || "Could not reset permissions");
      return;
    }
    const [o, l, a] = await loadDetail(selected.id);
    setOverrides(o);
    setLimits(l);
    setAudit(a);
    toast.success(`Reset to the ${ROLE_LABELS[selected.role]} preset`);
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
      {
        maxAmount: amount,
        unlimited,
        currency,
        maxApprovalsPerMonth: monthDrafts[type]?.trim()
          ? Number(monthDrafts[type].replace(/[^\d]/g, ""))
          : null,
        expiresAt: expiryToIso(grantExpiry),
      },
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
        max_approvals_per_month: monthDrafts[type]?.trim()
          ? Number(monthDrafts[type].replace(/[^\d]/g, ""))
          : null,
        expires_at: expiryToIso(grantExpiry),
      },
    }));
    getPermissionAudit(selected.id).then(setAudit);
    toast.success("Approval limit saved");
  };

  if (loading) {
    return <Skeleton className="h-72 w-full" />;
  }

  const summary = selected ? ROLE_SUMMARIES[selected.role] : null;

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
              onClick={() => {
                setSelected(u);
                setAdvanced(false);
              }}
              className={cn(
                "w-full text-left rounded-lg px-3 py-2 transition-colors",
                selected?.id === u.id
                  ? "bg-primary/10 border border-primary/30"
                  : "hover:bg-muted",
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
      <div className="space-y-5">
        {!selected || !summary ? (
          <Card className="dashboard-card">
            <CardContent className="py-12 text-center text-muted-foreground">
              Select a person to see and change what they can do.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Person header */}
            <Card className="dashboard-card overflow-hidden">
              <div className="bg-gradient-to-r from-primary/90 to-primary px-5 py-4 text-primary-foreground">
                <h3 className="text-lg font-semibold">
                  {advanced ? "Advanced permissions" : "Access overview"}
                </h3>
                <p className="text-sm opacity-90">
                  {advanced
                    ? "Fine-tune exactly what this person can do. Overrides the role preset."
                    : "What this person can and cannot do today."}
                </p>
              </div>
              <CardContent className="pt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 text-primary grid place-items-center text-sm font-semibold">
                    {initials(selected)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">
                      {selected.name} {selected.surname}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {ROLE_LABELS[selected.role]}
                      {selected.department ? ` · ${selected.department}` : ""}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {isCustomised && !isSuperUser
                    ? "Customised access"
                    : `Based on: ${ROLE_LABELS[selected.role]} preset`}
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

            {!advanced ? (
              /* ---------------- Simple view ---------------- */
              <>
                <Card className="dashboard-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{summary.headline}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-success mb-2">
                        Can
                      </p>
                      <ul className="space-y-1.5">
                        {summary.can.map((c) => (
                          <li key={c} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Cannot
                      </p>
                      {summary.cannot.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No restrictions apply.
                        </p>
                      ) : (
                        <ul className="space-y-1.5">
                          {summary.cannot.map((c) => (
                            <li
                              key={c}
                              className="flex items-start gap-2 text-sm text-muted-foreground"
                            >
                              <XIcon className="h-4 w-4 mt-0.5 shrink-0" />
                              {c}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="dashboard-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Approval authority</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-3">
                    {APPROVAL_TYPES.map((t) => {
                      const lim = limits[t.key];
                      return (
                        <div key={t.key} className="rounded-lg border bg-muted/30 p-3">
                          <p className="text-xs text-muted-foreground">{t.label}</p>
                          <p className="text-sm font-semibold mt-1">
                            {isSuperUser
                              ? "Unrestricted"
                              : lim?.unlimited
                                ? "Unlimited"
                                : lim?.max_amount != null
                                  ? `up to ${format(lim.max_amount)}`
                                  : "No limit set"}
                          </p>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setAdvanced(true)} disabled={isSuperUser}>
                    <SlidersHorizontal className="h-4 w-4 mr-2" /> Advanced permissions
                  </Button>
                  <Button
                    variant="outline"
                    disabled={isSuperUser || !isCustomised || saving === "reset"}
                    onClick={handleReset}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" /> Reset to preset
                  </Button>
                </div>
              </>
            ) : (
              /* ---------------- Advanced view ---------------- */
              <>
                <p className="text-sm text-muted-foreground">
                  Toggles below start from the <strong>{ROLE_LABELS[selected.role]}</strong>{" "}
                  preset. Change anything you like — this person&apos;s access becomes fully
                  custom.
                </p>

                <Card className="dashboard-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Access period</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      New permissions and limits saved below apply for this period. When it
                      ends, access returns to the role preset automatically.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <Select
                      value={grantExpiry}
                      onValueChange={(v) => setGrantExpiry(v as ExpiryPreset)}
                      disabled={isSuperUser}
                    >
                      <SelectTrigger className="max-w-xs">
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
                  </CardContent>
                </Card>

                {/* Permission groups */}
                {PERMISSION_GROUPS.map((group) => {
                  const on = group.permissions.filter((p) =>
                    isSuperUser ? true : effectivePermission(selected.role, overrides, p.key),
                  ).length;
                  return (
                    <Card key={group.id} className="dashboard-card">
                      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-base">{group.label}</CardTitle>
                        <span className="text-xs text-muted-foreground">
                          {group.note ?? `${on} of ${group.permissions.length} on`}
                        </span>
                      </CardHeader>
                      <CardContent className="divide-y pt-0">
                        {group.permissions.map((perm) => {
                          const value = isSuperUser
                            ? true
                            : effectivePermission(selected.role, overrides, perm.key);
                          const isDefault = !(perm.key in overrides);
                          return (
                            <div
                              key={perm.key}
                              className="flex items-center justify-between py-3 gap-4"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium">{perm.label}</p>
                                <p
                                  className={cn(
                                    "text-xs",
                                    perm.sensitive
                                      ? "text-destructive"
                                      : "text-muted-foreground",
                                  )}
                                >
                                  {perm.sensitive
                                    ? `${perm.hint ?? ""} — grant with care`
                                    : (perm.hint ??
                                      (isDefault
                                        ? `Role default (${defaultRolePermission(selected.role, perm.key) ? "allowed" : "blocked"})`
                                        : "Customised for this person"))}
                                </p>
                              </div>
                              <Switch
                                checked={value}
                                disabled={
                                  isSuperUser || saving === perm.key || loadingDetail
                                }
                                onCheckedChange={(next) => togglePermission(perm.key, next)}
                              />
                            </div>
                          );
                        })}

                        {/* Approval limits sit inside the Approvals group */}
                        {group.id === "approvals" && (
                          <div className="pt-4 space-y-4">
                            {APPROVAL_TYPES.map((t) => {
                              const lim = limits[t.key];
                              return (
                                <div
                                  key={t.key}
                                  className="rounded-lg bg-muted/30 p-3 space-y-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <Label className="text-sm">{t.label} limit</Label>
                                    <Badge variant="outline" className="text-[11px]">
                                      {isSuperUser
                                        ? "Unrestricted"
                                        : lim?.unlimited
                                          ? "Unlimited"
                                          : lim?.max_amount != null
                                            ? `up to ${format(lim.max_amount)}`
                                            : "No limit set"}
                                    </Badge>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Input
                                      className="w-36"
                                      inputMode="decimal"
                                      placeholder="Max amount"
                                      disabled={isSuperUser || loadingDetail}
                                      value={limitDrafts[t.key] ?? ""}
                                      onChange={(e) =>
                                        setLimitDrafts((p) => ({
                                          ...p,
                                          [t.key]: e.target.value,
                                        }))
                                      }
                                    />
                                    <Input
                                      className="w-36"
                                      inputMode="numeric"
                                      placeholder="Max per month"
                                      disabled={isSuperUser || loadingDetail}
                                      value={monthDrafts[t.key] ?? ""}
                                      onChange={(e) =>
                                        setMonthDrafts((p) => ({
                                          ...p,
                                          [t.key]: e.target.value,
                                        }))
                                      }
                                    />
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
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

                <UserAccessControls
                  user={selected}
                  colleagues={users}
                  disabled={isSuperUser}
                />

                <ApprovalTrail
                  approverId={selected.id}
                  approverName={`${selected.name} ${selected.surname ?? ""}`.trim()}
                  title="Approvals made by this person"
                />

                {/* Audit */}
                <Card className="dashboard-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <History className="h-4 w-4" /> Recent permission changes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {audit.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No changes recorded yet.
                      </p>
                    ) : (
                      <ul className="space-y-2 text-sm">
                        {audit.map((a) => (
                          <li
                            key={a.id}
                            className="flex flex-wrap gap-2 justify-between border-b pb-2 last:border-0"
                          >
                            <span>
                              <strong>{a.subject}</strong>: {a.old_value ?? "—"} →{" "}
                              {a.new_value ?? "—"}
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

                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={() => setAdvanced(false)}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to simple view
                  </Button>
                  <Button
                    variant="outline"
                    disabled={isSuperUser || !isCustomised || saving === "reset"}
                    onClick={handleReset}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" /> Reset to preset
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

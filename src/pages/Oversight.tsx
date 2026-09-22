import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatformAdmin } from "@/hooks/use-platform-admin";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import {
  Building2,
  Users,
  Receipt,
  HandCoins,
  Activity,
  Megaphone,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import {
  getPlatformOrganizations,
  getPlatformOverview,
  type PlatformOrganization,
  type PlatformOverview,
} from "@/services/platform.service";
import { AdvertisementsManager } from "@/components/oversight/AdvertisementsManager";

function Metric({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: JSX.Element;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-bold tabular-nums">{value}</p>
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function Bars({
  rows,
  valueLabel,
}: {
  rows: { label: string; amount: number }[];
  valueLabel?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.amount));
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">No data yet.</p>;
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="truncate pr-2">{r.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {valueLabel === "count" ? r.amount : formatCurrency(r.amount)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.round((r.amount / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Oversight() {
  const { isStaff, isLoading } = usePlatformAdmin();
  const { user, profile, signOut } = useAuth();
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [orgs, setOrgs] = useState<PlatformOrganization[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!isStaff) return;
    Promise.all([getPlatformOverview(), getPlatformOrganizations()]).then(
      ([o, list]) => {
        setOverview(o);
        setOrgs(list);
        setLoadingData(false);
      },
    );
  }, [isStaff]);

  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isStaff) return <Navigate to="/dashboard" replace />;

  const ctr =
    overview && overview.ad_views > 0
      ? `${Math.round((overview.ad_clicks / overview.ad_views) * 100)}% click-through`
      : "No views yet";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">Ovasyt Oversight</p>
              <p className="text-[11px] leading-tight text-muted-foreground">
                Internal platform dashboard
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:block">
              {profile?.email || user.email}
            </span>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard">App</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              <LogOut className="mr-1.5 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <h1 className="text-2xl font-bold sm:text-3xl">Platform overview</h1>

        {loadingData ? (
          <p className="text-sm text-muted-foreground">Loading platform data…</p>
        ) : (
          <Tabs defaultValue="overview" className="space-y-5">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="organizations">Organisations</TabsTrigger>
              <TabsTrigger value="adverts">Advertisements</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-5">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Metric
                  label="Organisations"
                  value={String(overview?.organizations ?? 0)}
                  hint={`${overview?.org_types?.length ?? 0} industry types`}
                  icon={<Building2 className="h-4 w-4" />}
                />
                <Metric
                  label="Active users (30 days)"
                  value={String(overview?.active_users_30d ?? 0)}
                  hint={`${overview?.users ?? 0} accounts in total`}
                  icon={<Users className="h-4 w-4" />}
                />
                <Metric
                  label="Transaction volume"
                  value={formatCurrency(overview?.transaction_value ?? 0)}
                  hint={`${overview?.transactions ?? 0} transactions`}
                  icon={<Receipt className="h-4 w-4" />}
                />
                <Metric
                  label="Donations recorded"
                  value={formatCurrency(overview?.donations_value ?? 0)}
                  hint={`${overview?.donors ?? 0} donors · ${overview?.projects ?? 0} projects`}
                  icon={<HandCoins className="h-4 w-4" />}
                />
                <Metric
                  label="Invoice scans"
                  value={String(overview?.scans ?? 0)}
                  icon={<Activity className="h-4 w-4" />}
                />
                <Metric
                  label="Requisitions & quotes"
                  value={`${overview?.requisitions ?? 0} / ${overview?.quotes ?? 0}`}
                  hint={`${overview?.suppliers ?? 0} suppliers`}
                  icon={<Activity className="h-4 w-4" />}
                />
                <Metric
                  label="Payment batches"
                  value={String(overview?.batches ?? 0)}
                  hint={`${formatCurrency(overview?.paid_value ?? 0)} settled`}
                  icon={<Receipt className="h-4 w-4" />}
                />
                <Metric
                  label="Advert performance"
                  value={`${overview?.ad_views ?? 0} / ${overview?.ad_clicks ?? 0}`}
                  hint={ctr}
                  icon={<Megaphone className="h-4 w-4" />}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Organisation types</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Bars
                      valueLabel="count"
                      rows={(overview?.org_types ?? []).map((t) => ({
                        label: t.label,
                        amount: Number(t.value),
                      }))}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Expense categories</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Bars
                      rows={(overview?.categories ?? []).map((c) => ({
                        label: c.label,
                        amount: Number(c.amount),
                      }))}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Spending pattern (12 months)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Bars
                      rows={(overview?.monthly ?? []).map((m) => ({
                        label: m.month,
                        amount: Number(m.amount),
                      }))}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="organizations">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    All organisations ({orgs.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Organisation</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Users</TableHead>
                        <TableHead className="text-right">Transactions</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead className="text-right">Requisitions</TableHead>
                        <TableHead className="text-right">Donations</TableHead>
                        <TableHead>Last activity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orgs.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="font-medium">{o.name}</TableCell>
                          <TableCell>{o.organisation_type}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {o.users}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {o.transactions}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(Number(o.transaction_value))}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {o.requisitions}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(Number(o.donations_value))}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {o.last_activity
                              ? new Date(o.last_activity).toLocaleDateString()
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="adverts">
              <AdvertisementsManager organizations={orgs} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

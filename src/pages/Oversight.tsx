import { useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatformAdmin } from "@/hooks/use-platform-admin";
import { LoadingScreen } from "@/components/LoadingScreen";
import internalLogo from "@/assets/ovasyt-internal-logo.png";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarRail, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { formatCurrency } from "@/lib/utils";
import {
  Activity, BarChart3, Building2, ChevronRight, Eye, FileSearch, HandCoins,
  LayoutDashboard, LogOut, Megaphone, MousePointerClick, ReceiptText,
  ShieldCheck, Sparkles, UserPlus, Users, Wallet, Waypoints,
} from "lucide-react";
import {
  getPlatformCustomerIntelligence, getPlatformOrganizations, getPlatformOverview,
  getPlatformRecentUsers, getPlatformLiveAnalytics, type PlatformCustomerIntelligence, type PlatformOrganization,
  type PlatformOverview, type PlatformRecentUser, type PlatformLiveAnalytics,
} from "@/services/platform.service";
import { AdvertisementsManager } from "@/components/oversight/AdvertisementsManager";

const trafficFallback = {
  visitors: 0, pageViews: 0, viewsPerVisit: 0, duration: "—", bounce: 0,
  daily: [] as number[],
  sources: [] as (readonly [string, number])[],
  pages: [] as (readonly [string, number])[],
  devices: [] as (readonly [string, number])[],
  countries: [] as (readonly [string, number])[],
};

type Section = "overview" | "organizations" | "intelligence" | "analytics" | "adverts" | "activity";

const sectionMeta: Record<Section, { label: string; description: string; icon: ElementType }> = {
  overview: { label: "Overview", description: "Real-time intelligence and ecosystem health", icon: LayoutDashboard },
  organizations: { label: "Organisations", description: "Customer profiles, contacts and platform activity", icon: Building2 },
  intelligence: { label: "Customer Intelligence", description: "What customers need and how they discovered Ovasyt", icon: Sparkles },
  analytics: { label: "Analytics", description: "Visitor acquisition, engagement and popular pages", icon: BarChart3 },
  adverts: { label: "Advertisements", description: "Create, target and measure dashboard campaigns", icon: Megaphone },
  activity: { label: "Platform Activity", description: "Recent users and operational platform signals", icon: Activity },
};

function InternalSidebar({ section, setSection }: { section: Section; setSection: (value: Section) => void }) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const { profile, user, signOut } = useAuth();
  const collapsed = state === "collapsed";
  const select = (value: Section) => { setSection(value); if (isMobile) setOpenMobile(false); };
  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex h-10 items-center overflow-hidden">
          {collapsed ? (
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground"><ShieldCheck className="h-5 w-5" /></div>
          ) : (
            <div className="flex items-center gap-2">
              <img src={internalLogo} alt="Ovasyt" className="h-10 w-28 object-contain object-left" />
              <div className="border-l border-sidebar-border pl-2"><p className="text-xs font-bold">Internal</p><p className="text-[10px] text-muted-foreground">Command center</p></div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {(Object.keys(sectionMeta) as Section[]).map((key) => {
                const item = sectionMeta[key];
                return <SidebarMenuItem key={key}>
                  <SidebarMenuButton isActive={section === key} tooltip={item.label} onClick={() => select(key)}>
                    <item.icon className="h-4 w-4" /><span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>;
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Customer app"><Link to="/dashboard"><Waypoints className="h-4 w-4" /><span>Customer app</span></Link></SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Log out" onClick={() => signOut()}><LogOut className="h-4 w-4" /><span>Log out</span></SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {!collapsed && <div className="mt-2 px-2 pb-1"><p className="truncate text-xs font-semibold">{profile?.name || "Ovasyt administrator"}</p><p className="truncate text-[10px] text-muted-foreground">{profile?.email || user?.email}</p></div>}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function StatCard({ label, value, hint, icon: Icon, tone = "primary" }: { label: string; value: string; hint: string; icon: ElementType; tone?: "primary" | "success" | "warning" }) {
  const toneClass = tone === "success" ? "bg-success/10 text-success" : tone === "warning" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary";
  return <Card className="overflow-hidden border-border/70 shadow-sm transition-shadow hover:shadow-md">
    <CardContent className="p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3"><div className={`grid h-10 w-10 place-items-center rounded-xl ${toneClass}`}><Icon className="h-5 w-5" /></div><Badge variant="secondary" className="text-[10px]">Live</Badge></div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 break-words text-xl font-bold leading-tight tabular-nums sm:text-2xl">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </CardContent>
  </Card>;
}

function Distribution({ title, rows, empty = "No information captured yet.", currency = false }: { title: string; rows: { label: string; amount: number }[]; empty?: string; currency?: boolean }) {
  const max = Math.max(1, ...rows.map((row) => row.amount));
  return <Card className="border-border/70 shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="space-y-4">
    {rows.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : rows.map((row) => <div key={row.label}>
      <div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="truncate font-medium">{row.label}</span><span className="tabular-nums text-muted-foreground">{currency ? formatCurrency(row.amount) : row.amount}</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${Math.max(5, row.amount / max * 100)}%` }} /></div>
    </div>)}
  </CardContent></Card>;
}

function countValues(items: PlatformCustomerIntelligence[], key: keyof PlatformCustomerIntelligence) {
  const counts = new Map<string, number>();
  items.forEach((item) => { const value = item[key]; if (typeof value === "string" && value.trim()) counts.set(value, (counts.get(value) ?? 0) + 1); });
  return [...counts].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
}

function PageSection({ title, children }: { title: string; children: ReactNode }) {
  return <section><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2></div>{children}</section>;
}

export default function Oversight() {
  const { isStaff, isLoading } = usePlatformAdmin();
  const { user } = useAuth();
  const [section, setSection] = useState<Section>("overview");
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [orgs, setOrgs] = useState<PlatformOrganization[]>([]);
  const [customers, setCustomers] = useState<PlatformCustomerIntelligence[]>([]);
  const [recentUsers, setRecentUsers] = useState<PlatformRecentUser[]>([]);
  const [liveTraffic, setLiveTraffic] = useState<PlatformLiveAnalytics | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!isStaff) return;
    Promise.all([getPlatformOverview(), getPlatformOrganizations(), getPlatformCustomerIntelligence(), getPlatformRecentUsers(30), getPlatformLiveAnalytics(30)]).then(([summary, organizations, intelligence, users, analytics]) => {
      setOverview(summary); setOrgs(organizations); setCustomers(intelligence); setRecentUsers(users); setLiveTraffic(analytics); setLoadingData(false);
    });
  }, [isStaff]);

  const completedOnboarding = customers.filter((item) => item.onboarding_completed_at).length;
  const incompleteProfiles = customers.filter((item) => !item.organisation_type).length;
  const typedOrgRows = (overview?.org_types ?? []).filter((item) => item.label !== "Unspecified").map((item) => ({ label: item.label, amount: Number(item.value) }));
  const signupCount = customers.filter((item) => Date.now() - new Date(item.organization_created_at).getTime() <= 30 * 86400000).length;
  const orgById = useMemo(() => new Map(orgs.map((org) => [org.id, org])), [orgs]);
  const traffic = liveTraffic && liveTraffic.page_views > 0 ? {
    visitors: liveTraffic.visitors,
    pageViews: liveTraffic.page_views,
    viewsPerVisit: liveTraffic.views_per_visit,
    bounce: liveTraffic.bounce_rate,
    daily: liveTraffic.daily.map((item) => item.visitors),
    sources: liveTraffic.sources.map((item) => [item.label, item.value] as const),
    pages: liveTraffic.pages.map((item) => [item.label, item.value] as const),
    devices: liveTraffic.devices.map((item) => [item.label, item.value] as const),
  } : trafficFallback;
  const growth = overview?.organization_growth ?? [];
  const growthMax = Math.max(1, ...growth.map((item) => Number(item.total)));

  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isStaff) return <Navigate to="/dashboard" replace />;

  const page = sectionMeta[section];
  return <SidebarProvider>
    <InternalSidebar section={section} setSection={setSection} />
    <SidebarInset className="min-w-0 bg-background">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3"><SidebarTrigger className="h-9 w-9" /><div className="min-w-0"><h1 className="truncate text-lg font-bold sm:text-xl">{page.label}</h1><p className="hidden truncate text-xs text-muted-foreground sm:block">{page.description}</p></div></div>
        <Badge variant="outline" className="shrink-0 gap-1.5"><span className="h-2 w-2 rounded-full bg-success" />Internal admin</Badge>
      </header>

      <main className="mx-auto w-full max-w-[1600px] space-y-7 p-4 sm:p-6 lg:p-8">
        {loadingData ? <LoadingScreen /> : <>
          {section === "overview" && <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Organisations" value={String(overview?.organizations ?? 0)} hint={`${signupCount} new in the last 30 days`} icon={Building2} />
              <StatCard label="Active users" value={String(overview?.active_users_30d ?? 0)} hint={`${overview?.users ?? 0} accounts in total`} icon={Users} tone="success" />
              <StatCard label="Transaction volume" value={formatCurrency(overview?.transaction_value ?? 0)} hint={`${overview?.transactions ?? 0} recorded transactions`} icon={Wallet} />
              <StatCard label="Donations recorded" value={formatCurrency(overview?.donations_value ?? 0)} hint={`${overview?.donors ?? 0} donors · ${overview?.projects ?? 0} projects`} icon={HandCoins} tone="warning" />
            </div>

            <div className="grid gap-6 xl:grid-cols-12">
              <Card className="border-border/70 shadow-sm xl:col-span-8"><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>Traffic analytics</CardTitle><p className="mt-1 text-xs text-muted-foreground">Live rolling 30 days</p></div><Badge variant="secondary">{traffic.visitors} visitors</Badge></CardHeader><CardContent>
                <div className="mb-6 grid grid-cols-3 gap-3"><Mini label="Page views" value={String(traffic.pageViews)} /><Mini label="Views / visit" value={String(traffic.viewsPerVisit)} /><Mini label="Bounce rate" value={`${traffic.bounce}%`} /></div>
                <div className="flex h-40 items-end gap-3 border-b border-border px-1">{traffic.daily.map((value, index) => <div key={index} className="flex h-full flex-1 items-end"><div className="w-full rounded-t-md bg-primary/80 transition-all hover:bg-primary" style={{ height: `${Math.max(18, value * 9)}%` }} /></div>)}</div>
                <div className="mt-2 flex justify-between text-[10px] text-muted-foreground"><span>Sep 15</span><span>Sep 17</span><span>Sep 19</span><span>Sep 22</span></div>
              </CardContent></Card>
              <Card className="overflow-hidden border-primary/20 bg-primary text-primary-foreground shadow-lg xl:col-span-4"><CardContent className="flex h-full min-h-64 flex-col justify-between p-6"><div><Sparkles className="mb-5 h-7 w-7" /><h2 className="text-xl font-bold">Onboarding health</h2><p className="mt-2 text-sm text-primary-foreground/75">Customer profiles completed and ready for informed support.</p></div><div><div className="mb-2 flex items-end justify-between"><span className="text-4xl font-bold">{customers.length ? Math.round(completedOnboarding / customers.length * 100) : 0}%</span><span className="text-xs">{completedOnboarding} of {customers.length}</span></div><div className="h-2 overflow-hidden rounded-full bg-primary-foreground/20"><div className="h-full rounded-full bg-primary-foreground" style={{ width: `${customers.length ? completedOnboarding / customers.length * 100 : 0}%` }} /></div>{incompleteProfiles > 0 && <p className="mt-3 text-xs text-primary-foreground/75">{incompleteProfiles} profiles need an organisation type.</p>}</div></CardContent></Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-12">
              <Card className="border-border/70 shadow-sm xl:col-span-8"><CardHeader><CardTitle>Recent organisations</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Organisation</TableHead><TableHead>Type</TableHead><TableHead>Contact</TableHead><TableHead className="text-right">Volume</TableHead><TableHead>Joined</TableHead></TableRow></TableHeader><TableBody>{customers.slice(0, 6).map((customer) => <TableRow key={customer.organization_id}><TableCell className="font-semibold">{customer.organization_name}</TableCell><TableCell><Badge variant="outline">{customer.organisation_type || "Profile incomplete"}</Badge></TableCell><TableCell><p className="text-xs">{customer.contact_name || "Primary contact"}</p><p className="max-w-48 truncate text-[11px] text-muted-foreground">{customer.contact_email || "No email captured"}</p></TableCell><TableCell className="text-right tabular-nums">{formatCurrency(Number(orgById.get(customer.organization_id)?.transaction_value ?? 0))}</TableCell><TableCell className="text-xs text-muted-foreground">{new Date(customer.organization_created_at).toLocaleDateString()}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
               <div className="space-y-6 xl:col-span-4"><Distribution title="Organisation types" rows={typedOrgRows} /><Distribution title="Industries & causes" rows={(overview?.industries ?? []).map((item) => ({ label: item.label, amount: Number(item.value) }))} /><Distribution title="Spending patterns" currency rows={(overview?.categories ?? []).slice(0, 5).map((item) => ({ label: item.label, amount: Number(item.amount) }))} /></div>
            </div>
             <Card className="border-border/70 shadow-sm"><CardHeader><CardTitle>Organisation growth over time</CardTitle></CardHeader><CardContent><div className="flex h-48 items-end gap-2 border-b border-border">{growth.map((item) => <div key={item.month} className="group flex h-full flex-1 items-end" title={`${item.month}: ${item.total} total, ${item.new_organizations} new`}><div className="w-full rounded-t-md bg-primary/80 transition-colors group-hover:bg-primary" style={{ height: `${Math.max(5, Number(item.total) / growthMax * 100)}%` }} /></div>)}</div><div className="mt-2 flex justify-between text-[10px] text-muted-foreground"><span>{growth[0]?.month ?? ""}</span><span>{growth[growth.length - 1]?.month ?? ""}</span></div></CardContent></Card>
          </>}

          {section === "organizations" && <PageSection title={`All organisations (${customers.length})`}><Card className="border-border/70 shadow-sm"><CardContent className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>Organisation</TableHead><TableHead>Business details</TableHead><TableHead>Primary contact</TableHead><TableHead>Registration</TableHead><TableHead>Activity</TableHead></TableRow></TableHeader><TableBody>{customers.map((customer) => { const org = orgById.get(customer.organization_id); return <TableRow key={customer.organization_id}><TableCell><p className="font-semibold">{customer.organization_name}</p><p className="text-xs text-muted-foreground">Joined {new Date(customer.organization_created_at).toLocaleDateString()}</p></TableCell><TableCell><Badge variant="outline">{customer.organisation_type || "Profile incomplete"}</Badge><p className="mt-1 max-w-56 truncate text-xs text-muted-foreground">{customer.address || "No address captured"}</p></TableCell><TableCell><p className="text-sm">{customer.contact_name || "—"}</p><p className="text-xs text-muted-foreground">{customer.contact_email || "No email"}</p><p className="text-xs text-muted-foreground">{customer.contact_phone || "No phone"}</p></TableCell><TableCell className="text-xs"><p>{customer.registration_number || "No registration number"}</p><p className="text-muted-foreground">{customer.pbo_registered ? `PBO ${customer.pbo_number || "registered"}` : "PBO not recorded"}</p></TableCell><TableCell><p className="text-sm font-semibold">{org?.users ?? 0} users</p><p className="text-xs text-muted-foreground">{org?.transactions ?? 0} transactions</p></TableCell></TableRow>; })}</TableBody></Table></CardContent></Card></PageSection>}

          {section === "intelligence" && <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Onboarding completed" value={String(completedOnboarding)} hint={`${customers.length - completedOnboarding} still incomplete`} icon={ShieldCheck} tone="success" /><StatCard label="New signups" value={String(signupCount)} hint="Organisations in the last 30 days" icon={UserPlus} /><StatCard label="Contactable customers" value={String(customers.filter((item) => item.contact_email).length)} hint="Primary email available" icon={Users} /><StatCard label="Profile gaps" value={String(incompleteProfiles)} hint="Organisation type not yet captured" icon={FileSearch} tone="warning" /></div><div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3"><Distribution title="Primary pain points" rows={countValues(customers, "pain_point")} /><Distribution title="Supported causes" rows={countValues(customers, "cause")} /><Distribution title="Funding sources" rows={countValues(customers, "funding")} /><Distribution title="Team size" rows={countValues(customers, "team_size")} /><Distribution title="How customers found Ovasyt" rows={countValues(customers, "heard_about")} /></div></>}

          {section === "analytics" && <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Visitors" value={String(traffic.visitors)} hint="Rolling 30 days" icon={Users} /><StatCard label="Page views" value={String(traffic.pageViews)} hint="Across public and app pages" icon={Eye} /><StatCard label="Views per visit" value={String(traffic.viewsPerVisit)} hint="Engagement depth" icon={MousePointerClick} /><StatCard label="Bounce rate" value={`${traffic.bounce}%`} hint="Single-page visits" icon={ChevronRight} tone="warning" /></div><div className="grid gap-6 lg:grid-cols-3"><Distribution title="Traffic sources" rows={traffic.sources.map(([label, amount]) => ({ label, amount }))} /><Distribution title="Popular pages" rows={traffic.pages.map(([label, amount]) => ({ label, amount }))} /><Distribution title="Devices" rows={traffic.devices.map(([label, amount]) => ({ label, amount }))} /></div></>}

          {section === "activity" && <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Invoice scans" value={String(overview?.scans ?? 0)} hint="Documents analysed" icon={FileSearch} /><StatCard label="Requisitions / quotes" value={`${overview?.requisitions ?? 0} / ${overview?.quotes ?? 0}`} hint={`${overview?.suppliers ?? 0} suppliers`} icon={ReceiptText} /><StatCard label="Payment batches" value={String(overview?.batches ?? 0)} hint={`${formatCurrency(overview?.paid_value ?? 0)} settled`} icon={Wallet} tone="success" /><StatCard label="Advert views / clicks" value={`${overview?.ad_views ?? 0} / ${overview?.ad_clicks ?? 0}`} hint="Published campaign engagement" icon={Megaphone} /></div><PageSection title="New users"><Card className="border-border/70 shadow-sm"><CardContent className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>User</TableHead><TableHead>Organisation</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead></TableRow></TableHeader><TableBody>{recentUsers.map((item) => <TableRow key={item.user_id}><TableCell><p className="font-semibold">{item.full_name || "Unnamed user"}</p><p className="text-xs text-muted-foreground">{item.email}</p></TableCell><TableCell>{item.organization_name || "Internal account"}</TableCell><TableCell>{item.role || "No role"}</TableCell><TableCell><Badge variant={item.status === "ACTIVE" ? "default" : "secondary"}>{item.status}</Badge></TableCell><TableCell className="text-xs text-muted-foreground">{new Date(item.joined_at).toLocaleDateString()}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card></PageSection></>}

          {section === "adverts" && <AdvertisementsManager organizations={orgs} />}
        </>}
      </main>
    </SidebarInset>
  </SidebarProvider>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border/70 bg-muted/35 p-3"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 text-lg font-bold tabular-nums">{value}</p></div>;
}

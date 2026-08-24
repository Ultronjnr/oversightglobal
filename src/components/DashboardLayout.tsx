import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "./Logo";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { LogOut, Building2, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { NotificationBell } from "./NotificationBell";
import { GlobalScanFAB } from "./capture/GlobalScanFAB";
import { TrialBanner } from "./billing/TrialBanner";
import { SubscriptionLockGate } from "./billing/SubscriptionLockGate";
import { InsightsCarousel } from "./dashboard/InsightsCarousel";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "./ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "./ui/sidebar";

interface NavItem {
  label: string;
  href: string;
  icon?: ReactNode;
  active?: boolean;
}

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  navItems?: NavItem[];
  /** Show the sliding analytics cards above the page content. */
  showInsights?: boolean;
}

/** Split nav into named groups (defaults: Overview + Workspace). */
function groupNav(navItems: NavItem[]) {
  if (navItems.length === 0) return [] as { label: string; items: NavItem[] }[];
  const ungrouped = navItems.filter((i) => !i.group);
  const groups: { label: string; items: NavItem[] }[] = [
    { label: "Overview", items: ungrouped.slice(0, 1) },
    ...(ungrouped.length > 1 ? [{ label: "Workspace", items: ungrouped.slice(1) }] : []),
  ];
  navItems
    .filter((i) => i.group)
    .forEach((item) => {
      const existing = groups.find((g) => g.label === item.group);
      existing
        ? existing.items.push(item)
        : groups.push({ label: item.group as string, items: [item] });
    });
  return groups;
}

export function DashboardLayout({
  children,
  title,
  navItems = [],
  showInsights = false,
}: DashboardLayoutProps) {
  const { profile, role, signOut } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const groups = groupNav(navItems);

  const getInitials = () => {
    if (!profile) return "U";
    const first = profile.name?.[0] || "";
    const last = profile.surname?.[0] || "";
    return (first + last).toUpperCase() || "U";
  };

  const getRoleLabel = () => {
    switch (role) {
      case "EMPLOYEE": return "Employee";
      case "HOD": return "Head of Department";
      case "FINANCE": return "Finance Manager";
      case "ADMIN": return "Administrator";
      case "SUPPLIER": return "Supplier";
      default: return "User";
    }
  };

  const getRoleBadgeClass = () => {
    switch (role) {
      case "EMPLOYEE": return "bg-primary/10 text-primary border-primary/20";
      case "HOD": return "bg-warning/10 text-warning border-warning/20";
      case "FINANCE": return "bg-success/10 text-success border-success/20";
      case "ADMIN": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <SidebarProvider>
      {/* Desktop left sidebar (collapses to an icon rail) */}
      {navItems.length > 0 && (
        <Sidebar collapsible="icon" className="hidden md:flex">
          <SidebarHeader className="p-3">
            <Link to="/" className="flex items-center gap-2 overflow-hidden">
              <Logo size="sm" />
            </Link>
          </SidebarHeader>
          <SidebarContent>
            {groups.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.href;
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                            <Link to={item.href}>
                              {item.icon}
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={signOut} tooltip="Logout">
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>
      )}

      <SidebarInset className="min-h-screen bg-[hsl(220,30%,97%)]">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white border-b border-border/40 shadow-sm">
          <div className="px-4 sm:px-6">
            <div className="flex items-center justify-between h-14 sm:h-16">
              {/* Logo & triggers */}
              <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                {/* Mobile hamburger drawer (grouped + scrollable) */}
                <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden h-10 w-10 shrink-0"
                      aria-label="Open navigation menu"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[85vw] max-w-[320px] p-0 flex flex-col">
                    <SheetHeader className="p-4 border-b border-border/40 text-left">
                      <SheetTitle className="flex items-center gap-2">
                        <Logo size="sm" />
                      </SheetTitle>
                    </SheetHeader>

                    {/* User summary */}
                    <div className="flex items-center gap-3 p-4 border-b border-border/40">
                      <Avatar className="h-10 w-10 bg-primary/10 border-2 border-primary/20">
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                          {getInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {profile?.name} {profile?.surname}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full text-[10px] font-semibold leading-none px-2 py-0.5 h-auto",
                              getRoleBadgeClass()
                            )}
                          >
                            {getRoleLabel()}
                          </Badge>
                          {profile?.department && (
                            <Badge
                              variant="outline"
                              className="rounded-full text-[10px] font-semibold leading-none px-2 py-0.5 h-auto bg-secondary/80 text-secondary-foreground border-secondary/30 flex items-center gap-1"
                            >
                              <Building2 className="h-3 w-3" />
                              {profile.department}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Grouped, scrollable navigation */}
                    <nav className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-4">
                      {groups.map((group) => (
                        <div key={group.label}>
                          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {group.label}
                          </p>
                          {group.items.map((item) => {
                            const isActive = location.pathname === item.href;
                            return (
                              <SheetClose asChild key={item.href}>
                                <Link
                                  to={item.href}
                                  className={cn(
                                    "flex items-center gap-3 px-3 min-h-[48px] rounded-lg text-sm transition-colors",
                                    isActive
                                      ? "bg-primary/10 text-primary font-semibold"
                                      : "text-foreground/80 font-medium hover:bg-muted/60"
                                  )}
                                >
                                  {item.icon}
                                  {item.label}
                                </Link>
                              </SheetClose>
                            );
                          })}
                        </div>
                      ))}
                    </nav>

                    {/* Logout */}
                    <div className="p-3 border-t border-border/40">
                      <Button
                        variant="outline"
                        onClick={signOut}
                        className="w-full gap-2 min-h-[48px]"
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>

                {navItems.length > 0 && (
                  <SidebarTrigger className="hidden md:flex" aria-label="Toggle sidebar" />
                )}

                <Link to="/" className="md:hidden">
                  <Logo size="sm" />
                </Link>
              </div>

              {/* Right side */}
              <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
                <NotificationBell />

                <div className="hidden sm:flex items-center gap-3">
                  <Avatar className="h-9 w-9 bg-primary/10 border-2 border-primary/20">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">
                      {profile?.name} {profile?.surname}
                    </p>
                    <div className="flex items-center justify-end gap-1.5 mt-1">
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full text-[11px] font-semibold leading-none px-2.5 py-1 h-auto whitespace-nowrap",
                          getRoleBadgeClass()
                        )}
                      >
                        {getRoleLabel()}
                      </Badge>
                      {profile?.department && (
                        <Badge
                          variant="outline"
                          className="rounded-full text-[11px] font-semibold leading-none px-2.5 py-1 h-auto whitespace-nowrap bg-secondary/80 text-secondary-foreground border-secondary/30 flex items-center gap-1"
                        >
                          <Building2 className="h-3 w-3" />
                          {profile.department}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={signOut}
                  className="hidden sm:flex gap-2 text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <TrialBanner />

        <main className="px-4 sm:px-6 py-5 sm:py-8">
          {/* Title */}
          <div className="mb-5 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
                {title}
              </h1>
            </div>
            <div className="h-1 w-12 sm:w-16 bg-primary rounded-full mt-2 sm:mt-3" />
          </div>

          <SubscriptionLockGate>
            {showInsights && <InsightsCarousel />}

            {/* Content */}
            <div className="animate-fade-in">
              {children}
            </div>
          </SubscriptionLockGate>

        </main>

        {/* Global floating receipt/invoice capture */}
        <GlobalScanFAB />
      </SidebarInset>
    </SidebarProvider>
  );
}

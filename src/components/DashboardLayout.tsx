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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "./ui/sheet";

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
}

export function DashboardLayout({ children, title, navItems = [] }: DashboardLayoutProps) {
  const { profile, role, signOut } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

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
    <div className="min-h-screen bg-[hsl(220,30%,97%)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-border/40 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo & Nav */}
            <div className="flex items-center gap-2 sm:gap-6 min-w-0">
              {/* Mobile hamburger drawer */}
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

                  {/* Navigation links */}
                  <nav className="flex-1 overflow-y-auto p-2">
                    {navItems.map((item) => {
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

              <Link to="/">
                <Logo size="sm" />
              </Link>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
              {/* Notifications */}
              <NotificationBell />

              {/* User info */}
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

              {/* Logout (desktop) */}
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
      <main className="container mx-auto px-4 sm:px-6 py-5 sm:py-8">
        {/* Title */}
        <div className="mb-5 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
              {title}
            </h1>
          </div>
          <div className="h-1 w-12 sm:w-16 bg-primary rounded-full mt-2 sm:mt-3" />
        </div>

        {/* Content */}
        <div className="animate-fade-in">
          {children}
        </div>
      </main>

      {/* Global floating receipt/invoice capture */}
      <GlobalScanFAB />
    </div>
  );
}

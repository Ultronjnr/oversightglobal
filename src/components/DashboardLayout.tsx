import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "./Logo";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { LogOut, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";

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
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Nav */}
            <div className="flex items-center gap-6">
              <Link to="/">
                <Logo size="sm" />
              </Link>
              
              {/* Navigation */}
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                        isActive 
                          ? "bg-primary text-white shadow-md" 
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-4">
              {/* Notifications */}
              <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
                <Bell className="h-5 w-5" />
              </Button>

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
                  <Badge variant="outline" className={cn("text-xs px-2 py-0 h-5", getRoleBadgeClass())}>
                    {getRoleLabel()}
                  </Badge>
                </div>
              </div>

              {/* Logout */}
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="gap-2 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            {title}
          </h1>
          <div className="h-1 w-16 bg-primary rounded-full mt-3" />
        </div>

        {/* Content */}
        <div className="animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}

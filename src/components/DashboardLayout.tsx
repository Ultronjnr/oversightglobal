import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "./Logo";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { LogOut, Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon?: ReactNode;
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

  return (
    <div className="min-h-screen hero-gradient">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Nav */}
            <div className="flex items-center gap-8">
              <Link to="/">
                <Logo size="sm" />
              </Link>
              
              {/* Navigation */}
              <nav className="hidden md:flex items-center gap-6">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "nav-link flex items-center gap-2",
                      location.pathname === item.href && "active"
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-4">
              {/* Notifications */}
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
              </Button>

              {/* User info */}
              <div className="hidden sm:flex items-center gap-3">
                <Avatar className="h-9 w-9 bg-primary/10 border border-primary/20">
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {profile?.name} {profile?.surname}
                  </p>
                  <p className="text-xs text-primary">{getRoleLabel()}</p>
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
      <main className="container mx-auto px-4 py-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            {title}
          </h1>
          <div className="h-1 w-16 bg-primary rounded-full mt-2" />
        </div>

        {/* Content */}
        <div className="animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}

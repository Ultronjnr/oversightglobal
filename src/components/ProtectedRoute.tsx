import { ReactNode } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingScreen } from "./LoadingScreen";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles, ArrowLeft } from "lucide-react";

type AppRole = "EMPLOYEE" | "HOD" | "FINANCE" | "ADMIN" | "SUPPLIER";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: AppRole[];
  /**
   * If true, FREEMIUM users are allowed (e.g. the Freemium portal itself).
   * Defaults to false — restricted modules show an upgrade prompt.
   */
  allowFreemium?: boolean;
}

export function ProtectedRoute({
  children,
  allowedRoles,
  allowFreemium = false,
}: ProtectedRouteProps) {
  const { user, role, profile, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Block FREEMIUM tier from advanced modules
  if (!allowFreemium && profile?.tier === "FREEMIUM") {
    return <UpgradeRequired />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    const rolePortalMap: Record<AppRole, string> = {
      EMPLOYEE: "/employee/portal",
      HOD: "/hod/portal",
      FINANCE: "/finance/portal",
      ADMIN: "/admin/portal",
      SUPPLIER: "/supplier/portal",
    };

    return <Navigate to={rolePortalMap[role]} replace />;
  }

  return <>{children}</>;
}

function UpgradeRequired() {
  return (
    <div className="min-h-screen bg-[hsl(220,30%,97%)] flex items-center justify-center p-6">
      <Card className="max-w-md w-full border-primary/20 shadow-lg">
        <CardContent className="py-10 text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">
              Upgrade to access this feature
            </h2>
            <p className="text-sm text-muted-foreground">
              Purchase Requisitions, Approvals, Suppliers and Finance workflows are
              available on the Standard plan.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
            <Button variant="gradient" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Upgrade Plan
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

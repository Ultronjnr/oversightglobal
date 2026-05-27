import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingScreen } from "./LoadingScreen";

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
  const { user, role, isLoading } = useAuth();
  void allowFreemium;

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
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

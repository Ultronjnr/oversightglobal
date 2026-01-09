import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingScreen } from "./LoadingScreen";

type AppRole = "EMPLOYEE" | "HOD" | "FINANCE" | "ADMIN" | "SUPPLIER";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // Redirect to appropriate portal based on role
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

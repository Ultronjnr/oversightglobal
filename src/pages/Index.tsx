import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingScreen } from "@/components/LoadingScreen";

const Index = () => {
  const { user, role, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      if (user && role) {
        // Redirect based on role
        const rolePortalMap: Record<string, string> = {
          EMPLOYEE: "/employee/portal",
          HOD: "/hod/portal",
          FINANCE: "/finance/portal",
          ADMIN: "/admin/portal",
          SUPPLIER: "/supplier/portal",
        };
        navigate(rolePortalMap[role] || "/login");
      } else {
        navigate("/login");
      }
    }
  }, [user, role, isLoading, navigate]);

  return <LoadingScreen />;
};

export default Index;

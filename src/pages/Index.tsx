import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingScreen } from "@/components/LoadingScreen";

const Index = () => {
  const { user, role, profile, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      if (user && role) {
        // FREEMIUM tier gets simplified portal regardless of role
        if (profile?.tier === "FREEMIUM") {
          navigate("/freemium/portal");
          return;
        }
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
  }, [user, role, profile, isLoading, navigate]);

  return <LoadingScreen />;
};

export default Index;

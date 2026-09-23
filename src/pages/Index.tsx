import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingScreen } from "@/components/LoadingScreen";
import { rolePortalMap } from "@/lib/role-routing";

/**
 * Entry point for /dashboard. The role is loaded a moment after the session,
 * so a signed-in user is given time to resolve their portal instead of being
 * bounced straight back to the login page.
 */
const Index = () => {
  const { user, role, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    if (role) {
      navigate(rolePortalMap[role] || "/login", { replace: true });
      return;
    }

    // Signed in but no role resolved yet — wait briefly before giving up.
    const timer = setTimeout(() => navigate("/login", { replace: true }), 5000);
    return () => clearTimeout(timer);
  }, [user, role, isLoading, navigate]);

  return <LoadingScreen />;
};

export default Index;

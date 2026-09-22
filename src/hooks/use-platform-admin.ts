import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isPlatformAdmin } from "@/services/platform.service";

/** True only for Ovasyt internal (Oversight) accounts. */
export function usePlatformAdmin() {
  const { user, isLoading: authLoading } = useAuth();
  const [isStaff, setIsStaff] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (authLoading) return;
    if (!user) {
      setIsStaff(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    isPlatformAdmin().then((ok) => {
      if (!active) return;
      setIsStaff(ok);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [user?.id, authLoading]);

  return { isStaff, isLoading: isLoading || authLoading };
}

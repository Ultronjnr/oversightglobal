import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns unread notification counts grouped by notification `type`
 * for the current user. Live-updates via Supabase Realtime.
 */
export function useNotificationCounts() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("notifications")
      .select("type")
      .eq("user_id", user.id)
      .eq("is_read", false);
    const next: Record<string, number> = {};
    (data || []).forEach((n: { type: string }) => {
      next[n.type] = (next[n.type] || 0) + 1;
    });
    setCounts(next);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    load();
    const ch = supabase
      .channel(`notif-counts-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, load]);

  return counts;
}
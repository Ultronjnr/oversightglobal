import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "ovasyt-analytics-session";

function getSessionId() {
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, created);
  return created;
}

export function PlatformAnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    const width = window.innerWidth;
    const deviceType = width < 768 ? "Mobile" : width < 1024 ? "Tablet" : "Desktop";
    let referrerHost: string | null = null;
    try {
      referrerHost = document.referrer ? new URL(document.referrer).hostname : null;
      if (referrerHost === window.location.hostname) referrerHost = null;
    } catch {
      referrerHost = null;
    }
    void supabase.from("platform_analytics_events").insert({
      session_id: getSessionId(),
      path: `${location.pathname}${location.search}`.slice(0, 500),
      referrer_host: referrerHost,
      device_type: deviceType,
    });
  }, [location.pathname, location.search]);

  return null;
}
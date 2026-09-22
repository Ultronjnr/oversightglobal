import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/error-handler";

export interface PlatformOverview {
  organizations: number;
  users: number;
  active_users_30d: number;
  transactions: number;
  transaction_value: number;
  paid_value: number;
  requisitions: number;
  quotes: number;
  suppliers: number;
  scans: number;
  batches: number;
  donors: number;
  projects: number;
  donations_value: number;
  receipts: number;
  ad_views: number;
  ad_clicks: number;
  org_types: { label: string; value: number }[];
  categories: { label: string; value: number; amount: number }[];
  monthly: { month: string; value: number; amount: number }[];
}

export interface PlatformOrganization {
  id: string;
  name: string;
  organisation_type: string;
  created_at: string;
  users: number;
  transactions: number;
  transaction_value: number;
  requisitions: number;
  donations_value: number;
  last_activity: string | null;
}

export interface AdPerformanceRow {
  id: string;
  title: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  views: number;
  clicks: number;
}

/** Is the signed-in user Ovasyt platform staff? */
export async function isPlatformAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_platform_admin", {});
  if (error) {
    logError("isPlatformAdmin", error);
    return false;
  }
  return Boolean(data);
}

export async function getPlatformOverview(): Promise<PlatformOverview | null> {
  const { data, error } = await supabase.rpc("platform_overview");
  if (error) {
    logError("getPlatformOverview", error);
    return null;
  }
  return data as unknown as PlatformOverview;
}

export async function getPlatformOrganizations(): Promise<PlatformOrganization[]> {
  const { data, error } = await supabase.rpc("platform_organizations");
  if (error) {
    logError("getPlatformOrganizations", error);
    return [];
  }
  return (data || []) as unknown as PlatformOrganization[];
}

export async function getAdPerformance(): Promise<AdPerformanceRow[]> {
  const { data, error } = await supabase.rpc("platform_ad_performance");
  if (error) {
    logError("getAdPerformance", error);
    return [];
  }
  return (data || []) as unknown as AdPerformanceRow[];
}

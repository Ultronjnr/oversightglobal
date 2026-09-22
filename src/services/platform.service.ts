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
  industries: { label: string; value: number }[];
  organization_growth: { month: string; total: number; new_organizations: number }[];
}

export interface PlatformLiveAnalytics {
  visitors: number;
  page_views: number;
  views_per_visit: number;
  bounce_rate: number;
  daily: { day: string; visitors: number; page_views: number }[];
  pages: { label: string; value: number }[];
  sources: { label: string; value: number }[];
  devices: { label: string; value: number }[];
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

export interface PlatformCustomerIntelligence {
  organization_id: string;
  organization_name: string;
  organisation_type: string | null;
  company_email: string | null;
  phone: string | null;
  address: string | null;
  registration_number: string | null;
  tax_number: string | null;
  pbo_registered: boolean | null;
  pbo_number: string | null;
  organization_created_at: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  pain_point: string | null;
  cause: string | null;
  funding: string | null;
  team_size: string | null;
  heard_about: string | null;
  onboarding_completed_at: string | null;
}

export interface PlatformRecentUser {
  user_id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  status: string;
  role: string | null;
  organization_id: string | null;
  organization_name: string | null;
  organisation_type: string | null;
  joined_at: string;
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

export async function getPlatformCustomerIntelligence(): Promise<PlatformCustomerIntelligence[]> {
  const { data, error } = await supabase.rpc("platform_customer_intelligence");
  if (error) {
    logError("getPlatformCustomerIntelligence", error);
    return [];
  }
  return (data || []) as unknown as PlatformCustomerIntelligence[];
}

export async function getPlatformRecentUsers(limit = 20): Promise<PlatformRecentUser[]> {
  const { data, error } = await supabase.rpc("platform_recent_users", { _limit: limit });
  if (error) {
    logError("getPlatformRecentUsers", error);
    return [];
  }
  return (data || []) as unknown as PlatformRecentUser[];
}

export async function getPlatformLiveAnalytics(days = 30): Promise<PlatformLiveAnalytics | null> {
  const { data, error } = await supabase.rpc("platform_live_analytics", { _days: days });
  if (error) {
    logError("getPlatformLiveAnalytics", error);
    return null;
  }
  return data as unknown as PlatformLiveAnalytics;
}

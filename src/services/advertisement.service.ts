import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/error-handler";

export type AdTone = "primary" | "success" | "warning" | "destructive";
export type AdStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface Advertisement {
  id: string;
  title: string;
  headline: string;
  body: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  tone: AdTone;
  priority: number;
  status: AdStatus;
  starts_at: string | null;
  ends_at: string | null;
  target_all: boolean;
  target_org_types: string[];
  target_tiers: string[];
  target_roles: string[];
  created_at: string;
}

export interface AdvertisementInput {
  title: string;
  headline: string;
  body?: string | null;
  image_url?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  tone: AdTone;
  priority: number;
  status: AdStatus;
  starts_at?: string | null;
  ends_at?: string | null;
  target_all: boolean;
  target_org_types: string[];
  target_roles: string[];
}

/**
 * Adverts the signed-in user is allowed to see right now. Targeting is
 * enforced by RLS; the schedule window is filtered here as well so an
 * expired or not-yet-started advert never reaches the dashboard.
 */
export async function getLiveAdvertisements(): Promise<Advertisement[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("advertisements")
    .select("*")
    .eq("status", "PUBLISHED")
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .order("priority", { ascending: false })
    .limit(5);

  if (error) {
    logError("getLiveAdvertisements", error);
    return [];
  }
  return (data || []) as unknown as Advertisement[];
}

/** Every advert — only platform staff can read these (RLS). */
export async function listAdvertisements(): Promise<Advertisement[]> {
  const { data, error } = await supabase
    .from("advertisements")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    logError("listAdvertisements", error);
    return [];
  }
  return (data || []) as unknown as Advertisement[];
}

export async function saveAdvertisement(
  input: AdvertisementInput,
  id?: string,
): Promise<{ success: boolean; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const payload = { ...input, created_by: auth.user?.id ?? null };

  const { error } = id
    ? await supabase.from("advertisements").update(payload).eq("id", id)
    : await supabase.from("advertisements").insert(payload);

  if (error) {
    logError("saveAdvertisement", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function setAdvertisementStatus(id: string, status: AdStatus) {
  const { error } = await supabase
    .from("advertisements")
    .update({ status })
    .eq("id", id);
  if (error) logError("setAdvertisementStatus", error);
  return { success: !error, error: error?.message };
}

export async function deleteAdvertisement(id: string) {
  const { error } = await supabase.from("advertisements").delete().eq("id", id);
  if (error) logError("deleteAdvertisement", error);
  return { success: !error, error: error?.message };
}

/** Organisations hand-picked for one advert. */
export async function getAdvertisementTargets(adId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("advertisement_targets")
    .select("organization_id")
    .eq("advertisement_id", adId);
  if (error) {
    logError("getAdvertisementTargets", error);
    return [];
  }
  return (data || []).map((r) => r.organization_id as string);
}

export async function setAdvertisementTargets(adId: string, orgIds: string[]) {
  await supabase.from("advertisement_targets").delete().eq("advertisement_id", adId);
  if (orgIds.length === 0) return { success: true };
  const { error } = await supabase.from("advertisement_targets").insert(
    orgIds.map((organization_id) => ({ advertisement_id: adId, organization_id })),
  );
  if (error) logError("setAdvertisementTargets", error);
  return { success: !error, error: error?.message };
}

/** Records a view or click so advert performance is real. Never throws. */
export async function recordAdvertisementEvent(
  advertisementId: string,
  eventType: "VIEW" | "CLICK",
  organizationId?: string | null,
) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    await supabase.from("advertisement_events").insert({
      advertisement_id: advertisementId,
      organization_id: organizationId ?? null,
      user_id: auth.user.id,
      event_type: eventType,
    });
  } catch (e) {
    logError("recordAdvertisementEvent", e);
  }
}

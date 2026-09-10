import { supabase } from "@/integrations/supabase/client";

export type OrganisationType = "NGO" | "NPO";

export interface OnboardingAnswers {
  pain_point?: string | null;
  pain_point_other?: string | null;
  cause?: string | null;
  cause_other?: string | null;
  team_size?: string | null;
  heard_about?: string | null;
  heard_about_other?: string | null;
  funding?: string | null;
  funding_other?: string | null;
}

export interface OnboardingRecord extends OnboardingAnswers {
  organization_id: string;
  completed_at?: string | null;
}

const ANSWER_COLUMNS =
  "organization_id, pain_point, pain_point_other, cause, cause_other, team_size, heard_about, heard_about_other, funding, funding_other, completed_at";

/** Fetch the onboarding record for an organisation (null when never started). */
export async function getOnboarding(
  organizationId: string,
): Promise<OnboardingRecord | null> {
  const { data, error } = await supabase
    .from("organization_onboarding")
    .select(ANSWER_COLUMNS)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as OnboardingRecord;
}

/** Date the onboarding wizard shipped — older organisations are never forced into it. */
const ONBOARDING_LAUNCH = new Date("2026-09-03T00:00:00Z");

/**
 * Should this organisation be sent through the onboarding wizard?
 * Only brand-new organisations (created after the wizard shipped) that have not
 * completed it qualify. Any lookup problem resolves to `false` so existing
 * customers are never locked out of their workspace.
 */
export async function shouldRunOnboarding(
  organizationId: string,
): Promise<boolean> {
  const [{ data: org, error: orgError }, { data: rec, error: recError }] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("created_at")
        .eq("id", organizationId)
        .maybeSingle(),
      supabase
        .from("organization_onboarding")
        .select("completed_at")
        .eq("organization_id", organizationId)
        .maybeSingle(),
    ]);

  if (orgError || recError || !org?.created_at) return false;
  if (new Date(org.created_at) < ONBOARDING_LAUNCH) return false;
  return !rec?.completed_at;
}

/** Persist the onboarding answers, marking completion when requested. */
export async function saveOnboarding(
  organizationId: string,
  userId: string,
  answers: OnboardingAnswers,
  complete = false,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("organization_onboarding")
    .upsert(
      {
        organization_id: organizationId,
        user_id: userId,
        ...answers,
        updated_at: new Date().toISOString(),
        ...(complete ? { completed_at: new Date().toISOString() } : {}),
      } as never,
      { onConflict: "organization_id" },
    );

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export interface OrganisationDetails {
  phone?: string | null;
  organisation_type?: OrganisationType | null;
  pbo_registered?: boolean;
  pbo_number?: string | null;
}

/**
 * Store the extra organisation profile fields captured during onboarding on the
 * existing organisation record (never creates a new one).
 */
export async function saveOrganisationDetails(
  organizationId: string,
  details: OrganisationDetails,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("organizations")
    .update({
      phone: details.phone ?? null,
      organisation_type: details.organisation_type ?? null,
      pbo_registered: details.pbo_registered ?? false,
      pbo_number: details.pbo_registered ? details.pbo_number ?? null : null,
    } as never)
    .eq("id", organizationId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Read back the organisation profile captured during onboarding. */
export async function getOrganisationDetails(
  organizationId: string,
): Promise<(OrganisationDetails & { name: string; address: string | null }) | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("name, address, phone, organisation_type, pbo_registered, pbo_number")
    .eq("id", organizationId)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as OrganisationDetails & { name: string; address: string | null };
}

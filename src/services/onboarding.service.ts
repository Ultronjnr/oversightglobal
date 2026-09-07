import { supabase } from "@/integrations/supabase/client";

export interface OnboardingAnswers {
  pain_point?: string | null;
  cause?: string | null;
  team_size?: string | null;
  heard_about?: string | null;
}

export interface OnboardingRecord extends OnboardingAnswers {
  organization_id: string;
  completed_at?: string | null;
}

/** Fetch the onboarding record for an organisation (null when never started). */
export async function getOnboarding(
  organizationId: string,
): Promise<OnboardingRecord | null> {
  const { data, error } = await supabase
    .from("organization_onboarding")
    .select("organization_id, pain_point, cause, team_size, heard_about, completed_at")
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
      },
      { onConflict: "organization_id" },
    );

  if (error) return { success: false, error: error.message };
  return { success: true };
}

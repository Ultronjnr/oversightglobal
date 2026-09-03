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

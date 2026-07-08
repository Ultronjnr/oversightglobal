import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/utils";

/**
 * Fetch the currency configured for an organization.
 * Falls back to the default currency (ZAR) when unavailable.
 */
export async function getOrgCurrency(
  organizationId?: string | null
): Promise<CurrencyCode> {
  if (!organizationId) return DEFAULT_CURRENCY;
  const { data } = await supabase
    .from("organizations")
    .select("currency")
    .eq("id", organizationId)
    .single();
  return (data?.currency as CurrencyCode) || DEFAULT_CURRENCY;
}

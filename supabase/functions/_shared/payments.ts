import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** Resolve the authenticated user + their organization from the request. */
export async function getAuthContext(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return { userId: null, orgId: null };
  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await anon.auth.getClaims(token);
  if (error || !data?.claims) return { userId: null, orgId: null };
  const userId = data.claims.sub as string;
  const admin = adminClient();
  const { data: profile } = await admin
    .from("profiles").select("organization_id").eq("id", userId).maybeSingle();
  return { userId, orgId: (profile as any)?.organization_id ?? null };
}

/** Idempotency: record a webhook/provider event; returns false if already processed. */
export async function recordEvent(
  admin: ReturnType<typeof adminClient>,
  provider: string,
  externalId: string,
  eventType: string,
  verified: boolean,
  payload: unknown,
): Promise<boolean> {
  const { error } = await admin.from("payment_provider_events").insert({
    provider, external_id: externalId, event_type: eventType, verified, payload,
    processed_at: new Date().toISOString(),
  });
  // unique violation => already processed
  if (error && (error as any).code === "23505") return false;
  if (error) throw error;
  return true;
}

export async function auditPayment(
  admin: ReturnType<typeof adminClient>,
  entry: {
    organization_id: string;
    batch_id?: string | null;
    invoice_id?: string | null;
    transaction_id?: string | null;
    action: string;
    old_status?: string | null;
    new_status?: string | null;
    amount?: number | null;
    performed_by?: string | null;
    notes?: string | null;
  },
) {
  try {
    await admin.from("payment_audit_log").insert(entry);
  } catch (e) {
    console.error("audit insert failed", e);
  }
}

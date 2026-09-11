import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Prefer the workspace's own Google key (works on custom domains);
    // fall back to the managed connector gateway.
    const OWN_GOOGLE_KEY = Deno.env.get("GOOGLE_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    const useDirect = Boolean(OWN_GOOGLE_KEY);
    if (!useDirect && (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY)) {
      return json({ error: "Address lookup is not configured." }, 500);
    }

    // Require a signed-in app user.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const sessionToken =
      typeof body?.sessionToken === "string" && body.sessionToken.length <= 100
        ? body.sessionToken
        : undefined;

    const baseUrl = useDirect ? "https://places.googleapis.com" : GATEWAY_URL;
    const placesHeaders = (fieldMask: string): Record<string, string> => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Goog-FieldMask": fieldMask,
      };
      if (useDirect) {
        headers["X-Goog-Api-Key"] = OWN_GOOGLE_KEY!;
      } else {
        headers.Authorization = `Bearer ${LOVABLE_API_KEY}`;
        headers["X-Connection-Api-Key"] = GOOGLE_MAPS_API_KEY!;
      }
      return headers;
    };

    if (action === "autocomplete") {
      const input = String(body?.input ?? "").trim();
      if (input.length < 3) return json({ suggestions: [] });
      if (input.length > 200) return json({ error: "Query too long" }, 400);

      const res = await fetch(`${baseUrl}/places/v1/places:autocomplete`, {
        method: "POST",
        headers: placesHeaders(
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
        ),
        body: JSON.stringify({
          input,
          sessionToken,
          includedRegionCodes: ["ZA"],
        }),
      });

      if (!res.ok) {
        const details = await res.text();
        console.error(`Places autocomplete failed [${res.status}]: ${details}`);
        return json({ error: "Address lookup failed", status: res.status, details }, res.status);
      }

      const data = await res.json();
      const suggestions = (data?.suggestions ?? [])
        .map((s: { placePrediction?: { placeId?: string; text?: { text?: string } } }) => ({
          placeId: s.placePrediction?.placeId,
          description: s.placePrediction?.text?.text,
        }))
        .filter((s: { placeId?: string; description?: string }) => s.placeId && s.description);

      return json({ suggestions });
    }

    if (action === "details") {
      const placeId = String(body?.placeId ?? "").trim();
      if (!placeId || placeId.length > 300) return json({ error: "Invalid place" }, 400);

      const url = new URL(`${GATEWAY_URL}/places/v1/places/${encodeURIComponent(placeId)}`);
      if (sessionToken) url.searchParams.set("sessionToken", sessionToken);

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          ...gatewayHeaders,
          "X-Goog-FieldMask": "id,formattedAddress,displayName,location",
        },
      });

      if (!res.ok) {
        const details = await res.text();
        console.error(`Place details failed [${res.status}]: ${details}`);
        return json({ error: "Address lookup failed", status: res.status, details }, res.status);
      }

      const place = await res.json();
      return json({
        formattedAddress: place?.formattedAddress ?? null,
        location: place?.location ?? null,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("places-autocomplete error", err);
    return json({ error: (err as Error).message }, 500);
  }
});

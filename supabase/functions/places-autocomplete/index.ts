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

    const gatewayAvailable = Boolean(LOVABLE_API_KEY && GOOGLE_MAPS_API_KEY);

    // Gateway routes "places/..." to places.googleapis.com; direct calls use
    // the API's real "/v1/..." paths.
    const buildRequest = (
      direct: boolean,
      path: string,
      fieldMask: string,
      search?: URLSearchParams,
    ) => {
      const base = direct ? "https://places.googleapis.com" : GATEWAY_URL;
      const p = direct ? path.replace(/^places\//, "") : path;
      const url = new URL(`${base}/${p}`);
      if (search) search.forEach((v, k) => url.searchParams.set(k, v));
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Goog-FieldMask": fieldMask,
      };
      if (direct) {
        headers["X-Goog-Api-Key"] = OWN_GOOGLE_KEY!;
      } else {
        headers.Authorization = `Bearer ${LOVABLE_API_KEY}`;
        headers["X-Connection-Api-Key"] = GOOGLE_MAPS_API_KEY!;
      }
      return { url: url.toString(), headers };
    };

    // Try the workspace key first; if it is blocked/restricted, retry through
    // the managed connector gateway so address lookup keeps working.
    const callPlaces = async (
      path: string,
      fieldMask: string,
      init: { method: string; body?: string; search?: URLSearchParams },
    ): Promise<Response> => {
      const attempts = useDirect
        ? gatewayAvailable
          ? [true, false]
          : [true]
        : [false];
      let last: Response | null = null;
      for (const direct of attempts) {
        const { url, headers } = buildRequest(direct, path, fieldMask, init.search);
        const res = await fetch(url, { method: init.method, headers, body: init.body });
        if (res.ok) return res;
        last = res;
        if (res.status !== 403 && res.status !== 401) break;
      }
      return last!;
    };

    const failure = async (res: Response) => {
      const details = await res.text();
      console.error(`Places request failed [${res.status}]: ${details}`);
      const blocked =
        res.status === 403 &&
        (details.includes("API_KEY_SERVICE_BLOCKED") ||
          details.includes("API_KEY_HTTP_REFERRER_BLOCKED") ||
          details.includes("SERVICE_DISABLED"));
      return json(
        {
          error: blocked
            ? "Address lookup is not enabled for this Google API key yet. Enable Places API (New) for the key and set its application restrictions to None."
            : "Address lookup failed",
          status: res.status,
          details,
        },
        res.status,
      );
    };

    if (action === "autocomplete") {
      const input = String(body?.input ?? "").trim();
      if (input.length < 3) return json({ suggestions: [] });
      if (input.length > 200) return json({ error: "Query too long" }, 400);

      const res = await callPlaces(
        "places/v1/places:autocomplete",
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
        {
          method: "POST",
          body: JSON.stringify({ input, sessionToken, includedRegionCodes: ["ZA"] }),
        },
      );

      if (!res.ok) return await failure(res);

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

      const search = new URLSearchParams();
      if (sessionToken) search.set("sessionToken", sessionToken);

      const res = await callPlaces(
        `places/v1/places/${encodeURIComponent(placeId)}`,
        "id,formattedAddress,displayName,location",
        { method: "GET", search },
      );

      if (!res.ok) return await failure(res);

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

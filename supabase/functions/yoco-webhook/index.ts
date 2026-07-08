import { corsHeaders, json, adminClient, recordEvent } from "../_shared/payments.ts";

// Verifies Yoco webhook signature (svix-style HMAC) and records the event.
async function verifySignature(secret: string, id: string, timestamp: string, body: string, signatureHeader: string): Promise<boolean> {
  try {
    // Yoco/svix: secret is "whsec_<base64>"; signed content = "id.timestamp.body"
    const secretBytes = Uint8Array.from(atob(secret.replace(/^whsec_/, "")), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signed = `${id}.${timestamp}.${body}`;
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed));
    const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
    // header may contain space-separated "v1,<sig>" pairs
    return signatureHeader.split(" ").some((part) => part.split(",").pop() === expected);
  } catch (e) {
    console.error("signature verify error", e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const raw = await req.text();
    const secret = Deno.env.get("YOCO_WEBHOOK_SECRET");
    const id = req.headers.get("webhook-id") ?? "";
    const timestamp = req.headers.get("webhook-timestamp") ?? "";
    const signature = req.headers.get("webhook-signature") ?? "";

    let verified = false;
    if (secret && id && signature) {
      verified = await verifySignature(secret, id, timestamp, raw, signature);
      if (!verified) return json({ error: "Invalid signature" }, 401);
    }

    const event = JSON.parse(raw || "{}");
    const admin = adminClient();
    const externalId = id || event.id || crypto.randomUUID();

    const fresh = await recordEvent(admin, "YOCO", externalId, event.type ?? "unknown", verified, event);
    if (!fresh) return json({ success: true, duplicate: true });

    // Handle payment success/failure events referencing a charge/invoice
    const chargeId = event?.payload?.id ?? event?.data?.id;
    if (chargeId) {
      const { data: inv } = await admin
        .from("subscription_invoices").select("*").eq("yoco_charge_id", chargeId).maybeSingle();
      if (inv) {
        const type = String(event.type ?? "");
        if (type.includes("succeeded")) {
          await admin.from("subscription_invoices").update({ status: "PAID", paid_at: new Date().toISOString() }).eq("id", (inv as any).id);
        } else if (type.includes("failed")) {
          await admin.from("subscription_invoices").update({ status: "FAILED" }).eq("id", (inv as any).id);
        }
      }
    }

    return json({ success: true });
  } catch (e) {
    console.error("yoco-webhook error", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

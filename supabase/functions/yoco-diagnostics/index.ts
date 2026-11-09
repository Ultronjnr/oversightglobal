// Super User-only, read-only health check for the Yoco integration.
// Never returns secret values. Does not create checkouts or move money.
import { corsHeaders, json, adminClient, getAuthContext } from "../_shared/payments.ts";
import { computeSignature, decodeSigningSecret } from "../_shared/yoco-signature.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { userId, orgId } = await getAuthContext(req);
    if (!userId || !orgId) return json({ error: "Unauthorized" }, 401);
    const admin = adminClient();
    const { data: role } = await admin.from("user_roles").select("role")
      .eq("user_id", userId).eq("role", "ADMIN").limit(1);
    if (!role?.length) return json({ error: "Only a Super User can run Yoco diagnostics" }, 403);

    const secretKey = Deno.env.get("YOCO_SECRET_KEY");

    // Super User-approved cleanup: remove registered Yoco webhooks by id.
    const reqBody = await req.json().catch(() => ({}));
    if (reqBody?.action === "delete_webhooks") {
      if (!secretKey) return json({ error: "Yoco secret key not configured" }, 503);
      const ids: string[] = Array.isArray(reqBody.ids) ? reqBody.ids.filter((x: unknown) => typeof x === "string" && /^sub_[A-Za-z0-9]+$/.test(x)) : [];
      const results = [];
      for (const wid of ids) {
        const r = await fetch(`https://payments.yoco.com/api/webhooks/${wid}`, {
          method: "DELETE", headers: { Authorization: `Bearer ${secretKey}` },
        });
        results.push({ id: wid, status: r.status, ok: r.ok });
      }
      return json({ deleted: results });
    }

    const webhookSecret = Deno.env.get("YOCO_WEBHOOK_SECRET");
    const modeRaw = Deno.env.get("YOCO_MODE");
    const report: Record<string, unknown> = {
      secrets: {
        YOCO_SECRET_KEY: !!secretKey,
        YOCO_WEBHOOK_SECRET: !!webhookSecret,
        YOCO_MODE: !!modeRaw,
      },
      modeIsTest: (modeRaw ?? "").trim().toLowerCase() === "test",
      webhookSecretReadable: webhookSecret ? !!decodeSigningSecret(webhookSecret) : false,
    };

    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/yoco-webhook`;
    report.expectedWebhookUrl = webhookUrl;

    // Registered webhooks (Checkout API sends all checkout events to each URL).
    if (secretKey) {
      const res = await fetch("https://payments.yoco.com/api/webhooks", {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      const body = await res.json().catch(() => ({}));
      const list: any[] = Array.isArray(body) ? body : (body?.subscriptions ?? body?.webhooks ?? body?.data ?? []);
      report.yocoKeyAccepted = res.ok;
      report.registeredWebhooks = res.ok
        ? list.map((w) => ({ id: w.id, name: w.name, url: w.url, mode: w.mode, matchesExpectedUrl: w.url === webhookUrl }))
        : { status: res.status, message: body?.message ?? body?.description ?? null };

      // Sandbox R2.00 invoices still awaiting payment: what does Yoco say?
      const { data: invs } = await admin.from("subscription_invoices")
        .select("id, invoice_number, status, amount, currency, yoco_charge_id")
        .eq("organization_id", orgId).like("invoice_number", "SANDBOX-%").neq("status", "PAID");
      const checks = [];
      for (const inv of invs ?? []) {
        if (!(inv as any).yoco_charge_id) continue;
        const r = await fetch(`https://payments.yoco.com/api/checkouts/${(inv as any).yoco_charge_id}`, {
          headers: { Authorization: `Bearer ${secretKey}` },
        });
        const c = await r.json().catch(() => ({}));
        const expectedCents = Math.round(Number((inv as any).amount) * 100);
        checks.push({
          invoiceNumber: (inv as any).invoice_number,
          invoiceStatus: (inv as any).status,
          checkoutId: (inv as any).yoco_charge_id,
          lookupStatus: r.status,
          checkoutStatus: c?.status ?? null,
          processingMode: c?.processingMode ?? null,
          paymentRecorded: !!c?.paymentId,
          amountMatches: c?.amount != null ? Number(c.amount) === expectedCents : null,
          currencyMatches: c?.currency ? String(c.currency).toUpperCase() === String((inv as any).currency || "ZAR").toUpperCase() : null,
        });
      }
      report.sandboxCheckouts = checks;
    }

    // Loopback: sign diagnostic events with the stored secret exactly the way
    // Yoco does, post them to the live webhook URL and check the responses.
    const secretBytes = webhookSecret ? decodeSigningSecret(webhookSecret) : null;
    if (secretBytes) {
      const send = async (id: string, ts: string, signedBody: string, sentBody: string) => {
        const sig = await computeSignature(secretBytes, id, ts, signedBody);
        const r = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "webhook-id": id, "webhook-timestamp": ts, "webhook-signature": `v1,${sig}` },
          body: sentBody,
        });
        return { status: r.status, body: await r.json().catch(() => null) };
      };
      const id = `diag_${crypto.randomUUID()}`;
      const now = String(Math.floor(Date.now() / 1000));
      const body = JSON.stringify({ id, type: "diagnostic.ping", payload: { mode: "diagnostic" } });
      const first = await send(id, now, body, body);
      const repeat = await send(id, now, body, body);
      const tampered = await send(`diag_${crypto.randomUUID()}`, now, body, body.replace("ping", "pong"));
      const stale = String(Math.floor(Date.now() / 1000) - 3600);
      const replay = await send(`diag_${crypto.randomUUID()}`, stale, body, body);
      const unsigned = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      report.loopback = {
        validSignatureAccepted: first.status === 200 && !(first.body as any)?.duplicate,
        duplicateIgnored: repeat.status === 200 && (repeat.body as any)?.duplicate === true,
        tamperedBodyRejected: tampered.status === 401,
        staleTimestampRejected: replay.status === 401,
        unsignedRejected: unsigned.status === 401,
      };
      // Remove the diagnostic idempotency record so it leaves no trace.
      await admin.from("payment_provider_events").delete().eq("provider", "YOCO").like("external_id", "diag_%");
    }

    return json(report);
  } catch (e) {
    console.error("yoco-diagnostics error", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

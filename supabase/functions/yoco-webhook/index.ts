import { corsHeaders, json, adminClient, recordEvent } from "../_shared/payments.ts";
import { verifyYocoSignature } from "../_shared/yoco-signature.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const raw = await req.text();
    const secret = Deno.env.get("YOCO_WEBHOOK_SECRET");
    const id = req.headers.get("webhook-id") ?? "";
    const timestamp = req.headers.get("webhook-timestamp") ?? "";
    const signature = req.headers.get("webhook-signature") ?? "";

    // Fail closed: refuse to process any webhook we cannot cryptographically
    // verify. If the signing secret is unset we cannot verify anything, so we
    // reject the request instead of accepting it as trusted.
    if (!secret) {
      console.error("yoco-webhook: YOCO_WEBHOOK_SECRET not configured; rejecting");
      return json({ error: "Webhook signing secret not configured" }, 503);
    }
    // Verify against the exact raw body and Yoco's webhook-* headers.
    const check = await verifyYocoSignature({ secret, id, timestamp, signatureHeader: signature, body: raw });
    if (!check.ok) {
      console.error("yoco-webhook: rejected delivery", { reason: check.reason, webhookId: id || null });
      return json({ error: "Invalid signature", reason: check.reason }, 401);
    }
    const verified = true;

    const event = JSON.parse(raw || "{}");
    const admin = adminClient();
    // webhook-id is stable across Yoco's retries of the same event.
    const externalId = id;

    const fresh = await recordEvent(admin, "YOCO", externalId, event.type ?? "unknown", verified, event);
    if (!fresh) return json({ success: true, duplicate: true });

    try {
      return await processEvent(admin, event);
    } catch (e) {
      // Release the idempotency record so Yoco's retry can be processed.
      await admin.from("payment_provider_events").delete().eq("provider", "YOCO").eq("external_id", externalId);
      throw e;
    }
  } catch (e) {
    console.error("yoco-webhook error", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

async function processEvent(admin: ReturnType<typeof adminClient>, event: any): Promise<Response> {
  // Handle payment success/failure. Hosted-checkout events carry our
  // metadata (invoiceId); legacy charge events only carry the charge id.
  const payload = event?.payload ?? event?.data ?? {};
  const chargeId = payload?.id ?? null;
  const metaInvoiceId = payload?.metadata?.invoiceId ?? null;
  // Hosted checkout: payload.id is the payment id; our stored reference is
  // the checkout id, which Yoco returns in metadata.checkoutId.
  const checkoutId = payload?.metadata?.checkoutId ?? null;
  const isSandboxTest = String(payload?.metadata?.test ?? "") === "true";

  // Never apply an event from the other Yoco mode (e.g. a live payment
  // while this app is configured for test, or vice versa).
  const configuredMode = Deno.env.get("YOCO_MODE") === "live" ? "live" : "test";
  const eventMode = payload?.mode ? String(payload.mode).toLowerCase() : null;
  if (eventMode && eventMode !== configuredMode) {
    console.error("yoco-webhook: mode mismatch, event recorded but not applied", { eventMode, configuredMode });
    return json({ success: true, ignored: "mode_mismatch" });
  }

  let inv: any = null;
  if (metaInvoiceId) {
    const { data } = await admin
      .from("subscription_invoices").select("*").eq("id", metaInvoiceId).maybeSingle();
    inv = data;
  }
  for (const ref of [checkoutId, chargeId]) {
    if (inv || !ref) continue;
    const { data } = await admin
      .from("subscription_invoices").select("*").eq("yoco_charge_id", ref).maybeSingle();
    inv = data;
  }

  if (inv) {
    const type = String(event.type ?? "");
    if (type === "refund.succeeded" || type === "refund.failed") {
      // Refund outcomes are recorded in payment_provider_events (above) for
      // audit; they never activate or fail a subscription.
      console.log("yoco-webhook refund event", { type, invoiceId: inv.id });
      return json({ success: true });
    }
    if (type === "payment.succeeded") {
      // Confirm the payment details match the invoice before activating:
      // amount (cents), currency and the checkout reference must all agree.
      const expectedCents = Math.round(Number(inv.amount) * 100);
      const paidCents = payload?.amount != null ? Number(payload.amount) : null;
      const paidCurrency = payload?.currency ? String(payload.currency).toUpperCase() : null;
      const referenceOk = !inv.yoco_charge_id || [checkoutId, chargeId].includes(inv.yoco_charge_id);
      const amountOk = paidCents == null || paidCents === expectedCents;
      const currencyOk = !paidCurrency || paidCurrency === String(inv.currency || "ZAR").toUpperCase();
      if (!referenceOk || !amountOk || !currencyOk) {
        console.error("yoco-webhook: payment detail mismatch", {
          invoiceId: inv.id, expectedCents, paidCents, paidCurrency, chargeId, referenceOk,
        });
        return json({ error: "Payment details do not match the invoice" }, 409);
      }
      const { error: paidErr } = await admin.from("subscription_invoices").update({
        status: "PAID", paid_at: new Date().toISOString(),
      }).eq("id", inv.id).neq("status", "PAID");
      if (paidErr) throw paidErr;
      if (isSandboxTest || String(inv.invoice_number ?? "").startsWith("SANDBOX-")) {
        // Sandbox test: confirm the subscription link without shortening or
        // changing the organisation's real billing period.
        await admin.from("organization_subscriptions").update({ status: "ACTIVE" })
          .eq("organization_id", inv.organization_id).in("status", ["INCOMPLETE", "TRIALING", "PAST_DUE"]);
        console.log("yoco-webhook sandbox payment applied", { invoiceId: inv.id });
        return json({ success: true, sandbox: true });
      }
      // Activate the subscription for the paid period
      await admin.from("organization_subscriptions").update({
        status: "ACTIVE",
        current_period_start: inv.period_start,
        current_period_end: inv.period_end,
        next_billing_date: inv.period_end,
      }).eq("organization_id", inv.organization_id);
    } else if (type === "payment.failed" && !isSandboxTest) {
      await admin.from("subscription_invoices").update({ status: "FAILED" }).eq("id", inv.id);
      await admin.from("organization_subscriptions")
        .update({ status: "PAST_DUE" }).eq("organization_id", inv.organization_id);
    }
  }

  return json({ success: true });
}

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeSignature, decodeSigningSecret, verifyYocoSignature } from "./yoco-signature.ts";

// Standard Webhooks reference vector (same scheme Yoco uses).
const SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
const ID = "msg_p5jXN8AQM9LWM0D4loKWxJek";
const TS = "1614265330";
const BODY = '{"test": 2432232314}';
const SIG = "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=";

Deno.test("matches the Standard Webhooks reference signature", async () => {
  const r = await verifyYocoSignature({ secret: SECRET, id: ID, timestamp: TS, signatureHeader: SIG, body: BODY, nowSeconds: Number(TS) });
  assertEquals(r.ok, true);
});

Deno.test("tolerates quotes and whitespace pasted around the secret", async () => {
  const r = await verifyYocoSignature({ secret: ` "${SECRET}"\n`, id: ID, timestamp: TS, signatureHeader: SIG, body: BODY, nowSeconds: Number(TS) });
  assertEquals(r.ok, true);
});

Deno.test("extracts the whsec_ value when a label was pasted with it", async () => {
  const r = await verifyYocoSignature({ secret: `Signing secret: ${SECRET}`, id: ID, timestamp: TS, signatureHeader: SIG, body: BODY, nowSeconds: Number(TS) });
  assertEquals(r.ok, true);
});

Deno.test("rejects a tampered body", async () => {
  const r = await verifyYocoSignature({ secret: SECRET, id: ID, timestamp: TS, signatureHeader: SIG, body: BODY + " ", nowSeconds: Number(TS) });
  assertEquals(r, { ok: false, reason: "bad_signature" });
});

Deno.test("rejects a timestamp older than 5 minutes (replay)", async () => {
  const r = await verifyYocoSignature({ secret: SECRET, id: ID, timestamp: TS, signatureHeader: SIG, body: BODY, nowSeconds: Number(TS) + 301 });
  assertEquals(r, { ok: false, reason: "stale_timestamp" });
});

Deno.test("accepts one valid entry among several signatures", async () => {
  const header = `v1,bogus ${SIG}`;
  const r = await verifyYocoSignature({ secret: SECRET, id: ID, timestamp: TS, signatureHeader: header, body: BODY, nowSeconds: Number(TS) });
  assertEquals(r.ok, true);
});

Deno.test("computeSignature produces the reference value", async () => {
  const sig = await computeSignature(decodeSigningSecret(SECRET)!, ID, TS, BODY);
  assertEquals(`v1,${sig}`, SIG);
});

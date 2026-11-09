// Yoco webhook signature verification (Standard Webhooks scheme).
// Signed content: `${webhook-id}.${webhook-timestamp}.${rawBody}`
// Key: base64-decoded part of the `whsec_...` secret. Header: space-separated
// `v1,<base64 HMAC-SHA256>` entries.

export const SIGNATURE_TOLERANCE_SECONDS = 300;

/** Decode a whsec_ signing secret, tolerating pasted quotes/whitespace. */
export function decodeSigningSecret(secret: string): Uint8Array<ArrayBuffer> | null {
  let b64 = secret.trim().replace(/^["']|["']$/g, "").replace(/^whsec_/, "").replace(/\s+/g, "")
    .replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  try {
    const bytes = new Uint8Array(Array.from(atob(b64), (c) => c.charCodeAt(0)));
    return bytes.length > 0 ? bytes : null;
  } catch {
    return null;
  }
}

export async function computeSignature(secretBytes: Uint8Array<ArrayBuffer>, id: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "missing_headers" | "bad_secret" | "stale_timestamp" | "bad_signature" };

export async function verifyYocoSignature(opts: {
  secret: string;
  id: string;
  timestamp: string;
  signatureHeader: string;
  body: string;
  nowSeconds?: number;
}): Promise<VerifyResult> {
  const { secret, id, timestamp, signatureHeader, body } = opts;
  if (!id || !timestamp || !signatureHeader) return { ok: false, reason: "missing_headers" };
  const ts = Number(timestamp);
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > SIGNATURE_TOLERANCE_SECONDS) {
    return { ok: false, reason: "stale_timestamp" };
  }
  const secretBytes = decodeSigningSecret(secret);
  if (!secretBytes) return { ok: false, reason: "bad_secret" };
  const expected = await computeSignature(secretBytes, id, timestamp, body);
  const match = signatureHeader.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    return version === "v1" && !!sig && safeEqual(sig, expected);
  });
  return match ? { ok: true } : { ok: false, reason: "bad_signature" };
}

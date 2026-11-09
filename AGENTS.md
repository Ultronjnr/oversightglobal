# Project rules

- Anything created outside a portal page (e.g. the global Scan Invoice modal) must call `emitRequisitionsChanged()` from `src/lib/data-events.ts`, and portal lists subscribe with `useRequisitionsChanged` — so new items appear without a page reload.
- Per-row data in tables (e.g. chat message counts) must be batched into one query per render pass, never fetched per row — per-row requests flood the browser connection pool and stall other calls.
- Invoice OCR runs in the `analyze-document` function with a single client call (upload, then analyze with `file_hash`); the server reuses cached results for identical files, so do not add a separate probe round-trip.
- Yoco webhook signatures are verified only through `supabase/functions/_shared/yoco-signature.ts` (raw body, webhook-* headers, 5-minute replay window), covered by its Deno test — one implementation keeps the webhook and diagnostics in agreement.

// Post-generation sitemap validation. Runs after generate-sitemap.ts.
// Checks: parseable XML, min URL count, ISO YYYY-MM-DD lastmod format,
// canonical BASE_URL, and that every dynamic donation-receipt row appears.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://ovasyt.tech";
const MIN_URLS = 8;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function fail(msg: string): never {
  console.error(`✖ sitemap validation failed: ${msg}`);
  process.exit(1);
}

async function main() {
  const xml = readFileSync(resolve("public/sitemap.xml"), "utf8");

  if (!xml.startsWith('<?xml')) fail("missing XML prolog");
  if (!xml.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')) {
    fail("missing sitemap 0.9 namespace");
  }

  const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);
  const lastmods = Array.from(xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)).map((m) => m[1]);

  if (locs.length < MIN_URLS) fail(`only ${locs.length} URLs (min ${MIN_URLS})`);
  if (lastmods.length !== locs.length) {
    fail(`lastmod count (${lastmods.length}) does not match loc count (${locs.length})`);
  }

  for (const loc of locs) {
    if (!loc.startsWith(`${BASE_URL}/`)) fail(`loc not on ${BASE_URL}: ${loc}`);
  }
  for (const d of lastmods) {
    if (!ISO_DATE.test(d)) fail(`lastmod not ISO YYYY-MM-DD: ${d}`);
  }

  // Confirm dynamic /verify/receipt/:id rows are present when creds exist.
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (url && key) {
    const client = createClient(url, key);
    const { data, error } = await client
      .from("donation_receipts")
      .select("id")
      .in("status", ["ISSUED", "EMAILED"])
      .not("verification_hash", "is", null);
    if (error) {
      console.warn(`⚠ could not verify dynamic receipts: ${error.message}`);
    } else {
      const missing = (data ?? []).filter(
        (row) => !locs.some((l) => l.includes(`/verify/receipt/${row.id}`)),
      );
      if (missing.length > 0) {
        fail(`${missing.length} donation receipt(s) missing from sitemap`);
      }
      console.log(`✓ ${data?.length ?? 0} dynamic receipt entries verified`);
    }
  } else {
    console.warn("⚠ skipping dynamic-row check (no VITE_SUPABASE_URL/KEY)");
  }

  console.log(`✓ sitemap.xml valid (${locs.length} URLs, all ISO lastmods, canonical ${BASE_URL})`);
}

main().catch((err) => {
  console.error("sitemap validation crashed:", err);
  process.exit(1);
});
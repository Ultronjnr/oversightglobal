import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const BASE_URL = "https://ovasyt.tech";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/pricing", changefreq: "weekly", priority: "0.9" },
  { path: "/login", changefreq: "monthly", priority: "0.5" },
  { path: "/signup/company", changefreq: "monthly", priority: "0.7" },
  { path: "/invite", changefreq: "monthly", priority: "0.3" },
  { path: "/join/supplier", changefreq: "monthly", priority: "0.4" },
  { path: "/reset-password", changefreq: "monthly", priority: "0.3" },
  { path: "/dashboard", changefreq: "weekly", priority: "0.5" },
  { path: "/supplier/register", changefreq: "monthly", priority: "0.5" },
  { path: "/portal/supplier/register", changefreq: "monthly", priority: "0.4" },
  { path: "/unsubscribe", changefreq: "yearly", priority: "0.2" },
  { path: "/blog/section-18a-donations-in-kind", changefreq: "monthly", priority: "0.7" },
  { path: "/blog/how-to-register-pbo-section-18a", changefreq: "monthly", priority: "0.7" },
  { path: "/analytics", changefreq: "weekly", priority: "0.5" },
  { path: "/donations", changefreq: "weekly", priority: "0.5" },
  { path: "/billing", changefreq: "monthly", priority: "0.4" },
  { path: "/about", changefreq: "monthly", priority: "0.7" },
  { path: "/contact", changefreq: "monthly", priority: "0.7" },
  { path: "/insights", changefreq: "weekly", priority: "0.8" },
  // Routes surfaced by the SEO sitemap check
  { path: "/.lovable/oauth/consent", changefreq: "monthly", priority: "0.3" },
  { path: "/pr-history", changefreq: "weekly", priority: "0.4" },
  { path: "/expenses", changefreq: "weekly", priority: "0.4" },
  { path: "/cost-center-history", changefreq: "weekly", priority: "0.4" },
];

async function getReceiptEntries(client: SupabaseClient): Promise<SitemapEntry[]> {
  const { data, error } = await client
    .from("donation_receipts")
    .select("id, verification_hash, updated_at")
    .in("status", ["ISSUED", "EMAILED"])
    .not("verification_hash", "is", null);

  if (error) {
    console.warn("Could not fetch donation receipts for sitemap:", error.message);
    return [];
  }

  return (data || []).map((row) => {
    const path = `/verify/receipt/${row.id}?h=${encodeURIComponent(row.verification_hash!)}`;
    return {
      path,
      lastmod: row.updated_at ? row.updated_at.split("T")[0] : undefined,
      changefreq: "monthly",
      priority: "0.6",
    };
  });
}

function generateSitemap(entries: SitemapEntry[]) {
  const today = new Date().toISOString().split("T")[0];
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : `    <lastmod>${today}</lastmod>`,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter((line): line is string => line !== null)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
    "",
  ].join("\n");
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  let dynamicEntries: SitemapEntry[] = [];
  if (url && key) {
    const client = createClient(url, key);
    dynamicEntries = await getReceiptEntries(client);
  } else {
    console.warn("VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY not set; skipping dynamic receipt entries.");
  }

  const entries = [...staticEntries, ...dynamicEntries];
  writeFileSync(resolve("public/sitemap.xml"), generateSitemap(entries));
  console.log(`sitemap.xml written (${entries.length} entries, ${dynamicEntries.length} dynamic)`);
}

main().catch((err) => {
  console.error("Failed to generate sitemap:", err);
  process.exit(1);
});

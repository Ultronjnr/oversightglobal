import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { statSync, existsSync } from "node:fs";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const BASE_URL = "https://ovasyt.tech";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
  /** Optional source file(s); newest mtime becomes lastmod when set. */
  sources?: string[];
}

// Public, indexable routes only. Auth-only routes (portals, dashboard,
// analytics, donations, billing, PR history, expenses, cost-center-history,
// invite, reset-password, unsubscribe, .lovable/*) are excluded here AND
// disallowed in robots.txt.
const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0", sources: ["src/pages/LandingPage.tsx"] },
  { path: "/pricing", changefreq: "weekly", priority: "0.9", sources: ["src/pages/Pricing.tsx"] },
  { path: "/about", changefreq: "monthly", priority: "0.7", sources: ["src/pages/About.tsx"] },
  { path: "/contact", changefreq: "monthly", priority: "0.7", sources: ["src/pages/Contact.tsx"] },
  { path: "/insights", changefreq: "weekly", priority: "0.8", sources: ["src/pages/Insights.tsx"] },
  { path: "/blog/section-18a-donations-in-kind", changefreq: "monthly", priority: "0.7", sources: ["src/pages/BlogSection18ADonationsInKind.tsx"] },
  { path: "/blog/how-to-register-pbo-section-18a", changefreq: "monthly", priority: "0.7", sources: ["src/pages/BlogRegisterPboSection18A.tsx"] },
  { path: "/blog/best-npo-bank-accounts-south-africa", changefreq: "monthly", priority: "0.7", sources: ["src/pages/BlogBestNpoBankAccountsSouthAfrica.tsx"] },
  { path: "/login", changefreq: "monthly", priority: "0.4", sources: ["src/pages/Login.tsx"] },
  { path: "/signup/company", changefreq: "monthly", priority: "0.8", sources: ["src/pages/SignupCompany.tsx"] },
  { path: "/join/supplier", changefreq: "monthly", priority: "0.4", sources: ["src/pages/JoinSupplier.tsx"] },
  { path: "/supplier/register", changefreq: "monthly", priority: "0.5", sources: ["src/pages/SupplierRegister.tsx"] },
];

function newestMtime(sources?: string[]): string | undefined {
  if (!sources || sources.length === 0) return undefined;
  let newest = 0;
  for (const src of sources) {
    const p = resolve(src);
    if (!existsSync(p)) continue;
    const t = statSync(p).mtimeMs;
    if (t > newest) newest = t;
  }
  if (!newest) return undefined;
  return new Date(newest).toISOString().split("T")[0];
}

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
  const urls = entries.map((e) => {
    const lastmod = e.lastmod ?? newestMtime(e.sources) ?? today;
    return [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter((line): line is string => line !== null)
      .join("\n");
  });

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

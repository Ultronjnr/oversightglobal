import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "./_supabase";

export default defineTool({
  name: "list_suppliers",
  title: "List suppliers",
  description:
    "List suppliers visible to the signed-in user's organization (scoped by access rules). Optionally filter by a company-name search term.",
  inputSchema: {
    search: z.string().trim().optional().describe("Case-insensitive company-name filter."),
    limit: z.number().int().min(1).max(50).optional().describe("Max rows to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("suppliers")
      .select("id,company_name,contact_person,contact_email,phone,industry,is_verified,vat_number,created_at")
      .order("company_name", { ascending: true })
      .limit(limit ?? 20);
    if (search) q = q.ilike("company_name", `%${search}%`);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { suppliers: data ?? [] },
    };
  },
});
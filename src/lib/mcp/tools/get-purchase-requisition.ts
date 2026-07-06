import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "./_supabase";

export default defineTool({
  name: "get_purchase_requisition",
  title: "Get purchase requisition",
  description:
    "Fetch the full detail of a single purchase requisition by its transaction_id (e.g. PR-000123), including line items and approval history.",
  inputSchema: {
    transaction_id: z.string().trim().min(1).describe("The requisition transaction_id."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ transaction_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("purchase_requisitions")
      .select("*")
      .eq("transaction_id", transaction_id)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data)
      return { content: [{ type: "text", text: `No requisition found for ${transaction_id}.` }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { requisition: data },
    };
  },
});
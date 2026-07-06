import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "./_supabase";

export default defineTool({
  name: "list_purchase_requisitions",
  title: "List purchase requisitions",
  description:
    "List purchase requisitions visible to the signed-in user (scoped by access rules). Optionally filter by status and limit results.",
  inputSchema: {
    status: z
      .enum(["PENDING", "APPROVED", "REJECTED", "PAID", "IN_PROGRESS"])
      .optional()
      .describe("Filter by requisition status."),
    limit: z.number().int().min(1).max(50).optional().describe("Max rows to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("purchase_requisitions")
      .select(
        "id,transaction_id,requested_by_name,requested_by_department,total_amount,currency,urgency,hod_status,finance_status,status,due_date,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) q = q.eq("status", status);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { requisitions: data ?? [] },
    };
  },
});
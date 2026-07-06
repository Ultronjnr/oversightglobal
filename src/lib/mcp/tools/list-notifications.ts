import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "./_supabase";

export default defineTool({
  name: "list_notifications",
  title: "List notifications",
  description: "List the signed-in user's most recent notifications. Optionally show only unread ones.",
  inputSchema: {
    unread_only: z.boolean().optional().describe("Only return unread notifications."),
    limit: z.number().int().min(1).max(50).optional().describe("Max rows to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ unread_only, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("notifications")
      .select("id,title,message,type,is_read,created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (unread_only) q = q.eq("is_read", false);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { notifications: data ?? [] },
    };
  },
});
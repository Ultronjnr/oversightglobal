import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, unauthenticated } from "./_supabase";

export default defineTool({
  name: "whoami",
  title: "Who am I",
  description:
    "Return the signed-in user's profile: name, email, department, role and organization.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    const [{ data: profile, error: pErr }, { data: roleRow }] = await Promise.all([
      sb.from("profiles").select("id,email,name,surname,department,organization_id,tier").eq("id", userId).maybeSingle(),
      sb.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    ]);

    if (pErr) return { content: [{ type: "text", text: pErr.message }], isError: true };

    const result = { ...profile, role: roleRow?.role ?? null };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});
/**
 * Ovi — in-app assistant.
 *
 * Answers "how do I ...?" questions about Ovasyt and, when useful, returns a
 * route the frontend can navigate the user to. Real AI only (Gemini); if the
 * model or key is unavailable we return a graceful fallback, never fake answers.
 */
import { createAiProvider, extractStructuredData } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const ROUTES = `
Available destinations (use the exact path):
- /employee/portal — employee workspace: submit purchase requisitions, reimbursements
- /hod/portal — head of department workspace: approve team requisitions
- /finance/portal — finance dashboard and incoming purchase requisitions
- /finance/portal?tab=approvals — finance approvals queue
- /finance/portal?tab=suppliers — supplier directory
- /finance/portal?tab=quotes — supplier quotes
- /finance/portal?tab=invoices — supplier invoices
- /finance/portal?tab=payments — approved but not paid payment queue / batches
- /finance/portal?tab=reimbursements — staff reimbursement claims
- /finance/portal?tab=vat — VAT assessment
- /finance/portal?tab=reports — financial reports and exports
- /admin/portal — Super User workspace
- /admin/portal?tab=users — users and roles
- /admin/portal?tab=permissions — permissions and approval limits
- /admin/portal?tab=company — organisation profile
- /supplier/portal — supplier workspace: quotes, negotiations, invoices
- /donations — donations / Section 18A module
- /analytics — analytics
- /expense-history — expense history
- /cost-center-history — cost centre / department history
- /billing — billing and subscription
- /inbox — requisition chat inbox
`;

const SYSTEM = `You are Ovi, the built-in assistant for Ovasyt, a South African procurement,
expense and donation management platform for NGOs and NPOs.

Help the user do things inside the app: capturing expenses with Scan AI, purchase
requisitions, supplier quotes and invoices, approvals, payment batches, VAT,
reports, donations/Section 18A receipts, dashboards and settings.

Rules:
- Be brief and practical: at most 4 short steps, plain language, no jargon.
- Amounts are in ZAR.
- Only suggest a route from the provided list, and only when it genuinely helps.
- If the question is outside Ovasyt, say so briefly.
- Never invent features, numbers or data. You cannot read the user's records.

Respond with JSON only:
{"answer": "markdown text", "route": "/path or null", "routeLabel": "short button label or null"}

${ROUTES}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages, role } = (await req.json()) as {
      messages?: ChatMessage[];
      role?: string | null;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "No question provided." }, 400);
    }

    const transcript = messages
      .slice(-10)
      .map((m) => `${m.role === "user" ? "User" : "Ovi"}: ${String(m.content).slice(0, 2000)}`)
      .join("\n");

    const provider = createAiProvider();
    const result = await extractStructuredData<{
      answer?: string;
      route?: string | null;
      routeLabel?: string | null;
    }>(provider, {
      system: SYSTEM,
      prompt: `The signed-in user's role is ${role ?? "unknown"}.\n\nConversation:\n${transcript}\n\nAnswer the last user message.`,
      temperature: 0.3,
      maxOutputTokens: 800,
    }, "ovi-assistant");

    const data = result.data;
    if (!data?.answer) {
      return json(
        { answer: "Ovi could not put an answer together just now. Please try again in a moment." },
        200,
      );
    }

    return json({
      answer: data.answer,
      route: data.route || null,
      routeLabel: data.routeLabel || null,
    });
  } catch (err) {
    console.error("ovi-assistant error", err);
    return json(
      {
        answer:
          "Ovi is unavailable right now. You can still use the menu on the left to reach any part of the workspace.",
        unavailable: true,
      },
      200,
    );
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type DocType = "INVOICE" | "REIMBURSEMENT_PROOF" | "PR_DOCUMENT";

interface RequestBody {
  document_type: DocType;
  bucket: string;
  storage_path: string;
  invoice_id?: string | null;
  reimbursement_id?: string | null;
  pr_id?: string | null;
  force?: boolean;
}

const EXTRACTION_TOOL = {
  type: "function",
  function: {
    name: "extract_document_data",
    description:
      "Extract structured financial data from an uploaded invoice, receipt or proof of payment.",
    parameters: {
      type: "object",
      properties: {
        supplier_name: { type: "string", description: "Vendor / supplier / merchant name" },
        supplier_vat_number: { type: "string", description: "Tax / VAT registration number if present" },
        document_number: { type: "string", description: "Invoice or receipt number" },
        document_date: { type: "string", description: "Date in YYYY-MM-DD" },
        due_date: { type: "string", description: "Payment due date YYYY-MM-DD if present" },
        currency: { type: "string", description: "ISO currency code, default ZAR" },
        subtotal: { type: "number" },
        vat_amount: { type: "number" },
        vat_rate: { type: "number", description: "Percentage, e.g. 15" },
        total_amount: { type: "number" },
        payment_method: { type: "string" },
        payment_reference: { type: "string" },
        line_items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              quantity: { type: "number" },
              unit_price: { type: "number" },
              amount: { type: "number" },
              total_price: { type: "number" },
              needs_review: { type: "boolean" },
            },
            required: ["description", "unit_price"],
            additionalProperties: false,
          },
        },
        confidence: {
          type: "number",
          description: "0..1 confidence in extraction quality",
        },
        notes: { type: "string", description: "Anything unusual or unclear" },
      },
      required: ["total_amount", "confidence"],
      additionalProperties: false,
    },
  },
};

function systemPromptFor(docType: DocType): string {
  if (docType === "REIMBURSEMENT_PROOF") {
    return "You are an OCR assistant analysing employee proof-of-payment documents (receipts, till slips, EFT confirmations) for a South African finance team. Extract every field you can read. Currency defaults to ZAR. VAT is normally 15% (Standard) or 0% (Zero). Return all amounts as numbers without currency symbols.";
  }
  if (docType === "INVOICE") {
    return "You are an OCR assistant analysing supplier tax invoices for a South African finance team. Extract supplier, VAT number, invoice number, dates, line items and totals. Currency defaults to ZAR. VAT is normally 15% (Standard) or 0% (Zero). Return numeric amounts only.";
  }
  return "You are an OCR assistant analysing a purchase requisition supporting document. Extract any supplier, totals, dates or reference numbers you can read.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Authorization required" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return json({ error: "LOVABLE_API_KEY not configured" }, 500);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Invalid authentication" }, 401);

    const body = (await req.json()) as RequestBody;
    const { document_type, bucket, storage_path } = body;
    if (!document_type || !bucket || !storage_path) {
      return json({ error: "Missing document_type, bucket or storage_path" }, 400);
    }
    if (
      !["pr-documents", "reimbursement-documents", "invoice-documents"].includes(bucket)
    ) {
      return json({ error: "Invalid bucket" }, 400);
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Resolve org from user profile
    const { data: profile } = await admin
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();
    if (!profile?.organization_id) return json({ error: "No organization" }, 403);

    // Re-use existing analysis if present and not forced
    if (!body.force) {
      const { data: existing } = await admin
        .from("ocr_analyses")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .eq("bucket", bucket)
        .eq("storage_path", storage_path)
        .eq("status", "COMPLETED")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) {
        return json({ success: true, analysis: existing, cached: true });
      }
    }

    // Create PROCESSING row
    const { data: created, error: insertErr } = await admin
      .from("ocr_analyses")
      .insert({
        organization_id: profile.organization_id,
        document_type,
        bucket,
        storage_path,
        invoice_id: body.invoice_id ?? null,
        reimbursement_id: body.reimbursement_id ?? null,
        pr_id: body.pr_id ?? null,
        status: "PROCESSING",
        created_by: user.id,
      })
      .select("*")
      .single();
    if (insertErr || !created) {
      console.error("insert ocr_analyses failed", insertErr);
      return json({ error: "Failed to create analysis record" }, 500);
    }

    try {
      // Download file
      const { data: fileBlob, error: dlErr } = await admin.storage
        .from(bucket)
        .download(storage_path);
      if (dlErr || !fileBlob) throw new Error(`Storage download failed: ${dlErr?.message}`);

      const contentType = fileBlob.type || guessMime(storage_path);
      const supported = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "application/pdf"];
      if (!supported.includes(contentType)) {
        throw new Error(`Unsupported file type for OCR: ${contentType}`);
      }

      const buf = new Uint8Array(await fileBlob.arrayBuffer());
      const base64 = encodeBase64(buf);
      const dataUrl = `data:${contentType};base64,${base64}`;

      const model = "google/gemini-2.5-flash";
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPromptFor(document_type) },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract the structured fields from this document. Use the extract_document_data tool. If a field is unreadable, omit it. Confidence is your overall trust score from 0 to 1.",
                },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
          tools: [EXTRACTION_TOOL],
          tool_choice: { type: "function", function: { name: "extract_document_data" } },
        }),
      });

      if (!aiResp.ok) {
        const t = await aiResp.text();
        if (aiResp.status === 429) throw new Error("AI rate limit exceeded, try again shortly");
        if (aiResp.status === 402) throw new Error("AI credits exhausted — please top up Lovable AI usage");
        throw new Error(`AI gateway error ${aiResp.status}: ${t.slice(0, 300)}`);
      }
      const aiJson = await aiResp.json();
      const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        throw new Error("AI returned no structured data");
      }
      let extracted: Record<string, unknown>;
      try {
        extracted = JSON.parse(toolCall.function.arguments);
      } catch {
        throw new Error("AI returned invalid JSON");
      }
      const confidence = typeof extracted.confidence === "number" ? extracted.confidence : null;

      const { data: updated, error: updateErr } = await admin
        .from("ocr_analyses")
        .update({
          status: "COMPLETED",
          extracted,
          confidence,
          model,
        })
        .eq("id", created.id)
        .select("*")
        .single();
      if (updateErr) throw updateErr;

      return json({ success: true, analysis: updated, cached: false });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("analyze-document failed:", message);
      await admin
        .from("ocr_analyses")
        .update({ status: "FAILED", error_message: message })
        .eq("id", created.id);
      return json({ error: message }, 500);
    }
  } catch (e) {
    console.error("analyze-document outer error", e);
    return json({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function guessMime(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (["jpg", "jpeg"].includes(ext)) return "image/jpeg";
  return "application/octet-stream";
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
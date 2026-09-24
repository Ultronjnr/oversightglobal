import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/responses";
const AI_MODEL = "openai/gpt-6-astra";
const MAX_AI_ATTEMPTS = 3;

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
  file_hash?: string | null;
  probe_only?: boolean;
}

const EXTRACTION_SCHEMA = `{
  "supplier_name": "string",
  "supplier_vat_number": "string",
  "document_number": "string",
  "document_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD",
  "currency": "ZAR",
  "subtotal": 0,
  "vat_amount": 0,
  "vat_rate": 15,
  "vat_status": "STANDARD|ZERO_RATED|EXEMPT|NOT_REGISTERED",
  "supplier_vat_registered": true,
  "total_amount": 0,
  "payment_method": "string",
  "payment_reference": "string",
  "purchase_order_number": "string",
  "payment_terms": "string",
  "reference_number": "string",
  "expense_category": "string (only if clearly stated)",
  "project": "string (only if clearly stated)",
  "donor": "string (only if clearly stated)",
  "bank_name": "string",
  "bank_account_number": "digits only",
  "bank_branch_code": "digits only",
  "bank_account_type": "Current/Cheque|Savings|Transmission",
  "line_items": [{
    "description": "string",
    "quantity": 1,
    "unit_price": 0,
    "total_price": 0,
    "vat_amount": 0,
    "needs_review": false
  }],
  "confidence": 0.85,
  "notes": "string"
}`;

class AiGatewayError extends Error {
  status: number;
  retryAfterMs: number | null;

  constructor(message: string, status: number, retryAfterMs: number | null = null) {
    super(message);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }
}

function responseOutputText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  return output.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as unknown[]
      : [];
    return content.flatMap((part) => {
      if (!part || typeof part !== "object") return [];
      const text = (part as Record<string, unknown>).text;
      return typeof text === "string" ? [text] : [];
    });
  }).join("");
}

async function readResponseStream(res: Response): Promise<string> {
  if (!res.body) throw new AiGatewayError("AI returned an empty response.", 502);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  let terminalAnswer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      for (const line of event.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;
        try {
          const data = JSON.parse(raw) as Record<string, unknown>;
          if (data.type === "response.output_text.delta" && typeof data.delta === "string") {
            answer += data.delta;
          }
          if (data.type === "response.completed" && data.response && typeof data.response === "object") {
            terminalAnswer = responseOutputText(data.response as Record<string, unknown>);
          }
          if (data.type === "error") {
            const error = data.error as Record<string, unknown> | undefined;
            throw new AiGatewayError(
              typeof error?.message === "string" ? error.message : "AI could not scan this invoice.",
              502,
            );
          }
        } catch (error) {
          if (error instanceof AiGatewayError) throw error;
        }
      }
    }
    if (done) break;
  }
  return answer.trim() || terminalAnswer.trim();
}

async function scanInvoiceWithLovableAi(
  file: { mimeType: string; data: string },
  systemPrompt: string,
): Promise<{ data: Record<string, unknown>; model: string }> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new AiGatewayError("Invoice scanning is not configured.", 401);

  const mediaPart = file.mimeType === "application/pdf"
    ? {
        type: "input_file",
        filename: "invoice.pdf",
        file_data: `data:application/pdf;base64,${file.data}`,
      }
    : {
        type: "input_image",
        image_url: `data:${file.mimeType};base64,${file.data}`,
      };

  let lastError: AiGatewayError | null = null;
  for (let attempt = 0; attempt < MAX_AI_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      const waitMs = lastError?.retryAfterMs ?? (1200 * (2 ** (attempt - 1)) + Math.floor(Math.random() * 350));
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        stream: true,
        reasoning: { effort: "low", summary: "auto" },
        input: [{
          role: "user",
          content: [
            {
              type: "input_text",
              text: `${systemPrompt}\n\nReturn one valid JSON object only, without markdown. Use this shape: ${EXTRACTION_SCHEMA}\n\nExtract all invoice fields now. total_amount and confidence are required. If line items are unclear, return one summary line item using the invoice total.`,
            },
            mediaPart,
          ],
        }],
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
      const message = typeof payload.message === "string"
        ? payload.message
        : typeof payload.error === "string"
          ? payload.error
          : "AI could not scan this invoice.";
      const error = new AiGatewayError(message, response.status, parseRetryAfter(response.headers.get("Retry-After")));
      if (response.status !== 429 && response.status < 500) throw error;
      lastError = error;
      continue;
    }

    const text = await readResponseStream(response);
    const data = extractJsonObject(text);
    if (!data) throw new AiGatewayError("AI could not read enough invoice detail. Try a clearer image or PDF.", 422);
    return { data, model: AI_MODEL };
  }

  throw lastError ?? new AiGatewayError("Invoice scanning is temporarily busy. Please try again shortly.", 503);
}

function systemPromptFor(docType: DocType): string {
  const base = [
    "You are an expert South African tax invoice OCR extractor for SARS-compliant receipts.",
    "Extract structured data from the receipt image/PDF.",
    "",
    "RULES:",
    "- ALWAYS extract EVERY line item as a separate object. Never skip a line.",
    "- The document MAY span multiple pages. Read every page and MERGE line items from ALL pages into a single flat line_items array. Never restart numbering or drop rows on later pages.",
    "- Totals (subtotal, vat_amount, total_amount) refer to the WHOLE document — take them from the final summary page.",
    "- For each line item, ALWAYS output:",
    "  * description (string, clean item name)",
    "  * quantity (number, default 1 if missing)",
    "  * unit_price (number, in ZAR, WITHOUT the 'R' symbol. MUST be present. If only total is shown, calculate unit_price = total_price / quantity, rounded to 2 decimals.)",
    "  * total_price (number, in ZAR, the line total)",
    "  * vat_amount (number or null)",
    "- If unit_price is not explicitly printed, derive it: unit_price = total_price / quantity.",
    "- Never return null for unit_price. Always compute it.",
    "- Do NOT confuse unit_price with total_price. total_price = quantity * unit_price.",
    "- Ensure math consistency: sum(line total_price) ≈ subtotal; subtotal + vat_amount ≈ total_amount.",
    "- Return numbers only — no currency symbols, no thousands separators.",
    "- Currency defaults to ZAR. VAT is normally 15% (Standard) or 0% (Zero).",
    "- VAT STATUS: derive it from the document itself, never guess a default:",
    "  * STANDARD - a valid supplier VAT number is printed and VAT is charged at 15%.",
    "  * ZERO_RATED - supplier is VAT registered but the supply is charged at 0% (e.g. basic foodstuffs, exports).",
    "  * EXEMPT - the document states the supply is VAT exempt (e.g. financial services, residential rent).",
    "  * NOT_REGISTERED - no supplier VAT number appears anywhere on the document.",
    "- Set supplier_vat_registered to true only when a supplier VAT number is actually printed.",
    "- If VAT is charged but no supplier VAT number is printed, still report NOT_REGISTERED and note it in notes - this is an incorrectly charged VAT.",
    "- BANKING DETAILS: carefully look for the supplier's banking/payment details, usually near the footer or in a 'Banking Details' / 'Payment Details' block. Extract:",
    "  * bank_name (e.g. FNB, Standard Bank, ABSA, Nedbank, Capitec)",
    "  * bank_account_number (digits only, no spaces)",
    "  * bank_branch_code (universal/branch code, digits only)",
    "  * bank_account_type (Current/Cheque, Savings, or Transmission). Default to 'Current/Cheque' if not stated but a bank account is present.",
    "  If no banking details are printed, omit these fields.",
    "- PAYMENT REFERENCE: look for a 'Payment Reference', 'Beneficiary Reference', 'Use as reference' or 'Deposit reference' instruction, usually beside the banking details. Put it in payment_reference exactly as printed.",
    "- If no payment reference is printed anywhere, leave payment_reference empty - never invent one. The invoice number will be used instead.",
    "- Map fields when calling extract_document_data:",
    "  receipt_number → document_number, date → document_date, supplier_vat → supplier_vat_number,",
    "  vat_total → vat_amount, total → total_amount.",
    "- Be extremely precise with numbers.",
  ].join("\n");
  if (docType === "REIMBURSEMENT_PROOF") {
    return base + "\n\nContext: this is an employee proof-of-payment (receipt, till slip, EFT confirmation).";
  }
  if (docType === "INVOICE") {
    return base + "\n\nContext: this is a supplier tax invoice. Extract supplier legal name, VAT number, invoice serial number and invoice date.";
  }
  return base + "\n\nContext: this is a purchase requisition supporting document.";
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return json({ error: "Backend environment not configured" }, 500);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Invalid authentication" }, 401);

    const body = (await req.json()) as RequestBody;
    const { document_type, bucket, storage_path, file_hash, probe_only } = body;
    if (!document_type) {
      return json({ error: "Missing document_type" }, 400);
    }
    if (probe_only) {
      if (!file_hash) return json({ error: "probe_only requires file_hash" }, 400);
    } else if (!bucket || !storage_path) {
      return json({ error: "Missing bucket or storage_path" }, 400);
    }
    if (bucket &&
      !["pr-documents", "reimbursement-documents", "invoice-documents", "quote-documents"].includes(bucket)
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

    // Fast cache: if the caller precomputed a SHA-256 hash of the file, reuse
    // any prior COMPLETED analysis for the same org+hash without touching
    // storage or the AI model. Enables instant re-scan and zero-cost dedup.
    if (file_hash && !body.force) {
      const { data: hashHit } = await admin
        .from("ocr_analyses")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .eq("file_hash", file_hash)
        .eq("status", "COMPLETED")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (hashHit) {
        return json({ success: true, analysis: hashHit, cached: true });
      }
      if (probe_only) {
        return json({ success: true, analysis: null, cached: false });
      }
    }
    if (probe_only) {
      return json({ success: true, analysis: null, cached: false });
    }

    // Cross-tenant guard: the service-role client bypasses RLS on storage.
    // Verify the requested storage_path actually belongs to the caller's
    // organization before downloading. All app upload paths are prefixed with
    // either <organization_id>/... or <user_id>/..., or (for PR chat) with
    // chat/<pr_id>/... where the PR must belong to the caller's org.
    const orgOk = await verifyStoragePathOwnership(
      admin, storage_path!, user.id, profile.organization_id,
    );
    if (!orgOk) {
      return json({ error: "Not authorized for this document" }, 403);
    }

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
        file_hash: file_hash ?? null,
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

      const contentType = normalizeMime(fileBlob.type, storage_path);
      const supported = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "application/pdf"];
      if (!supported.includes(contentType)) {
        throw new Error(`Unsupported file type for OCR: ${contentType}`);
      }

      const buf = new Uint8Array(await fileBlob.arrayBuffer());
      // Compute (or verify) a SHA-256 fingerprint so we can dedup future scans
      // even when the client didn't precompute a hash.
      const computedHash = await sha256Hex(buf);
      if (!file_hash && !body.force) {
        const { data: postHit } = await admin
          .from("ocr_analyses")
          .select("*")
          .eq("organization_id", profile.organization_id)
          .eq("file_hash", computedHash)
          .eq("status", "COMPLETED")
          .neq("id", created.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (postHit) {
          await admin.from("ocr_analyses").delete().eq("id", created.id);
          return json({ success: true, analysis: postHit, cached: true });
        }
      }
      const base64 = encodeBase64(buf);

      const result = await scanInvoiceWithLovableAi(
        { mimeType: contentType, data: base64 },
        systemPromptFor(document_type),
      );
      const model = result.model;
      const extracted = result.data as Record<string, unknown> | null;
      if (!extracted) throw new Error("AI returned no structured data");
      coerceExtracted(extracted);
      normalizeLineItems(extracted);
      const confidence = typeof extracted.confidence === "number" ? extracted.confidence : null;

      const { data: updated, error: updateErr } = await admin
        .from("ocr_analyses")
        .update({
          status: "COMPLETED",
          extracted,
          confidence,
          model,
          file_hash: computedHash,
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
      const status = e instanceof AiGatewayError ? e.status : 500;
      return json({ error: message }, status);
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

function normalizeMime(blobType: string | undefined, path: string): string {
  const guessed = guessMime(path);
  if (!blobType || blobType === "application/octet-stream") return guessed;
  if (blobType === "image/jpg") return "image/jpeg";
  return blobType;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.\-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeLineItems(extracted: Record<string, unknown>) {
  const items = extracted?.line_items;
  if (!Array.isArray(items)) return;
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    let qty = toNum(item.quantity);
    let unit = toNum(item.unit_price);
    let total = toNum(item.total_price) ?? toNum(item.amount);
    let needsReview = item.needs_review === true;

    // Default quantity to 1 if missing
    if (qty == null || qty <= 0) {
      qty = 1;
      if (item.quantity == null) needsReview = true;
    }
    // Derive unit_price from total / qty when missing
    if (unit == null && total != null) {
      unit = Number((total / qty).toFixed(2));
    }
    // Derive total from unit * qty when missing
    if (total == null && unit != null) {
      total = Number((unit * qty).toFixed(2));
    }
    // Last-resort defaults — never null
    if (unit == null) {
      unit = 0;
      needsReview = true;
    }
    if (total == null) {
      total = Number((unit * qty).toFixed(2));
    }

    item.quantity = qty;
    item.unit_price = unit;
    item.total_price = total;
    item.amount = total;
    item.needs_review = needsReview;
  }
}

function coerceExtracted(extracted: Record<string, unknown>) {
  for (const key of ["subtotal", "vat_amount", "vat_rate", "total_amount", "confidence"]) {
    const n = toNum(extracted[key]);
    if (n != null) extracted[key] = n;
  }
  if (!extracted.currency) extracted.currency = "ZAR";
  const confidence = toNum(extracted.confidence);
  if (confidence == null || confidence <= 0) extracted.confidence = 0.7;

  const total = toNum(extracted.total_amount);
  const lineItems = extracted.line_items;
  if (total != null && (!Array.isArray(lineItems) || lineItems.length === 0)) {
    extracted.line_items = [{
      description: String(extracted.document_number ? `Invoice ${extracted.document_number}` : "Invoice total"),
      quantity: 1,
      unit_price: total,
      total_price: total,
      needs_review: true,
    }];
  }
}

async function verifyStoragePathOwnership(
  admin: ReturnType<typeof createClient>,
  storagePath: string,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const segments = storagePath.split("/").filter(Boolean);
  if (segments.length === 0) return false;
  const first = segments[0];
  if (first === organizationId) return true;
  if (first === userId) return true;
  // PR chat uploads: chat/<pr_id>/<file>
  if (first === "chat" && segments.length >= 2) {
    const prId = segments[1];
    const { data } = await admin
      .from("purchase_requisitions")
      .select("organization_id")
      .eq("id", prId)
      .maybeSingle();
    if ((data as any)?.organization_id === organizationId) return true;
  }
  // Last-resort fallback: if we already indexed this document as an
  // attachment for the caller's org, allow it.
  const { data: attach } = await admin
    .from("attachments")
    .select("id")
    .eq("file_path", storagePath)
    .eq("organization_id", organizationId)
    .limit(1)
    .maybeSingle();
  return !!attach;
}
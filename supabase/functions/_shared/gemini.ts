/**
 * Provider-agnostic AI document service (server-side only).
 *
 * Default provider: Google Gemini (direct API, billed to our own GEMINI_API_KEY).
 * Swap providers by implementing `AiProvider` and passing it to the helpers below —
 * no business logic changes required.
 *
 * NEVER import this from frontend code. The API key must stay server-side.
 */

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export interface AiFilePart {
  mimeType: string;
  /** raw base64 (no data: prefix) */
  data: string;
}

export interface AiJsonRequest {
  system: string;
  prompt: string;
  files?: AiFilePart[];
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
}

export interface AiJsonResult<T = Record<string, unknown>> {
  data: T | null;
  model: string;
  raw: string;
  durationMs: number;
  promptTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
}

/** Implement this to swap Gemini for OpenAI or any other provider. */
export interface AiProvider {
  readonly name: string;
  generateJson<T = Record<string, unknown>>(req: AiJsonRequest): Promise<AiJsonResult<T>>;
}

// Gemini 2.5 Flash public pricing (USD per 1M tokens) — used for cost logging only.
const COST_PER_M = { input: 0.3, output: 2.5 };

export class GeminiProvider implements AiProvider {
  readonly name = "gemini";
  #apiKey: string;
  #defaultModel: string;

  constructor(apiKey: string, defaultModel = DEFAULT_GEMINI_MODEL) {
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
    this.#apiKey = apiKey;
    this.#defaultModel = defaultModel;
  }

  async generateJson<T = Record<string, unknown>>(req: AiJsonRequest): Promise<AiJsonResult<T>> {
    const model = req.model ?? this.#defaultModel;
    const started = Date.now();

    const parts: Record<string, unknown>[] = [{ text: req.prompt }];
    for (const f of req.files ?? []) {
      parts.push({ inlineData: { mimeType: f.mimeType, data: f.data } });
    }

    const body = {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: req.temperature ?? 0,
        responseMimeType: "application/json",
        maxOutputTokens: req.maxOutputTokens ?? 4096,
      },
    };

    const res = await fetch(
      `${GEMINI_ENDPOINT}/${model}:generateContent?key=${encodeURIComponent(this.#apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      const detail = redact(text).slice(0, 400);
      if (res.status === 429) throw new Error("AI rate limit exceeded, try again shortly");
      if (res.status === 401 || res.status === 403) {
        throw new Error("Gemini rejected the API key — check GEMINI_API_KEY");
      }
      throw new Error(`Gemini error ${res.status}: ${detail}`);
    }

    const payload = await res.json();
    const raw: string = (payload?.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p?.text ?? "")
      .join("")
      .trim();

    const usage = payload?.usageMetadata ?? {};
    const promptTokens = numOrNull(usage.promptTokenCount);
    const outputTokens = numOrNull(usage.candidatesTokenCount);
    const estimatedCostUsd = promptTokens !== null && outputTokens !== null
      ? Number(
        ((promptTokens / 1e6) * COST_PER_M.input + (outputTokens / 1e6) * COST_PER_M.output)
          .toFixed(6),
      )
      : null;

    return {
      data: parseJsonObject<T>(raw),
      model,
      raw,
      durationMs: Date.now() - started,
      promptTokens,
      outputTokens,
      estimatedCostUsd,
    };
  }
}

/** Build the default provider from env. */
export function createAiProvider(model?: string): AiProvider {
  return new GeminiProvider(Deno.env.get("GEMINI_API_KEY") ?? "", model);
}

/**
 * Runs a JSON generation with one automatic retry, and structured logging
 * (model, duration, tokens, estimated cost, outcome). Never logs the API key.
 */
export async function extractStructuredData<T = Record<string, unknown>>(
  provider: AiProvider,
  req: AiJsonRequest,
  label = "ai",
): Promise<AiJsonResult<T>> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await provider.generateJson<T>(req);
      console.log(JSON.stringify({
        scope: label,
        provider: provider.name,
        model: result.model,
        attempt,
        ms: result.durationMs,
        prompt_tokens: result.promptTokens,
        output_tokens: result.outputTokens,
        est_cost_usd: result.estimatedCostUsd,
        status: result.data ? "success" : "no_structured_data",
      }));
      if (result.data) return result;
      lastErr = new Error("AI returned no structured data");
    } catch (e) {
      lastErr = e;
      console.error(JSON.stringify({
        scope: label,
        provider: provider.name,
        attempt,
        status: "failure",
        error: redact(e instanceof Error ? e.message : String(e)).slice(0, 300),
      }));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("AI request failed");
}

/* ------------------------------------------------------------------ */
/* Reusable document tasks                                             */
/* ------------------------------------------------------------------ */

const JSON_ONLY = "Respond with a single valid compact JSON object only. No markdown, no commentary.";

export function scanInvoice(provider: AiProvider, file: AiFilePart, systemPrompt: string, schema: string) {
  return extractStructuredData(provider, {
    system: `${systemPrompt}\n\n${JSON_ONLY} Use this JSON shape and omit unreadable optional fields: ${schema}`,
    prompt:
      "Extract the invoice fields now. Return one JSON object only. total_amount and confidence are required. If line items are unclear, return one summary line item using the invoice total.",
    files: [file],
    maxOutputTokens: 4096,
  }, "scan-invoice");
}

export function scanReceipt(provider: AiProvider, file: AiFilePart) {
  return extractStructuredData(provider, {
    system:
      `You extract data from South African retail receipts / till slips. ${JSON_ONLY} Shape: {"merchant":"string","transaction_date":"YYYY-MM-DD","amount":0,"vat_amount":0,"payment_reference":"string","payment_method":"CARD|CASH|EFT","currency":"ZAR","receipt_number":"string","confidence":0.9}`,
    prompt: "Extract the receipt fields now.",
    files: [file],
    maxOutputTokens: 1024,
  }, "scan-receipt");
}

export interface PopComparison {
  amount_paid?: number;
  reference_number?: string;
  beneficiary?: string;
  date_paid?: string;
  bank_name?: string;
  currency?: string;
  warnings?: string[];
  matches?: boolean;
}

export function scanProofOfPayment(
  provider: AiProvider,
  file: AiFilePart,
  expected?: { amount?: number; reference?: string; supplier?: string },
) {
  return extractStructuredData<PopComparison>(provider, {
    system:
      `You extract data from bank proof-of-payment documents and compare it to an expected transaction. ${JSON_ONLY} Shape: {"amount_paid":0,"reference_number":"string","beneficiary":"string","date_paid":"YYYY-MM-DD","bank_name":"string","currency":"ZAR","matches":true,"warnings":["string"]}. Add a warning when the amount differs, the reference differs, the beneficiary/supplier differs, or the document looks like the wrong proof of payment.`,
    prompt: `Extract and compare. Expected transaction: ${JSON.stringify(expected ?? {})}`,
    files: [file],
    maxOutputTokens: 1024,
  }, "scan-pop");
}

export interface DuplicateVerdict {
  possibleDuplicate: boolean;
  confidence: number;
  matchedTransactionId: string | null;
  reason: string;
}

export function detectDuplicates(
  provider: AiProvider,
  candidate: Record<string, unknown>,
  existing: Array<Record<string, unknown>>,
) {
  return extractStructuredData<DuplicateVerdict>(provider, {
    system:
      `You detect duplicate finance transactions. Compare supplier, description, amount and invoice number. Never reject — only report. ${JSON_ONLY} Shape: {"possibleDuplicate":false,"confidence":0,"matchedTransactionId":null,"reason":"string"}`,
    prompt: `Candidate: ${JSON.stringify(candidate)}\nExisting: ${JSON.stringify(existing)}`,
    maxOutputTokens: 512,
  }, "detect-duplicates");
}

export function summarizeDocument(provider: AiProvider, file: AiFilePart) {
  return extractStructuredData(provider, {
    system: `Summarize the document for a finance team. ${JSON_ONLY} Shape: {"summary":"string","key_points":["string"]}`,
    prompt: "Summarize this document.",
    files: [file],
    maxOutputTokens: 700,
  }, "summarize-document");
}

/* ------------------------------------------------------------------ */

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function redact(text: string): string {
  return text.replace(/key=[^&\s"]+/gi, "key=***");
}

export function parseJsonObject<T>(text: string): T | null {
  if (!text) return null;
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // fall through
  }
  const start = cleaned.indexOf("{");
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

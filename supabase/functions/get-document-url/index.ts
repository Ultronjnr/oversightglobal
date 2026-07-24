import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  document_url?: string;
  pr_id: string;
}

type DocumentCandidate = {
  bucket: string;
  pathOrUrl: string;
};

const ALLOWED_BUCKETS = new Set(["pr-documents", "invoice-documents", "attachments"]);

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function detectBucket(pathOrUrl: string, fallbackBucket = "pr-documents"): string {
  const match = pathOrUrl.match(/\/storage\/v1\/object\/(?:sign|public)\/([^/]+)\//);
  if (match?.[1] && ALLOWED_BUCKETS.has(match[1])) return match[1];

  const prefix = pathOrUrl.split("/")[0];
  if (ALLOWED_BUCKETS.has(prefix)) return prefix;

  return ALLOWED_BUCKETS.has(fallbackBucket) ? fallbackBucket : "pr-documents";
}

function normalizeCandidates(pathOrUrl: string, bucket: string): string[] {
  const raw = pathOrUrl.trim();
  if (!raw) return [];

  let path = raw;
  const storageMatch = raw.match(new RegExp(`/storage/v1/object/(?:sign|public)/${bucket}/([^?]+)`));
  if (storageMatch?.[1]) {
    path = storageMatch[1];
  } else if (raw.startsWith(`${bucket}/`)) {
    path = raw.replace(new RegExp(`^${bucket}/`), "");
  }

  const candidates = new Set<string>();
  const add = (value: string) => {
    const cleaned = value.replace(/^\/+/, "").replace(new RegExp(`^${bucket}/`), "");
    if (cleaned) candidates.add(cleaned);
  };

  add(path);
  try {
    add(decodeURIComponent(path));
  } catch {
    // Keep original candidate when decoding fails.
  }

  return Array.from(candidates);
}

function addCandidate(candidates: DocumentCandidate[], pathOrUrl: unknown, fallbackBucket = "pr-documents") {
  if (typeof pathOrUrl !== "string" || !pathOrUrl.trim()) return;
  candidates.push({
    bucket: detectBucket(pathOrUrl, fallbackBucket),
    pathOrUrl: pathOrUrl.trim(),
  });
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token from header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!supabaseAnonKey) {
      console.error("SUPABASE_ANON_KEY not available");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's token for auth check
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: RequestBody = await req.json();
    const { pr_id } = body;

    if (!pr_id) {
      return new Response(
        JSON.stringify({ error: "Missing pr_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client for access checks and signed URL generation
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's profile to check organization
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    // Get the PR to verify access
    const { data: pr, error: prError } = await adminClient
      .from("purchase_requisitions")
      .select("id, organization_id, document_url")
      .eq("id", pr_id)
      .single();

    if (prError || !pr) {
      return new Response(
        JSON.stringify({ error: "Purchase requisition not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user has access:
    // 1. Same organization
    // 2. Supplier linked via quote request
    let hasAccess = false;

    // Check org membership
    if (profile?.organization_id === pr.organization_id) {
      hasAccess = true;
    }

    // Check if supplier linked to this PR via quote request
    if (!hasAccess) {
      const { data: supplierLink } = await adminClient
        .from("suppliers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (supplierLink) {
        const { data: quoteRequest } = await adminClient
          .from("quote_requests")
          .select("id")
          .eq("pr_id", pr_id)
          .eq("supplier_id", supplierLink.id)
          .single();

        if (quoteRequest) {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: "Access denied to this document" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: derive storage paths ONLY from database rows the user is allowed
    // to access. The client-supplied document_url is intentionally ignored.
    const documentCandidates: DocumentCandidate[] = [];
    addCandidate(documentCandidates, (pr as any).document_url, "pr-documents");

    // Scanned invoices and payment transactions may carry the invoice document
    // even when purchase_requisitions.document_url remains empty.
    const { data: txns } = await adminClient
      .from("transactions")
      .select("id, document_url, scan_document_path, scan_document_bucket, invoice_id, updated_at")
      .eq("pr_id", pr_id)
      .order("updated_at", { ascending: false });

    const transactionIds: string[] = [];
    const invoiceIds: string[] = [];
    for (const txn of (txns || []) as any[]) {
      if (txn.id) transactionIds.push(txn.id);
      if (txn.invoice_id) invoiceIds.push(txn.invoice_id);
      addCandidate(documentCandidates, txn.scan_document_path, firstText(txn.scan_document_bucket, "pr-documents") || "pr-documents");
      addCandidate(documentCandidates, txn.document_url, firstText(txn.scan_document_bucket, "pr-documents") || "pr-documents");
    }

    const invoiceQuery = adminClient
      .from("invoices")
      .select("document_url, updated_at")
      .eq("pr_id", pr_id)
      .order("updated_at", { ascending: false });
    const { data: invoicesByPr } = await invoiceQuery;
    for (const invoice of (invoicesByPr || []) as any[]) {
      addCandidate(documentCandidates, invoice.document_url, "invoice-documents");
    }

    if (invoiceIds.length > 0) {
      const { data: invoicesById } = await adminClient
        .from("invoices")
        .select("document_url, updated_at")
        .in("id", invoiceIds)
        .order("updated_at", { ascending: false });
      for (const invoice of (invoicesById || []) as any[]) {
        addCandidate(documentCandidates, invoice.document_url, "invoice-documents");
      }
    }

    let attachmentQuery = adminClient
      .from("attachments")
      .select("file_path, file_name, mime_type, created_at")
      .eq("is_current", true)
      .eq("pr_id", pr_id)
      .order("created_at", { ascending: false });
    const { data: prAttachments } = await attachmentQuery;
    for (const attachment of (prAttachments || []) as any[]) {
      addCandidate(documentCandidates, attachment.file_path, "attachments");
    }

    if (transactionIds.length > 0) {
      const { data: txnAttachments } = await adminClient
        .from("attachments")
        .select("file_path, file_name, mime_type, created_at")
        .eq("is_current", true)
        .in("transaction_id", transactionIds)
        .order("created_at", { ascending: false });
      for (const attachment of (txnAttachments || []) as any[]) {
        addCandidate(documentCandidates, attachment.file_path, "attachments");
      }
    }

    const uniqueDocuments = new Map<string, DocumentCandidate>();
    for (const candidate of documentCandidates) {
      if (!ALLOWED_BUCKETS.has(candidate.bucket)) continue;
      uniqueDocuments.set(`${candidate.bucket}:${candidate.pathOrUrl}`, candidate);
    }

    let signedUrl: string | null = null;
    let lastError: unknown = null;
    let resolvedPath = "";
    let resolvedBucket = "pr-documents";
    for (const document of uniqueDocuments.values()) {
      for (const candidatePath of normalizeCandidates(document.pathOrUrl, document.bucket)) {
        const { data, error } = await adminClient.storage
          .from(document.bucket)
          .createSignedUrl(candidatePath, 600);
        if (data?.signedUrl) {
          signedUrl = data.signedUrl;
          resolvedPath = candidatePath;
          resolvedBucket = document.bucket;
          break;
        }
        lastError = error;
      }
      if (signedUrl) break;
    }

    if (!signedUrl) {
      console.error(
        "Signed URL generation failed for all candidates",
        { candidates: Array.from(uniqueDocuments.values()), lastError, pr_id }
      );
      return new Response(
        JSON.stringify({
          error: uniqueDocuments.size > 0
            ? "Document file not found in storage"
            : "This purchase requisition has no document",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract file info from path
    const fileName = resolvedPath.split("/").pop() || "document";
    const fileExtension = fileName.split(".").pop()?.toLowerCase() || "";

    // Determine file type for preview handling
    let fileType = "other";
    if (["pdf"].includes(fileExtension)) {
      fileType = "pdf";
    } else if (["jpg", "jpeg", "png", "webp", "gif"].includes(fileExtension)) {
      fileType = "image";
    }

    return new Response(
      JSON.stringify({
        success: true,
        signed_url: signedUrl,
        file_name: fileName,
        file_type: fileType,
        bucket: resolvedBucket,
        expires_in: 600,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

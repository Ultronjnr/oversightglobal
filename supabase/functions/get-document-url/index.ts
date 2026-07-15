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

    // SECURITY: derive storage path ONLY from the PR row loaded from the DB.
    // Never trust a client-supplied document_url — that would let an authorized
    // caller request a signed URL for any other PR's file in the shared bucket.
    const prDocumentUrl = (pr as any).document_url as string | null;
    if (!prDocumentUrl) {
      return new Response(
        JSON.stringify({ error: "This purchase requisition has no document" }),
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

    // Extract the storage path from the document_url
    // URLs can be:
    // 1. Full signed URL: https://xxx.supabase.co/storage/v1/object/sign/pr-documents/user-id/filename.pdf?token=xxx
    // 2. Public URL: https://xxx.supabase.co/storage/v1/object/public/pr-documents/user-id/filename.pdf
    // 3. Just the path: user-id/filename.pdf
    
    let storagePath = prDocumentUrl;
    
    // Extract path from signed URL
    if (prDocumentUrl.includes("/storage/v1/object/sign/pr-documents/")) {
      const match = prDocumentUrl.match(/\/pr-documents\/([^?]+)/);
      if (match) {
        storagePath = match[1];
      }
    }
    // Extract path from public URL
    else if (prDocumentUrl.includes("/storage/v1/object/public/pr-documents/")) {
      const match = prDocumentUrl.match(/\/pr-documents\/([^?]+)/);
      if (match) {
        storagePath = match[1];
      }
    }
    // Handle direct path
    else if (prDocumentUrl.startsWith("pr-documents/")) {
      storagePath = prDocumentUrl.replace("pr-documents/", "");
    }

    // URL decode the path in case it has encoded characters
    try {
      storagePath = decodeURIComponent(storagePath);
    } catch {
      // keep as-is
    }
    storagePath = storagePath.replace(/^\/+/, "");

    // Build candidate paths to try, in order
    const candidates = Array.from(
      new Set(
        [
          storagePath,
          storagePath.replace(/^pr-documents\//, ""),
          // sometimes paths are double-encoded
          (() => {
            try { return decodeURIComponent(storagePath); } catch { return storagePath; }
          })(),
        ].filter(Boolean)
      )
    );

    let signedUrl: string | null = null;
    let lastError: unknown = null;
    let resolvedPath = storagePath;
    for (const candidate of candidates) {
      const { data, error } = await adminClient.storage
        .from("pr-documents")
        .createSignedUrl(candidate, 600);
      if (data?.signedUrl) {
        signedUrl = data.signedUrl;
        resolvedPath = candidate;
        break;
      }
      lastError = error;
    }

    if (!signedUrl) {
      console.error(
        "Signed URL generation failed for all candidates",
        { candidates, lastError, pr_id }
      );
      return new Response(
        JSON.stringify({
          error: "Document file not found in storage",
          attempted_path: storagePath,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    storagePath = resolvedPath;

    // Extract file info from path
    const fileName = storagePath.split("/").pop() || "document";
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

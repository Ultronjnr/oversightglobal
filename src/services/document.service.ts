import { supabase } from "@/integrations/supabase/client";
import { logError, getSafeErrorMessage } from "@/lib/error-handler";

export interface DocumentUrlResult {
  success: boolean;
  signed_url?: string;
  file_name?: string;
  file_type?: "pdf" | "image" | "other";
  expires_in?: number;
  error?: string;
}

/**
 * Get a secure signed URL for a PR document
 * Uses the edge function to verify access and generate fresh signed URLs
 */
export async function getDocumentSignedUrl(
  documentUrl: string,
  prId: string
): Promise<DocumentUrlResult> {
  try {
    // Get current session for auth header
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return { 
        success: false, 
        error: "Authentication required to view documents" 
      };
    }

    const response = await supabase.functions.invoke("get-document-url", {
      body: {
        document_url: documentUrl,
        pr_id: prId,
      },
    });

    if (response.error) {
      logError("getDocumentSignedUrl", response.error);
      return { 
        success: false, 
        error: getSafeErrorMessage(response.error) 
      };
    }

    const data = response.data;

    if (!data?.success) {
      return { 
        success: false, 
        error: data?.error || "Failed to generate document URL" 
      };
    }

    return {
      success: true,
      signed_url: data.signed_url,
      file_name: data.file_name,
      file_type: data.file_type,
      expires_in: data.expires_in,
    };
  } catch (error: any) {
    logError("getDocumentSignedUrl", error);
    return { 
      success: false, 
      error: getSafeErrorMessage(error) 
    };
  }
}

/**
 * Extract storage path from a document URL or return the path as-is
 * Handles legacy signed URLs, public URLs, and direct paths
 */
export function extractStoragePath(documentUrl: string): string {
  if (!documentUrl) return "";

  // Handle signed URLs
  if (documentUrl.includes("/storage/v1/object/sign/pr-documents/")) {
    const match = documentUrl.match(/\/pr-documents\/([^?]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
  }

  // Handle public URLs
  if (documentUrl.includes("/storage/v1/object/public/pr-documents/")) {
    const match = documentUrl.match(/\/pr-documents\/([^?]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
  }

  // Handle direct path with bucket prefix
  if (documentUrl.startsWith("pr-documents/")) {
    return documentUrl.replace("pr-documents/", "");
  }

  // Assume it's already a clean path
  return documentUrl;
}

/**
 * Get file extension from a document URL or path
 */
export function getFileExtension(documentUrl: string): string {
  const path = extractStoragePath(documentUrl);
  const fileName = path.split("/").pop() || "";
  return fileName.split(".").pop()?.toLowerCase() || "";
}

/**
 * Determine file type for preview handling
 */
export function getFileType(documentUrl: string): "pdf" | "image" | "other" {
  const ext = getFileExtension(documentUrl);
  
  if (ext === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "image";
  return "other";
}

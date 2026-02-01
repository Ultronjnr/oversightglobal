import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

const BUCKET_NAME = "quote-documents";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface UploadQuoteDocumentResult {
  success: boolean;
  path?: string;
  error?: string;
}

/**
 * Upload a quote document (PDF only)
 */
export async function uploadQuoteDocument(
  file: File,
  quoteRequestId: string
): Promise<UploadQuoteDocumentResult> {
  try {
    // Validate file type
    if (file.type !== "application/pdf") {
      return { success: false, error: "Only PDF files are allowed" };
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return { success: false, error: "File size must be less than 10MB" };
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    // Generate unique filename
    const fileExt = "pdf";
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${user.id}/${quoteRequestId}/${fileName}`;

    // Upload file
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return { success: false, error: uploadError.message };
    }

    return { success: true, path: filePath };
  } catch (error: any) {
    console.error("uploadQuoteDocument error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get a signed URL for viewing a quote document
 */
export async function getQuoteDocumentUrl(
  path: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, 600); // 10-minute expiry

    if (error) {
      console.error("Signed URL error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, url: data.signedUrl };
  } catch (error: any) {
    console.error("getQuoteDocumentUrl error:", error);
    return { success: false, error: error.message };
  }
}

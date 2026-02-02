import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

const BUCKET_NAME = "invoice-documents";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface Invoice {
  id: string;
  quote_id: string;
  pr_id: string;
  supplier_id: string;
  organization_id: string;
  document_url: string;
  status: "UPLOADED" | "AWAITING_PAYMENT" | "PAID";
  created_at: string;
  updated_at: string;
}

export interface UploadInvoiceResult {
  success: boolean;
  invoice?: Invoice;
  error?: string;
}

/**
 * Upload an invoice document (PDF only) and create invoice record
 */
export async function uploadInvoice(
  file: File,
  quoteId: string,
  prId: string,
  organizationId: string
): Promise<UploadInvoiceResult> {
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

    // Get supplier ID
    const { data: supplier, error: supplierError } = await supabase
      .from("suppliers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (supplierError || !supplier) {
      return { success: false, error: "Supplier profile not found" };
    }

    // Check if invoice already exists for this quote
    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("id")
      .eq("quote_id", quoteId)
      .maybeSingle();

    if (existingInvoice) {
      return { success: false, error: "An invoice has already been uploaded for this quote" };
    }

    // Generate unique filename
    const fileName = `${uuidv4()}.pdf`;
    const filePath = `${user.id}/${quoteId}/${fileName}`;

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

    // Create invoice record
    const { data: invoice, error: insertError } = await supabase
      .from("invoices")
      .insert({
        quote_id: quoteId,
        pr_id: prId,
        supplier_id: supplier.id,
        organization_id: organizationId,
        document_url: filePath,
        status: "UPLOADED",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      // Try to clean up uploaded file
      await supabase.storage.from(BUCKET_NAME).remove([filePath]);
      return { success: false, error: insertError.message };
    }

    // Update quote status to INVOICE_UPLOADED
    await supabase
      .from("quotes")
      .update({ status: "INVOICE_UPLOADED" })
      .eq("id", quoteId);

    return { success: true, invoice: invoice as Invoice };
  } catch (error: any) {
    console.error("uploadInvoice error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get a signed URL for viewing an invoice document
 */
export async function getInvoiceDocumentUrl(
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
    console.error("getInvoiceDocumentUrl error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get invoices for the current supplier
 */
export async function getSupplierInvoices(): Promise<{
  success: boolean;
  data: Invoice[];
  error?: string;
}> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, data: [], error: "Not authenticated" };
    }

    // Get supplier ID
    const { data: supplier } = await supabase
      .from("suppliers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!supplier) {
      return { success: false, data: [], error: "Supplier profile not found" };
    }

    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("supplier_id", supplier.id)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, data: [], error: error.message };
    }

    return { success: true, data: (data || []) as Invoice[] };
  } catch (error: any) {
    return { success: false, data: [], error: error.message };
  }
}

export interface InvoiceWithDetails extends Invoice {
  supplier?: {
    id: string;
    company_name: string;
    contact_email: string;
  };
  pr?: {
    id: string;
    transaction_id: string;
    total_amount: number;
    currency: string;
    requested_by_name: string;
  };
  quote?: {
    id: string;
    amount: number;
  };
}

/**
 * Get invoices for finance (organization-wide)
 */
export async function getOrganizationInvoices(): Promise<{
  success: boolean;
  data: Invoice[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, data: [], error: error.message };
    }

    return { success: true, data: (data || []) as Invoice[] };
  } catch (error: any) {
    return { success: false, data: [], error: error.message };
  }
}

/**
 * Get invoices awaiting payment with full details
 */
export async function getInvoicesAwaitingPayment(): Promise<{
  success: boolean;
  data: InvoiceWithDetails[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("invoices")
      .select(`
        *,
        supplier:suppliers (
          id,
          company_name,
          contact_email
        ),
        pr:purchase_requisitions (
          id,
          transaction_id,
          total_amount,
          currency,
          requested_by_name
        ),
        quote:quotes (
          id,
          amount
        )
      `)
      .in("status", ["UPLOADED", "AWAITING_PAYMENT"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("getInvoicesAwaitingPayment error:", error);
      return { success: false, data: [], error: error.message };
    }

    return { success: true, data: (data || []) as InvoiceWithDetails[] };
  } catch (error: any) {
    console.error("getInvoicesAwaitingPayment error:", error);
    return { success: false, data: [], error: error.message };
  }
}

/**
 * Update invoice status (Finance only)
 */
export async function updateInvoiceStatus(
  invoiceId: string,
  status: "AWAITING_PAYMENT" | "PAID"
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("invoices")
      .update({ status })
      .eq("id", invoiceId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Mark multiple invoices as paid (batch operation)
 */
export async function markInvoicesAsPaid(
  invoiceIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    if (invoiceIds.length === 0) {
      return { success: false, error: "No invoices selected" };
    }

    const { error } = await supabase
      .from("invoices")
      .update({ status: "PAID" })
      .in("id", invoiceIds);

    if (error) {
      console.error("markInvoicesAsPaid error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("markInvoicesAsPaid error:", error);
    return { success: false, error: error.message };
  }
}

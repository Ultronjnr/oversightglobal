import { supabase } from "@/integrations/supabase/client";
import type { PRItem } from "@/types/pr.types";
import type { Json } from "@/integrations/supabase/types";

export interface SupplierProfile {
  id: string;
  company_name: string;
  contact_email: string;
  registration_number: string | null;
  is_verified: boolean;
  phone: string | null;
  address: string | null;
  industry: string | null;
  user_id: string;
}

export interface SupplierQuoteRequest {
  id: string;
  pr_id: string;
  supplier_id: string;
  organization_id: string;
  requested_by: string;
  message: string | null;
  items: PRItem[];
  status: string;
  created_at: string;
  updated_at: string;
  organization_name?: string;
  pr_transaction_id?: string;
  requester_name?: string;
  requester_email?: string;
  // Extended PR details
  pr_due_date?: string | null;
  pr_payment_due_date?: string | null;
  pr_urgency?: string;
  pr_document_url?: string | null;
  pr_total_amount?: number;
  pr_currency?: string;
}

export interface SupplierQuote {
  id: string;
  quote_request_id: string;
  supplier_id: string;
  organization_id: string;
  pr_id: string;
  amount: number;
  delivery_time: string | null;
  valid_until: string | null;
  notes: string | null;
  status: string;
  document_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierStats {
  pendingRequests: number;
  submittedQuotes: number;
  acceptedQuotes: number;
  totalValue: number;
}

/**
 * Get the current supplier's profile
 */
export async function getSupplierProfile(): Promise<{
  success: boolean;
  data: SupplierProfile | null;
  error?: string;
}> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, data: null, error: "Not authenticated" };
    }

    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return { success: false, data: null, error: "Supplier profile not found" };
      }
      return { success: false, data: null, error: error.message };
    }

    return { success: true, data: data as SupplierProfile };
  } catch (error: any) {
    return { success: false, data: null, error: error.message };
  }
}

/**
 * Get quote requests for the current supplier with organization and PR details
 */
export async function getSupplierQuoteRequests(): Promise<{
  success: boolean;
  data: SupplierQuoteRequest[];
  error?: string;
}> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, data: [], error: "Not authenticated" };
    }

    // First get the supplier's ID
    const { data: supplier } = await supabase
      .from("suppliers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!supplier) {
      return { success: false, data: [], error: "Supplier profile not found" };
    }

    // Get quote requests with organization name and PR details
    // Note: requested_by doesn't have FK to profiles, so we get requester info from the PR
    const { data, error } = await supabase
      .from("quote_requests")
      .select(`
        *,
        organizations:organization_id (name),
        purchase_requisitions:pr_id (
          transaction_id,
          due_date,
          payment_due_date,
          urgency,
          document_url,
          total_amount,
          currency,
          items,
          requested_by_name
        )
      `)
      .eq("supplier_id", supplier.id)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, data: [], error: error.message };
    }

    // Transform data to include organization name and PR details
    // Use safer fallback text instead of "Unknown" to improve UX
    const transformedData = (data || []).map((item: any) => {
      const pr = item.purchase_requisitions;
      return {
        ...item,
        organization_name: item.organizations?.name || "Organization Assigned",
        pr_transaction_id: pr?.transaction_id || "PR Pending",
        // Get requester name from the PR record
        requester_name: pr?.requested_by_name || "Finance Department",
        requester_email: null, // Email not available without additional query
        // Extended PR details
        pr_due_date: pr?.due_date || null,
        pr_payment_due_date: pr?.payment_due_date || null,
        pr_urgency: pr?.urgency || "NORMAL",
        pr_document_url: pr?.document_url || null,
        pr_total_amount: pr?.total_amount || 0,
        pr_currency: pr?.currency || "ZAR",
        // Use PR items if quote_request items is empty
        items: item.items?.length > 0 ? item.items : (pr?.items || []),
        organizations: undefined,
        purchase_requisitions: undefined,
      };
    });

    return { success: true, data: transformedData as SupplierQuoteRequest[] };
  } catch (error: any) {
    return { success: false, data: [], error: error.message };
  }
}

/**
 * Get the supplier's own quotes
 */
export async function getSupplierQuotes(): Promise<{
  success: boolean;
  data: SupplierQuote[];
  error?: string;
}> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, data: [], error: "Not authenticated" };
    }

    // First get the supplier's ID
    const { data: supplier } = await supabase
      .from("suppliers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!supplier) {
      return { success: false, data: [], error: "Supplier profile not found" };
    }

    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("supplier_id", supplier.id)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, data: [], error: error.message };
    }

    return { success: true, data: (data || []) as unknown as SupplierQuote[] };
  } catch (error: any) {
    return { success: false, data: [], error: error.message };
  }
}

/**
 * Submit a quote for a quote request
 */
export async function submitQuote(params: {
  quoteRequestId: string;
  prId: string;
  organizationId: string;
  amount: number;
  deliveryTime?: string;
  validUntil?: string;
  notes?: string;
  documentUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    // Get supplier ID
    const { data: supplier } = await supabase
      .from("suppliers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!supplier) {
      return { success: false, error: "Supplier profile not found" };
    }

    // Check if quote already exists for this request
    const { data: existingQuote } = await supabase
      .from("quotes")
      .select("id")
      .eq("quote_request_id", params.quoteRequestId)
      .eq("supplier_id", supplier.id)
      .maybeSingle();

    if (existingQuote) {
      return { success: false, error: "You have already submitted a quote for this request" };
    }

    // Insert the quote
    const { error: insertError } = await supabase.from("quotes").insert({
      quote_request_id: params.quoteRequestId,
      pr_id: params.prId,
      organization_id: params.organizationId,
      supplier_id: supplier.id,
      amount: params.amount,
      delivery_time: params.deliveryTime || null,
      valid_until: params.validUntil || null,
      notes: params.notes || null,
      document_url: params.documentUrl || null,
      status: "SUBMITTED",
    });

    if (insertError) {
      return { success: false, error: insertError.message };
    }

    // Update quote request status
    await supabase
      .from("quote_requests")
      .update({ status: "QUOTED" })
      .eq("id", params.quoteRequestId);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get supplier statistics
 */
export async function getSupplierStats(): Promise<{
  success: boolean;
  data: SupplierStats;
  error?: string;
}> {
  try {
    const [requestsResult, quotesResult] = await Promise.all([
      getSupplierQuoteRequests(),
      getSupplierQuotes(),
    ]);

    const pendingRequests = requestsResult.data.filter(
      (r) => r.status === "PENDING"
    ).length;

    const submittedQuotes = quotesResult.data.filter(
      (q) => q.status === "SUBMITTED"
    ).length;

    const acceptedQuotes = quotesResult.data.filter(
      (q) => q.status === "ACCEPTED"
    );

    const totalValue = acceptedQuotes.reduce((sum, q) => sum + (q.amount || 0), 0);

    return {
      success: true,
      data: {
        pendingRequests,
        submittedQuotes,
        acceptedQuotes: acceptedQuotes.length,
        totalValue,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      data: { pendingRequests: 0, submittedQuotes: 0, acceptedQuotes: 0, totalValue: 0 },
      error: error.message,
    };
  }
}

/**
 * Update supplier profile
 */
export async function updateSupplierProfile(
  updates: Partial<Pick<SupplierProfile, "company_name" | "contact_email" | "phone" | "address" | "industry" | "registration_number">>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("suppliers")
      .update(updates)
      .eq("user_id", user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Accept a quote request - supplier agrees to provide a quote
 */
export async function acceptQuoteRequest(
  quoteRequestId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    // Get supplier ID
    const { data: supplier } = await supabase
      .from("suppliers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!supplier) {
      return { success: false, error: "Supplier profile not found" };
    }

    // Verify the quote request belongs to this supplier and is pending
    const { data: request, error: reqError } = await supabase
      .from("quote_requests")
      .select("id, status")
      .eq("id", quoteRequestId)
      .eq("supplier_id", supplier.id)
      .single();

    if (reqError || !request) {
      return { success: false, error: "Quote request not found" };
    }

    if (request.status !== "PENDING") {
      return { success: false, error: "Quote request is no longer pending" };
    }

    // Update status to ACCEPTED
    const { error: updateError } = await supabase
      .from("quote_requests")
      .update({ 
        status: "ACCEPTED",
        updated_at: new Date().toISOString()
      })
      .eq("id", quoteRequestId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Decline a quote request - supplier declines to participate
 */
export async function declineQuoteRequest(
  quoteRequestId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    // Get supplier ID
    const { data: supplier } = await supabase
      .from("suppliers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!supplier) {
      return { success: false, error: "Supplier profile not found" };
    }

    // Verify the quote request belongs to this supplier and is pending
    const { data: request, error: reqError } = await supabase
      .from("quote_requests")
      .select("id, status")
      .eq("id", quoteRequestId)
      .eq("supplier_id", supplier.id)
      .single();

    if (reqError || !request) {
      return { success: false, error: "Quote request not found" };
    }

    if (request.status !== "PENDING") {
      return { success: false, error: "Quote request is no longer pending" };
    }

    // Update status to DECLINED
    const { error: updateError } = await supabase
      .from("quote_requests")
      .update({ 
        status: "DECLINED",
        updated_at: new Date().toISOString()
      })
      .eq("id", quoteRequestId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

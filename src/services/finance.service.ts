import { supabase } from "@/integrations/supabase/client";
import type {
  PRHistoryEntry,
  PurchaseRequisition,
  PRItem,
} from "@/types/pr.types";
import type { Json } from "@/integrations/supabase/types";

interface ApprovalResult {
  success: boolean;
  error?: string;
}

export interface Supplier {
  id: string;
  company_name: string;
  contact_email: string;
  registration_number: string | null;
  is_verified: boolean;
  phone: string | null;
  address: string | null;
  industry: string | null;
}

export interface QuoteRequest {
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
  supplier?: Supplier;
  pr?: PurchaseRequisition;
}

export interface Quote {
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
  created_at: string;
  updated_at: string;
  supplier?: Supplier;
  pr?: PurchaseRequisition;
}

/**
 * Generate a unique transaction ID for split PRs
 */
function generateSplitTransactionId(parentId: string, index: number): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const dateStr = `${year}${month}${day}`;
  
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let randomPart = "";
  for (let i = 0; i < 2; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return `PR-${dateStr}-${randomPart}${index + 1}`;
}

/**
 * Finance approves a PR
 */
export async function financeApprovePR(
  prId: string,
  comments: string
): Promise<ApprovalResult> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: "User not authenticated" };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("name, surname")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return { success: false, error: "Profile not found" };
    }

    const { data: prData, error: prError } = await supabase
      .from("purchase_requisitions")
      .select("*")
      .eq("id", prId)
      .single();

    if (prError || !prData) {
      return { success: false, error: "PR not found" };
    }

    const pr = prData as unknown as PurchaseRequisition;
    const userName = `${profile.name}${profile.surname ? " " + profile.surname : ""}`;
    const currentHistory = (pr.history as PRHistoryEntry[]) || [];

    const historyEntry: PRHistoryEntry = {
      action: "FINANCE_APPROVED",
      user_id: user.id,
      user_name: userName,
      timestamp: new Date().toISOString(),
      details: comments || "Approved by Finance",
    };

    const newHistory = [...currentHistory, historyEntry];

    const { error: updateError } = await supabase
      .from("purchase_requisitions")
      .update({
        status: "FINANCE_APPROVED",
        finance_status: "Approved",
        history: newHistory as unknown as Json,
      })
      .eq("id", prId);

    if (updateError) {
      console.error("Update error:", updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("financeApprovePR error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Finance declines a PR
 */
export async function financeDeclinePR(
  prId: string,
  comments: string
): Promise<ApprovalResult> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: "User not authenticated" };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("name, surname")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return { success: false, error: "Profile not found" };
    }

    const { data: prData, error: prError } = await supabase
      .from("purchase_requisitions")
      .select("*")
      .eq("id", prId)
      .single();

    if (prError || !prData) {
      return { success: false, error: "PR not found" };
    }

    const pr = prData as unknown as PurchaseRequisition;
    const userName = `${profile.name}${profile.surname ? " " + profile.surname : ""}`;
    const currentHistory = (pr.history as PRHistoryEntry[]) || [];

    const historyEntry: PRHistoryEntry = {
      action: "FINANCE_DECLINED",
      user_id: user.id,
      user_name: userName,
      timestamp: new Date().toISOString(),
      details: comments || "Declined by Finance",
    };

    const newHistory = [...currentHistory, historyEntry];

    const { error: updateError } = await supabase
      .from("purchase_requisitions")
      .update({
        status: "FINANCE_DECLINED",
        finance_status: "Declined",
        history: newHistory as unknown as Json,
      })
      .eq("id", prId);

    if (updateError) {
      console.error("Update error:", updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("financeDeclinePR error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Finance splits a PR
 */
export async function financeSplitPR(
  prId: string,
  splits: { items: PRItem[]; comments: string }[]
): Promise<ApprovalResult> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: "User not authenticated" };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("name, surname")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return { success: false, error: "Profile not found" };
    }

    const { data: prData, error: prError } = await supabase
      .from("purchase_requisitions")
      .select("*")
      .eq("id", prId)
      .single();

    if (prError || !prData) {
      return { success: false, error: "PR not found" };
    }

    const parentPR = prData as unknown as PurchaseRequisition;
    const userName = `${profile.name}${profile.surname ? " " + profile.surname : ""}`;
    const currentHistory = (parentPR.history as PRHistoryEntry[]) || [];

    // Create child PRs
    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      const totalAmount = split.items.reduce((sum, item) => sum + item.total, 0);

      const childHistoryEntry: PRHistoryEntry = {
        action: "PR_SPLIT_CREATED_BY_FINANCE",
        user_id: user.id,
        user_name: userName,
        timestamp: new Date().toISOString(),
        details: `Split from ${parentPR.transaction_id} by Finance. ${split.comments}`,
      };

      const childPR: any = {
        transaction_id: generateSplitTransactionId(parentPR.transaction_id, i),
        organization_id: parentPR.organization_id,
        requested_by: parentPR.requested_by,
        requested_by_name: parentPR.requested_by_name,
        requested_by_department: parentPR.requested_by_department,
        items: split.items as unknown as Json,
        total_amount: totalAmount,
        currency: parentPR.currency,
        urgency: parentPR.urgency,
        hod_status: "Approved",
        finance_status: "Pending",
        status: "PENDING_FINANCE_APPROVAL",
        due_date: parentPR.due_date,
        payment_due_date: parentPR.payment_due_date,
        document_url: parentPR.document_url,
        parent_pr_id: prId,
        history: [childHistoryEntry] as unknown as Json,
      };

      const { error: insertError } = await supabase
        .from("purchase_requisitions")
        .insert(childPR);

      if (insertError) {
        console.error("Child PR insert error:", insertError);
        return { success: false, error: `Failed to create split PR: ${insertError.message}` };
      }
    }

    // Update parent PR
    const parentHistoryEntry: PRHistoryEntry = {
      action: "PR_SPLIT_BY_FINANCE",
      user_id: user.id,
      user_name: userName,
      timestamp: new Date().toISOString(),
      details: `Split into ${splits.length} child PRs by Finance`,
    };

    const newParentHistory = [...currentHistory, parentHistoryEntry];

    const { error: updateError } = await supabase
      .from("purchase_requisitions")
      .update({
        status: "SPLIT",
        finance_status: "Split",
        history: newParentHistory as unknown as Json,
      })
      .eq("id", prId);

    if (updateError) {
      console.error("Parent update error:", updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("financeSplitPR error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get PRs pending Finance approval
 */
export async function getFinancePendingPRs(): Promise<{
  success: boolean;
  data: PurchaseRequisition[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("purchase_requisitions")
      .select("*")
      .eq("status", "PENDING_FINANCE_APPROVAL")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching Finance PRs:", error);
      return { success: false, error: error.message, data: [] };
    }

    return { success: true, data: (data || []) as unknown as PurchaseRequisition[] };
  } catch (error: any) {
    console.error("getFinancePendingPRs error:", error);
    return { success: false, error: error.message, data: [] };
  }
}

/**
 * Get all verified suppliers
 */
export async function getVerifiedSuppliers(): Promise<{
  success: boolean;
  data: Supplier[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("is_verified", true)
      .order("company_name", { ascending: true });

    if (error) {
      console.error("Error fetching suppliers:", error);
      return { success: false, error: error.message, data: [] };
    }

    return { success: true, data: (data || []) as Supplier[] };
  } catch (error: any) {
    console.error("getVerifiedSuppliers error:", error);
    return { success: false, error: error.message, data: [] };
  }
}

/**
 * Get all suppliers (for admin view)
 */
export async function getAllSuppliers(): Promise<{
  success: boolean;
  data: Supplier[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .order("company_name", { ascending: true });

    if (error) {
      console.error("Error fetching all suppliers:", error);
      return { success: false, error: error.message, data: [] };
    }

    return { success: true, data: (data || []) as Supplier[] };
  } catch (error: any) {
    console.error("getAllSuppliers error:", error);
    return { success: false, error: error.message, data: [] };
  }
}

/**
 * Send quote request to supplier
 */
export async function sendQuoteRequest(
  prId: string,
  supplierId: string,
  items: PRItem[],
  message: string
): Promise<ApprovalResult> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: "User not authenticated" };
    }

    // Get user's organization
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      return { success: false, error: "Organization not found" };
    }

    const { error: insertError } = await supabase
      .from("quote_requests")
      .insert({
        pr_id: prId,
        supplier_id: supplierId,
        organization_id: profile.organization_id,
        requested_by: user.id,
        message,
        items: items as unknown as Json,
        status: "PENDING",
      });

    if (insertError) {
      console.error("Quote request insert error:", insertError);
      return { success: false, error: insertError.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("sendQuoteRequest error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get quote requests for organization
 */
export async function getQuoteRequests(): Promise<{
  success: boolean;
  data: QuoteRequest[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("quote_requests")
      .select(`
        *,
        supplier:suppliers (*)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching quote requests:", error);
      return { success: false, error: error.message, data: [] };
    }

    return { success: true, data: (data || []) as unknown as QuoteRequest[] };
  } catch (error: any) {
    console.error("getQuoteRequests error:", error);
    return { success: false, error: error.message, data: [] };
  }
}

/**
 * Get quotes for organization
 */
export async function getQuotes(): Promise<{
  success: boolean;
  data: Quote[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("quotes")
      .select(`
        *,
        supplier:suppliers (*)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching quotes:", error);
      return { success: false, error: error.message, data: [] };
    }

    return { success: true, data: (data || []) as unknown as Quote[] };
  } catch (error: any) {
    console.error("getQuotes error:", error);
    return { success: false, error: error.message, data: [] };
  }
}

/**
 * Accept a quote and link to PR
 */
export async function acceptQuote(
  quoteId: string,
  prId: string
): Promise<ApprovalResult> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: "User not authenticated" };
    }

    // Update quote status
    const { error: quoteError } = await supabase
      .from("quotes")
      .update({ status: "ACCEPTED" })
      .eq("id", quoteId);

    if (quoteError) {
      console.error("Quote update error:", quoteError);
      return { success: false, error: quoteError.message };
    }

    // Reject other quotes for the same PR
    const { error: rejectError } = await supabase
      .from("quotes")
      .update({ status: "REJECTED" })
      .eq("pr_id", prId)
      .neq("id", quoteId);

    if (rejectError) {
      console.error("Reject other quotes error:", rejectError);
    }

    return { success: true };
  } catch (error: any) {
    console.error("acceptQuote error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Reject a quote
 */
export async function rejectQuote(quoteId: string): Promise<ApprovalResult> {
  try {
    const { error } = await supabase
      .from("quotes")
      .update({ status: "REJECTED" })
      .eq("id", quoteId);

    if (error) {
      console.error("Quote reject error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("rejectQuote error:", error);
    return { success: false, error: error.message };
  }
}

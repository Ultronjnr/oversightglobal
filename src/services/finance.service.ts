import { supabase } from "@/integrations/supabase/client";
import type {
  PRHistoryEntry,
  PurchaseRequisition,
  PRItem,
} from "@/types/pr.types";
import type { Json } from "@/integrations/supabase/types";
import { logError, getSafeErrorMessage } from "@/lib/error-handler";

interface ApprovalResult {
  success: boolean;
  error?: string;
}

export interface Supplier {
  id: string;
  company_name: string;
  contact_email: string;
  contact_person: string | null;
  registration_number: string | null;
  is_verified: boolean;
  phone: string | null;
  address: string | null;
  industry: string | null;
  vat_number: string | null;
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

export type QuoteWorkflowStatus = 
  | "PENDING_REVIEW"
  | "QUOTE_SENT"
  | "QUOTE_ACCEPTED"
  | "QUOTE_SUBMITTED"
  | "COMPLETED";

export interface PRWithQuoteStatus extends PurchaseRequisition {
  quote_workflow_status: QuoteWorkflowStatus;
  quote_request_count: number;
  accepted_quote_count: number;
  submitted_quote_count: number;
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
  document_url: string | null;
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
      logError("financeApprovePR", updateError);
      return { success: false, error: getSafeErrorMessage(updateError) };
    }

    return { success: true };
  } catch (error: any) {
    logError("financeApprovePR", error);
    return { success: false, error: getSafeErrorMessage(error) };
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
      logError("financeDeclinePR", updateError);
      return { success: false, error: getSafeErrorMessage(updateError) };
    }

    return { success: true };
  } catch (error: any) {
    logError("financeDeclinePR", error);
    return { success: false, error: getSafeErrorMessage(error) };
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
        logError("financeSplitPR.childInsert", insertError);
        return { success: false, error: getSafeErrorMessage(insertError) };
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
      logError("financeSplitPR.parentUpdate", updateError);
      return { success: false, error: getSafeErrorMessage(updateError) };
    }

    return { success: true };
  } catch (error: any) {
    logError("financeSplitPR", error);
    return { success: false, error: getSafeErrorMessage(error) };
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
      logError("getFinancePendingPRs", error);
      return { success: false, error: getSafeErrorMessage(error), data: [] };
    }

    return { success: true, data: (data || []) as unknown as PurchaseRequisition[] };
  } catch (error: any) {
    logError("getFinancePendingPRs", error);
    return { success: false, error: getSafeErrorMessage(error), data: [] };
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
      logError("getVerifiedSuppliers", error);
      return { success: false, error: getSafeErrorMessage(error), data: [] };
    }

    return { success: true, data: (data || []) as Supplier[] };
  } catch (error: any) {
    logError("getVerifiedSuppliers", error);
    return { success: false, error: getSafeErrorMessage(error), data: [] };
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
      logError("getAllSuppliers", error);
      return { success: false, error: getSafeErrorMessage(error), data: [] };
    }

    return { success: true, data: (data || []) as Supplier[] };
  } catch (error: any) {
    logError("getAllSuppliers", error);
    return { success: false, error: getSafeErrorMessage(error), data: [] };
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
      logError("sendQuoteRequest", insertError);
      return { success: false, error: getSafeErrorMessage(insertError) };
    }

    return { success: true };
  } catch (error: any) {
    logError("sendQuoteRequest", error);
    return { success: false, error: getSafeErrorMessage(error) };
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
      logError("getQuoteRequests", error);
      return { success: false, error: getSafeErrorMessage(error), data: [] };
    }

    return { success: true, data: (data || []) as unknown as QuoteRequest[] };
  } catch (error: any) {
    logError("getQuoteRequests", error);
    return { success: false, error: getSafeErrorMessage(error), data: [] };
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
      logError("getQuotes", error);
      return { success: false, error: getSafeErrorMessage(error), data: [] };
    }

    return { success: true, data: (data || []) as unknown as Quote[] };
  } catch (error: any) {
    logError("getQuotes", error);
    return { success: false, error: getSafeErrorMessage(error), data: [] };
  }
}

/**
 * Accept a quote using the secure RPC function that automatically rejects other quotes
 * This locks the decision and prevents any further changes
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

    // Call the RPC function that handles accepting one quote and rejecting others atomically
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc("accept_quote_and_reject_others", {
        _quote_id: quoteId,
        _pr_id: prId,
      });

    if (rpcError) {
      logError("acceptQuote.rpc", rpcError);
      return { success: false, error: getSafeErrorMessage(rpcError) };
    }

    const result = rpcResult as { success: boolean; error?: string; accepted_quote_id?: string };
    
    if (!result.success) {
      return { success: false, error: result.error || "Failed to accept quote" };
    }

    // Get user profile for history update
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, surname")
      .eq("id", user.id)
      .single();

    // Get quote details for history
    const { data: quoteData } = await supabase
      .from("quotes")
      .select(`
        *,
        supplier:suppliers (company_name)
      `)
      .eq("id", quoteId)
      .single();

    // Update PR history if we have the data
    if (profile && quoteData) {
      const { data: prData } = await supabase
        .from("purchase_requisitions")
        .select("*")
        .eq("id", prId)
        .single();

      if (prData) {
        const pr = prData as unknown as PurchaseRequisition;
        const userName = `${profile.name}${profile.surname ? " " + profile.surname : ""}`;
        const currentHistory = (pr.history as PRHistoryEntry[]) || [];
        const supplierName = (quoteData as any).supplier?.company_name || "Unknown Supplier";

        const historyEntry: PRHistoryEntry = {
          action: "QUOTE_ACCEPTED",
          user_id: user.id,
          user_name: userName,
          timestamp: new Date().toISOString(),
          details: `Accepted quote from ${supplierName} for ${new Intl.NumberFormat("en-ZA", {
            style: "currency",
            currency: "ZAR",
          }).format(quoteData.amount)}. Other quotes have been automatically rejected.`,
        };

        const newHistory = [...currentHistory, historyEntry];

        await supabase
          .from("purchase_requisitions")
          .update({
            history: newHistory as unknown as Json,
            total_amount: quoteData.amount,
          })
          .eq("id", prId);
      }
    }

    return { success: true };
  } catch (error: any) {
    logError("acceptQuote", error);
    return { success: false, error: getSafeErrorMessage(error) };
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
      logError("rejectQuote", error);
      return { success: false, error: getSafeErrorMessage(error) };
    }

    return { success: true };
  } catch (error: any) {
    logError("rejectQuote", error);
    return { success: false, error: getSafeErrorMessage(error) };
  }
}

/**
 * Get PRs with quote workflow status for Finance Overview
 * Status progression: PR → Quote Sent → Quote Accepted → Completed
 */
export async function getPRsWithQuoteStatus(): Promise<{
  success: boolean;
  data: PRWithQuoteStatus[];
  error?: string;
}> {
  try {
    // Get all PRs that are approved or have quote activity
    const { data: prsData, error: prsError } = await supabase
      .from("purchase_requisitions")
      .select("*")
      .in("status", ["PENDING_FINANCE_APPROVAL", "FINANCE_APPROVED", "SPLIT"])
      .order("updated_at", { ascending: false });

    if (prsError) {
      logError("getPRsWithQuoteStatus.prs", prsError);
      return { success: false, error: getSafeErrorMessage(prsError), data: [] };
    }

    const prs = (prsData || []) as unknown as PurchaseRequisition[];

    // Get all quote requests for these PRs
    const prIds = prs.map(pr => pr.id);
    
    if (prIds.length === 0) {
      return { success: true, data: [] };
    }

    const { data: quoteRequestsData, error: qrError } = await supabase
      .from("quote_requests")
      .select("pr_id, status")
      .in("pr_id", prIds);

    if (qrError) {
      logError("getPRsWithQuoteStatus.quoteRequests", qrError);
    }

    const { data: quotesData, error: quotesError } = await supabase
      .from("quotes")
      .select("pr_id, status")
      .in("pr_id", prIds);

    if (quotesError) {
      logError("getPRsWithQuoteStatus.quotes", quotesError);
    }

    // Map PRs with quote workflow status
    const prsWithStatus: PRWithQuoteStatus[] = prs.map(pr => {
      const prQuoteRequests = (quoteRequestsData || []).filter(qr => qr.pr_id === pr.id);
      const prQuotes = (quotesData || []).filter(q => q.pr_id === pr.id);
      
      const quoteRequestCount = prQuoteRequests.length;
      const acceptedQuoteRequestCount = prQuoteRequests.filter(qr => qr.status === "ACCEPTED").length;
      const submittedQuoteCount = prQuotes.filter(q => q.status === "SUBMITTED").length;
      const acceptedQuoteCount = prQuotes.filter(q => q.status === "ACCEPTED").length;

      let quoteWorkflowStatus: QuoteWorkflowStatus = "PENDING_REVIEW";
      
      if (pr.status === "FINANCE_APPROVED" && acceptedQuoteCount > 0) {
        quoteWorkflowStatus = "COMPLETED";
      } else if (acceptedQuoteCount > 0) {
        quoteWorkflowStatus = "COMPLETED";
      } else if (submittedQuoteCount > 0) {
        quoteWorkflowStatus = "QUOTE_SUBMITTED";
      } else if (acceptedQuoteRequestCount > 0) {
        quoteWorkflowStatus = "QUOTE_ACCEPTED";
      } else if (quoteRequestCount > 0) {
        quoteWorkflowStatus = "QUOTE_SENT";
      } else {
        quoteWorkflowStatus = "PENDING_REVIEW";
      }

      return {
        ...pr,
        quote_workflow_status: quoteWorkflowStatus,
        quote_request_count: quoteRequestCount,
        accepted_quote_count: acceptedQuoteCount,
        submitted_quote_count: submittedQuoteCount,
      };
    });

    return { success: true, data: prsWithStatus };
  } catch (error: any) {
    logError("getPRsWithQuoteStatus", error);
    return { success: false, error: getSafeErrorMessage(error), data: [] };
  }
}

import { supabase } from "@/integrations/supabase/client";
import type {
  PRHistoryEntry,
  PRStatus,
  PurchaseRequisition,
  PRItem,
} from "@/types/pr.types";
import type { Json } from "@/integrations/supabase/types";

interface ApprovalResult {
  success: boolean;
  error?: string;
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
  
  // Extract the random part from parent ID or generate new
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let randomPart = "";
  for (let i = 0; i < 2; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return `PR-${dateStr}-${randomPart}${index + 1}`;
}

/**
 * Add a history entry to a PR
 */
async function addHistoryEntry(
  prId: string,
  currentHistory: PRHistoryEntry[],
  entry: PRHistoryEntry
): Promise<PRHistoryEntry[]> {
  return [...currentHistory, entry];
}

/**
 * HOD approves a PR - moves to PENDING_FINANCE_APPROVAL
 */
export async function hodApprovePR(
  prId: string,
  comments: string
): Promise<ApprovalResult> {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: "User not authenticated" };
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("name, surname")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return { success: false, error: "Profile not found" };
    }

    // Get current PR
    const { data: prData, error: prError } = await supabase
      .from("purchase_requisitions" as any)
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
      action: "HOD_APPROVED",
      user_id: user.id,
      user_name: userName,
      timestamp: new Date().toISOString(),
      details: comments || "Approved by HOD",
    };

    const newHistory = [...currentHistory, historyEntry];

    // Update PR
    const { error: updateError } = await supabase
      .from("purchase_requisitions" as any)
      .update({
        status: "PENDING_FINANCE_APPROVAL",
        hod_status: "Approved",
        history: newHistory as unknown as Json,
      })
      .eq("id", prId);

    if (updateError) {
      console.error("Update error:", updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("hodApprovePR error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * HOD declines a PR - returns to employee
 */
export async function hodDeclinePR(
  prId: string,
  comments: string
): Promise<ApprovalResult> {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: "User not authenticated" };
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("name, surname")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return { success: false, error: "Profile not found" };
    }

    // Get current PR
    const { data: prData, error: prError } = await supabase
      .from("purchase_requisitions" as any)
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
      action: "HOD_DECLINED",
      user_id: user.id,
      user_name: userName,
      timestamp: new Date().toISOString(),
      details: comments || "Declined by HOD",
    };

    const newHistory = [...currentHistory, historyEntry];

    // Update PR
    const { error: updateError } = await supabase
      .from("purchase_requisitions" as any)
      .update({
        status: "HOD_DECLINED",
        hod_status: "Declined",
        history: newHistory as unknown as Json,
      })
      .eq("id", prId);

    if (updateError) {
      console.error("Update error:", updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("hodDeclinePR error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * HOD splits a PR into multiple child PRs
 */
export async function hodSplitPR(
  prId: string,
  splits: { items: PRItem[]; comments: string }[]
): Promise<ApprovalResult> {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: "User not authenticated" };
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("name, surname")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return { success: false, error: "Profile not found" };
    }

    // Get current PR (parent)
    const { data: prData, error: prError } = await supabase
      .from("purchase_requisitions" as any)
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
        action: "PR_SPLIT_CREATED",
        user_id: user.id,
        user_name: userName,
        timestamp: new Date().toISOString(),
        details: `Split from ${parentPR.transaction_id}. ${split.comments}`,
      };

      const childPR = {
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
        .from("purchase_requisitions" as any)
        .insert(childPR);

      if (insertError) {
        console.error("Child PR insert error:", insertError);
        return { success: false, error: `Failed to create split PR: ${insertError.message}` };
      }
    }

    // Update parent PR status to SPLIT
    const parentHistoryEntry: PRHistoryEntry = {
      action: "PR_SPLIT",
      user_id: user.id,
      user_name: userName,
      timestamp: new Date().toISOString(),
      details: `Split into ${splits.length} child PRs by HOD`,
    };

    const newParentHistory = [...currentHistory, parentHistoryEntry];

    const { error: updateError } = await supabase
      .from("purchase_requisitions" as any)
      .update({
        status: "SPLIT",
        hod_status: "Split",
        history: newParentHistory as unknown as Json,
      })
      .eq("id", prId);

    if (updateError) {
      console.error("Parent update error:", updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("hodSplitPR error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get PRs pending HOD approval for the current user's organization
 */
export async function getHODPendingPRs(): Promise<{
  success: boolean;
  data: PurchaseRequisition[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("purchase_requisitions" as any)
      .select("*")
      .eq("status", "PENDING_HOD_APPROVAL")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching HOD PRs:", error);
      return { success: false, error: error.message, data: [] };
    }

    return { success: true, data: (data || []) as unknown as PurchaseRequisition[] };
  } catch (error: any) {
    console.error("getHODPendingPRs error:", error);
    return { success: false, error: error.message, data: [] };
  }
}

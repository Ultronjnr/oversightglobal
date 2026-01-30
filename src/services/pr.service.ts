import { supabase } from "@/integrations/supabase/client";
import type {
  CreatePRInput,
  CreatePRResult,
  PRHistoryEntry,
  PRItem,
  PRStatus,
  PurchaseRequisition,
} from "@/types/pr.types";
import type { Json } from "@/integrations/supabase/types";
import { logError, getSafeErrorMessage } from "@/lib/error-handler";

/**
 * Generate a unique transaction ID in format: PR-YYYYMMDD-XXXX
 */
function generateTransactionId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const dateStr = `${year}${month}${day}`;

  // Generate 4 random uppercase letters
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let randomPart = "";
  for (let i = 0; i < 4; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `PR-${dateStr}-${randomPart}`;
}

/**
 * Calculate total amount from items array
 */
function calculateTotalAmount(items: CreatePRInput["items"]): number {
  return items.reduce((sum, item) => sum + item.total, 0);
}

/**
 * Check if organization has an ACTIVE HOD user
 * Uses a SECURITY DEFINER function to bypass RLS restrictions
 */
async function organizationHasHOD(organizationId: string): Promise<boolean> {
  try {
    // Use the database function that bypasses RLS to check for active HODs
    const { data, error } = await supabase.rpc("organization_has_active_hod", {
      _org_id: organizationId,
    });

    if (error) {
      logError("organizationHasActiveHOD", error);
      return false;
    }

    // Log routing decision for debugging (server-side only)
    console.log("[PR Routing] org:", organizationId, "| HOD detected:", data);

    return data === true;
  } catch (error) {
    logError("organizationHasHOD", error);
    return false;
  }
}

/**
 * Create a new Purchase Requisition
 */
export async function createPurchaseRequisition(
  input: CreatePRInput
): Promise<CreatePRResult> {
  try {
    // 1. Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "User not authenticated" };
    }

    // 2. Get user profile for name and organization
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, name, surname, organization_id, department")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return { success: false, error: "User profile not found" };
    }

    if (!profile.organization_id) {
      return { success: false, error: "User is not associated with an organization" };
    }

    // 3. Generate transaction ID
    const transactionId = generateTransactionId();

    // 4. Calculate total amount
    const totalAmount = calculateTotalAmount(input.items);

    // 5. Determine initial status based on HOD existence
    const hasHOD = await organizationHasHOD(profile.organization_id);
    const initialStatus: PRStatus = hasHOD
      ? "PENDING_HOD_APPROVAL"
      : "PENDING_FINANCE_APPROVAL";

    // 6. Create initial history entry
    const userName = `${profile.name}${profile.surname ? " " + profile.surname : ""}`;
    const historyEntry: PRHistoryEntry = {
      action: "PR_CREATED",
      user_id: user.id,
      user_name: userName,
      timestamp: new Date().toISOString(),
      details: hasHOD
        ? "Submitted for HOD approval"
        : "Submitted directly for Finance approval (no HOD in organization)",
    };

    // 7. Insert the PR using raw insert (types may not be updated yet)
    const insertData = {
      transaction_id: transactionId,
      organization_id: profile.organization_id,
      requested_by: user.id,
      requested_by_name: userName,
      requested_by_department: input.department || profile.department,
      items: input.items as unknown as Json,
      total_amount: totalAmount,
      currency: "ZAR",
      urgency: input.urgency,
      hod_status: hasHOD ? "Pending" : "N/A",
      finance_status: "Pending",
      status: initialStatus,
      due_date: input.due_date || null,
      payment_due_date: input.payment_due_date || null,
      document_url: input.document_url || null,
      history: [historyEntry] as unknown as Json,
    };

    const { data: prData, error: insertError } = await supabase
      .from("purchase_requisitions" as any)
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      logError("prInsert", insertError);
      return { success: false, error: getSafeErrorMessage(insertError) };
    }

    // Cast the response to our type
    const pr = prData as unknown as PurchaseRequisition;

    return {
      success: true,
      data: pr,
    };
  } catch (error: any) {
    logError("createPurchaseRequisition", error);
    return { success: false, error: getSafeErrorMessage(error) };
  }
}

/**
 * Create a new Purchase Requisition that bypasses HOD approval
 * Used when HOD submits their own PR - goes directly to Finance
 */
export async function createPurchaseRequisitionBypassHOD(
  input: CreatePRInput
): Promise<CreatePRResult> {
  try {
    // 1. Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "User not authenticated" };
    }

    // 2. Get user profile for name and organization
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, name, surname, organization_id, department")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return { success: false, error: "User profile not found" };
    }

    if (!profile.organization_id) {
      return { success: false, error: "User is not associated with an organization" };
    }

    // 3. Generate transaction ID
    const transactionId = generateTransactionId();

    // 4. Calculate total amount
    const totalAmount = calculateTotalAmount(input.items);

    // 5. Set status directly to PENDING_FINANCE_APPROVAL (bypass HOD)
    const initialStatus: PRStatus = "PENDING_FINANCE_APPROVAL";

    // 6. Create initial history entry
    const userName = `${profile.name}${profile.surname ? " " + profile.surname : ""}`;
    const historyEntry: PRHistoryEntry = {
      action: "PR_CREATED",
      user_id: user.id,
      user_name: userName,
      timestamp: new Date().toISOString(),
      details: "Submitted directly for Finance approval (HOD self-submission)",
    };

    // 7. Insert the PR
    const insertData = {
      transaction_id: transactionId,
      organization_id: profile.organization_id,
      requested_by: user.id,
      requested_by_name: userName,
      requested_by_department: input.department || profile.department,
      items: input.items as unknown as Json,
      total_amount: totalAmount,
      currency: "ZAR",
      urgency: input.urgency,
      hod_status: "Auto-Approved",
      finance_status: "Pending",
      status: initialStatus,
      due_date: input.due_date || null,
      payment_due_date: input.payment_due_date || null,
      document_url: input.document_url || null,
      history: [historyEntry] as unknown as Json,
    };

    const { data: prData, error: insertError } = await supabase
      .from("purchase_requisitions" as any)
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      logError("prInsertBypassHOD", insertError);
      return { success: false, error: getSafeErrorMessage(insertError) };
    }

    const pr = prData as unknown as PurchaseRequisition;

    return {
      success: true,
      data: pr,
    };
  } catch (error: any) {
    logError("createPurchaseRequisitionBypassHOD", error);
    return { success: false, error: getSafeErrorMessage(error) };
  }
}

/**
 * Get all PRs for the current user (based on their role)
 */
export async function getUserPurchaseRequisitions(): Promise<{
  success: boolean;
  data: PurchaseRequisition[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("purchase_requisitions" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      logError("fetchPRs", error);
      return { success: false, error: getSafeErrorMessage(error), data: [] };
    }

    return { success: true, data: (data || []) as unknown as PurchaseRequisition[] };
  } catch (error: any) {
    logError("getUserPurchaseRequisitions", error);
    return { success: false, error: getSafeErrorMessage(error), data: [] };
  }
}

/**
 * Get a single PR by ID
 */
export async function getPurchaseRequisitionById(prId: string): Promise<{
  success: boolean;
  data: PurchaseRequisition | null;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("purchase_requisitions" as any)
      .select("*")
      .eq("id", prId)
      .single();

    if (error) {
      logError("fetchPRById", error);
      return { success: false, error: getSafeErrorMessage(error), data: null };
    }

    return { success: true, data: data as unknown as PurchaseRequisition };
  } catch (error: any) {
    logError("getPurchaseRequisitionById", error);
    return { success: false, error: getSafeErrorMessage(error), data: null };
  }
}

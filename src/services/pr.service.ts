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
 * Check if organization has an HOD
 */
async function organizationHasHOD(organizationId: string): Promise<boolean> {
  try {
    // Query user_roles table to find HOD users, then check if they belong to this org
    const { data: hodUsers, error } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "HOD");

    if (error || !hodUsers || hodUsers.length === 0) {
      return false;
    }

    // Check if any of these HOD users belong to the organization
    const hodUserIds = hodUsers.map((u) => u.user_id);
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("organization_id", organizationId)
      .in("id", hodUserIds);

    if (profileError) {
      console.error("Error checking HOD profiles:", profileError);
      return false;
    }

    return profiles && profiles.length > 0;
  } catch (error) {
    console.error("Error in organizationHasHOD:", error);
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
      console.error("PR insert error:", insertError);
      return { success: false, error: insertError.message };
    }

    // Cast the response to our type
    const pr = prData as unknown as PurchaseRequisition;

    return {
      success: true,
      data: pr,
    };
  } catch (error: any) {
    console.error("createPurchaseRequisition error:", error);
    return { success: false, error: error.message || "An unexpected error occurred" };
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
      console.error("Error fetching PRs:", error);
      return { success: false, error: error.message, data: [] };
    }

    return { success: true, data: (data || []) as unknown as PurchaseRequisition[] };
  } catch (error: any) {
    console.error("getUserPurchaseRequisitions error:", error);
    return { success: false, error: error.message, data: [] };
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
      console.error("Error fetching PR:", error);
      return { success: false, error: error.message, data: null };
    }

    return { success: true, data: data as unknown as PurchaseRequisition };
  } catch (error: any) {
    console.error("getPurchaseRequisitionById error:", error);
    return { success: false, error: error.message, data: null };
  }
}

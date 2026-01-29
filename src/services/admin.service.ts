import { supabase } from "@/integrations/supabase/client";
import type { PurchaseRequisition } from "@/types/pr.types";

export interface UserProfile {
  id: string;
  name: string;
  surname: string | null;
  email: string;
  phone: string | null;
  department: string | null;
  status: "ACTIVE" | "PENDING" | "SUSPENDED";
  organization_id: string | null;
  created_at: string;
  role?: string;
}

export interface Organization {
  id: string;
  name: string;
  company_email: string | null;
  address: string | null;
  created_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  invited_by: string;
  created_at: string;
  expires_at: string;
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
  created_at: string;
}

export type OrgSupplierStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export interface OrganizationSupplier {
  id: string;
  supplier_id: string;
  organization_id: string;
  status: OrgSupplierStatus;
  created_at: string;
  updated_at: string;
}

export interface SupplierWithStatus extends Supplier {
  relationship_status?: OrgSupplierStatus | null;
}

/**
 * Get organization profile
 */
export async function getOrganizationProfile(): Promise<{
  success: boolean;
  data: Organization | null;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, data: null, error: "Not authenticated" };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      return { success: false, data: null, error: "No organization found" };
    }

    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", profile.organization_id)
      .single();

    if (error) {
      return { success: false, data: null, error: error.message };
    }

    return { success: true, data: data as Organization };
  } catch (error: any) {
    return { success: false, data: null, error: error.message };
  }
}

/**
 * Update organization profile
 */
export async function updateOrganizationProfile(
  updates: Partial<Pick<Organization, "name" | "company_email" | "address">>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      return { success: false, error: "No organization found" };
    }

    const { error } = await supabase
      .from("organizations")
      .update(updates)
      .eq("id", profile.organization_id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get organization users with roles
 */
export async function getOrganizationUsers(): Promise<{
  success: boolean;
  data: UserProfile[];
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, data: [], error: "Not authenticated" };
    }

    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!currentProfile?.organization_id) {
      return { success: false, data: [], error: "No organization found" };
    }

    // Get all profiles in the organization
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("organization_id", currentProfile.organization_id)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, data: [], error: error.message };
    }

    // Get roles for each user
    const usersWithRoles = await Promise.all(
      (profiles || []).map(async (profile) => {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", profile.id)
          .maybeSingle();

        return {
          ...profile,
          role: roleData?.role || "EMPLOYEE",
        } as UserProfile;
      })
    );

    return { success: true, data: usersWithRoles };
  } catch (error: any) {
    return { success: false, data: [], error: error.message };
  }
}

/**
 * Get all organization PRs
 */
export async function getAllOrganizationPRs(): Promise<{
  success: boolean;
  data: PurchaseRequisition[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("purchase_requisitions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, data: [], error: error.message };
    }

    return { success: true, data: (data || []) as unknown as PurchaseRequisition[] };
  } catch (error: any) {
    return { success: false, data: [], error: error.message };
  }
}

/**
 * Get verified suppliers
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
      return { success: false, data: [], error: error.message };
    }

    return { success: true, data: (data || []) as Supplier[] };
  } catch (error: any) {
    return { success: false, data: [], error: error.message };
  }
}

/**
 * Get unlinked verified suppliers (not yet linked to admin's organization)
 */
export async function getUnlinkedSuppliers(): Promise<{
  success: boolean;
  data: SupplierWithStatus[];
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, data: [], error: "Not authenticated" };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      return { success: false, data: [], error: "No organization found" };
    }

    // Get all verified suppliers
    const { data: suppliers, error: suppliersError } = await supabase
      .from("suppliers")
      .select("*")
      .eq("is_verified", true)
      .order("company_name", { ascending: true });

    if (suppliersError) {
      return { success: false, data: [], error: suppliersError.message };
    }

    // Get existing relationships for this organization
    const { data: relationships, error: relError } = await supabase
      .from("organization_suppliers")
      .select("supplier_id, status")
      .eq("organization_id", profile.organization_id);

    if (relError) {
      return { success: false, data: [], error: relError.message };
    }

    // Create a map of supplier relationships
    const relationshipMap = new Map(
      (relationships || []).map((r) => [r.supplier_id, r.status as OrgSupplierStatus])
    );

    // Filter to only unlinked suppliers (no relationship or DECLINED can be re-added)
    const unlinkedSuppliers: SupplierWithStatus[] = (suppliers || [])
      .filter((s) => {
        const status = relationshipMap.get(s.id);
        return !status || status === "DECLINED";
      })
      .map((s) => ({
        ...s,
        relationship_status: relationshipMap.get(s.id) || null,
      }));

    return { success: true, data: unlinkedSuppliers };
  } catch (error: any) {
    return { success: false, data: [], error: error.message };
  }
}

/**
 * Get suppliers linked to admin's organization (ACCEPTED status)
 */
export async function getLinkedSuppliers(): Promise<{
  success: boolean;
  data: Supplier[];
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, data: [], error: "Not authenticated" };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      return { success: false, data: [], error: "No organization found" };
    }

    // Get accepted relationships for this organization
    const { data: relationships, error: relError } = await supabase
      .from("organization_suppliers")
      .select("supplier_id")
      .eq("organization_id", profile.organization_id)
      .eq("status", "ACCEPTED");

    if (relError) {
      return { success: false, data: [], error: relError.message };
    }

    if (!relationships || relationships.length === 0) {
      return { success: true, data: [] };
    }

    const supplierIds = relationships.map((r) => r.supplier_id);

    // Get supplier details
    const { data: suppliers, error: suppliersError } = await supabase
      .from("suppliers")
      .select("*")
      .in("id", supplierIds)
      .order("company_name", { ascending: true });

    if (suppliersError) {
      return { success: false, data: [], error: suppliersError.message };
    }

    return { success: true, data: (suppliers || []) as Supplier[] };
  } catch (error: any) {
    return { success: false, data: [], error: error.message };
  }
}

/**
 * Accept a supplier (create or update relationship to ACCEPTED)
 */
export async function acceptSupplier(
  supplierId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      return { success: false, error: "No organization found" };
    }

    // Upsert the relationship
    const { error } = await supabase
      .from("organization_suppliers")
      .upsert(
        {
          supplier_id: supplierId,
          organization_id: profile.organization_id,
          status: "ACCEPTED",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "supplier_id,organization_id" }
      );

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Decline a supplier (create or update relationship to DECLINED)
 */
export async function declineSupplier(
  supplierId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      return { success: false, error: "No organization found" };
    }

    // Upsert the relationship
    const { error } = await supabase
      .from("organization_suppliers")
      .upsert(
        {
          supplier_id: supplierId,
          organization_id: profile.organization_id,
          status: "DECLINED",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "supplier_id,organization_id" }
      );

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Verify a supplier
 */
export async function verifySupplier(
  supplierId: string,
  verified: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("suppliers")
      .update({ is_verified: verified })
      .eq("id", supplierId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get admin dashboard stats
 */
export async function getAdminStats(): Promise<{
  success: boolean;
  data: {
    totalUsers: number;
    activePRs: number;
    completedPRs: number;
    verifiedSuppliers: number;
  };
  error?: string;
}> {
  try {
    const [usersResult, prsResult, suppliersResult] = await Promise.all([
      getOrganizationUsers(),
      getAllOrganizationPRs(),
      getVerifiedSuppliers(),
    ]);

    const activePRs = prsResult.data.filter(
      (pr) =>
        pr.status !== "FINANCE_APPROVED" &&
        pr.status !== "FINANCE_DECLINED" &&
        pr.status !== "HOD_DECLINED" &&
        pr.status !== "SPLIT"
    ).length;

    const completedPRs = prsResult.data.filter(
      (pr) => pr.status === "FINANCE_APPROVED"
    ).length;

    return {
      success: true,
      data: {
        totalUsers: usersResult.data.length,
        activePRs,
        completedPRs,
        verifiedSuppliers: suppliersResult.data.length,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      data: { totalUsers: 0, activePRs: 0, completedPRs: 0, verifiedSuppliers: 0 },
      error: error.message,
    };
  }
}

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
  department?: string | null;
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
  vat_number: string | null;
  organization_id: string | null;
  created_at: string;
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
 * Get organization suppliers (suppliers linked to this organization)
 */
export async function getOrganizationSuppliers(): Promise<{
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
      return { success: false, data: [], error: error.message };
    }

    return { success: true, data: (data || []) as Supplier[] };
  } catch (error: any) {
    return { success: false, data: [], error: error.message };
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
      getOrganizationSuppliers(),
    ]);

    const totalUsers = usersResult.success ? usersResult.data.length : 0;
    const activePRs = prsResult.success
      ? prsResult.data.filter(
          (pr) =>
            pr.status !== "FINANCE_APPROVED" &&
            pr.status !== "FINANCE_DECLINED" &&
            pr.status !== "HOD_DECLINED" &&
            pr.status !== "SPLIT"
        ).length
      : 0;
    const completedPRs = prsResult.success
      ? prsResult.data.filter((pr) => pr.status === "FINANCE_APPROVED").length
      : 0;
    const verifiedSuppliers = suppliersResult.success
      ? suppliersResult.data.filter((s) => s.is_verified).length
      : 0;

    return {
      success: true,
      data: {
        totalUsers,
        activePRs,
        completedPRs,
        verifiedSuppliers,
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

/**
 * Update a user's role
 */
export async function updateUserRole(
  userId: string,
  newRole: "EMPLOYEE" | "HOD" | "FINANCE" | "ADMIN"
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole })
      .eq("user_id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Update a user's status
 */
export async function updateUserStatus(
  userId: string,
  status: "ACTIVE" | "SUSPENDED"
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ status })
      .eq("id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete a user from the organization
 */
export async function deleteUser(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete role first
    await supabase.from("user_roles").delete().eq("user_id", userId);

    // Update profile to remove from organization
    const { error } = await supabase
      .from("profiles")
      .update({ organization_id: null, status: "SUSPENDED" })
      .eq("id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

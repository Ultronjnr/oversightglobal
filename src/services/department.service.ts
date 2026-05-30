import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/error-handler";

export interface Department {
  id: string;
  organization_id: string;
  name: string;
  code: string | null;
  budget_limit: number | null;
  manager_user_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DepartmentInput {
  name: string;
  code?: string | null;
  budget_limit?: number | null;
  manager_user_id?: string | null;
}

/**
 * Get all cost centers / departments for the current organization
 */
export async function getDepartments(): Promise<{
  success: boolean;
  data: Department[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, data: [], error: getSafeErrorMessage(error) };
    }

    return { success: true, data: data as Department[] };
  } catch (error: any) {
    return { success: false, data: [], error: getSafeErrorMessage(error) };
  }
}

/**
 * Create a new cost center / department
 */
export async function createDepartment(
  input: DepartmentInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
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

    const { error } = await supabase.from("departments").insert({
      name: input.name.trim(),
      code: input.code?.trim() || null,
      budget_limit: input.budget_limit ?? null,
      manager_user_id: input.manager_user_id || null,
      organization_id: profile.organization_id,
    });

    if (error) {
      return { success: false, error: getSafeErrorMessage(error) };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: getSafeErrorMessage(error) };
  }
}

/**
 * Update an existing cost center / department
 */
export async function updateDepartment(
  id: string,
  input: DepartmentInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("departments")
      .update({
        name: input.name.trim(),
        code: input.code?.trim() || null,
        budget_limit: input.budget_limit ?? null,
        manager_user_id: input.manager_user_id || null,
      })
      .eq("id", id);

    if (error) {
      return { success: false, error: getSafeErrorMessage(error) };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: getSafeErrorMessage(error) };
  }
}

/**
 * Toggle the active status of a cost center / department (soft deactivate)
 */
export async function setDepartmentActive(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("departments")
      .update({ is_active: isActive })
      .eq("id", id);

    if (error) {
      return { success: false, error: getSafeErrorMessage(error) };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: getSafeErrorMessage(error) };
  }
}
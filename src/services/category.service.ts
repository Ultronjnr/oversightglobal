import { supabase } from "@/integrations/supabase/client";
import { logError, getSafeErrorMessage } from "@/lib/error-handler";

export type CategoryType = "EXPENSE" | "ASSET";

export interface Category {
  id: string;
  organization_id: string;
  name: string;
  type: CategoryType;
  description: string | null;
  created_at: string;
  created_by: string;
}

export interface CreateCategoryInput {
  name: string;
  type: CategoryType;
  description?: string;
}

interface CategoryResult {
  success: boolean;
  data?: Category;
  error?: string;
}

interface CategoriesResult {
  success: boolean;
  data: Category[];
  error?: string;
}

/**
 * Get all categories for the current user's organization
 */
export async function getCategories(): Promise<CategoriesResult> {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("type", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      logError("getCategories", error);
      return { success: false, error: getSafeErrorMessage(error), data: [] };
    }

    return { success: true, data: (data || []) as Category[] };
  } catch (error: any) {
    logError("getCategories", error);
    return { success: false, error: getSafeErrorMessage(error), data: [] };
  }
}

/**
 * Create a new category
 */
export async function createCategory(
  input: CreateCategoryInput
): Promise<CategoryResult> {
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

    const { data, error } = await supabase
      .from("categories")
      .insert({
        organization_id: profile.organization_id,
        name: input.name.trim(),
        type: input.type,
        description: input.description?.trim() || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      logError("createCategory", error);
      // Check for duplicate name error
      if (error.code === "23505") {
        return { success: false, error: "A category with this name already exists" };
      }
      return { success: false, error: getSafeErrorMessage(error) };
    }

    return { success: true, data: data as Category };
  } catch (error: any) {
    logError("createCategory", error);
    return { success: false, error: getSafeErrorMessage(error) };
  }
}

/**
 * Get categories grouped by type
 */
export function groupCategoriesByType(categories: Category[]): {
  expenses: Category[];
  assets: Category[];
} {
  return {
    expenses: categories.filter((c) => c.type === "EXPENSE"),
    assets: categories.filter((c) => c.type === "ASSET"),
  };
}

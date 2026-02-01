import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/error-handler";

export interface CreateSupplierInvitationParams {
  email: string;
  companyName: string;
}

interface SupplierInvitationResponse {
  success: boolean;
  invitation_id?: string;
  token?: string;
  email?: string;
  organization_id?: string;
  error?: string;
}

/**
 * Create a supplier invitation (Admin only)
 */
export async function createSupplierInvitation(
  params: CreateSupplierInvitationParams
): Promise<{
  success: boolean;
  inviteLink?: string;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc("create_supplier_invitation", {
      _email: params.email,
      _company_name: params.companyName,
    });

    if (error) {
      return { success: false, error: getSafeErrorMessage(error) };
    }

    const response = data as unknown as SupplierInvitationResponse;
    
    if (!response?.success) {
      return { success: false, error: response?.error || "Failed to create invitation" };
    }

    // Generate invite link
    const baseUrl = window.location.origin;
    const inviteLink = `${baseUrl}/invite?token=${response.token}&email=${encodeURIComponent(response.email || params.email)}&type=supplier`;

    return { success: true, inviteLink };
  } catch (error: any) {
    return { success: false, error: getSafeErrorMessage(error) };
  }
}

export interface AcceptSupplierInvitationParams {
  token: string;
  email: string;
  password: string;
  companyName: string;
  industries: string[];
  vatNumber?: string;
  registrationNumber: string;
  phone: string;
  address: string;
  contactPerson: string;
}

interface AcceptSupplierResponse {
  success: boolean;
  supplier_id?: string;
  organization_id?: string;
  error?: string;
}

/**
 * Accept a supplier invitation and complete registration
 */
export async function acceptSupplierInvitation(
  params: AcceptSupplierInvitationParams
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // First, create the auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (authError) {
      return { success: false, error: getSafeErrorMessage(authError) };
    }

    if (!authData.user) {
      return { success: false, error: "Failed to create user account" };
    }

    // Create profile (no organization for suppliers - they get org from invitation)
    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      email: params.email.toLowerCase(),
      name: params.companyName,
      phone: params.phone || null,
    });

    if (profileError) {
      return { success: false, error: getSafeErrorMessage(profileError) };
    }

    // Accept the supplier invitation and create supplier record
    const { data, error } = await supabase.rpc("accept_supplier_invitation", {
      _token: params.token,
      _email: params.email,
      _user_id: authData.user.id,
      _company_name: params.companyName,
      _industries: params.industries,
      _vat_number: params.vatNumber || null,
      _registration_number: params.registrationNumber,
      _phone: params.phone,
      _address: params.address,
      _contact_person: params.contactPerson,
    });

    if (error) {
      return { success: false, error: getSafeErrorMessage(error) };
    }

    const response = data as unknown as AcceptSupplierResponse;
    
    if (!response?.success) {
      return { success: false, error: response?.error || "Failed to complete registration" };
    }

    // Assign SUPPLIER role using the secure function
    const { error: roleError } = await supabase.rpc("assign_invitation_role", {
      _user_id: authData.user.id,
      _role: "SUPPLIER",
    });

    if (roleError) {
      return { success: false, error: getSafeErrorMessage(roleError) };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: getSafeErrorMessage(error) };
  }
}

/**
 * Validate a supplier invitation token
 */
export async function validateSupplierInvitation(
  token: string,
  email: string
): Promise<{
  success: boolean;
  data?: {
    companyName: string;
    organizationName: string;
    organizationId: string;
  };
  error?: string;
}> {
  try {
    // Use existing validate_invitation function
    const { data, error } = await supabase.rpc("validate_invitation", {
      _token: token,
      _email: email,
    });

    if (error) {
      return { success: false, error: getSafeErrorMessage(error) };
    }

    if (!data || data.length === 0) {
      return { success: false, error: "Invalid invitation" };
    }

    const invitation = data[0];

    // Verify it's a supplier invitation
    if (invitation.role !== "SUPPLIER") {
      return { success: false, error: "Invalid supplier invitation" };
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return { success: false, error: "This invitation has expired" };
    }

    // Check if already used
    if (invitation.status !== "pending") {
      return { success: false, error: "This invitation has already been used" };
    }

    // Get organization name
    const { data: orgData } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", invitation.organization_id)
      .single();

    return {
      success: true,
      data: {
        companyName: invitation.department || "", // Company name stored in department field
        organizationName: orgData?.name || "Unknown Organization",
        organizationId: invitation.organization_id,
      },
    };
  } catch (error: any) {
    return { success: false, error: getSafeErrorMessage(error) };
  }
}

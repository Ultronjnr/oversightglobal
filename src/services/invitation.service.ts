import { supabase } from "@/integrations/supabase/client";

export interface Invitation {
  id: string;
  email: string;
  role: string;
  department: string | null;
  token: string;
  status: "pending" | "accepted" | "expired";
  expires_at: string;
  organization_id: string;
  invited_by: string;
  created_at: string;
}

export interface CreateInvitationParams {
  email: string;
  role: "EMPLOYEE" | "HOD" | "FINANCE" | "ADMIN";
  department?: string;
}

/**
 * Generate a secure random token
 */
function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Create a new invitation
 */
export async function createInvitation(
  params: CreateInvitationParams
): Promise<{
  success: boolean;
  inviteLink?: string;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      return { success: false, error: "No organization found" };
    }

    // Check if invitation already exists for this email
    const { data: existingInvitation } = await supabase
      .from("invitations")
      .select("id, status")
      .eq("email", params.email.toLowerCase())
      .eq("organization_id", profile.organization_id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvitation) {
      return { success: false, error: "An invitation already exists for this email" };
    }

    // Generate secure token and expiry
    const token = generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    // Create the invitation
    const { error } = await supabase.from("invitations").insert({
      email: params.email.toLowerCase(),
      role: params.role,
      department: params.department || null,
      token,
      status: "pending",
      expires_at: expiresAt.toISOString(),
      organization_id: profile.organization_id,
      invited_by: user.id,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Generate invite link
    const baseUrl = window.location.origin;
    const inviteLink = `${baseUrl}/invite?token=${token}&email=${encodeURIComponent(params.email.toLowerCase())}`;

    return { success: true, inviteLink };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get all invitations for the organization
 */
export async function getOrganizationInvitations(): Promise<{
  success: boolean;
  data: Invitation[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("invitations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, data: [], error: error.message };
    }

    return { success: true, data: data as Invitation[] };
  } catch (error: any) {
    return { success: false, data: [], error: error.message };
  }
}

/**
 * Cancel/expire an invitation
 */
export async function cancelInvitation(
  invitationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("invitations")
      .update({ status: "expired" })
      .eq("id", invitationId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Validate an invitation token (public - uses security definer function)
 */
export async function validateInvitation(
  token: string,
  email: string
): Promise<{
  success: boolean;
  data?: {
    id: string;
    email: string;
    role: string;
    department: string | null;
    organization_id: string;
    status: string;
    expires_at: string;
  };
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc("validate_invitation", {
      _token: token,
      _email: email,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return { success: false, error: "Invalid invitation" };
    }

    const invitation = data[0];

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return { success: false, error: "This invitation has expired" };
    }

    // Check if already used
    if (invitation.status !== "pending") {
      return { success: false, error: "This invitation has already been used" };
    }

    return { success: true, data: invitation };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Accept an invitation - create user, profile, and role
 */
export async function acceptInvitation(
  token: string,
  email: string,
  password: string,
  name: string,
  surname?: string
): Promise<{
  success: boolean;
  role?: string;
  error?: string;
}> {
  try {
    // First validate the invitation
    const validation = await validateInvitation(token, email);
    if (!validation.success || !validation.data) {
      return { success: false, error: validation.error || "Invalid invitation" };
    }

    const invitation = validation.data;

    // Create the auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (authError) {
      return { success: false, error: authError.message };
    }

    if (!authData.user) {
      return { success: false, error: "Failed to create user" };
    }

    // Create the profile
    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      email: email.toLowerCase(),
      name,
      surname: surname || null,
      department: invitation.department,
      organization_id: invitation.organization_id,
    });

    if (profileError) {
      return { success: false, error: profileError.message };
    }

    // Assign the role using secure function (bypasses RLS for privileged roles)
    const { data: roleAssigned, error: roleError } = await supabase.rpc("assign_invitation_role", {
      _user_id: authData.user.id,
      _role: invitation.role as "ADMIN" | "EMPLOYEE" | "FINANCE" | "HOD" | "SUPPLIER",
    });

    if (roleError || !roleAssigned) {
      return { success: false, error: roleError?.message || "Failed to assign role" };
    }

    // Mark invitation as accepted
    await supabase.rpc("accept_invitation", {
      _token: token,
      _email: email,
    });

    return { success: true, role: invitation.role };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

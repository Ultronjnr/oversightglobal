import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/error-handler";

export interface Invitation {
  id: string;
  email: string;
  role: string;
  department: string | null;
  token?: string;
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
  emailSent?: boolean;
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
      token_hash: token, // hashed to SHA-256 by BEFORE INSERT trigger
      status: "pending",
      expires_at: expiresAt.toISOString(),
      organization_id: profile.organization_id,
      invited_by: user.id,
    });

    if (error) {
      return { success: false, error: getSafeErrorMessage(error) };
    }

    // Generate invite link
    const baseUrl = window.location.origin;
    const inviteLink = `${baseUrl}/invite?token=${token}&email=${encodeURIComponent(params.email.toLowerCase())}`;

    // Attempt to send the invitation email via the built-in email system
    let emailSent = false;
    try {
      const { error: emailError } = await supabase.functions.invoke(
        "send-transactional-email",
        {
          body: {
            templateName: "invitation",
            recipientEmail: params.email.toLowerCase(),
            idempotencyKey: `invitation-${token}`,
            templateData: {
              inviteLink,
              role: params.role,
              department: params.department || null,
            },
          },
        }
      );
      emailSent = !emailError;
    } catch {
      emailSent = false;
    }

    return { success: true, inviteLink, emailSent };
  } catch (error: any) {
    return { success: false, error: getSafeErrorMessage(error) };
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
      .select(
        "id, email, role, department, status, expires_at, organization_id, invited_by, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, data: [], error: getSafeErrorMessage(error) };
    }

    return { success: true, data: data as Invitation[] };
  } catch (error: any) {
    return { success: false, data: [], error: getSafeErrorMessage(error) };
  }
}

/**
 * Cancel/expire an invitation
 */
export async function resendInvitation(
  invitation: Pick<Invitation, "id">
): Promise<{ success: boolean; emailSent: boolean; error?: string }> {
  try {
    // Rotate the token server-side; the raw token is never readable from the row.
    const { data, error } = await supabase.rpc("resend_invitation", {
      _invitation_id: invitation.id,
    });
    if (error) {
      return { success: false, emailSent: false, error: getSafeErrorMessage(error) };
    }
    const res = data as unknown as {
      success: boolean;
      error?: string;
      token?: string;
      email?: string;
      role?: string;
      department?: string | null;
    };
    if (!res?.success || !res.token || !res.email) {
      return { success: false, emailSent: false, error: res?.error || "Failed to resend invitation" };
    }

    const baseUrl = window.location.origin;
    const inviteLink = `${baseUrl}/invite?token=${res.token}&email=${encodeURIComponent(
      res.email.toLowerCase()
    )}`;

    const { error: emailError } = await supabase.functions.invoke(
      "send-transactional-email",
      {
        body: {
          templateName: "invitation",
          recipientEmail: res.email.toLowerCase(),
          idempotencyKey: `invitation-resend-${res.token}-${Date.now()}`,
          templateData: {
            inviteLink,
            role: res.role,
            department: res.department || null,
          },
        },
      }
    );

    if (emailError) {
      return { success: false, emailSent: false, error: getSafeErrorMessage(emailError) };
    }

    return { success: true, emailSent: true };
  } catch (error: any) {
    return { success: false, emailSent: false, error: getSafeErrorMessage(error) };
  }
}

export async function cancelInvitation(
  invitationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("invitations")
      .update({ status: "expired" })
      .eq("id", invitationId);

    if (error) {
      return { success: false, error: getSafeErrorMessage(error) };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: getSafeErrorMessage(error) };
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
      return { success: false, error: getSafeErrorMessage(error) };
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
    return { success: false, error: getSafeErrorMessage(error) };
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
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (authError) {
      return { success: false, error: getSafeErrorMessage(authError) };
    }

    if (!authData.user) {
      return { success: false, error: "Failed to create user" };
    }

    // Finalise profile + role + mark invitation accepted in a single secure RPC.
    // This works even when email confirmation is required (no session yet).
    const { data: completion, error: completionError } = await supabase.rpc(
      "complete_invitation_signup",
      {
        _token: token,
        _email: email,
        _user_id: authData.user.id,
        _name: name,
        _surname: surname || null,
      }
    );

    if (completionError) {
      return { success: false, error: getSafeErrorMessage(completionError) };
    }

    const res = completion as unknown as { success: boolean; error?: string; role?: string };
    if (!res?.success) {
      return { success: false, error: res?.error || "Failed to complete signup" };
    }

    return { success: true, role: invitation.role };
  } catch (error: any) {
    return { success: false, error: getSafeErrorMessage(error) };
  }
}

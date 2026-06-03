import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/error-handler";

export interface SupplierInvitation {
  id: string;
  email: string;
  company_name: string;
  contact_person: string | null;
  industry: string | null;
  registration_number: string | null;
  vat_number: string | null;
  status: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

export interface CreateSupplierInviteParams {
  email: string;
  companyName: string;
  contactPerson: string;
  industry?: string;
  registrationNumber?: string;
  vatNumber?: string;
}

interface InviteRpcResponse {
  success: boolean;
  error?: string;
  token?: string;
  email?: string;
  company_name?: string;
  contact_person?: string;
}

function registrationUrl(token: string) {
  return `${window.location.origin}/supplier/register?token=${token}`;
}

async function sendInvitationEmail(args: {
  email: string;
  contactPerson?: string;
  companyName?: string;
  token: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "supplier-invitation",
        recipientEmail: args.email,
        idempotencyKey: `supplier-invite-${args.token}`,
        templateData: {
          contactPerson: args.contactPerson,
          companyName: args.companyName,
          registrationUrl: registrationUrl(args.token),
        },
      },
    });
    if (error) return { success: false, error: getSafeErrorMessage(error) };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: getSafeErrorMessage(err) };
  }
}

export async function createSupplierInvite(
  params: CreateSupplierInviteParams
): Promise<{ success: boolean; error?: string; emailSent?: boolean }> {
  try {
    const { data, error } = await supabase.rpc("create_supplier_invite", {
      _email: params.email,
      _company_name: params.companyName,
      _contact_person: params.contactPerson,
      _industry: params.industry || null,
      _registration_number: params.registrationNumber || null,
      _vat_number: params.vatNumber || null,
    });

    if (error) return { success: false, error: getSafeErrorMessage(error) };
    const res = data as unknown as InviteRpcResponse;
    if (!res?.success) return { success: false, error: res?.error || "Failed to create invitation" };

    const emailResult = await sendInvitationEmail({
      email: res.email!,
      contactPerson: res.contact_person || params.contactPerson,
      companyName: res.company_name || params.companyName,
      token: res.token!,
    });

    return { success: true, emailSent: emailResult.success, error: emailResult.error };
  } catch (err: any) {
    return { success: false, error: getSafeErrorMessage(err) };
  }
}

export async function resendSupplierInvite(
  invitationId: string
): Promise<{ success: boolean; error?: string; emailSent?: boolean }> {
  try {
    const { data, error } = await supabase.rpc("resend_supplier_invite", {
      _invitation_id: invitationId,
    });
    if (error) return { success: false, error: getSafeErrorMessage(error) };
    const res = data as unknown as InviteRpcResponse;
    if (!res?.success) return { success: false, error: res?.error || "Failed to resend invitation" };

    const emailResult = await sendInvitationEmail({
      email: res.email!,
      contactPerson: res.contact_person || undefined,
      companyName: res.company_name || undefined,
      token: res.token!,
    });

    return { success: true, emailSent: emailResult.success, error: emailResult.error };
  } catch (err: any) {
    return { success: false, error: getSafeErrorMessage(err) };
  }
}

export async function cancelSupplierInvite(
  invitationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc("cancel_supplier_invite", {
      _invitation_id: invitationId,
    });
    if (error) return { success: false, error: getSafeErrorMessage(error) };
    const res = data as unknown as InviteRpcResponse;
    if (!res?.success) return { success: false, error: res?.error || "Failed to cancel invitation" };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: getSafeErrorMessage(err) };
  }
}

export async function listSupplierInvitations(): Promise<{
  success: boolean;
  data: SupplierInvitation[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("supplier_invitations")
      .select(
        "id, email, company_name, contact_person, industry, registration_number, vat_number, status, created_at, expires_at, accepted_at"
      )
      .order("created_at", { ascending: false });

    if (error) return { success: false, data: [], error: getSafeErrorMessage(error) };

    // Reflect expiry in display without requiring a write
    const now = Date.now();
    const normalized = (data || []).map((d: any) => ({
      ...d,
      status:
        d.status === "PENDING" && new Date(d.expires_at).getTime() < now
          ? "EXPIRED"
          : d.status,
    })) as SupplierInvitation[];

    return { success: true, data: normalized };
  } catch (err: any) {
    return { success: false, data: [], error: getSafeErrorMessage(err) };
  }
}
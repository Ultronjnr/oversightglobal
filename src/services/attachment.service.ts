import { supabase } from "@/integrations/supabase/client";

const BUCKET = "attachments";
const MAX_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];

export type AttachmentKind = "INVOICE" | "RECEIPT" | "OTHER";

export interface Attachment {
  id: string;
  organization_id: string;
  kind: AttachmentKind;
  pr_id: string | null;
  transaction_id: string | null;
  reimbursement_id: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  vat_number: string | null;
  file_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  notes: string | null;
  ai_extracted: any | null;
  uploaded_by: string;
  created_at: string;
}

export interface UploadAttachmentInput {
  file: File;
  kind: AttachmentKind;
  pr_id?: string | null;
  transaction_id?: string | null;
  reimbursement_id?: string | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  vat_number?: string | null;
  notes?: string | null;
}

export interface AttachmentFilter {
  pr_id?: string;
  transaction_id?: string;
  reimbursement_id?: string;
  supplier_id?: string;
}

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

export async function uploadAttachment(
  input: UploadAttachmentInput
): Promise<{ success: boolean; attachment?: Attachment; error?: string }> {
  try {
    const { file } = input;
    if (!file) return { success: false, error: "No file provided" };
    if (!ALLOWED_MIME.includes(file.type)) {
      return { success: false, error: "Only PDF, JPG, or PNG files are allowed" };
    }
    if (file.size > MAX_SIZE) {
      return { success: false, error: "File must be smaller than 15MB" };
    }

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return { success: false, error: "Not authenticated" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();
    const organization_id = (profile as any)?.organization_id as string | undefined;
    if (!organization_id) return { success: false, error: "Organization not found" };

    const ts = Date.now();
    const path = `${organization_id}/${input.kind.toLowerCase()}/${ts}-${crypto.randomUUID()}-${safeName(file.name)}`;

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (upErr) {
      console.error("[attachment] upload error:", upErr);
      return { success: false, error: "Failed to upload file" };
    }

    const insertPayload = {
      organization_id,
      kind: input.kind,
      pr_id: input.pr_id ?? null,
      transaction_id: input.transaction_id ?? null,
      reimbursement_id: input.reimbursement_id ?? null,
      supplier_id: input.supplier_id ?? null,
      supplier_name: input.supplier_name?.trim() || null,
      invoice_number: input.invoice_number?.trim() || null,
      invoice_date: input.invoice_date || null,
      vat_number: input.vat_number?.trim() || null,
      notes: input.notes?.trim() || null,
      file_path: path,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
      uploaded_by: user.id,
    };

    const { data, error: insErr } = await supabase
      .from("attachments" as any)
      .insert(insertPayload)
      .select()
      .single();

    if (insErr) {
      console.error("[attachment] insert error:", insErr);
      await supabase.storage.from(BUCKET).remove([path]);
      return { success: false, error: insErr.message };
    }

    return { success: true, attachment: data as unknown as Attachment };
  } catch (err: any) {
    console.error("[attachment] unexpected:", err);
    return { success: false, error: err.message || "Unexpected error" };
  }
}

export async function listAttachments(
  filter: AttachmentFilter
): Promise<{ success: boolean; data: Attachment[]; error?: string }> {
  try {
    let q = supabase.from("attachments" as any).select("*").order("created_at", { ascending: false });
    if (filter.pr_id) q = q.eq("pr_id", filter.pr_id);
    if (filter.transaction_id) q = q.eq("transaction_id", filter.transaction_id);
    if (filter.reimbursement_id) q = q.eq("reimbursement_id", filter.reimbursement_id);
    if (filter.supplier_id) q = q.eq("supplier_id", filter.supplier_id);
    const { data, error } = await q;
    if (error) return { success: false, data: [], error: error.message };
    return { success: true, data: (data || []) as unknown as Attachment[] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function getAttachmentSignedUrl(
  path: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
  if (error || !data?.signedUrl) return { success: false, error: error?.message || "Failed to generate URL" };
  return { success: true, url: data.signedUrl };
}

export async function deleteAttachment(
  attachment: Pick<Attachment, "id" | "file_path">
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from("attachments" as any).delete().eq("id", attachment.id);
  if (error) return { success: false, error: error.message };
  await supabase.storage.from(BUCKET).remove([attachment.file_path]);
  return { success: true };
}
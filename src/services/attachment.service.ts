import { supabase } from "@/integrations/supabase/client";

const BUCKET = "attachments";
const MAX_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];

export type AttachmentKind =
  | "INVOICE"
  | "RECEIPT"
  | "QUOTE"
  | "PURCHASE_ORDER"
  | "SUPPORTING"
  | "OTHER";

export const ATTACHMENT_KIND_LABELS: Record<AttachmentKind, string> = {
  INVOICE: "Invoice",
  RECEIPT: "Receipt",
  QUOTE: "Quote",
  PURCHASE_ORDER: "Purchase Order",
  SUPPORTING: "Supporting Document",
  OTHER: "Attachment",
};

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
  version: number;
  is_current: boolean;
  supersedes_id: string | null;
  updated_at: string;
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
  /** OCR JSON, corrected fields and version history persisted with the file. */
  ai_extracted?: any | null;
}

export interface AttachmentFilter {
  pr_id?: string;
  transaction_id?: string;
  reimbursement_id?: string;
  supplier_id?: string;
  kind?: AttachmentKind;
  /** Include superseded (older) versions. Defaults to false — current only. */
  includeAllVersions?: boolean;
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
      ai_extracted: input.ai_extracted ?? null,
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
    if (filter.kind) q = q.eq("kind", filter.kind);
    if (!filter.includeAllVersions) q = q.eq("is_current", true);
    const { data, error } = await q;
    if (error) return { success: false, data: [], error: error.message };
    return { success: true, data: (data || []) as unknown as Attachment[] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

/**
 * Return the full version history for a given attachment (newest first),
 * following the supersedes chain in both directions. Nothing is ever deleted —
 * older versions remain permanently available.
 */
export async function listAttachmentVersions(
  attachment: Pick<Attachment, "id" | "transaction_id" | "pr_id" | "kind" | "file_name">
): Promise<{ success: boolean; data: Attachment[]; error?: string }> {
  try {
    // Walk to the current head, then collect the whole chain by shared target+kind.
    const filter: AttachmentFilter = { includeAllVersions: true, kind: attachment.kind };
    if (attachment.transaction_id) filter.transaction_id = attachment.transaction_id;
    else if (attachment.pr_id) filter.pr_id = attachment.pr_id;
    const res = await listAttachments(filter);
    if (!res.success) return res;
    // Build the chain containing this attachment via supersedes links.
    const byId = new Map(res.data.map((a) => [a.id, a]));
    const chain = new Set<string>([attachment.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const a of res.data) {
        if (a.supersedes_id && chain.has(a.id) && !chain.has(a.supersedes_id) && byId.has(a.supersedes_id)) {
          chain.add(a.supersedes_id);
          changed = true;
        }
        if (a.supersedes_id && chain.has(a.supersedes_id) && !chain.has(a.id)) {
          chain.add(a.id);
          changed = true;
        }
      }
    }
    const data = res.data
      .filter((a) => chain.has(a.id))
      .sort((a, b) => b.version - a.version);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

/**
 * Replace an existing attachment with a new file while preserving history.
 * The old row is kept (is_current=false); a new current row is inserted that
 * points back to it via supersedes_id. The original file is never removed.
 */
export async function replaceAttachment(
  current: Attachment,
  file: File
): Promise<{ success: boolean; attachment?: Attachment; error?: string }> {
  try {
    if (!file) return { success: false, error: "No file provided" };
    if (!ALLOWED_MIME.includes(file.type)) {
      return { success: false, error: "Only PDF, JPG, or PNG files are allowed" };
    }
    if (file.size > MAX_SIZE) {
      return { success: false, error: "File must be smaller than 15MB" };
    }

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return { success: false, error: "Not authenticated" };

    const ts = Date.now();
    const path = `${current.organization_id}/${current.kind.toLowerCase()}/${ts}-${crypto.randomUUID()}-${safeName(file.name)}`;

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (upErr) {
      console.error("[attachment] replace upload error:", upErr);
      return { success: false, error: "Failed to upload file" };
    }

    const insertPayload = {
      organization_id: current.organization_id,
      kind: current.kind,
      pr_id: current.pr_id,
      transaction_id: current.transaction_id,
      reimbursement_id: current.reimbursement_id,
      supplier_id: current.supplier_id,
      supplier_name: current.supplier_name,
      invoice_number: current.invoice_number,
      invoice_date: current.invoice_date,
      vat_number: current.vat_number,
      notes: current.notes,
      ai_extracted: current.ai_extracted,
      file_path: path,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
      uploaded_by: user.id,
      version: (current.version ?? 1) + 1,
      is_current: true,
      supersedes_id: current.id,
    };

    const { data, error: insErr } = await supabase
      .from("attachments" as any)
      .insert(insertPayload)
      .select()
      .single();
    if (insErr) {
      console.error("[attachment] replace insert error:", insErr);
      await supabase.storage.from(BUCKET).remove([path]);
      return { success: false, error: insErr.message };
    }

    // Demote the previous version — kept for history, never deleted.
    await supabase
      .from("attachments" as any)
      .update({ is_current: false })
      .eq("id", current.id);

    return { success: true, attachment: data as unknown as Attachment };
  } catch (err: any) {
    console.error("[attachment] replace unexpected:", err);
    return { success: false, error: err.message || "Unexpected error" };
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
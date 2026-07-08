import { supabase } from "@/integrations/supabase/client";

export const DONATION_BUCKET = "donation-assets";

export type DonorType = "INDIVIDUAL" | "ORGANIZATION";
export type DonationKind = "CASH" | "IN_KIND";
export type ReceiptStatus = "DRAFT" | "ISSUED" | "EMAILED" | "CANCELLED";
export type AllocationType = "RESERVED" | "SPENT";
export type AllocationSource = "MANUAL" | "EXPENSE" | "TRANSACTION";
export type AuditAction =
  | "CREATED"
  | "EDITED"
  | "ISSUED"
  | "DOWNLOADED"
  | "EMAILED"
  | "CANCELLED";

export interface Donor {
  id: string;
  organization_id: string;
  donor_type: DonorType;
  name: string;
  id_or_reg_number: string | null;
  income_tax_number: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FundingPool {
  id: string;
  organization_id: string;
  donor_id: string;
  total_donated: number;
  total_allocated: number;
  total_spent: number;
  updated_at: string;
}

export interface DonationProject {
  id: string;
  organization_id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: string;
  budget: number;
  created_at: string;
}

export interface Donation {
  id: string;
  organization_id: string;
  donor_id: string;
  donation_date: string;
  amount: number;
  currency: string;
  donation_type: DonationKind;
  description: string | null;
  in_kind_value: number | null;
  receipt_id: string | null;
  created_at: string;
}

export interface FundAllocation {
  id: string;
  organization_id: string;
  donor_id: string;
  pool_id: string | null;
  project_id: string | null;
  amount: number;
  allocation_type: AllocationType;
  source_type: AllocationSource;
  source_id: string | null;
  description: string | null;
  created_at: string;
}

export interface DonationOrgProfile {
  id: string;
  organization_id: string;
  legal_name: string | null;
  npo_number: string | null;
  pbo_number: string | null;
  vat_number: string | null;
  registration_number: string | null;
  physical_address: string | null;
  postal_address: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  signatory_name: string | null;
  signatory_designation: string | null;
  logo_path: string | null;
  signature_path: string | null;
  stamp_path: string | null;
  receipt_prefix: string;
  next_receipt_number: number;
  template: Record<string, any>;
}

export interface DonationReceipt {
  id: string;
  organization_id: string;
  receipt_number: string;
  donation_id: string | null;
  donor_id: string | null;
  issued_at: string | null;
  status: ReceiptStatus;
  snapshot: Record<string, any>;
  pdf_path: string | null;
  version: number;
  verification_hash: string | null;
  created_at: string;
  updated_at: string;
}

async function currentOrgId(): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not authenticated");
  const { data } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", uid)
    .single();
  const org = (data as any)?.organization_id as string | undefined;
  if (!org) throw new Error("Organization not found");
  return org;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function logAudit(
  entity_type: string,
  entity_id: string | null,
  action: AuditAction,
  details: Record<string, any> = {}
) {
  try {
    const organization_id = await currentOrgId();
    const actor_id = await currentUserId();
    await supabase.from("donation_audit_log").insert({
      organization_id,
      entity_type,
      entity_id,
      action,
      actor_id,
      details,
    } as any);
  } catch (e) {
    // audit logging must never block the main action
    console.error("audit log failed", e);
  }
}

// ===== Donors =====
export async function listDonors(search = ""): Promise<Donor[]> {
  let q = supabase.from("organization_donors").select("*").order("name");
  if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Donor[];
}

export async function upsertDonor(
  input: Partial<Donor> & { name: string }
): Promise<Donor> {
  const organization_id = await currentOrgId();
  const created_by = await currentUserId();
  if (input.id) {
    const { data, error } = await supabase
      .from("organization_donors")
      .update({
        donor_type: input.donor_type,
        name: input.name,
        id_or_reg_number: input.id_or_reg_number ?? null,
        income_tax_number: input.income_tax_number ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        notes: input.notes ?? null,
        is_active: input.is_active ?? true,
      } as any)
      .eq("id", input.id)
      .select()
      .single();
    if (error) throw error;
    await logAudit("donor", input.id, "EDITED", { name: input.name });
    return data as Donor;
  }
  const { data, error } = await supabase
    .from("organization_donors")
    .insert({
      organization_id,
      created_by,
      donor_type: input.donor_type ?? "INDIVIDUAL",
      name: input.name,
      id_or_reg_number: input.id_or_reg_number ?? null,
      income_tax_number: input.income_tax_number ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
    } as any)
    .select()
    .single();
  if (error) throw error;
  await logAudit("donor", (data as any).id, "CREATED", { name: input.name });
  return data as Donor;
}

// ===== Pools =====
export async function listPools(): Promise<FundingPool[]> {
  const { data, error } = await supabase.from("donor_funding_pools").select("*");
  if (error) throw error;
  return (data ?? []) as FundingPool[];
}

// ===== Projects =====
export async function listProjects(): Promise<DonationProject[]> {
  const { data, error } = await supabase
    .from("donation_projects")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []) as DonationProject[];
}

export async function upsertProject(
  input: Partial<DonationProject> & { name: string }
): Promise<DonationProject> {
  const organization_id = await currentOrgId();
  const created_by = await currentUserId();
  if (input.id) {
    const { data, error } = await supabase
      .from("donation_projects")
      .update({
        name: input.name,
        code: input.code ?? null,
        description: input.description ?? null,
        status: input.status ?? "ACTIVE",
        budget: input.budget ?? 0,
      } as any)
      .eq("id", input.id)
      .select()
      .single();
    if (error) throw error;
    return data as DonationProject;
  }
  const { data, error } = await supabase
    .from("donation_projects")
    .insert({
      organization_id,
      created_by,
      name: input.name,
      code: input.code ?? null,
      description: input.description ?? null,
      status: input.status ?? "ACTIVE",
      budget: input.budget ?? 0,
    } as any)
    .select()
    .single();
  if (error) throw error;
  return data as DonationProject;
}

// ===== Donations =====
export async function listDonations(): Promise<Donation[]> {
  const { data, error } = await supabase
    .from("donations")
    .select("*")
    .order("donation_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Donation[];
}

export async function upsertDonation(
  input: Partial<Donation> & { donor_id: string; amount: number }
): Promise<Donation> {
  const organization_id = await currentOrgId();
  const created_by = await currentUserId();
  if (input.id) {
    const { data, error } = await supabase
      .from("donations")
      .update({
        donor_id: input.donor_id,
        donation_date: input.donation_date,
        amount: input.amount,
        currency: input.currency,
        donation_type: input.donation_type ?? "CASH",
        description: input.description ?? null,
        in_kind_value: input.in_kind_value ?? null,
      } as any)
      .eq("id", input.id)
      .select()
      .single();
    if (error) throw error;
    await logAudit("donation", input.id, "EDITED", { amount: input.amount });
    return data as Donation;
  }
  const { data, error } = await supabase
    .from("donations")
    .insert({
      organization_id,
      created_by,
      donor_id: input.donor_id,
      donation_date: input.donation_date ?? new Date().toISOString().slice(0, 10),
      amount: input.amount,
      currency: input.currency ?? "ZAR",
      donation_type: input.donation_type ?? "CASH",
      description: input.description ?? null,
      in_kind_value: input.in_kind_value ?? null,
    } as any)
    .select()
    .single();
  if (error) throw error;
  await logAudit("donation", (data as any).id, "CREATED", { amount: input.amount });
  return data as Donation;
}

// ===== Allocations =====
export async function listAllocations(): Promise<FundAllocation[]> {
  const { data, error } = await supabase
    .from("fund_allocations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FundAllocation[];
}

export async function createAllocation(
  input: Partial<FundAllocation> & { donor_id: string; amount: number }
): Promise<FundAllocation> {
  const organization_id = await currentOrgId();
  const created_by = await currentUserId();
  const { data: pool } = await supabase
    .from("donor_funding_pools")
    .select("id")
    .eq("donor_id", input.donor_id)
    .single();
  const { data, error } = await supabase
    .from("fund_allocations")
    .insert({
      organization_id,
      created_by,
      donor_id: input.donor_id,
      pool_id: (pool as any)?.id ?? null,
      project_id: input.project_id ?? null,
      amount: input.amount,
      allocation_type: input.allocation_type ?? "RESERVED",
      source_type: input.source_type ?? "MANUAL",
      source_id: input.source_id ?? null,
      description: input.description ?? null,
    } as any)
    .select()
    .single();
  if (error) throw error;
  await logAudit("allocation", (data as any).id, "CREATED", { amount: input.amount });
  return data as FundAllocation;
}

// ===== Org profile =====
export async function getOrgProfile(): Promise<DonationOrgProfile | null> {
  const organization_id = await currentOrgId();
  const { data } = await supabase
    .from("donation_org_profiles")
    .select("*")
    .eq("organization_id", organization_id)
    .maybeSingle();
  return (data as DonationOrgProfile) ?? null;
}

export async function saveOrgProfile(
  input: Partial<DonationOrgProfile>
): Promise<DonationOrgProfile> {
  const organization_id = await currentOrgId();
  const { data: existing } = await supabase
    .from("donation_org_profiles")
    .select("id")
    .eq("organization_id", organization_id)
    .maybeSingle();
  const payload = {
    legal_name: input.legal_name ?? null,
    npo_number: input.npo_number ?? null,
    pbo_number: input.pbo_number ?? null,
    vat_number: input.vat_number ?? null,
    registration_number: input.registration_number ?? null,
    physical_address: input.physical_address ?? null,
    postal_address: input.postal_address ?? null,
    contact_name: input.contact_name ?? null,
    contact_email: input.contact_email ?? null,
    contact_phone: input.contact_phone ?? null,
    signatory_name: input.signatory_name ?? null,
    signatory_designation: input.signatory_designation ?? null,
    logo_path: input.logo_path ?? null,
    signature_path: input.signature_path ?? null,
    stamp_path: input.stamp_path ?? null,
    receipt_prefix: input.receipt_prefix ?? "18A",
    template: input.template ?? {},
  };
  if (existing) {
    const { data, error } = await supabase
      .from("donation_org_profiles")
      .update(payload as any)
      .eq("id", (existing as any).id)
      .select()
      .single();
    if (error) throw error;
    return data as DonationOrgProfile;
  }
  const { data, error } = await supabase
    .from("donation_org_profiles")
    .insert({ organization_id, ...payload } as any)
    .select()
    .single();
  if (error) throw error;
  return data as DonationOrgProfile;
}

// ===== Assets =====
export async function uploadAsset(
  file: File,
  kind: "logo" | "signature" | "stamp"
): Promise<string> {
  const organization_id = await currentOrgId();
  const ext = file.name.split(".").pop() || "png";
  const path = `${organization_id}/branding/${kind}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(DONATION_BUCKET)
    .upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

export async function getAssetDataUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(DONATION_BUCKET).download(path);
  if (error || !data) return null;
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(data);
  });
}

export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string | null> {
  const { data } = await supabase.storage
    .from(DONATION_BUCKET)
    .createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

// ===== Receipts =====
export async function listReceipts(search = ""): Promise<DonationReceipt[]> {
  let q = supabase
    .from("donation_receipts")
    .select("*")
    .order("created_at", { ascending: false });
  if (search.trim()) q = q.ilike("receipt_number", `%${search.trim()}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as DonationReceipt[];
}

export async function nextReceiptNumber(): Promise<string> {
  const organization_id = await currentOrgId();
  const { data, error } = await supabase.rpc("next_donation_receipt_number", {
    _org_id: organization_id,
  } as any);
  if (error) throw error;
  return data as unknown as string;
}

async function makeVerificationHash(parts: string[]): Promise<string> {
  const enc = new TextEncoder().encode(parts.join("|"));
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export async function issueReceipt(input: {
  receipt_number: string;
  donation_id: string;
  donor_id: string;
  snapshot: Record<string, any>;
  pdf_path?: string | null;
}): Promise<DonationReceipt> {
  const organization_id = await currentOrgId();
  const created_by = await currentUserId();
  const id = crypto.randomUUID();
  const hash = await makeVerificationHash([
    id,
    input.receipt_number,
    input.donor_id,
    String(input.snapshot?.amount ?? ""),
  ]);
  const { data, error } = await supabase
    .from("donation_receipts")
    .insert({
      id,
      organization_id,
      receipt_number: input.receipt_number,
      donation_id: input.donation_id,
      donor_id: input.donor_id,
      issued_at: new Date().toISOString(),
      status: "ISSUED",
      snapshot: input.snapshot,
      pdf_path: input.pdf_path ?? null,
      version: 1,
      verification_hash: hash,
      created_by,
      updated_by: created_by,
    } as any)
    .select()
    .single();
  if (error) throw error;
  await supabase
    .from("donations")
    .update({ receipt_id: id } as any)
    .eq("id", input.donation_id);
  await logAudit("receipt", id, "ISSUED", { receipt_number: input.receipt_number });
  return data as DonationReceipt;
}

export async function cancelReceipt(id: string): Promise<void> {
  const updated_by = await currentUserId();
  const { error } = await supabase
    .from("donation_receipts")
    .update({ status: "CANCELLED", updated_by } as any)
    .eq("id", id);
  if (error) throw error;
  await logAudit("receipt", id, "CANCELLED", {});
}

export function verificationUrl(id: string, hash: string): string {
  return `${window.location.origin}/verify/receipt/${id}?h=${hash}`;
}

// ===== Dashboard =====
export interface DonationDashboard {
  totalDonors: number;
  totalDonations: number;
  receiptsIssued: number;
  pendingReceipts: number;
  availableFunding: number;
  allocatedFunding: number;
}

export async function getDashboard(): Promise<DonationDashboard> {
  const [donors, donations, receipts, pools] = await Promise.all([
    supabase.from("organization_donors").select("id", { count: "exact", head: true }),
    supabase.from("donations").select("amount"),
    supabase.from("donation_receipts").select("status"),
    supabase.from("donor_funding_pools").select("total_donated,total_allocated,total_spent"),
  ]);
  const donationRows = (donations.data ?? []) as { amount: number }[];
  const receiptRows = (receipts.data ?? []) as { status: ReceiptStatus }[];
  const poolRows = (pools.data ?? []) as {
    total_donated: number;
    total_allocated: number;
    total_spent: number;
  }[];
  const allocated = poolRows.reduce(
    (s, p) => s + Number(p.total_allocated) + Number(p.total_spent),
    0
  );
  const donated = poolRows.reduce((s, p) => s + Number(p.total_donated), 0);
  return {
    totalDonors: donors.count ?? 0,
    totalDonations: donationRows.reduce((s, d) => s + Number(d.amount), 0),
    receiptsIssued: receiptRows.filter((r) => r.status === "ISSUED" || r.status === "EMAILED").length,
    pendingReceipts: donationRows.length - receiptRows.filter((r) => r.status !== "CANCELLED").length,
    availableFunding: Math.max(donated - allocated, 0),
    allocatedFunding: allocated,
  };
}
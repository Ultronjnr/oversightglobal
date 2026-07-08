import { supabase } from "@/integrations/supabase/client";

export type SubscriptionStatus =
  | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "INCOMPLETE";
export type BillingCycle = "MONTHLY" | "ANNUAL";
export type InvoiceStatus = "DRAFT" | "OPEN" | "PAID" | "FAILED" | "VOID";

export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_annual: number;
  currency: string;
  features: string[];
  user_limit: number | null;
  storage_gb: number | null;
  tier: number;
  is_public: boolean;
  is_custom: boolean;
  is_recommended: boolean;
  is_active: boolean;
}

export interface OrganizationSubscription {
  id: string;
  organization_id: string;
  plan_id: string | null;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  current_period_start: string | null;
  current_period_end: string | null;
  next_billing_date: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
}

export interface PaymentMethod {
  id: string;
  organization_id: string;
  provider: string;
  brand: string | null;
  last4: string | null;
  expiry_month: number | null;
  expiry_year: number | null;
  is_default: boolean;
  created_at: string;
}

export interface SubscriptionInvoice {
  id: string;
  organization_id: string;
  plan_id: string | null;
  invoice_number: string | null;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  period_start: string | null;
  period_end: string | null;
  due_date: string | null;
  paid_at: string | null;
  pdf_path: string | null;
  created_at: string;
}

async function currentOrgId(): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not authenticated");
  const { data } = await supabase
    .from("profiles").select("organization_id").eq("id", uid).single();
  const org = (data as any)?.organization_id as string | undefined;
  if (!org) throw new Error("Organization not found");
  return org;
}

export async function listPlans(includeHidden = false): Promise<SubscriptionPlan[]> {
  let q = supabase.from("subscription_plans").select("*").eq("is_active", true).order("tier");
  if (!includeHidden) q = q.eq("is_public", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((p: any) => ({ ...p, features: Array.isArray(p.features) ? p.features : [] })) as SubscriptionPlan[];
}

export async function getSubscription(): Promise<OrganizationSubscription | null> {
  const org = await currentOrgId();
  const { data, error } = await supabase
    .from("organization_subscriptions").select("*").eq("organization_id", org).maybeSingle();
  if (error) throw error;
  return (data as OrganizationSubscription) ?? null;
}

export async function getPaymentMethod(): Promise<PaymentMethod | null> {
  const org = await currentOrgId();
  const { data, error } = await supabase
    .from("payment_methods").select("*")
    .eq("organization_id", org).eq("is_default", true)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return (data as PaymentMethod) ?? null;
}

export async function listInvoices(): Promise<SubscriptionInvoice[]> {
  const { data, error } = await supabase
    .from("subscription_invoices").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SubscriptionInvoice[];
}

/** Select / change plan. Sets the desired plan & cycle. Charging happens via edge function. */
export async function selectPlan(planId: string, cycle: BillingCycle): Promise<void> {
  const organization_id = await currentOrgId();
  const existing = await getSubscription();
  if (existing) {
    const { error } = await supabase
      .from("organization_subscriptions")
      .update({ plan_id: planId, billing_cycle: cycle, cancel_at_period_end: false } as any)
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("organization_subscriptions")
      .insert({ organization_id, plan_id: planId, billing_cycle: cycle, status: "INCOMPLETE" } as any);
    if (error) throw error;
  }
}

export async function cancelSubscription(atPeriodEnd = true): Promise<void> {
  const sub = await getSubscription();
  if (!sub) return;
  const { error } = await supabase
    .from("organization_subscriptions")
    .update({
      cancel_at_period_end: atPeriodEnd,
      status: atPeriodEnd ? sub.status : "CANCELLED",
      cancelled_at: atPeriodEnd ? null : new Date().toISOString(),
    } as any)
    .eq("id", sub.id);
  if (error) throw error;
}

export async function removePaymentMethod(id: string): Promise<void> {
  const { error } = await supabase.from("payment_methods").delete().eq("id", id);
  if (error) throw error;
}

/** Save a Yoco card token via edge function (vaults card, stores brand/last4). */
export async function saveCard(token: string, cycle: BillingCycle, planId: string | null): Promise<any> {
  const { data, error } = await supabase.functions.invoke("yoco-save-card", {
    body: { token, cycle, planId },
  });
  if (error) throw error;
  return data;
}

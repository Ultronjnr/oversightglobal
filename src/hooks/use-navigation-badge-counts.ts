import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type NavigationCounts = Record<string, number>;

export function useNavigationBadgeCounts(): NavigationCounts {
  const { user, role } = useAuth();
  const [counts, setCounts] = useState<NavigationCounts>({});

  const load = useCallback(async () => {
    if (!user?.id || !["FINANCE", "ADMIN", "HOD"].includes(role || "")) {
      setCounts({});
      return;
    }

    const approvalStatuses: ("PENDING_HOD_APPROVAL" | "PENDING_FINANCE_APPROVAL" | "HOD_APPROVED")[] = role === "HOD"
      ? ["PENDING_HOD_APPROVAL"]
      : ["PENDING_FINANCE_APPROVAL", "HOD_APPROVED"];
    const [approval, payable, partial, reimbursements, batches, invoices, quotes] = await Promise.all([
      supabase.from("purchase_requisitions").select("id", { count: "exact", head: true }).in("status", approvalStatuses),
      (supabase as any).rpc("get_approved_not_paid_queue"),
      supabase.from("transactions" as any).select("id", { count: "exact", head: true }).eq("status", "PARTIALLY_PAID"),
      supabase.from("reimbursements").select("id", { count: "exact", head: true }).in("status", ["PENDING", "APPROVED", "AWAITING_PAYMENT"]),
      supabase.from("payment_batches").select("id", { count: "exact", head: true }).in("status", ["DRAFT", "CONFIRMED"]),
      supabase.from("invoices").select("id", { count: "exact", head: true }).in("status", ["DRAFT", "OPEN"]),
      supabase.from("quotes").select("id", { count: "exact", head: true }).eq("status", "SUBMITTED"),
    ]);

    setCounts({
      Approvals: approval.count ?? 0,
      "Approved – Not Paid": Array.isArray(payable.data) ? payable.data.length : 0,
      "Partially Paid": partial.count ?? 0,
      Reimbursements: reimbursements.count ?? 0,
      "Payment Batches": batches.count ?? 0,
      Invoices: invoices.count ?? 0,
      Quotes: quotes.count ?? 0,
    });
  }, [role, user?.id]);

  useEffect(() => {
    void load();
    if (!user?.id || !["FINANCE", "ADMIN", "HOD"].includes(role || "")) return;
    const channel = supabase
      .channel(`navigation-counts-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_requisitions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_allocations" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_batches" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "reimbursements" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "quotes" }, load)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, role, user?.id]);

  return counts;
}
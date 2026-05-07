import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2, Wallet, CheckCheck, AlertCircle, Undo2, Layers } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import {
  getInvoicesAwaitingPayment,
  type InvoiceWithDetails,
} from "@/services/invoice.service";
import { supabase } from "@/integrations/supabase/client";

export type TransactionStatusFilter =
  | "PARTIALLY_PAID"
  | "FULLY_PAID"
  | "OVERDUE"
  | "REIMBURSEMENTS"
  | "BATCHES";

export type TransactionStatusCounts = Record<TransactionStatusFilter, number>;

export async function getTransactionStatusCounts(): Promise<TransactionStatusCounts> {
  const filters: TransactionStatusFilter[] = [
    "PARTIALLY_PAID",
    "FULLY_PAID",
    "OVERDUE",
    "REIMBURSEMENTS",
    "BATCHES",
  ];
  const results = await Promise.all(filters.map((f) => loadRows(f)));
  return filters.reduce((acc, f, i) => {
    acc[f] = results[i].length;
    return acc;
  }, {} as TransactionStatusCounts);
}

interface TransactionRow {
  id: string;
  transactionId: string;
  party: string;
  partySub?: string;
  totalAmount: number;
  amountPaid: number;
  remaining: number;
  status: string;
  date: string;
  currency?: string;
}

const filterMeta: Record<TransactionStatusFilter, {
  title: string;
  description: string;
  icon: React.ReactNode;
  badgeClass: string;
  statusLabel: string;
}> = {
  PARTIALLY_PAID: {
    title: "No Partial Payments",
    description: "Transactions that have been partially settled will appear here.",
    icon: <Wallet className="h-16 w-16" />,
    badgeClass: "bg-warning/10 text-warning border-warning/30",
    statusLabel: "Partially Paid",
  },
  FULLY_PAID: {
    title: "No Fully Paid Transactions",
    description: "Once invoices are marked as paid, they will be listed here.",
    icon: <CheckCheck className="h-16 w-16" />,
    badgeClass: "bg-success/10 text-success border-success/30",
    statusLabel: "Fully Paid",
  },
  OVERDUE: {
    title: "No Overdue Transactions",
    description: "Approved transactions older than 30 days without full payment will appear here.",
    icon: <AlertCircle className="h-16 w-16" />,
    badgeClass: "bg-destructive/10 text-destructive border-destructive/30",
    statusLabel: "Overdue",
  },
  REIMBURSEMENTS: {
    title: "No Reimbursements",
    description: "Employee reimbursement requests will appear here once submitted.",
    icon: <Undo2 className="h-16 w-16" />,
    badgeClass: "bg-primary/10 text-primary border-primary/30",
    statusLabel: "Reimbursement",
  },
  BATCHES: {
    title: "No Payment Batches",
    description: "Payment batches you create will appear here for tracking and reconciliation.",
    icon: <Layers className="h-16 w-16" />,
    badgeClass: "bg-muted text-muted-foreground",
    statusLabel: "Batch",
  },
};

export function TransactionStatusTab({ filter }: { filter: TransactionStatusFilter }) {
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const meta = filterMeta[filter];

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const data = await loadRows(filter);
      if (!cancelled) {
        setRows(data);
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [filter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyState icon={meta.icon} title={meta.title} description={meta.description} />;
  }

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Transaction ID</TableHead>
            <TableHead>Requester / Supplier</TableHead>
            <TableHead className="text-right">Total Amount</TableHead>
            <TableHead className="text-right">Amount Paid</TableHead>
            <TableHead className="text-right">Remaining Balance</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="hover:bg-muted/20">
              <TableCell className="font-mono text-sm font-medium">{row.transactionId}</TableCell>
              <TableCell>
                <p className="font-medium">{row.party}</p>
                {row.partySub && (
                  <p className="text-xs text-muted-foreground">{row.partySub}</p>
                )}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {formatCurrency(row.totalAmount, row.currency)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(row.amountPaid, row.currency)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(row.remaining, row.currency)}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={meta.badgeClass}>
                  {row.status}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {row.date ? format(new Date(row.date), "dd MMM yyyy") : "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

async function loadRows(filter: TransactionStatusFilter): Promise<TransactionRow[]> {
  try {
    if (filter === "FULLY_PAID") {
      const { data } = await supabase
        .from("invoices")
        .select("id, status, created_at, updated_at, supplier:suppliers(company_name, contact_email), pr:purchase_requisitions(transaction_id, currency), quote:quotes(amount)")
        .eq("status", "PAID")
        .order("updated_at", { ascending: false });
      return (data || []).map((inv: any) => {
        const total = inv.quote?.amount || 0;
        return {
          id: inv.id,
          transactionId: inv.pr?.transaction_id || "-",
          party: inv.supplier?.company_name || "-",
          partySub: inv.supplier?.contact_email,
          totalAmount: total,
          amountPaid: total,
          remaining: 0,
          status: "Fully Paid",
          date: inv.updated_at || inv.created_at,
          currency: inv.pr?.currency,
        };
      });
    }

    if (filter === "OVERDUE") {
      const result = await getInvoicesAwaitingPayment();
      if (!result.success) return [];
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      return result.data
        .filter((inv: InvoiceWithDetails) => new Date(inv.created_at).getTime() < cutoff)
        .map((inv: InvoiceWithDetails) => {
          const total = inv.quote?.amount || 0;
          return {
            id: inv.id,
            transactionId: inv.pr?.transaction_id || "-",
            party: inv.supplier?.company_name || "-",
            partySub: inv.supplier?.contact_email,
            totalAmount: total,
            amountPaid: 0,
            remaining: total,
            status: "Overdue 30+ days",
            date: inv.created_at,
            currency: inv.pr?.currency,
          };
        });
    }

    // Partially Paid, Reimbursements, Batches: not modeled yet — return empty
    return [];
  } catch (e) {
    console.error("TransactionStatusTab load error", e);
    return [];
  }
}
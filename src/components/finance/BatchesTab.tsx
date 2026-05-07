import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  ExternalLink,
  Layers,
  Loader2,
  Building2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";
import { getInvoiceDocumentUrl } from "@/services/invoice.service";

interface BatchAllocation {
  id: string;
  invoice_id: string;
  amount_paid: number;
  invoice?: {
    id: string;
    document_url: string;
    status: string;
    quote?: { amount: number };
    supplier?: { company_name: string; contact_email: string };
    pr?: { transaction_id: string; currency: string };
  };
}

interface BatchRow {
  id: string;
  created_at: string;
  total_amount: number;
  currency: string;
  notes: string | null;
  allocations: BatchAllocation[];
}

export function BatchesTab() {
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    void fetchBatches();
  }, []);

  const fetchBatches = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("payment_batches")
      .select(
        `id, created_at, total_amount, currency, notes,
         allocations:payment_allocations (
           id, invoice_id, amount_paid,
           invoice:invoices (
             id, document_url, status,
             quote:quotes ( amount ),
             supplier:suppliers ( company_name, contact_email ),
             pr:purchase_requisitions ( transaction_id, currency )
           )
         )`,
      )
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load batches", { description: error.message });
      setLoading(false);
      return;
    }
    setBatches((data || []) as any);
    setLoading(false);
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleViewInvoice = async (path: string) => {
    const result = await getInvoiceDocumentUrl(path);
    if (result.success && result.url) {
      window.open(result.url, "_blank");
    } else {
      toast.error("Failed to load invoice", { description: result.error });
    }
  };

  const batchStatus = (b: BatchRow) => {
    const allFull = b.allocations.every(
      (a) => a.invoice?.status === "PAID",
    );
    return allFull ? "Processed" : "Draft";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <EmptyState
        icon={<Layers className="h-16 w-16" />}
        title="No Payment Batches"
        description="Payment batches you create will appear here for tracking and reconciliation."
      />
    );
  }

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="w-10"></TableHead>
            <TableHead>Batch ID</TableHead>
            <TableHead>Date Created</TableHead>
            <TableHead className="text-right">Total Amount</TableHead>
            <TableHead className="text-right"># Transactions</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((b) => {
            const isOpen = expanded.has(b.id);
            const status = batchStatus(b);
            return (
              <>
                <TableRow
                  key={b.id}
                  className="cursor-pointer hover:bg-muted/20"
                  onClick={() => toggleExpand(b.id)}
                >
                  <TableCell>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm font-medium">
                    {b.id.slice(0, 8).toUpperCase()}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(b.created_at), "dd MMM yyyy HH:mm")}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(Number(b.total_amount), b.currency)}
                  </TableCell>
                  <TableCell className="text-right">{b.allocations.length}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        status === "Processed"
                          ? "bg-success/10 text-success border-success/30"
                          : "bg-warning/10 text-warning border-warning/30"
                      }
                    >
                      {status}
                    </Badge>
                  </TableCell>
                </TableRow>
                {isOpen && (
                  <TableRow key={`${b.id}-detail`} className="bg-muted/10 hover:bg-muted/10">
                    <TableCell colSpan={6} className="p-4">
                      {b.notes && (
                        <p className="text-sm text-muted-foreground mb-3">
                          <span className="font-medium text-foreground">Notes:</span> {b.notes}
                        </p>
                      )}
                      <div className="rounded-lg border border-border/50 overflow-hidden bg-background">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead>Supplier</TableHead>
                              <TableHead>Transaction</TableHead>
                              <TableHead className="text-right">Amount Paid</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead className="text-right">Invoice</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {b.allocations.map((a) => {
                              const total = a.invoice?.quote?.amount || 0;
                              const isFull = a.invoice?.status === "PAID";
                              return (
                                <TableRow key={a.id}>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Building2 className="h-4 w-4 text-muted-foreground" />
                                      <div>
                                        <p className="font-medium text-sm">
                                          {a.invoice?.supplier?.company_name || "-"}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {a.invoice?.supplier?.contact_email}
                                        </p>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">
                                    {a.invoice?.pr?.transaction_id || "-"}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    {formatCurrency(
                                      Number(a.amount_paid),
                                      a.invoice?.pr?.currency,
                                    )}
                                    <p className="text-xs text-muted-foreground font-normal">
                                      of {formatCurrency(total, a.invoice?.pr?.currency)}
                                    </p>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={
                                        isFull
                                          ? "bg-success/10 text-success border-success/30"
                                          : "bg-warning/10 text-warning border-warning/30"
                                      }
                                    >
                                      {isFull ? "Full" : "Partial"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {a.invoice?.document_url ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleViewInvoice(a.invoice!.document_url);
                                        }}
                                        className="gap-1 text-primary hover:text-primary"
                                      >
                                        <FileText className="h-4 w-4" />
                                        View Invoice
                                        <ExternalLink className="h-3 w-3" />
                                      </Button>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
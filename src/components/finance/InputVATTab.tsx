import { useEffect, useState } from "react";
import { Loader2, Percent, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface VATRow {
  id: string;
  transactionId: string;
  supplier: string;
  vatNumber: string;
  totalAmount: number;
  vatAmount: number;
  date: string;
  currency: string;
}

const VAT_RATE = 0.15;

const formatCurrency = (amount: number, currency: string = "ZAR") =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(amount);

export function InputVATTab() {
  const [rows, setRows] = useState<VATRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("invoices")
          .select(
            "id, created_at, updated_at, supplier:suppliers(company_name, vat_number), pr:purchase_requisitions(transaction_id, currency), quote:quotes(amount)"
          )
          .order("updated_at", { ascending: false });
        if (error) throw error;

        const mapped: VATRow[] = (data || [])
          .filter((inv: any) => inv.supplier?.vat_number && String(inv.supplier.vat_number).trim() !== "")
          .map((inv: any) => {
            const total = Number(inv.quote?.amount || 0);
            // VAT-inclusive total: VAT = total * 15/115
            const vat = total * (VAT_RATE / (1 + VAT_RATE));
            return {
              id: inv.id,
              transactionId: inv.pr?.transaction_id || "-",
              supplier: inv.supplier?.company_name || "-",
              vatNumber: inv.supplier?.vat_number,
              totalAmount: total,
              vatAmount: vat,
              date: inv.updated_at || inv.created_at,
              currency: inv.pr?.currency || "ZAR",
            };
          });
        setRows(mapped);
      } catch (e) {
        console.error("InputVATTab load error", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalVAT = rows.reduce((s, r) => s + r.vatAmount, 0);
  const totalExVAT = rows.reduce((s, r) => s + (r.totalAmount - r.vatAmount), 0);
  const vatPercent = totalExVAT > 0 ? (totalVAT / totalExVAT) * 100 : 0;
  const belowOptimal = rows.length > 0 && vatPercent < 15;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard
          label="Total VAT Claimable"
          value={formatCurrency(totalVAT)}
          valueColor="success"
        />
        <StatCard
          label="VAT % vs Expected (15%)"
          value={`${vatPercent.toFixed(2)}%`}
          valueColor={belowOptimal ? "warning" : "success"}
          icon={<Percent className="h-5 w-5" />}
        />
      </div>

      {belowOptimal && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
          <p>
            Your VAT claim is below optimal. Consider using VAT-registered suppliers.
          </p>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<Percent className="h-16 w-16" />}
          title="No tax invoices"
          description="Invoices from VAT-registered suppliers will appear here."
        />
      ) : (
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Transaction ID</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">VAT Amount</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/20">
                  <TableCell className="font-mono text-sm font-medium">{r.transactionId}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{r.supplier}</p>
                      <p className="text-xs text-muted-foreground">VAT: {r.vatNumber}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-success">
                    {formatCurrency(r.vatAmount, r.currency)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(r.totalAmount, r.currency)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {r.date ? format(new Date(r.date), "dd MMM yyyy") : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
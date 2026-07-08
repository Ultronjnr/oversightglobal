import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listInvoices, type SubscriptionInvoice } from "@/services/subscription.service";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Loader2 } from "lucide-react";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PAID: "default", OPEN: "secondary", DRAFT: "outline", FAILED: "destructive", VOID: "outline",
};

export function BillingHistoryTab() {
  const { format } = useCurrency();
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listInvoices().then(setInvoices).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <Card className="p-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Paid</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">{inv.invoice_number || inv.id.slice(0, 8)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {inv.period_start} → {inv.period_end}
                </TableCell>
                <TableCell className="text-right">{format(Number(inv.amount))}</TableCell>
                <TableCell><Badge variant={statusVariant[inv.status] || "outline"}>{inv.status}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : "—"}</TableCell>
              </TableRow>
            ))}
            {invoices.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No invoices yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  CalendarIcon,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { getAllSuppliers } from "@/services/finance.service";
import {
  AGING_BUCKETS,
  getOutstandingPayables,
  getSupplierStatement,
  type AgingBucket,
  type PayablesReport,
  type SupplierStatement,
} from "@/services/reporting.service";
import {
  exportPayablesToExcel,
  exportPayablesToPdf,
  exportStatementToExcel,
  exportStatementToPdf,
} from "@/services/reporting-export.service";

const bucketTone: Record<AgingBucket, string> = {
  CURRENT: "bg-success/10 text-success border-success/30",
  D1_30: "bg-primary/10 text-primary border-primary/30",
  D31_60: "bg-warning/10 text-warning border-warning/30",
  D61_90: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  D90_PLUS: "bg-destructive/10 text-destructive border-destructive/30",
};

function DateField({
  value,
  onChange,
  placeholder,
}: {
  value?: Date;
  onChange: (d?: Date) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-[170px] justify-start gap-2", !value && "text-muted-foreground")}
        >
          <CalendarIcon className="h-4 w-4" />
          {value ? format(value, "dd MMM yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => {
            onChange(d ?? undefined);
            setOpen(false);
          }}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

export function ReportsTab() {
  const [suppliers, setSuppliers] = useState<{ id: string; company_name: string }[]>([]);
  const [supplierId, setSupplierId] = useState<string>("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [statement, setStatement] = useState<SupplierStatement | null>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);

  const [payables, setPayables] = useState<PayablesReport | null>(null);
  const [loadingPayables, setLoadingPayables] = useState(false);
  const [payablesSupplier, setPayablesSupplier] = useState<string>("ALL");

  useEffect(() => {
    getAllSuppliers().then((res) => {
      if (res.success) {
        setSuppliers(res.data.map((s: any) => ({ id: s.id, company_name: s.company_name })));
      }
    });
  }, []);

  const loadPayables = async (supplier = payablesSupplier) => {
    setLoadingPayables(true);
    try {
      const res = await getOutstandingPayables({
        supplierId: supplier === "ALL" ? null : supplier,
      });
      if (res.success && res.data) setPayables(res.data);
      else toast.error(res.error || "Failed to load payables");
    } finally {
      setLoadingPayables(false);
    }
  };

  useEffect(() => {
    loadPayables("ALL");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStatement = async () => {
    if (!supplierId) {
      toast.error("Select a supplier first.");
      return;
    }
    setLoadingStatement(true);
    try {
      const res = await getSupplierStatement({ supplierId, startDate, endDate });
      if (res.success && res.data) setStatement(res.data);
      else toast.error(res.error || "Failed to build statement");
    } finally {
      setLoadingStatement(false);
    }
  };

  const topSuppliers = useMemo(() => payables?.supplier_totals.slice(0, 5) ?? [], [payables]);

  return (
    <Tabs defaultValue="payables" className="space-y-4">
      <TabsList className="bg-muted/60 p-1.5 rounded-xl">
        <TabsTrigger value="payables" className="gap-1.5 rounded-lg">
          <FileText className="h-4 w-4" /> Outstanding Payables
        </TabsTrigger>
        <TabsTrigger value="statement" className="gap-1.5 rounded-lg">
          <Users className="h-4 w-4" /> Supplier Statement
        </TabsTrigger>
      </TabsList>

      {/* ------------- Outstanding payables ------------- */}
      <TabsContent value="payables" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={payablesSupplier}
            onValueChange={(v) => {
              setPayablesSupplier(v);
              loadPayables(v);
            }}
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="All suppliers" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="ALL">All suppliers</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2" onClick={() => loadPayables()} disabled={loadingPayables}>
            {loadingPayables ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            className="gap-2"
            disabled={!payables?.rows.length}
            onClick={() => payables && exportPayablesToExcel(payables)}
          >
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button
            className="gap-2"
            disabled={!payables?.rows.length}
            onClick={() => payables && exportPayablesToPdf(payables)}
          >
            <Download className="h-4 w-4" /> PDF
          </Button>
        </div>

        {/* Aging summary */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {AGING_BUCKETS.map((b) => (
            <Card key={b.key} className="border-border/60">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{b.label}</p>
                <p className="mt-1 text-lg font-semibold">
                  {formatCurrency(payables?.bucket_totals[b.key] ?? 0, payables?.currency)}
                </p>
              </CardContent>
            </Card>
          ))}
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-primary">Total Outstanding</p>
              <p className="mt-1 text-lg font-semibold text-primary">
                {formatCurrency(payables?.total_outstanding ?? 0, payables?.currency)}
              </p>
            </CardContent>
          </Card>
        </div>

        {topSuppliers.length > 0 && (
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Top exposures by supplier</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {topSuppliers.map((s) => (
                <Badge key={s.supplier_name} variant="outline" className="gap-2 py-1.5">
                  {s.supplier_name}
                  <span className="font-semibold">
                    {formatCurrency(s.outstanding, payables?.currency)}
                  </span>
                </Badge>
              ))}
            </CardContent>
          </Card>
        )}

        {!payables?.rows.length ? (
          <EmptyState
            icon={<FileText className="h-16 w-16" />}
            title="Nothing outstanding"
            description="Every approved transaction has been fully paid, or no transactions match this filter."
          />
        ) : (
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Reference</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payables.rows.map((r) => (
                  <TableRow key={r.transaction_id} className="hover:bg-muted/20">
                    <TableCell className="font-mono text-sm">{r.reference}</TableCell>
                    <TableCell>{r.supplier_name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.project_name || "—"}</TableCell>
                    <TableCell>
                      {r.due_date ? format(new Date(r.due_date), "dd MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={bucketTone[r.bucket]}>
                        {r.days_outstanding}d ·{" "}
                        {AGING_BUCKETS.find((b) => b.key === r.bucket)?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(r.amount, r.currency)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(r.amount_paid, r.currency)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(r.outstanding, r.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>

      {/* ------------- Supplier statement ------------- */}
      <TabsContent value="statement" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Select a supplier" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DateField value={startDate} onChange={setStartDate} placeholder="From date" />
          <DateField value={endDate} onChange={setEndDate} placeholder="To date" />
          <Button onClick={loadStatement} disabled={loadingStatement} className="gap-2">
            {loadingStatement ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Generate
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            className="gap-2"
            disabled={!statement}
            onClick={() => statement && exportStatementToExcel(statement)}
          >
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button
            className="gap-2"
            disabled={!statement}
            onClick={() => statement && exportStatementToPdf(statement)}
          >
            <Download className="h-4 w-4" /> PDF
          </Button>
        </div>

        {!statement ? (
          <EmptyState
            icon={<Users className="h-16 w-16" />}
            title="No statement generated"
            description="Pick a supplier and an optional date range, then click Generate to build the statement of account."
          />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Opening balance", statement.opening_balance],
                ["Charges", statement.total_charges],
                ["Payments", statement.total_payments],
                ["Balance due", statement.closing_balance],
              ].map(([label, value], i) => (
                <Card key={label as string} className={cn("border-border/60", i === 3 && "border-primary/40 bg-primary/5")}>
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className={cn("mt-1 text-lg font-semibold", i === 3 && "text-primary")}>
                      {formatCurrency(value as number, statement.currency)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {statement.lines.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-16 w-16" />}
                title="No activity in this period"
                description="This supplier has no charges or payments in the selected date range."
              />
            ) : (
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Date</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Charge</TableHead>
                      <TableHead className="text-right">Payment</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statement.lines.map((l) => (
                      <TableRow key={l.id} className="hover:bg-muted/20">
                        <TableCell>{format(new Date(l.date), "dd MMM yyyy")}</TableCell>
                        <TableCell className="font-mono text-sm">{l.reference}</TableCell>
                        <TableCell className="text-muted-foreground">{l.description}</TableCell>
                        <TableCell className="text-right">
                          {l.charge ? formatCurrency(l.charge, statement.currency) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-success">
                          {l.payment ? formatCurrency(l.payment, statement.currency) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(l.running_balance, statement.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

export default ReportsTab;

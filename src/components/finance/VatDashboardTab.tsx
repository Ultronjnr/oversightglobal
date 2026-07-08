import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Percent,
  Download,
  Pencil,
  RefreshCw,
  Filter,
  X,
  TrendingUp,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  listVatTransactions,
  summariseVat,
  updateTransactionVat,
  computeVatFromInclusive,
  isRecoverable,
  isOutstanding,
  type VatTransaction,
} from "@/services/vat.service";

export function VatDashboardTab() {
  const { role } = useAuth();
  const { currency: orgCurrency } = useCurrency();
  const fmt = (n: number, currency: string = orgCurrency) =>
    new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(n || 0);
  const isFinance = role === "FINANCE" || role === "ADMIN";
  const [rows, setRows] = useState<VatTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editing, setEditing] = useState<VatTransaction | null>(null);
  const [editRate, setEditRate] = useState("15");
  const [editInclusive, setEditInclusive] = useState("0");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await listVatTransactions();
    setLoading(false);
    if (res.success) setRows(res.data);
    else toast.error(res.error || "Failed to load VAT data");
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const startMs = startDate ? new Date(startDate).getTime() : -Infinity;
    const endMs = endDate ? new Date(endDate).getTime() + 86_400_000 - 1 : Infinity;
    return rows.filter((r) => {
      const t = new Date(r.invoiced_at || r.created_at).getTime();
      return t >= startMs && t <= endMs;
    });
  }, [rows, startDate, endDate]);

  const summary = useMemo(() => summariseVat(filtered), [filtered]);

  const openEdit = (r: VatTransaction) => {
    setEditing(r);
    setEditRate(String(r.vat_rate));
    setEditInclusive(String(r.inclusive_amount));
  };

  const preview = useMemo(
    () => computeVatFromInclusive(Number(editInclusive) || 0, Number(editRate) || 0),
    [editInclusive, editRate]
  );

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const res = await updateTransactionVat(editing.id, {
      vat_rate: Number(editRate) || 0,
      ...preview,
    });
    setSaving(false);
    if (res.success) {
      toast.success("VAT updated");
      setEditing(null);
      load();
    } else {
      toast.error(res.error || "Failed to update VAT");
    }
  };

  const exportSars = () => {
    try {
      const exportRows = filtered.map((r) => ({
        "Transaction ID": r.id.slice(0, 8).toUpperCase(),
        Supplier: r.supplier_name,
        "Supplier VAT No.": r.vat_number || "",
        Status: r.status,
        Recoverable: isRecoverable(r.status) ? "Yes" : isOutstanding(r.status) ? "Outstanding" : "No",
        Date: format(new Date(r.invoiced_at || r.created_at), "yyyy-MM-dd"),
        "VAT Rate %": r.vat_rate,
        "Amount Excl. VAT": Number(r.exclusive_amount.toFixed(2)),
        "VAT Amount": Number(r.vat_amount.toFixed(2)),
        "Amount Incl. VAT": Number(r.inclusive_amount.toFixed(2)),
        Currency: r.currency,
      }));
      const ws = XLSX.utils.json_to_sheet(exportRows);
      ws["!cols"] = [
        { wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 18 }, { wch: 12 },
        { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 8 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "VAT201 Detail");

      // Summary sheet (SARS VAT201-style input VAT summary)
      const summaryRows = [
        { Metric: "Total VAT Exclusive (Net)", Amount: Number(summary.totalExclusive.toFixed(2)) },
        { Metric: "Total Input VAT", Amount: Number(summary.totalVat.toFixed(2)) },
        { Metric: "Recoverable Input VAT", Amount: Number(summary.recoverableVat.toFixed(2)) },
        { Metric: "Outstanding Input VAT", Amount: Number(summary.outstandingVat.toFixed(2)) },
        { Metric: "Total VAT Inclusive (Gross)", Amount: Number(summary.totalInclusive.toFixed(2)) },
      ];
      const ws2 = XLSX.utils.json_to_sheet(summaryRows);
      ws2["!cols"] = [{ wch: 32 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws2, "VAT201 Summary");

      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(
        new Blob([out], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `sars-vat-report-${startDate || "all"}_to_${endDate || "all"}.xlsx`
      );
      toast.success(`Exported ${exportRows.length} row(s)`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to export VAT report");
    }
  };

  if (!isFinance) {
    return (
      <EmptyState
        icon={<Percent className="h-16 w-16" />}
        title="Finance access only"
        description="The VAT dashboard is available to Finance Managers and Admins."
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Recoverable VAT"
          value={fmt(summary.recoverableVat)}
          valueColor="success"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          label="Outstanding VAT"
          value={fmt(summary.outstandingVat)}
          valueColor="warning"
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard label="Total Input VAT" value={fmt(summary.totalVat)} valueColor="primary" />
        <StatCard label="Net (Excl. VAT)" value={fmt(summary.totalExclusive)} valueColor="default" />
      </div>

      {/* Filters + export */}
      <div className="flex flex-col lg:flex-row lg:items-end gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
        <div className="grid grid-cols-2 gap-2 flex-1 max-w-md">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Filter className="h-3 w-3" /> Start Date
            </label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">End Date</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(startDate || endDate) && (
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => { setStartDate(""); setEndDate(""); }}>
              <X className="h-4 w-4" /> Clear
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-2" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button size="sm" className="gap-2" onClick={exportSars} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" /> SARS Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* VAT by month */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">VAT by Month</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.byMonth.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={summary.byMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="recoverable" name="Recoverable" stackId="v" fill="hsl(var(--success))" />
                  <Bar dataKey="outstanding" name="Outstanding" stackId="v" fill="hsl(var(--warning))" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* VAT by supplier */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">VAT by Supplier</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[300px] overflow-auto">
            {summary.bySupplier.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8 text-center">No data</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">VAT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.bySupplier.map((s) => (
                    <TableRow key={s.key}>
                      <TableCell className="max-w-[160px] truncate">{s.label}</TableCell>
                      <TableCell className="text-right">{fmt(s.exclusive)}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(s.vat)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transactions table with manual VAT edit */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Transactions ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          {filtered.length === 0 ? (
            <EmptyState icon={<Percent className="h-12 w-12" />} title="No transactions" description="No transactions match the selected dates." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>VAT No.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Excl.</TableHead>
                  <TableHead className="text-right">VAT</TableHead>
                  <TableHead className="text-right">Incl.</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-[160px] truncate">{r.supplier_name}</TableCell>
                    <TableCell className="text-xs">{r.vat_number || <span className="text-destructive">missing</span>}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          isRecoverable(r.status)
                            ? "bg-success/10 text-success border-success/30"
                            : isOutstanding(r.status)
                            ? "bg-warning/10 text-warning border-warning/30"
                            : "text-muted-foreground"
                        }
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.vat_rate}%{r.vat_manual && <span title="Manually edited" className="ml-1 text-primary">•</span>}
                    </TableCell>
                    <TableCell className="text-right">{fmt(r.exclusive_amount, r.currency)}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(r.vat_amount, r.currency)}</TableCell>
                    <TableCell className="text-right">{fmt(r.inclusive_amount, r.currency)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(r)} title="Edit VAT">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Manual VAT edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Edit VAT — {editing?.supplier_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">VAT Rate %</Label>
                <Input type="number" step="0.01" value={editRate} onChange={(e) => setEditRate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Inclusive (Gross)</Label>
                <Input type="number" step="0.01" value={editInclusive} onChange={(e) => setEditInclusive(e.target.value)} />
              </div>
            </div>
            <div className="rounded-md border p-3 text-sm space-y-1 bg-muted/30">
              <div className="flex justify-between"><span className="text-muted-foreground">Exclusive (Net)</span><span className="font-medium">{fmt(preview.exclusive_amount, editing?.currency)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">VAT Amount</span><span className="font-medium">{fmt(preview.vat_amount, editing?.currency)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Inclusive (Gross)</span><span className="font-medium">{fmt(preview.inclusive_amount, editing?.currency)}</span></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save VAT
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

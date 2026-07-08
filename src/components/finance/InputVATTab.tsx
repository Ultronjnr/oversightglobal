import { useEffect, useMemo, useState } from "react";
import { Loader2, Percent, Download, FileArchive, Filter, X } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { getInvoiceDocumentUrl } from "@/services/invoice.service";

type VATStatus =
  | "CLAIMABLE"
  | "MISSING_DOCS"
  | "INVALID_INVOICE"
  | "PENDING_VERIFICATION";

interface VATRow {
  id: string;
  prId: string;
  transactionId: string;
  invoiceNumber: string;
  supplier: string;
  vatNumber: string;
  inclusive: number;
  exclusive: number;
  vatAmount: number;
  date: string;
  currency: string;
  documentUrl: string | null;
  status: VATStatus;
}

const statusMeta: Record<VATStatus, { label: string; className: string }> = {
  CLAIMABLE: {
    label: "Claimable",
    className: "bg-success/10 text-success border-success/30",
  },
  MISSING_DOCS: {
    label: "Missing Documentation",
    className: "bg-destructive/10 text-destructive border-destructive/30",
  },
  INVALID_INVOICE: {
    label: "Invalid Tax Invoice",
    className: "bg-warning/10 text-warning border-warning/30",
  },
  PENDING_VERIFICATION: {
    label: "Pending Verification",
    className: "bg-muted text-muted-foreground border-muted-foreground/20",
  },
};

const VAT_RATE = 0.15;

/**
 * SARS-compliant VAT split for a VAT-inclusive gross amount.
 * exclusive = gross / 1.15
 * vat       = gross - exclusive
 * effective rate (vat / exclusive) is always exactly 15%.
 */
function splitInclusive(gross: number) {
  const exclusive = gross / (1 + VAT_RATE);
  const vat = gross - exclusive;
  return { exclusive, vat };
}

function deriveStatus(inv: any): VATStatus {
  const hasVat =
    inv.supplier?.vat_number &&
    String(inv.supplier.vat_number).trim() !== "";
  const hasDoc = !!inv.document_url;
  if (!hasVat) return "INVALID_INVOICE";
  if (!hasDoc) return "MISSING_DOCS";
  if (inv.status === "UPLOADED") return "PENDING_VERIFICATION";
  return "CLAIMABLE";
}

export function InputVATTab() {
  const { role } = useAuth();
  const { currency: orgCurrency } = useCurrency();
  const formatCurrency = (amount: number, currency: string = orgCurrency) =>
    new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(amount);
  const [rows, setRows] = useState<VATRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<VATStatus | "ALL">("ALL");
  const [exporting, setExporting] = useState<"none" | "xlsx" | "zip">("none");

  const isFinance = role === "FINANCE" || role === "ADMIN";

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("invoices")
          .select(
            "id, pr_id, status, document_url, created_at, updated_at, supplier:suppliers(company_name, vat_number), pr:purchase_requisitions(transaction_id, currency), quote:quotes(amount)"
          )
          .order("updated_at", { ascending: false });
        if (error) throw error;

        const mapped: VATRow[] = (data || []).map((inv: any) => {
          const gross = Number(inv.quote?.amount || 0);
          const { exclusive, vat } = splitInclusive(gross);
          const status = deriveStatus(inv);
          return {
            id: inv.id,
            prId: inv.pr_id,
            transactionId: inv.pr?.transaction_id || "-",
            invoiceNumber: String(inv.id).slice(0, 8).toUpperCase(),
            supplier: inv.supplier?.company_name || "-",
            vatNumber: inv.supplier?.vat_number || "",
            inclusive: gross,
            exclusive: status === "CLAIMABLE" ? exclusive : 0,
            vatAmount: status === "CLAIMABLE" ? vat : 0,
            date: inv.updated_at || inv.created_at,
            currency: inv.pr?.currency || "ZAR",
            documentUrl: inv.document_url || null,
            status,
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

  const filteredRows = useMemo(() => {
    const startMs = startDate ? new Date(startDate).getTime() : -Infinity;
    const endMs = endDate
      ? new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1
      : Infinity;
    return rows.filter((r) => {
      const t = r.date ? new Date(r.date).getTime() : 0;
      if (t < startMs || t > endMs) return false;
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      return true;
    });
  }, [rows, startDate, endDate, statusFilter]);

  const totalInclusive = filteredRows.reduce((s, r) => s + r.inclusive, 0);
  const totalExclusive = filteredRows.reduce((s, r) => s + r.exclusive, 0);
  const totalVAT = filteredRows.reduce((s, r) => s + r.vatAmount, 0);
  const vatPercent =
    totalExclusive > 0
      ? Math.round((totalVAT / totalExclusive) * 100 * 100) / 100
      : 0;

  const datePart = () =>
    `${startDate || "all"}_to_${endDate || "all"}`;

  const handleExportExcel = () => {
    try {
      setExporting("xlsx");
      const exportRows = filteredRows.map((r) => ({
        "Transaction ID": r.transactionId,
        Supplier: r.supplier,
        "VAT Number": r.vatNumber,
        "Invoice Number": r.invoiceNumber,
        "Status": statusMeta[r.status].label,
        "Transaction Amount (Incl.)": Number(r.inclusive.toFixed(2)),
        "Net (Excl.)": Number(r.exclusive.toFixed(2)),
        "VAT Amount": Number(r.vatAmount.toFixed(2)),
        Currency: r.currency,
        Date: r.date ? format(new Date(r.date), "yyyy-MM-dd") : "",
      }));
      const ws = XLSX.utils.json_to_sheet(exportRows);
      ws["!cols"] = [
        { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 22 },
        { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 12 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "VAT Claimable");
      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(
        new Blob([out], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `vat-claimable-${datePart()}.xlsx`,
      );
      toast.success(`Exported ${exportRows.length} row(s) to Excel`);
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to export Excel");
    } finally {
      setExporting("none");
    }
  };

  const handleExportZip = async () => {
    try {
      setExporting("zip");
      const docRows = filteredRows.filter((r) => r.documentUrl);
      if (docRows.length === 0) {
        toast.warning("No invoice documents in current selection");
        setExporting("none");
        return;
      }
      const zip = new JSZip();
      let fetched = 0;
      let skipped = 0;
      for (const r of docRows) {
        try {
          const res = await getInvoiceDocumentUrl(r.documentUrl!);
          if (!res.success || !res.url) {
            skipped += 1;
            continue;
          }
          const fileRes = await fetch(res.url);
          if (!fileRes.ok) {
            skipped += 1;
            continue;
          }
          const blob = await fileRes.blob();
          const ext =
            r.documentUrl!.split(".").pop() ||
            "pdf";
          const safeSupplier = r.supplier.replace(/[^\w-]+/g, "_").slice(0, 40);
          zip.file(`${r.transactionId}_${safeSupplier}.${ext}`, blob);
          fetched += 1;
        } catch (e) {
          skipped += 1;
          console.warn("ZIP fetch failed for", r.id, e);
        }
      }
      if (fetched === 0) {
        toast.error("Could not download any invoice files");
        setExporting("none");
        return;
      }
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `vat-invoices-${datePart()}.zip`);
      toast.success(`Downloaded ${fetched} invoice(s)${skipped ? `, skipped ${skipped} unavailable file(s)` : ""}`);
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to build ZIP");
    } finally {
      setExporting("none");
    }
  };

  if (!isFinance) {
    return (
      <EmptyState
        icon={<Percent className="h-16 w-16" />}
        title="Finance access only"
        description="VAT input claim management is available to Finance Managers."
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="VAT Inclusive Total"
          value={formatCurrency(totalInclusive)}
          valueColor="default"
        />
        <StatCard
          label="VAT Exclusive (Net)"
          value={formatCurrency(totalExclusive)}
          valueColor="primary"
        />
        <StatCard
          label="Total VAT Claimable"
          value={formatCurrency(totalVAT)}
          valueColor="success"
        />
        <StatCard
          label="VAT Percentage"
          value={`${vatPercent.toFixed(2)}%`}
          valueColor="success"
          icon={<Percent className="h-5 w-5" />}
        />
      </div>

      {/* Filters & export bar */}
      <div className="flex flex-col lg:flex-row lg:items-end gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 flex-1">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Filter className="h-3 w-3" /> Start Date
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">End Date</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="CLAIMABLE">Claimable</SelectItem>
                <SelectItem value="MISSING_DOCS">Missing Documentation</SelectItem>
                <SelectItem value="INVALID_INVOICE">Invalid Tax Invoice</SelectItem>
                <SelectItem value="PENDING_VERIFICATION">Pending Verification</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(startDate || endDate || statusFilter !== "ALL") && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setStatusFilter("ALL");
              }}
            >
              <X className="h-4 w-4" /> Clear
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleExportExcel}
            disabled={exporting !== "none" || filteredRows.length === 0}
          >
            {exporting === "xlsx" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export Excel
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={handleExportZip}
            disabled={exporting !== "none" || filteredRows.length === 0}
          >
            {exporting === "zip" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileArchive className="h-4 w-4" />
            )}
            Download Invoices (ZIP)
          </Button>
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <EmptyState
          icon={<Percent className="h-16 w-16" />}
          title="No tax invoices"
          description="No invoices match your current filters."
        />
      ) : (
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Transaction ID</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Inclusive</TableHead>
                <TableHead className="text-right">Exclusive</TableHead>
                <TableHead className="text-right">VAT (15%)</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/20">
                  <TableCell className="font-mono text-sm font-medium">{r.transactionId}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {r.invoiceNumber}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{r.supplier}</p>
                      <p className="text-xs text-muted-foreground">
                        VAT: {r.vatNumber || "—"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusMeta[r.status].className}>
                      {statusMeta[r.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(r.inclusive, r.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(r.exclusive, r.currency)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-success">
                    {formatCurrency(r.vatAmount, r.currency)}
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
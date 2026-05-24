import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

/**
 * Friendly status labels for the public-facing batch lifecycle.
 * Internal DB statuses map to user-friendly labels.
 */
export function batchStatusLabel(status: string | null | undefined): string {
  switch ((status || "").toUpperCase()) {
    case "DRAFT":
      return "Pending";
    case "CONFIRMED":
      return "Processing";
    case "PAID":
      return "Paid";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status || "—";
  }
}

export interface BatchExportAllocation {
  supplier: string;
  contact?: string | null;
  transaction_ref: string;
  amount_paid: number;
  total_amount: number;
  type: "Full" | "Partial";
  currency?: string;
}

export interface BatchExportData {
  batch_number: string;
  created_at: string;
  status: string;
  payment_reference: string | null;
  paid_at: string | null;
  notes: string | null;
  currency: string;
  total_amount: number;
  allocations: BatchExportAllocation[];
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportBatchToExcel(batch: BatchExportData) {
  const summary: Record<string, unknown>[] = [
    { Field: "Batch Number", Value: batch.batch_number },
    { Field: "Status", Value: batchStatusLabel(batch.status) },
    {
      Field: "Created",
      Value: format(new Date(batch.created_at), "yyyy-MM-dd HH:mm"),
    },
    {
      Field: "Paid At",
      Value: batch.paid_at
        ? format(new Date(batch.paid_at), "yyyy-MM-dd HH:mm")
        : "—",
    },
    { Field: "Payment Reference", Value: batch.payment_reference || "—" },
    {
      Field: "Total Amount",
      Value: formatCurrency(batch.total_amount, batch.currency),
    },
    { Field: "# Transactions", Value: batch.allocations.length },
    { Field: "Notes", Value: batch.notes || "—" },
  ];

  const rows = batch.allocations.map((a, i) => ({
    "#": i + 1,
    Supplier: a.supplier,
    Contact: a.contact || "",
    "Transaction Ref": a.transaction_ref,
    "Amount Paid": Number(a.amount_paid).toFixed(2),
    "Total Amount": Number(a.total_amount).toFixed(2),
    Type: a.type,
    Currency: a.currency || batch.currency,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(summary, { skipHeader: false }),
    "Summary",
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Allocations");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(
    new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `payment-batch-${batch.batch_number}.xlsx`,
  );
}

export function exportBatchToPdf(batch: BatchExportData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  let y = margin;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Payment Batch Report", margin, y);
  y += 22;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Batch: ${batch.batch_number}`, margin, y);
  y += 16;
  doc.text(`Status: ${batchStatusLabel(batch.status)}`, margin, y);
  y += 16;
  doc.text(
    `Created: ${format(new Date(batch.created_at), "yyyy-MM-dd HH:mm")}`,
    margin,
    y,
  );
  y += 16;
  if (batch.paid_at) {
    doc.text(
      `Paid: ${format(new Date(batch.paid_at), "yyyy-MM-dd HH:mm")}`,
      margin,
      y,
    );
    y += 16;
  }
  if (batch.payment_reference) {
    doc.text(`Reference: ${batch.payment_reference}`, margin, y);
    y += 16;
  }
  doc.setFont("helvetica", "bold");
  doc.text(
    `Total: ${formatCurrency(batch.total_amount, batch.currency)}  (${batch.allocations.length} transaction${batch.allocations.length === 1 ? "" : "s"})`,
    margin,
    y,
  );
  y += 10;

  autoTable(doc, {
    startY: y + 8,
    head: [["#", "Supplier", "Transaction Ref", "Type", "Amount Paid", "Total"]],
    body: batch.allocations.map((a, i) => [
      String(i + 1),
      a.supplier,
      a.transaction_ref,
      a.type,
      formatCurrency(Number(a.amount_paid), a.currency || batch.currency),
      formatCurrency(Number(a.total_amount), a.currency || batch.currency),
    ]),
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 252] },
    margin: { left: margin, right: margin },
  });

  if (batch.notes) {
    const finalY = (doc as any).lastAutoTable?.finalY ?? y + 80;
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text(`Notes: ${batch.notes}`, margin, finalY + 24, {
      maxWidth: doc.internal.pageSize.getWidth() - margin * 2,
    });
  }

  doc.save(`payment-batch-${batch.batch_number}.pdf`);
}
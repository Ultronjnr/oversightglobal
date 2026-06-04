import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import logoUrl from "@/assets/ovasyt-logo.png";

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
  // Netcash-style creditor fields
  invoice_ref?: string | null;
  supplier_account?: string | null;
  branch_code?: string | null;
  account_type?: string | null;
  statement_ref?: string | null;
  pr_number?: string | null;
  vat_registered?: boolean;
  payment_status?: string;
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
  // Header / audit metadata (optional — fall back gracefully)
  batch_name?: string | null;
  service_type?: string | null;
  created_by_name?: string | null;
  organization_name?: string | null;
  export_id?: string | null;
  system_user?: string | null;
  netcash_status?: string | null;
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

/** VAT helpers — amounts are treated as VAT-inclusive at 15% for VAT-registered suppliers. */
const VAT_RATE = 0.15;
function vatPortion(amount: number, vatRegistered: boolean | undefined): number {
  if (!vatRegistered) return 0;
  return amount - amount / (1 + VAT_RATE);
}
function vatClassification(vatRegistered: boolean | undefined): string {
  return vatRegistered ? "Standard (15%)" : "Zero (0%)";
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(logoUrl);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
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

const BRAND: [number, number, number] = [79, 70, 229]; // indigo
const INK: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [100, 116, 139];

/**
 * Netcash-style creditor payment batch report.
 * Returns the generated PDF as a Blob (also triggers a download by default).
 */
export async function exportBatchToPdf(
  batch: BatchExportData,
  options: { download?: boolean } = { download: true },
): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentW = pageW - margin * 2;
  const currency = batch.currency || "ZAR";
  const logo = await loadLogoDataUrl();
  const generatedAt = new Date();

  // ---------- totals ----------
  let vatTotal = 0;
  batch.allocations.forEach((a) => {
    vatTotal += vatPortion(Number(a.amount_paid || 0), a.vat_registered);
  });
  const grossTotal = batch.allocations.reduce((s, a) => s + Number(a.amount_paid || 0), 0);
  const netTotal = grossTotal - vatTotal;

  // ---------- SECTION 1: HEADER ----------
  let y = margin;
  if (logo) {
    try {
      doc.addImage(logo, "PNG", margin, y, 110, 36, undefined, "FAST");
    } catch {
      /* ignore logo failures */
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text("Payment Batch Report", pageW - margin, y + 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(batch.organization_name || "OVASYT", pageW - margin, y + 30, { align: "right" });
  doc.text("Creditor Batch • Netcash Format", pageW - margin, y + 42, { align: "right" });

  y += 58;
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(1.2);
  doc.line(margin, y, pageW - margin, y);
  y += 14;

  const headerRows: [string, string][] = [
    ["Batch Number", batch.batch_number],
    ["Batch Name", batch.batch_name || batch.notes || "—"],
    ["Batch Status", batchStatusLabel(batch.status)],
    ["Service Type", batch.service_type || "Creditor Payments"],
    ["Created By", batch.created_by_name || "—"],
    ["Created Date", format(new Date(batch.created_at), "dd MMM yyyy HH:mm")],
    ["Action Date", batch.paid_at ? format(new Date(batch.paid_at), "dd MMM yyyy") : "Pending"],
    ["Total Transactions", String(batch.allocations.length)],
    ["Batch Total", formatCurrency(grossTotal, currency)],
  ];

  doc.setFontSize(9);
  const colW = contentW / 3;
  const rowH = 26;
  headerRows.forEach((row, i) => {
    const col = i % 3;
    const r = Math.floor(i / 3);
    const x = margin + col * colW;
    const ry = y + r * rowH;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(row[0].toUpperCase(), x, ry + 8, { charSpace: 0.3 });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...INK);
    doc.text(String(row[1]), x, ry + 20, { maxWidth: colW - 8 });
  });
  y += Math.ceil(headerRows.length / 3) * rowH + 8;

  // ---------- SECTION 2: PAYMENT DETAILS TABLE ----------
  autoTable(doc, {
    startY: y,
    head: [[
      "Invoice Ref",
      "Supplier",
      "Account No.",
      "Branch",
      "Acc. Type",
      "Statement Ref",
      "PR Number",
      "VAT Class",
      "Amount",
      "Status",
    ]],
    body: batch.allocations.map((a) => [
      a.invoice_ref || a.transaction_ref || "—",
      a.supplier,
      a.supplier_account || "—",
      a.branch_code || "—",
      a.account_type || "—",
      a.statement_ref || a.transaction_ref || "—",
      a.pr_number || a.transaction_ref || "—",
      vatClassification(a.vat_registered),
      formatCurrency(Number(a.amount_paid), a.currency || currency),
      a.payment_status || batchStatusLabel(batch.status),
    ]),
    styles: { fontSize: 7.5, cellPadding: 4, textColor: INK as any, lineColor: [226, 232, 240], lineWidth: 0.5 },
    headStyles: { fillColor: BRAND as any, textColor: 255, fontSize: 7.5, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 252] },
    columnStyles: { 8: { halign: "right" } },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable?.finalY ?? y + 80;

  // ---------- SECTION 3: BATCH TOTALS ----------
  y += 18;
  if (y > pageH - 220) { doc.addPage(); y = margin; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text("Batch Totals", margin, y);
  y += 8;
  const totalsRows = [
    ["Total Transactions", String(batch.allocations.length)],
    ["Total Amount", formatCurrency(grossTotal, currency)],
    ["VAT Total", formatCurrency(vatTotal, currency)],
    ["Net Total", formatCurrency(netTotal, currency)],
  ];
  autoTable(doc, {
    startY: y,
    body: totalsRows,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: "bold", textColor: MUTED as any, cellWidth: 160 },
      1: { halign: "right", fontStyle: "bold", textColor: INK as any },
    },
    margin: { left: pageW - margin - 280, right: margin },
  });
  y = (doc as any).lastAutoTable?.finalY ?? y + 80;

  // ---------- SECTION 4: APPROVALS ----------
  y += 24;
  if (y > pageH - 160) { doc.addPage(); y = margin; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text("Approvals", margin, y);
  y += 24;
  const sigW = (contentW - 40) / 3;
  ["Finance Officer", "Finance Manager", "Authoriser"].forEach((role, i) => {
    const x = margin + i * (sigW + 20);
    doc.setDrawColor(...MUTED);
    doc.setLineWidth(0.6);
    doc.line(x, y + 36, x + sigW, y + 36);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(role, x, y + 50);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Name & Signature", x, y + 62);
    doc.text("Date: ____________________", x, y + 76);
  });
  y += 92;

  // ---------- SECTION 5: AUDIT TRAIL ----------
  if (y > pageH - 130) { doc.addPage(); y = margin; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text("Audit Trail", margin, y);
  y += 8;
  const auditRows = [
    ["Batch ID", batch.batch_number],
    ["Export ID", batch.export_id || "—"],
    ["Generated Timestamp", format(generatedAt, "dd MMM yyyy HH:mm:ss")],
    ["System User", batch.system_user || batch.created_by_name || "—"],
    ["Netcash Export Status", batch.netcash_status || "Ready for Netcash Import"],
  ];
  autoTable(doc, {
    startY: y,
    body: auditRows,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 4, lineColor: [226, 232, 240], lineWidth: 0.5 },
    columnStyles: {
      0: { fontStyle: "bold", textColor: MUTED as any, cellWidth: 160 },
      1: { textColor: INK as any },
    },
    margin: { left: margin, right: margin },
  });

  // ---------- FOOTER + PAGE NUMBERS ----------
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(...[226, 232, 240]);
    doc.setLineWidth(0.5);
    doc.line(margin, pageH - 34, pageW - margin, pageH - 34);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      batch.organization_name || "OVASYT",
      margin,
      pageH - 22,
    );
    doc.text(
      `Export ID: ${batch.export_id || "—"}`,
      pageW / 2,
      pageH - 22,
      { align: "center" },
    );
    doc.text(`Page ${p} of ${pageCount}`, pageW - margin, pageH - 22, { align: "right" });
  }

  const blob = doc.output("blob");
  if (options.download !== false) {
    triggerDownload(blob, `payment-batch-${batch.batch_number}.pdf`);
  }
  return blob;
}
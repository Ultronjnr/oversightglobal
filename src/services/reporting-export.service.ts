import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import logoUrl from "@/assets/ovasyt-logo.png";
import {
  AGING_BUCKETS,
  type PayablesReport,
  type SupplierStatement,
} from "@/services/reporting.service";

const BRAND: [number, number, number] = [79, 70, 229];
const INK: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [100, 116, 139];

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

async function drawHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  orgName: string,
): Promise<number> {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  const logo = await loadLogoDataUrl();
  let y = margin;
  if (logo) {
    try {
      doc.addImage(logo, "PNG", margin, y, 110, 36, undefined, "FAST");
    } catch {
      /* ignore */
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text(title, pageW - margin, y + 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(orgName, pageW - margin, y + 30, { align: "right" });
  doc.text(subtitle, pageW - margin, y + 42, { align: "right" });
  y += 58;
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(1.2);
  doc.line(margin, y, pageW - margin, y);
  return y + 16;
}

function drawFooter(doc: jsPDF, label: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, pageH - 34, pageW - margin, pageH - 34);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(label, margin, pageH - 22);
    doc.text(
      `Generated ${format(new Date(), "dd MMM yyyy HH:mm")}`,
      pageW / 2,
      pageH - 22,
      { align: "center" },
    );
    doc.text(`Page ${p} of ${pages}`, pageW - margin, pageH - 22, { align: "right" });
  }
}

/* ---------------- Supplier statement ---------------- */

export async function exportStatementToPdf(
  st: SupplierStatement,
  orgName = "OVASYT",
): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  const pageW = doc.internal.pageSize.getWidth();
  const period =
    st.period_start && st.period_end
      ? `${format(new Date(st.period_start), "dd MMM yyyy")} – ${format(new Date(st.period_end), "dd MMM yyyy")}`
      : "All activity to date";

  let y = await drawHeader(doc, "Statement of Account", period, orgName);

  const info: [string, string][] = [
    ["Supplier", st.supplier_name],
    ["Email", st.contact_email || "—"],
    ["Phone", st.contact_phone || "—"],
    ["VAT Number", st.vat_number || "—"],
    ["Opening Balance", formatCurrency(st.opening_balance, st.currency)],
    ["Closing Balance", formatCurrency(st.closing_balance, st.currency)],
  ];
  const colW = (pageW - margin * 2) / 3;
  doc.setFontSize(9);
  info.forEach((row, i) => {
    const x = margin + (i % 3) * colW;
    const ry = y + Math.floor(i / 3) * 26;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(row[0].toUpperCase(), x, ry + 8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...INK);
    doc.text(String(row[1]), x, ry + 20, { maxWidth: colW - 8 });
  });
  y += Math.ceil(info.length / 3) * 26 + 10;

  autoTable(doc, {
    startY: y,
    head: [["Date", "Reference", "Description", "Charge", "Payment", "Balance"]],
    body: st.lines.map((l) => [
      format(new Date(l.date), "dd MMM yyyy"),
      l.reference,
      l.description,
      l.charge ? formatCurrency(l.charge, st.currency) : "—",
      l.payment ? formatCurrency(l.payment, st.currency) : "—",
      formatCurrency(l.running_balance, st.currency),
    ]),
    styles: { fontSize: 8, cellPadding: 4, textColor: INK as any, lineColor: [226, 232, 240], lineWidth: 0.5 },
    headStyles: { fillColor: BRAND as any, textColor: 255, fontSize: 8, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 252] },
    columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable?.finalY ?? y + 60;

  autoTable(doc, {
    startY: y + 14,
    body: [
      ["Total Charges", formatCurrency(st.total_charges, st.currency)],
      ["Total Payments", formatCurrency(st.total_payments, st.currency)],
      ["Balance Due", formatCurrency(st.closing_balance, st.currency)],
    ],
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: "bold", textColor: MUTED as any, cellWidth: 160 },
      1: { halign: "right", fontStyle: "bold", textColor: INK as any },
    },
    margin: { left: pageW - margin - 300, right: margin },
  });

  drawFooter(doc, `${orgName} · Statement · ${st.supplier_name}`);
  triggerDownload(
    doc.output("blob"),
    `statement-${st.supplier_name.replace(/\s+/g, "-").toLowerCase()}.pdf`,
  );
}

export function exportStatementToExcel(st: SupplierStatement) {
  const summary = [
    { Field: "Supplier", Value: st.supplier_name },
    { Field: "Email", Value: st.contact_email || "—" },
    { Field: "VAT Number", Value: st.vat_number || "—" },
    { Field: "Opening Balance", Value: st.opening_balance.toFixed(2) },
    { Field: "Total Charges", Value: st.total_charges.toFixed(2) },
    { Field: "Total Payments", Value: st.total_payments.toFixed(2) },
    { Field: "Closing Balance", Value: st.closing_balance.toFixed(2) },
  ];
  const rows = st.lines.map((l) => ({
    Date: format(new Date(l.date), "yyyy-MM-dd"),
    Reference: l.reference,
    Description: l.description,
    Charge: l.charge.toFixed(2),
    Payment: l.payment.toFixed(2),
    Balance: l.running_balance.toFixed(2),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Summary");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Statement");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(
    new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `statement-${st.supplier_name.replace(/\s+/g, "-").toLowerCase()}.xlsx`,
  );
}

/* ---------------- Outstanding payables ---------------- */

export async function exportPayablesToPdf(
  rep: PayablesReport,
  orgName = "OVASYT",
): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const margin = 40;
  const pageW = doc.internal.pageSize.getWidth();
  let y = await drawHeader(
    doc,
    "Outstanding Payables",
    `As at ${format(new Date(rep.as_at), "dd MMM yyyy")}`,
    orgName,
  );

  autoTable(doc, {
    startY: y,
    head: [AGING_BUCKETS.map((b) => b.label).concat("Total")],
    body: [
      AGING_BUCKETS.map((b) => formatCurrency(rep.bucket_totals[b.key], rep.currency)).concat(
        formatCurrency(rep.total_outstanding, rep.currency),
      ),
    ],
    styles: { fontSize: 8.5, cellPadding: 5, halign: "right", textColor: INK as any },
    headStyles: { fillColor: BRAND as any, textColor: 255, halign: "right", fontStyle: "bold" },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable?.finalY ?? y + 60;

  autoTable(doc, {
    startY: y + 16,
    head: [[
      "Reference",
      "Supplier",
      "Project",
      "Due Date",
      "Days",
      "Bucket",
      "Amount",
      "Paid",
      "Outstanding",
    ]],
    body: rep.rows.map((r) => [
      r.reference,
      r.supplier_name,
      r.project_name || "—",
      r.due_date ? format(new Date(r.due_date), "dd MMM yyyy") : "—",
      String(r.days_outstanding),
      AGING_BUCKETS.find((b) => b.key === r.bucket)?.label ?? r.bucket,
      formatCurrency(r.amount, r.currency),
      formatCurrency(r.amount_paid, r.currency),
      formatCurrency(r.outstanding, r.currency),
    ]),
    styles: { fontSize: 7.5, cellPadding: 4, textColor: INK as any, lineColor: [226, 232, 240], lineWidth: 0.5 },
    headStyles: { fillColor: BRAND as any, textColor: 255, fontSize: 7.5, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 252] },
    columnStyles: { 6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" } },
    margin: { left: margin, right: margin },
  });

  drawFooter(doc, `${orgName} · Outstanding Payables`);
  triggerDownload(doc.output("blob"), `outstanding-payables-${format(new Date(rep.as_at), "yyyy-MM-dd")}.pdf`);
}

export function exportPayablesToExcel(rep: PayablesReport) {
  const aging = AGING_BUCKETS.map((b) => ({
    Bucket: b.label,
    Outstanding: rep.bucket_totals[b.key].toFixed(2),
  }));
  aging.push({ Bucket: "Total", Outstanding: rep.total_outstanding.toFixed(2) });

  const rows = rep.rows.map((r) => ({
    Reference: r.reference,
    Supplier: r.supplier_name,
    Project: r.project_name || "",
    "Due Date": r.due_date ? format(new Date(r.due_date), "yyyy-MM-dd") : "",
    "Days Outstanding": r.days_outstanding,
    Bucket: AGING_BUCKETS.find((b) => b.key === r.bucket)?.label ?? r.bucket,
    Amount: r.amount.toFixed(2),
    Paid: r.amount_paid.toFixed(2),
    Outstanding: r.outstanding.toFixed(2),
    Status: r.status,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(aging), "Aging Summary");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Payables");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      rep.supplier_totals.map((s) => ({
        Supplier: s.supplier_name,
        Outstanding: s.outstanding.toFixed(2),
      })),
    ),
    "By Supplier",
  );
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(
    new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `outstanding-payables-${format(new Date(rep.as_at), "yyyy-MM-dd")}.xlsx`,
  );
}

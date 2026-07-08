import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, type CurrencyCode } from "@/lib/utils";
import {
  getReportBundle,
  getOrgProfile,
  getDashboard,
  type ReportBundle,
} from "@/services/donation.service";

export type ReportKind = "donor" | "yearly" | "impact" | "transparency";

const REPORT_TITLES: Record<ReportKind, string> = {
  donor: "Donor Contribution Report",
  yearly: "Annual Donation Report",
  impact: "Impact Report",
  transparency: "Fund Transparency Report",
};

function money(n: number, c: CurrencyCode) {
  return formatCurrency(n, c);
}

export async function generateReportPdf(
  kind: ReportKind,
  currency: CurrencyCode,
  year?: string
): Promise<void> {
  const [bundle, profile] = await Promise.all([
    getReportBundle(kind === "yearly" || kind === "transparency" ? year : undefined),
    getOrgProfile(),
  ]);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 48;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(profile?.legal_name || "Organization", 40, y);
  y += 20;
  doc.setFontSize(13);
  doc.setTextColor(60);
  doc.text(REPORT_TITLES[kind] + (year ? ` — ${year}` : ""), 40, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  const meta: string[] = [];
  if (profile?.npo_number) meta.push(`NPO: ${profile.npo_number}`);
  if (profile?.pbo_number) meta.push(`PBO: ${profile.pbo_number}`);
  meta.push(`Generated: ${new Date().toLocaleDateString()}`);
  doc.text(meta.join("    "), 40, y);
  y += 20;
  doc.setTextColor(0);

  const t = bundle.totals;

  // Summary band
  doc.setFillColor(243, 244, 246);
  doc.rect(40, y, pageW - 80, 54, "F");
  doc.setFontSize(9);
  doc.setTextColor(100);
  const cols = [
    ["Total Donated", money(t.donated, currency)],
    ["Allocated", money(t.allocated, currency)],
    ["Spent", money(t.spent, currency)],
    ["Remaining", money(t.remaining, currency)],
  ];
  const cw = (pageW - 80) / cols.length;
  cols.forEach((c, i) => {
    const cx = 40 + i * cw + 12;
    doc.setTextColor(110);
    doc.setFont("helvetica", "normal");
    doc.text(c[0], cx, y + 20);
    doc.setTextColor(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(c[1], cx, y + 40);
    doc.setFontSize(9);
  });
  y += 74;
  doc.setTextColor(0);

  const addTable = (head: string[], body: any[][]) => {
    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      theme: "striped",
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 9, cellPadding: 5 },
      margin: { left: 40, right: 40 },
    });
    // @ts-ignore
    y = (doc.lastAutoTable?.finalY ?? y) + 24;
  };

  if (kind === "donor" || kind === "transparency" || kind === "yearly") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("By Donor", 40, y);
    y += 10;
    addTable(
      ["Donor", "Donated", "Allocated", "Spent", "Remaining"],
      bundle.donorRows.map((r) => [
        r.donor_name,
        money(r.donated, currency),
        money(r.allocated, currency),
        money(r.spent, currency),
        money(r.remaining, currency),
      ])
    );
  }

  if (kind === "impact" || kind === "transparency") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("By Project", 40, y);
    y += 10;
    addTable(
      ["Project", "Allocated", "Spent"],
      bundle.byProject.map((p) => [
        p.project,
        money(p.allocated, currency),
        money(p.spent, currency),
      ])
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Spending by Expense Category", 40, y);
    y += 10;
    addTable(
      ["Expense Category", "Amount"],
      bundle.byCategory.map((c) => [c.category, money(c.amount, currency)])
    );
  }

  if (kind === "yearly") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Year Breakdown", 40, y);
    y += 10;
    addTable(
      ["Year", "Donated", "Spent"],
      bundle.byYear.map((r) => [r.year, money(r.donated, currency), money(r.spent, currency)])
    );
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `${profile?.legal_name || "Organization"} — ${REPORT_TITLES[kind]} — Page ${i} of ${pageCount}`,
      40,
      doc.internal.pageSize.getHeight() - 24
    );
  }

  const fname = `${REPORT_TITLES[kind].replace(/\s+/g, "-")}${year ? "-" + year : ""}.pdf`;
  doc.save(fname);
}

export async function generateDashboardPdf(currency: CurrencyCode): Promise<void> {
  const [d, profile] = await Promise.all([getDashboard(), getOrgProfile()]);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 48;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(profile?.legal_name || "Organization", 40, y);
  y += 20;
  doc.setFontSize(13);
  doc.setTextColor(60);
  doc.text("Donor Fund Dashboard", 40, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 40, y);
  y += 24;
  doc.setTextColor(0);

  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value"]],
    body: [
      ["Total Donated", money(d.totalDonated, currency)],
      ["Allocated", money(d.allocatedFunding, currency)],
      ["Spent", money(d.spentFunding, currency)],
      ["Remaining", money(d.remainingFunding, currency)],
      ["Projects Supported", String(d.projectsSupported)],
      ["Total Donors", String(d.totalDonors)],
      ["Receipts Issued", String(d.receiptsIssued)],
    ],
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 10, cellPadding: 6 },
    margin: { left: 40, right: 40 },
  });

  doc.save("Donor-Fund-Dashboard.pdf");
}

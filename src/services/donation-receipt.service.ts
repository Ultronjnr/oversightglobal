import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { formatCurrency } from "@/lib/utils";
import {
  getAssetDataUrl,
  verificationUrl,
  type DonationOrgProfile,
  type Donor,
  type Donation,
} from "./donation.service";

export interface ReceiptRenderInput {
  receiptNumber: string;
  receiptId: string;
  verificationHash: string;
  profile: DonationOrgProfile | null;
  donor: Donor;
  donation: Donation;
  currency: string;
  declaration?: string;
}

const DEFAULT_DECLARATION =
  "This receipt is issued in terms of Section 18A of the Income Tax Act No. 58 of 1962. " +
  "It confirms that the donation described above was received and will be used exclusively " +
  "for the objectives of the organisation as approved by the Commissioner for SARS. " +
  "No goods, services or benefits of any kind were provided in exchange for this donation.";

function numberToWords(n: number): string {
  // Simple integer-to-words for the rand amount
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const toWords = (num: number): string => {
    if (num === 0) return "Zero";
    if (num < 20) return a[num];
    if (num < 100) return b[Math.floor(num / 10)] + (num % 10 ? " " + a[num % 10] : "");
    if (num < 1000)
      return a[Math.floor(num / 100)] + " Hundred" + (num % 100 ? " and " + toWords(num % 100) : "");
    if (num < 1_000_000)
      return toWords(Math.floor(num / 1000)) + " Thousand" + (num % 1000 ? " " + toWords(num % 1000) : "");
    return (
      toWords(Math.floor(num / 1_000_000)) +
      " Million" +
      (num % 1_000_000 ? " " + toWords(num % 1_000_000) : "")
    );
  };
  return toWords(Math.floor(n));
}

export async function generateReceiptPdf(input: ReceiptRenderInput): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const p = input.profile;
  const primary: [number, number, number] = [37, 99, 235]; // indigo/blue

  const [logo, signature, stamp, qr] = await Promise.all([
    getAssetDataUrl(p?.logo_path ?? null),
    getAssetDataUrl(p?.signature_path ?? null),
    getAssetDataUrl(p?.stamp_path ?? null),
    QRCode.toDataURL(verificationUrl(input.receiptId, input.verificationHash), {
      margin: 1,
      width: 240,
    }),
  ]);

  // Watermark
  doc.saveGraphicsState();
  // @ts-ignore GState exists at runtime
  doc.setGState(new (doc as any).GState({ opacity: 0.06 }));
  doc.setTextColor(...primary);
  doc.setFontSize(90);
  doc.setFont("helvetica", "bold");
  doc.text("SECTION 18A", pageW / 2, pageH / 2, { align: "center", angle: 35 });
  doc.restoreGraphicsState();

  // Header band
  doc.setFillColor(...primary);
  doc.rect(0, 0, pageW, 96, "F");
  if (logo) {
    try {
      doc.addImage(logo, "PNG", margin, 22, 52, 52);
    } catch {}
  }
  const headerX = logo ? margin + 66 : margin;
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(p?.legal_name || "Organization", headerX, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const reg: string[] = [];
  if (p?.npo_number) reg.push(`NPO: ${p.npo_number}`);
  if (p?.pbo_number) reg.push(`PBO: ${p.pbo_number}`);
  if (p?.vat_number) reg.push(`VAT: ${p.vat_number}`);
  doc.text(reg.join("    "), headerX, 56);
  if (p?.physical_address) doc.text(p.physical_address.replace(/\n/g, ", "), headerX, 70, { maxWidth: pageW - headerX - margin });

  // Title
  let y = 128;
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("SECTION 18A TAX RECEIPT", margin, y);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90, 90, 90);
  doc.text(`Receipt No: ${input.receiptNumber}`, pageW - margin, y - 12, { align: "right" });
  doc.text(`Date: ${new Date(input.donation.donation_date).toLocaleDateString("en-ZA")}`, pageW - margin, y, {
    align: "right",
  });
  doc.text(`Verify ID: ${input.receiptId.slice(0, 8)}`, pageW - margin, y + 12, { align: "right" });

  y += 24;
  doc.setDrawColor(...primary);
  doc.setLineWidth(1.5);
  doc.line(margin, y, pageW - margin, y);
  y += 20;

  // Donor block
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Received from (Donor)", margin, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: primary },
    head: [["Field", "Details"]],
    body: [
      ["Name", input.donor.name],
      ["Type", input.donor.donor_type === "ORGANIZATION" ? "Organization" : "Individual"],
      ["ID / Reg No", input.donor.id_or_reg_number || "-"],
      ["Income Tax No", input.donor.income_tax_number || "-"],
      ["Email", input.donor.email || "-"],
      ["Address", input.donor.address || "-"],
    ],
    columnStyles: { 0: { cellWidth: 120, fontStyle: "bold" } },
    margin: { left: margin, right: margin },
  });
  // @ts-ignore lastAutoTable is added by plugin
  y = (doc as any).lastAutoTable.finalY + 20;

  // Donation block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Donation Details", margin, y);
  y += 6;
  const amountStr = formatCurrency(Number(input.donation.amount), input.currency);
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: primary },
    head: [["Field", "Details"]],
    body: [
      ["Donation Date", new Date(input.donation.donation_date).toLocaleDateString("en-ZA")],
      ["Type", input.donation.donation_type === "IN_KIND" ? "In-Kind" : "Cash"],
      ["Description", input.donation.description || "Donation"],
      ["Amount in words", `${numberToWords(Number(input.donation.amount))} ${input.currency}`],
      ["Amount", amountStr],
    ],
    columnStyles: { 0: { cellWidth: 120, fontStyle: "bold" } },
    margin: { left: margin, right: margin },
  });
  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 20;

  // Declaration
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Declaration", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);
  const decl = input.declaration || DEFAULT_DECLARATION;
  const declLines = doc.splitTextToSize(decl, pageW - margin * 2);
  doc.text(declLines, margin, y);
  y += declLines.length * 11 + 24;

  // Signature + stamp + QR row
  const rowY = Math.min(y, pageH - 150);
  if (signature) {
    try {
      doc.addImage(signature, "PNG", margin, rowY, 120, 50);
    } catch {}
  }
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.5);
  doc.line(margin, rowY + 56, margin + 150, rowY + 56);
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);
  doc.text(p?.signatory_name || "Authorised Signatory", margin, rowY + 68);
  if (p?.signatory_designation) doc.text(p.signatory_designation, margin, rowY + 80);

  if (stamp) {
    try {
      doc.addImage(stamp, "PNG", pageW / 2 - 40, rowY, 80, 80);
    } catch {}
  }

  try {
    doc.addImage(qr, "PNG", pageW - margin - 80, rowY, 80, 80);
  } catch {}
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text("Scan to verify", pageW - margin - 80, rowY + 90);

  // Footer
  doc.setDrawColor(...primary);
  doc.setLineWidth(1);
  doc.line(margin, pageH - 40, pageW - margin, pageH - 40);
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  const footerBits = [p?.contact_email, p?.contact_phone, p?.postal_address?.replace(/\n/g, ", ")].filter(
    Boolean
  );
  doc.text(footerBits.join("  |  "), pageW / 2, pageH - 26, { align: "center" });
  doc.text(
    `This is a computer-generated Section 18A receipt. Verify authenticity at ${window.location.host}/verify/receipt/${input.receiptId.slice(0, 8)}`,
    pageW / 2,
    pageH - 14,
    { align: "center" }
  );

  return doc.output("blob");
}
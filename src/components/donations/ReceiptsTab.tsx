import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  listReceipts, listDonations, listDonors, getOrgProfile, nextReceiptNumber,
  issueReceipt, cancelReceipt, uploadAsset, getSignedUrl, logAudit, verificationUrl,
  type DonationReceipt, type Donation, type Donor, type DonationOrgProfile,
} from "@/services/donation.service";
import { generateReceiptPdf } from "@/services/donation-receipt.service";
import { DONATION_BUCKET } from "@/services/donation.service";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import { Plus, Download, Mail, Ban } from "lucide-react";

export function ReceiptsTab() {
  const { currency } = useCurrency();
  const [receipts, setReceipts] = useState<DonationReceipt[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [profile, setProfile] = useState<DonationOrgProfile | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedDonation, setSelectedDonation] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [pendingNumber, setPendingNumber] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [r, dn, d, p] = await Promise.all([
      listReceipts(), listDonations(), listDonors(), getOrgProfile(),
    ]);
    setReceipts(r); setDonations(dn); setDonors(d); setProfile(p);
  };
  useEffect(() => { load(); }, []);

  const donorName = (id: string | null) => donors.find((d) => d.id === id)?.name || "-";
  const unreceipted = donations.filter((d) => !d.receipt_id);

  const buildPreview = async () => {
    const donation = donations.find((d) => d.id === selectedDonation);
    if (!donation) { toast.error("Select a donation"); return; }
    const donor = donors.find((d) => d.id === donation.donor_id);
    if (!donor) { toast.error("Donor not found"); return; }
    setBusy(true);
    try {
      const number = await nextReceiptNumber();
      const receiptId = crypto.randomUUID();
      const hash = "preview";
      const blob = await generateReceiptPdf({
        receiptNumber: number,
        receiptId,
        verificationHash: hash,
        profile,
        donor,
        donation,
        currency,
        declaration: (profile?.template as any)?.declaration,
      });
      setPendingNumber(number);
      setPreviewBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to generate preview");
    } finally { setBusy(false); }
  };

  const confirmIssue = async () => {
    const donation = donations.find((d) => d.id === selectedDonation);
    if (!donation || !pendingNumber) return;
    const donor = donors.find((d) => d.id === donation.donor_id);
    if (!donor) return;
    setBusy(true);
    try {
      const rec = await issueReceipt({
        receipt_number: pendingNumber,
        donation_id: donation.id,
        donor_id: donor.id,
        snapshot: {
          donor: donor.name,
          amount: donation.amount,
          currency,
          date: donation.donation_date,
        },
      });
      // regenerate PDF with real id + hash and store it
      const blob = await generateReceiptPdf({
        receiptNumber: rec.receipt_number,
        receiptId: rec.id,
        verificationHash: rec.verification_hash || "",
        profile, donor, donation, currency,
        declaration: (profile?.template as any)?.declaration,
      });
      const path = `${rec.organization_id}/receipts/${rec.receipt_number}.pdf`;
      await supabase.storage.from(DONATION_BUCKET).upload(path, blob, { upsert: true, contentType: "application/pdf" });
      await supabase.from("donation_receipts").update({ pdf_path: path } as any).eq("id", rec.id);
      toast.success(`Receipt ${rec.receipt_number} issued`);
      setOpen(false);
      resetPreview();
      load();
    } catch (e) {
      console.error(e);
      toast.error("Failed to issue receipt");
    } finally { setBusy(false); }
  };

  const resetPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null); setPreviewBlob(null); setPendingNumber(null); setSelectedDonation("");
  };

  const download = async (r: DonationReceipt) => {
    try {
      let path = r.pdf_path;
      let url = path ? await getSignedUrl(path) : null;
      // Fallback: regenerate PDF from stored snapshot + current donor/donation
      // so previously-issued receipts can always be re-downloaded even if
      // the stored PDF is missing.
      if (!url) {
        const donation = donations.find((d) => d.id === r.donation_id);
        const donor = donors.find((d) => d.id === r.donor_id);
        if (!donation || !donor) { toast.error("Receipt source data not found"); return; }
        const blob = await generateReceiptPdf({
          receiptNumber: r.receipt_number,
          receiptId: r.id,
          verificationHash: r.verification_hash || "",
          profile, donor, donation,
          currency: (r.snapshot as any)?.currency || currency,
          declaration: (profile?.template as any)?.declaration,
        });
        const newPath = `${r.organization_id}/receipts/${r.receipt_number}.pdf`;
        const up = await supabase.storage
          .from(DONATION_BUCKET)
          .upload(newPath, blob, { upsert: true, contentType: "application/pdf" });
        if (!up.error) {
          await supabase.from("donation_receipts").update({ pdf_path: newPath } as any).eq("id", r.id);
          path = newPath;
          url = await getSignedUrl(newPath);
        } else {
          // Offline fallback: download the freshly generated blob directly.
          const objectUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = objectUrl; a.download = `${r.receipt_number}.pdf`;
          document.body.appendChild(a); a.click(); a.remove();
          URL.revokeObjectURL(objectUrl);
          logAudit("receipt", r.id, "DOWNLOADED", { regenerated: true });
          return;
        }
      }
      if (url) {
        window.open(url, "_blank");
        logAudit("receipt", r.id, "DOWNLOADED", {});
      } else {
        toast.error("Failed to open receipt");
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to download receipt");
    }
  };

  const email = async (r: DonationReceipt) => {
    const donor = donors.find((d) => d.id === r.donor_id);
    if (!donor?.email) { toast.error("Donor has no email address"); return; }
    if (!r.pdf_path) { toast.error("PDF not available"); return; }
    try {
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "donation-receipt",
          recipientEmail: donor.email,
          idempotencyKey: `donation-receipt-${r.id}`,
          templateData: {
            // The edge function re-derives donorName, receiptNumber,
            // downloadUrl and verifyUrl from the database using this id, so
            // client-supplied values cannot be used for phishing.
            receiptId: r.id,
          },
        },
      });
      await supabase.from("donation_receipts").update({ status: "EMAILED" } as any).eq("id", r.id);
      logAudit("receipt", r.id, "EMAILED", { to: donor.email });
      toast.success("Receipt emailed");
      load();
    } catch {
      toast.error("Failed to send email");
    }
  };

  const cancel = async (r: DonationReceipt) => {
    try { await cancelReceipt(r.id); toast.success("Receipt cancelled"); load(); }
    catch { toast.error("Failed to cancel"); }
  };

  const statusColor = (s: string) =>
    s === "ISSUED" ? "default" : s === "EMAILED" ? "secondary" : s === "CANCELLED" ? "destructive" : "outline";

  return (
    <Card className="p-4 space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { resetPreview(); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />Generate Receipt</Button>
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetPreview(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Generate Section 18A Receipt</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Donation *</Label>
              <Select value={selectedDonation} onValueChange={(v) => { setSelectedDonation(v); resetPreviewKeepOpen(); }}>
                <SelectTrigger><SelectValue placeholder="Select an unreceipted donation" /></SelectTrigger>
                <SelectContent>
                  {unreceipted.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {donorName(d.donor_id)} — {new Date(d.donation_date).toLocaleDateString("en-ZA")} — {Number(d.amount)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!previewUrl && (
              <Button variant="secondary" onClick={buildPreview} disabled={busy || !selectedDonation}>
                {busy ? "Generating…" : "Preview PDF"}
              </Button>
            )}
            {previewUrl && (
              <div className="border rounded-lg overflow-hidden">
                <iframe title="Receipt preview" src={previewUrl} className="w-full h-[480px]" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetPreview(); }}>Cancel</Button>
            {previewUrl && <Button onClick={confirmIssue} disabled={busy}>{busy ? "Issuing…" : "Issue & Save"}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receipt No</TableHead><TableHead>Donor</TableHead><TableHead>Issued</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receipts.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.receipt_number}</TableCell>
                <TableCell>{donorName(r.donor_id)}</TableCell>
                <TableCell>{r.issued_at ? new Date(r.issued_at).toLocaleDateString("en-ZA") : "-"}</TableCell>
                <TableCell><Badge variant={statusColor(r.status) as any}>{r.status}</Badge></TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button variant="ghost" size="icon" title="Download" onClick={() => download(r)}><Download className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Email" onClick={() => email(r)}><Mail className="h-4 w-4" /></Button>
                  {r.status !== "CANCELLED" && <Button variant="ghost" size="icon" title="Cancel" onClick={() => cancel(r)}><Ban className="h-4 w-4" /></Button>}
                </TableCell>
              </TableRow>
            ))}
            {receipts.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No receipts issued yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </Card>
  );

  function resetPreviewKeepOpen() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null); setPreviewBlob(null); setPendingNumber(null);
  }
}
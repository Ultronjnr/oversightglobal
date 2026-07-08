import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  listDonations, upsertDonation, listDonors, type Donation, type Donor, type DonationKind,
} from "@/services/donation.service";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export function DonationsTab() {
  const { currency, format } = useCurrency();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    donor_id: "", amount: "", donation_type: "CASH" as DonationKind,
    donation_date: new Date().toISOString().slice(0, 10), description: "",
  });

  const load = async () => {
    const [d, dn] = await Promise.all([listDonations(), listDonors()]);
    setDonations(d); setDonors(dn);
  };
  useEffect(() => { load(); }, []);

  const donorName = (id: string) => donors.find((d) => d.id === id)?.name || "-";

  const save = async () => {
    if (!form.donor_id) { toast.error("Select a donor"); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    try {
      await upsertDonation({ ...form, amount: Number(form.amount), currency });
      toast.success("Donation recorded");
      setOpen(false);
      setForm({ donor_id: "", amount: "", donation_type: "CASH", donation_date: new Date().toISOString().slice(0, 10), description: "" });
      load();
    } catch { toast.error("Failed to save donation"); }
    finally { setSaving(false); }
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Record Donation</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New Donation</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Donor *</Label>
                <Select value={form.donor_id} onValueChange={(v) => setForm({ ...form, donor_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select donor" /></SelectTrigger>
                  <SelectContent>
                    {donors.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Date</Label><Input type="date" value={form.donation_date} onChange={(e) => setForm({ ...form, donation_date: e.target.value })} /></div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.donation_type} onValueChange={(v) => setForm({ ...form, donation_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="IN_KIND">In-Kind</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Amount ({currency}) *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead><TableHead>Donor</TableHead><TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead><TableHead>Receipt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {donations.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{new Date(d.donation_date).toLocaleDateString("en-ZA")}</TableCell>
                <TableCell className="font-medium">{donorName(d.donor_id)}</TableCell>
                <TableCell>{d.donation_type === "IN_KIND" ? "In-Kind" : "Cash"}</TableCell>
                <TableCell className="text-right">{format(Number(d.amount))}</TableCell>
                <TableCell>{d.receipt_id ? "Issued" : "-"}</TableCell>
              </TableRow>
            ))}
            {donations.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No donations yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
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
import { listDonors, upsertDonor, type Donor, type DonorType } from "@/services/donation.service";
import { toast } from "sonner";
import { Plus, Search, Pencil } from "lucide-react";

const empty = {
  donor_type: "INDIVIDUAL" as DonorType,
  name: "",
  id_or_reg_number: "",
  income_tax_number: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
};

export function DonorRegistryTab() {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ ...empty });

  const load = async (s = "") => {
    try { setDonors(await listDonors(s)); } catch { toast.error("Failed to load donors"); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm({ ...empty }); setOpen(true); };
  const openEdit = (d: Donor) => { setForm({ ...d }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      await upsertDonor(form);
      toast.success("Donor saved");
      setOpen(false);
      load(search);
    } catch { toast.error("Failed to save donor"); }
    finally { setSaving(false); }
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search donors…" value={search}
            onChange={(e) => { setSearch(e.target.value); load(e.target.value); }} />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add Donor</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{form.id ? "Edit Donor" : "New Donor"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Type</Label>
                <Select value={form.donor_type} onValueChange={(v) => setForm({ ...form, donor_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                    <SelectItem value="ORGANIZATION">Organization</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>ID / Reg No</Label><Input value={form.id_or_reg_number || ""} onChange={(e) => setForm({ ...form, id_or_reg_number: e.target.value })} /></div>
                <div><Label>Income Tax No</Label><Input value={form.income_tax_number || ""} onChange={(e) => setForm({ ...form, income_tax_number: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div><Label>Address</Label><Textarea value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div><Label>Notes</Label><Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
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
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Tax No</TableHead>
              <TableHead>Email</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {donors.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell>{d.donor_type === "ORGANIZATION" ? "Organization" : "Individual"}</TableCell>
                <TableCell>{d.income_tax_number || "-"}</TableCell>
                <TableCell>{d.email || "-"}</TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
            {donors.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No donors yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
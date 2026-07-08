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
  listPools, listDonors, listProjects, createAllocation,
  type FundingPool, type Donor, type DonationProject, type AllocationType,
} from "@/services/donation.service";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export function FundingPoolsTab() {
  const { format } = useCurrency();
  const [pools, setPools] = useState<FundingPool[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [projects, setProjects] = useState<DonationProject[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    donor_id: "", project_id: "", amount: "", allocation_type: "RESERVED" as AllocationType,
    expense_category: "", allocation_date: new Date().toISOString().slice(0, 10), description: "",
  });

  const load = async () => {
    const [p, d, pr] = await Promise.all([listPools(), listDonors(), listProjects()]);
    setPools(p); setDonors(d); setProjects(pr);
  };
  useEffect(() => { load(); }, []);

  const donorName = (id: string) => donors.find((d) => d.id === id)?.name || "-";
  const remaining = (p: FundingPool) =>
    Number(p.total_donated) - Number(p.total_allocated) - Number(p.total_spent);

  const save = async () => {
    if (!form.donor_id) { toast.error("Select a donor"); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    try {
      await createAllocation({
        donor_id: form.donor_id,
        project_id: form.project_id || null,
        amount: Number(form.amount),
        allocation_type: form.allocation_type,
        expense_category: form.allocation_type === "SPENT" ? (form.expense_category || null) : null,
        allocation_date: form.allocation_date,
        description: form.description || null,
      });
      toast.success("Allocation created");
      setOpen(false);
      setForm({ donor_id: "", project_id: "", amount: "", allocation_type: "RESERVED", expense_category: "", allocation_date: new Date().toISOString().slice(0, 10), description: "" });
      load();
    } catch { toast.error("Failed to create allocation"); }
    finally { setSaving(false); }
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Allocate Funds</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Allocate Donor Funds</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Donor *</Label>
                <Select value={form.donor_id} onValueChange={(v) => setForm({ ...form, donor_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select donor" /></SelectTrigger>
                  <SelectContent>{donors.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Project</Label>
                <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Optional project" /></SelectTrigger>
                  <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.allocation_type} onValueChange={(v) => setForm({ ...form, allocation_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RESERVED">Reserved</SelectItem>
                      <SelectItem value="SPENT">Spent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
              <TableHead>Donor</TableHead>
              <TableHead className="text-right">Donated</TableHead>
              <TableHead className="text-right">Allocated</TableHead>
              <TableHead className="text-right">Spent</TableHead>
              <TableHead className="text-right">Available</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pools.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{donorName(p.donor_id)}</TableCell>
                <TableCell className="text-right">{format(Number(p.total_donated))}</TableCell>
                <TableCell className="text-right">{format(Number(p.total_allocated))}</TableCell>
                <TableCell className="text-right">{format(Number(p.total_spent))}</TableCell>
                <TableCell className="text-right font-semibold">{format(remaining(p))}</TableCell>
              </TableRow>
            ))}
            {pools.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No funding pools yet. Add a donor to begin.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
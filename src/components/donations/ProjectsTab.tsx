import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listProjects, upsertProject, type DonationProject } from "@/services/donation.service";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";

const empty = { name: "", code: "", description: "", status: "ACTIVE", budget: "" };

export function ProjectsTab() {
  const { format } = useCurrency();
  const [projects, setProjects] = useState<DonationProject[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ ...empty });

  const load = async () => setProjects(await listProjects());
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      await upsertProject({ ...form, budget: Number(form.budget) || 0 });
      toast.success("Project saved");
      setOpen(false); setForm({ ...empty }); load();
    } catch { toast.error("Failed to save project"); }
    finally { setSaving(false); }
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={() => setForm({ ...empty })}><Plus className="h-4 w-4 mr-1" />Add Project</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{form.id ? "Edit Project" : "New Project"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Code</Label><Input value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
                <div><Label>Budget</Label><Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></div>
              </div>
              <div><Label>Description</Label><Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
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
            <TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Budget</TableHead><TableHead></TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.code || "-"}</TableCell>
                <TableCell>{p.status}</TableCell>
                <TableCell className="text-right">{format(Number(p.budget))}</TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={() => { setForm({ ...p, budget: String(p.budget) }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
            {projects.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No projects yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
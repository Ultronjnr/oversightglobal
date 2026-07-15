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
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  listPools, listDonors, listProjects, listAllocations, createAllocation,
  type FundingPool, type Donor, type DonationProject, type AllocationType,
  type FundAllocation,
} from "@/services/donation.service";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import { Plus, FolderOpen, Wallet, TrendingDown, PiggyBank, FolderSearch } from "lucide-react";

export function FundingPoolsTab() {
  const { format } = useCurrency();
  const [pools, setPools] = useState<FundingPool[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [projects, setProjects] = useState<DonationProject[]>([]);
  const [allocations, setAllocations] = useState<FundAllocation[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [form, setForm] = useState<any>({
    donor_id: "", project_id: "", amount: "", allocation_type: "RESERVED" as AllocationType,
    expense_category: "", allocation_date: new Date().toISOString().slice(0, 10), description: "",
  });

  const load = async () => {
    const [p, d, pr, a] = await Promise.all([listPools(), listDonors(), listProjects(), listAllocations()]);
    setPools(p); setDonors(d); setProjects(pr); setAllocations(a);
  };
  useEffect(() => { load(); }, []);

  const donorName = (id: string) => donors.find((d) => d.id === id)?.name || "-";
  const remaining = (p: FundingPool) =>
    Number(p.total_donated) - Number(p.total_allocated) - Number(p.total_spent);

  const save = async () => {
    if (!form.donor_id) { toast.error("Select a donor"); return; }
    if (!form.project_id) { toast.error("Select a project first — allocations must belong to a project"); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    try {
      await createAllocation({
        donor_id: form.donor_id,
        project_id: form.project_id,
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

  // Aggregate allocation stats per project
  const projectStats = projects.map((pr) => {
    const rows = allocations.filter((a) => a.project_id === pr.id);
    const reserved = rows.filter((a) => a.allocation_type === "RESERVED").reduce((s, a) => s + Number(a.amount), 0);
    const spent = rows.filter((a) => a.allocation_type === "SPENT").reduce((s, a) => s + Number(a.amount), 0);
    const budget = Number(pr.budget) || 0;
    const committed = reserved + spent;
    const remaining = Math.max(budget - committed, 0);
    const pct = budget > 0 ? Math.min((committed / budget) * 100, 100) : 0;
    return { project: pr, rows, reserved, spent, budget, committed, remaining, pct };
  });
  const activeStat = projectStats.find((s) => s.project.id === selectedProjectId);

  const openAllocate = () => {
    if (!selectedProjectId) {
      toast.error("Choose a project first");
      return;
    }
    setForm((f: any) => ({ ...f, project_id: selectedProjectId }));
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Step 1: pick a project */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 min-w-0">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Step 1 · Choose a project</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={projects.length ? "Select a project to view or allocate funds" : "No projects yet — create one in the Projects tab"} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}{p.code ? ` · ${p.code}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={openAllocate} disabled={!selectedProjectId}>
            <Plus className="h-4 w-4 mr-1" />Allocate Funds
          </Button>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Allocate Donor Funds</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Project *</Label>
                <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Donor *</Label>
                <Select value={form.donor_id} onValueChange={(v) => setForm({ ...form, donor_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select donor" /></SelectTrigger>
                  <SelectContent>{donors.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
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
              {form.allocation_type === "SPENT" && (
                <div>
                  <Label>Expense Category</Label>
                  <Input placeholder="e.g. Transport, Salaries" value={form.expense_category} onChange={(e) => setForm({ ...form, expense_category: e.target.value })} />
                </div>
              )}
              <div><Label>Date</Label><Input type="date" value={form.allocation_date} onChange={(e) => setForm({ ...form, allocation_date: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>

      {/* Step 2: selected project detail (empty state until picked) */}
      {!selectedProjectId ? (
        <Card className="p-10 flex flex-col items-center justify-center text-center gap-2 border-dashed">
          <FolderSearch className="h-10 w-10 text-muted-foreground" />
          <h3 className="font-semibold">Select a project to begin</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Fund allocations must belong to a project. Pick one from the dropdown above to see its budget, reserved and spent totals, and to record new allocations.
          </p>
        </Card>
      ) : activeStat && (
        <Card className="p-4">
          <Accordion type="single" collapsible defaultValue={activeStat.project.id} className="w-full">
            {(() => {
              const { project, rows, reserved, spent, budget, committed, remaining, pct } = activeStat;
              const over = budget > 0 && committed > budget;
              return (
                <AccordionItem value={project.id} className="border-none">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex-1 flex flex-col gap-2 pr-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-medium truncate">{project.name}</span>
                          {project.code && <Badge variant="outline" className="text-xs">{project.code}</Badge>}
                        </div>
                        <div className="hidden sm:flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1 text-amber-600"><Wallet className="h-3 w-3" />Reserved {format(reserved)}</span>
                          <span className="flex items-center gap-1 text-rose-600"><TrendingDown className="h-3 w-3" />Spent {format(spent)}</span>
                          <span className={`flex items-center gap-1 font-semibold ${over ? "text-destructive" : "text-emerald-600"}`}>
                            <PiggyBank className="h-3 w-3" />
                            {over ? "Over" : "Left"} {format(over ? committed - budget : remaining)}
                          </span>
                        </div>
                      </div>
                      {budget > 0 && (
                        <div className="space-y-1">
                          <Progress value={pct} className={over ? "[&>div]:bg-destructive" : ""} />
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>{pct.toFixed(0)}% of budget committed</span>
                            <span>Budget {format(budget)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="sm:hidden grid grid-cols-3 gap-2 text-xs mb-3">
                      <div className="rounded border p-2"><div className="text-muted-foreground">Reserved</div><div className="font-semibold">{format(reserved)}</div></div>
                      <div className="rounded border p-2"><div className="text-muted-foreground">Spent</div><div className="font-semibold">{format(spent)}</div></div>
                      <div className="rounded border p-2"><div className="text-muted-foreground">{over ? "Over" : "Left"}</div><div className={`font-semibold ${over ? "text-destructive" : "text-emerald-600"}`}>{format(over ? committed - budget : remaining)}</div></div>
                    </div>
                    {rows.length === 0 ? (
                      <div className="text-xs text-muted-foreground py-3">
                        No allocations recorded for this project yet. Use “Allocate Funds” above to add the first one.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Donor</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map((a) => (
                              <TableRow key={a.id}>
                                <TableCell className="text-xs">{(a.allocation_date || a.created_at || "").slice(0, 10)}</TableCell>
                                <TableCell>{donorName(a.donor_id)}</TableCell>
                                <TableCell>
                                  <Badge variant={a.allocation_type === "SPENT" ? "destructive" : "secondary"} className="text-[10px]">
                                    {a.allocation_type}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{a.expense_category || "-"}</TableCell>
                                <TableCell className="text-right font-medium">{format(Number(a.amount))}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })()}
          </Accordion>
        </Card>
      )}

      {/* Donor pool summary */}
      <Card className="p-4 space-y-2">
        <h3 className="font-semibold text-sm">Donor funding pools</h3>
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
    </div>
  );
}
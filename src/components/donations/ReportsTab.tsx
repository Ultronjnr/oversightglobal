import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  getReportBundle,
  getDonorDetail,
  type ReportBundle,
  type DonorDetailReport,
} from "@/services/donation.service";
import { generateReportPdf, generateDonorReportPdf, type ReportKind } from "@/services/donation-report.service";
import { toast } from "sonner";
import { FileText, Download, HandCoins, PieChart, ShieldCheck, CalendarDays, UserRound, ChevronDown, ChevronRight, Loader2 } from "lucide-react";

const REPORTS: { kind: ReportKind; title: string; desc: string; icon: JSX.Element }[] = [
  { kind: "donor", title: "Donor Report", desc: "Contributions, allocations and remaining balance per donor.", icon: <HandCoins className="h-5 w-5" /> },
  { kind: "yearly", title: "Yearly Report", desc: "Donations and spending broken down by year.", icon: <CalendarDays className="h-5 w-5" /> },
  { kind: "impact", title: "Impact Report", desc: "How funds were spent across projects and categories.", icon: <PieChart className="h-5 w-5" /> },
  { kind: "transparency", title: "Transparency Report", desc: "Full donor-to-project fund traceability.", icon: <ShieldCheck className="h-5 w-5" /> },
];

export function ReportsTab() {
  const { format, currency } = useCurrency();
  const [year, setYear] = useState<string>("all");
  const [bundle, setBundle] = useState<ReportBundle | null>(null);
  const [busy, setBusy] = useState<ReportKind | null>(null);
  const [donorId, setDonorId] = useState<string>("");
  const [donorBusy, setDonorBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, DonorDetailReport>>({});
  const [loadingRow, setLoadingRow] = useState<string | null>(null);

  useEffect(() => {
    getReportBundle().then(setBundle).catch(() => {});
  }, []);

  const years = bundle
    ? Array.from(new Set(bundle.byYear.map((y) => y.year).filter((y) => y && y !== "—"))).sort().reverse()
    : [];

  const download = async (kind: ReportKind) => {
    setBusy(kind);
    try {
      await generateReportPdf(kind, currency, year === "all" ? undefined : year);
      toast.success("Report downloaded");
    } catch (e) {
      toast.error("Failed to generate report");
    } finally {
      setBusy(null);
    }
  };

  const downloadDonor = async () => {
    if (!donorId) {
      toast.error("Select a donor first");
      return;
    }
    setDonorBusy(true);
    try {
      await generateDonorReportPdf(donorId, currency);
      toast.success("Donor report downloaded");
    } catch {
      toast.error("Failed to generate donor report");
    } finally {
      setDonorBusy(false);
    }
  };

  const toggleRow = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!details[id]) {
      setLoadingRow(id);
      try {
        const detail = await getDonorDetail(id);
        setDetails((prev) => ({ ...prev, [id]: detail }));
      } catch {
        toast.error("Failed to load donor details");
      } finally {
        setLoadingRow(null);
      }
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="font-semibold flex items-center gap-2 mb-1"><UserRound className="h-4 w-4" />Donor Information Report</p>
        <p className="text-sm text-muted-foreground mb-3">
          Select a donor to export a detailed PDF: donations, allocated &amp; spent, per-project tracking, expense categories and full allocation history.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <Label>Donor</Label>
            <Select value={donorId} onValueChange={setDonorId}>
              <SelectTrigger className="max-w-md"><SelectValue placeholder="Select a donor…" /></SelectTrigger>
              <SelectContent>
                {(bundle?.donorRows ?? []).map((r) => (
                  <SelectItem key={r.donor_id} value={r.donor_id}>{r.donor_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={downloadDonor} disabled={donorBusy || !donorId}>
            <Download className="h-4 w-4 mr-1" />
            {donorBusy ? "Generating…" : "Export PDF"}
          </Button>
        </div>
      </Card>

      <Card className="p-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <Label>Reporting Period</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">Applies to yearly &amp; transparency reports.</p>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {REPORTS.map((r) => (
          <Card key={r.kind} className="p-4 flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 text-primary p-2">{r.icon}</div>
            <div className="flex-1">
              <p className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4" />{r.title}</p>
              <p className="text-sm text-muted-foreground mb-3">{r.desc}</p>
              <Button size="sm" onClick={() => download(r.kind)} disabled={busy === r.kind}>
                <Download className="h-4 w-4 mr-1" />
                {busy === r.kind ? "Generating…" : "Export PDF"}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {bundle && (
        <Card className="p-4">
          <p className="font-semibold mb-1">Donor Fund Summary (all time)</p>
          <p className="text-xs text-muted-foreground mb-3">Click a donor row to view a detailed breakdown.</p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Donor</TableHead>
                  <TableHead className="text-right">Donated</TableHead>
                  <TableHead className="text-right">Allocated</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bundle.donorRows.map((r) => (
                  <>
                    <TableRow
                      key={r.donor_id}
                      className="cursor-pointer"
                      onClick={() => toggleRow(r.donor_id)}
                    >
                      <TableCell>
                        {expanded === r.donor_id
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                      <TableCell className="font-medium">{r.donor_name}</TableCell>
                      <TableCell className="text-right">{format(r.donated)}</TableCell>
                      <TableCell className="text-right">{format(r.allocated)}</TableCell>
                      <TableCell className="text-right">{format(r.spent)}</TableCell>
                      <TableCell className="text-right font-semibold">{format(r.remaining)}</TableCell>
                    </TableRow>
                    {expanded === r.donor_id && (
                      <TableRow key={r.donor_id + "-detail"} className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={6} className="p-4">
                          {loadingRow === r.donor_id && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" /> Loading details…
                            </div>
                          )}
                          {details[r.donor_id] && (
                            <DonorBreakdown detail={details[r.donor_id]} format={format} onExport={() => { setDonorId(r.donor_id); }} />
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
                {bundle.donorRows.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No donor activity yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}

function DonorBreakdown({
  detail,
  format,
}: {
  detail: DonorDetailReport;
  format: (n: number) => string;
  onExport?: () => void;
}) {
  const { donor, totals, byProject, byCategory, donations, allocations } = detail;
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div><p className="text-xs text-muted-foreground">Donated</p><p className="font-semibold">{format(totals.donated)}</p></div>
        <div><p className="text-xs text-muted-foreground">Allocated</p><p className="font-semibold">{format(totals.allocated)}</p></div>
        <div><p className="text-xs text-muted-foreground">Spent</p><p className="font-semibold">{format(totals.spent)}</p></div>
        <div><p className="text-xs text-muted-foreground">Remaining</p><p className="font-semibold">{format(totals.remaining)}</p></div>
      </div>

      {(donor.email || donor.phone || donor.id_or_reg_number || donor.income_tax_number) && (
        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
          <span>{donor.donor_type === "ORGANIZATION" ? "Organization" : "Individual"}</span>
          {donor.id_or_reg_number && <span>ID/Reg: {donor.id_or_reg_number}</span>}
          {donor.income_tax_number && <span>Tax: {donor.income_tax_number}</span>}
          {donor.email && <span>{donor.email}</span>}
          {donor.phone && <span>{donor.phone}</span>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <p className="font-semibold mb-1">Project Tracking</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead className="text-right">Allocated</TableHead>
                <TableHead className="text-right">Spent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byProject.map((p) => (
                <TableRow key={p.project}>
                  <TableCell>{p.project}</TableCell>
                  <TableCell className="text-right">{format(p.allocated)}</TableCell>
                  <TableCell className="text-right">{format(p.spent)}</TableCell>
                </TableRow>
              ))}
              {byProject.length === 0 && <TableRow><TableCell colSpan={3} className="text-muted-foreground">No allocations.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
        <div>
          <p className="font-semibold mb-1">Expense Categories</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byCategory.map((c) => (
                <TableRow key={c.category}>
                  <TableCell>{c.category}</TableCell>
                  <TableCell className="text-right">{format(c.amount)}</TableCell>
                </TableRow>
              ))}
              {byCategory.length === 0 && <TableRow><TableCell colSpan={2} className="text-muted-foreground">No spending yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <p className="font-semibold mb-1">Allocation &amp; Expense Detail</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allocations.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.date}</TableCell>
                <TableCell>{a.project}</TableCell>
                <TableCell>{a.expense_category}</TableCell>
                <TableCell>{a.description}</TableCell>
                <TableCell>{a.allocation_type === "SPENT" ? "Spent" : "Reserved"}</TableCell>
                <TableCell className="text-right">{format(a.amount)}</TableCell>
              </TableRow>
            ))}
            {allocations.length === 0 && <TableRow><TableCell colSpan={6} className="text-muted-foreground">No allocations recorded.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

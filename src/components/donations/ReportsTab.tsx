import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrency } from "@/contexts/CurrencyContext";
import { getReportBundle, type ReportBundle } from "@/services/donation.service";
import { generateReportPdf, type ReportKind } from "@/services/donation-report.service";
import { toast } from "sonner";
import { FileText, Download, HandCoins, PieChart, ShieldCheck, CalendarDays } from "lucide-react";

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

  return (
    <div className="space-y-4">
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
          <p className="font-semibold mb-3">Donor Fund Summary (all time)</p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Donor</TableHead>
                  <TableHead className="text-right">Donated</TableHead>
                  <TableHead className="text-right">Allocated</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bundle.donorRows.map((r) => (
                  <TableRow key={r.donor_id}>
                    <TableCell className="font-medium">{r.donor_name}</TableCell>
                    <TableCell className="text-right">{format(r.donated)}</TableCell>
                    <TableCell className="text-right">{format(r.allocated)}</TableCell>
                    <TableCell className="text-right">{format(r.spent)}</TableCell>
                    <TableCell className="text-right font-semibold">{format(r.remaining)}</TableCell>
                  </TableRow>
                ))}
                {bundle.donorRows.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No donor activity yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}

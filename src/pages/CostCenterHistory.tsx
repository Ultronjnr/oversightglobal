import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Building2, Filter, X, Loader2, CalendarRange, Receipt } from "lucide-react";

import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { adminNavItems } from "@/lib/admin-nav";
import {
  getExpenses,
  summarizeByDepartment,
  type ExpenseFilters,
  type ExpenseRecord,
  type DepartmentSummary,
} from "@/services/expense.service";

export default function CostCenterHistory() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [filters, setFilters] = useState<ExpenseFilters>({});
  const [drillDown, setDrillDown] = useState<DepartmentSummary | null>(null);

  const load = async () => {
    setLoading(true);
    const exp = await getExpenses(filters);
    if (exp.success) setRecords(exp.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.from, filters.to]);

  const summaries = useMemo(() => summarizeByDepartment(records), [records]);

  const totals = useMemo(() => {
    const totalSpent = records.reduce((s, r) => s + r.amount, 0);
    const totalVat = records.reduce((s, r) => s + r.vatAmount, 0);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const thisMonth = records.reduce((s, r) => {
      const d = r.approvalDate ? new Date(r.approvalDate) : null;
      return d && d >= monthStart ? s + r.amount : s;
    }, 0);
    return { totalSpent, totalVat, thisMonth, count: summaries.length };
  }, [records, summaries]);

  const drillRecords = useMemo(() => {
    if (!drillDown) return [];
    return records.filter((r) => r.department === drillDown.department);
  }, [records, drillDown]);

  const resetFilters = () => setFilters({});

  return (
    <DashboardLayout title="Cost Center / Department History" navItems={adminNavItems}>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Total Spent" value={formatCurrency(totals.totalSpent)} valueColor="primary" isLoading={loading} />
          <StatCard label="This Month" value={formatCurrency(totals.thisMonth)} valueColor="success" isLoading={loading} />
          <StatCard label="VAT Recoverable" value={formatCurrency(totals.totalVat)} valueColor="warning" isLoading={loading} />
          <StatCard label="Cost Centers" value={totals.count} valueColor="primary" isLoading={loading} />
        </div>

        {/* Filters */}
        <SectionCard title="Filters" icon={<Filter className="h-5 w-5" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">From</label>
              <Input
                type="date"
                value={filters.from || ""}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || undefined }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">To</label>
              <Input
                type="date"
                value={filters.to || ""}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || undefined }))}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-2">
              <X className="h-4 w-4" />Reset
            </Button>
          </div>
        </SectionCard>

        {/* Department Summaries */}
        <SectionCard title="Cost Center Summary" icon={<Building2 className="h-5 w-5" />}>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : summaries.length === 0 ? (
            <EmptyState icon={<Building2 className="h-12 w-12" />} title="No spend yet" description="Approved transactions will appear here grouped by cost center." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {summaries.map((s) => (
                <button
                  key={s.department}
                  type="button"
                  onClick={() => setDrillDown(s)}
                  className="text-left"
                >
                  <Card className="hover:shadow-md hover:border-primary/40 transition-all">
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold truncate">{s.department}</p>
                        <Badge variant="outline" className="text-xs">COST CENTER</Badge>
                      </div>
                      <p className="text-2xl font-bold text-primary">{formatCurrency(s.totalSpent)}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{s.count} transaction{s.count === 1 ? "" : "s"}</span>
                        <span>VAT {formatCurrency(s.totalVat)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 pt-1">
                        <CalendarRange className="h-3 w-3" />
                        {Object.keys(s.monthly).length} active month{Object.keys(s.monthly).length === 1 ? "" : "s"}
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Drill-down */}
      <Dialog open={!!drillDown} onOpenChange={(o) => !o && setDrillDown(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {drillDown?.department} — Transactions
            </DialogTitle>
          </DialogHeader>
          {drillDown && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Card><CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Total Spent</p>
                  <p className="text-xl font-bold text-primary">{formatCurrency(drillDown.totalSpent)}</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">VAT</p>
                  <p className="text-xl font-bold text-warning">{formatCurrency(drillDown.totalVat)}</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Transactions</p>
                  <p className="text-xl font-bold">{drillDown.count}</p>
                </CardContent></Card>
              </div>
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Transaction</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Approved</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillRecords.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <p className="font-medium truncate max-w-[220px]">{r.title}</p>
                          <p className="text-xs text-muted-foreground font-mono">{r.transactionId}</p>
                        </TableCell>
                        <TableCell>{r.supplierName}</TableCell>
                        <TableCell><Badge variant="outline">{r.categoryName}</Badge></TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(r.amount, r.currency)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.approvalDate ? format(new Date(r.approvalDate), "dd MMM yyyy") : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
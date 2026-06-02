import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Receipt, Filter, X, Loader2, Tag, BadgePercent, CalendarRange } from "lucide-react";

import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import {
  getExpenses,
  summarizeByCategory,
  type ExpenseFilters,
  type ExpenseRecord,
  type CategorySummary,
  type ExpensePaymentStatus,
} from "@/services/expense.service";
import { getCategories, type Category } from "@/services/category.service";
import { adminNavItems } from "@/lib/admin-nav";

const paymentStatusMeta: Record<ExpensePaymentStatus, { label: string; className: string }> = {
  APPROVED_NOT_PAID: { label: "Approved – Not Paid", className: "bg-destructive/10 text-destructive border-destructive/30" },
  PARTIALLY_PAID: { label: "Partially Paid", className: "bg-warning/10 text-warning border-warning/30" },
  FULLY_PAID: { label: "Fully Paid", className: "bg-success/10 text-success border-success/30" },
};

export default function ExpenseHistory() {
  const { role } = useAuth();

  const navItems = useMemo(() => {
    if (role === "ADMIN") return adminNavItems;
    const base = role === "FINANCE"
      ? "/finance/portal"
      : role === "HOD"
      ? "/hod/portal"
      : "/employee/portal";
    return [
      { label: "My Portal", href: base },
      { label: "Purchase Requisition History", href: "/pr-history" },
      { label: "Expense History", href: "/expenses" },
    ];
  }, [role]);

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filters, setFilters] = useState<ExpenseFilters>({
    categoryId: "ALL",
    paymentStatus: "ALL",
    vatClaimable: "ALL",
  });
  const [categoryDrillDown, setCategoryDrillDown] = useState<CategorySummary | null>(null);

  const load = async () => {
    setLoading(true);
    const [exp, cats] = await Promise.all([getExpenses(filters), getCategories()]);
    if (exp.success) setRecords(exp.data);
    if (cats.success) setCategories(cats.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.from, filters.to, filters.categoryId, filters.paymentStatus, filters.vatClaimable]);

  const totals = useMemo(() => {
    const totalSpent = records.reduce((s, r) => s + r.amount, 0);
    const totalVat = records.reduce((s, r) => s + r.vatAmount, 0);
    const claimable = records.filter((r) => r.vatClaimable).length;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const thisMonth = records.reduce((s, r) => {
      const d = r.approvalDate ? new Date(r.approvalDate) : null;
      return d && d >= monthStart ? s + r.amount : s;
    }, 0);
    return { totalSpent, totalVat, claimable, thisMonth };
  }, [records]);

  const summaries = useMemo(() => summarizeByCategory(records), [records]);

  const drillRecords = useMemo(() => {
    if (!categoryDrillDown) return [];
    return records.filter((r) =>
      categoryDrillDown.categoryId
        ? r.categoryId === categoryDrillDown.categoryId
        : r.categoryName === categoryDrillDown.categoryName,
    );
  }, [records, categoryDrillDown]);

  const resetFilters = () =>
    setFilters({ categoryId: "ALL", paymentStatus: "ALL", vatClaimable: "ALL" });

  return (
    <DashboardLayout title="Expense History" navItems={navItems as any}>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Total Spent" value={formatCurrency(totals.totalSpent)} valueColor="primary" isLoading={loading} />
          <StatCard label="This Month" value={formatCurrency(totals.thisMonth)} valueColor="success" isLoading={loading} />
          <StatCard label="VAT Recoverable" value={formatCurrency(totals.totalVat)} valueColor="warning" isLoading={loading} />
          <StatCard label="Claimable Items" value={totals.claimable} valueColor="primary" isLoading={loading} />
        </div>

        {/* Filters */}
        <SectionCard title="Filters" icon={<Filter className="h-5 w-5" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Category</label>
              <Select
                value={filters.categoryId || "ALL"}
                onValueChange={(v) => setFilters((f) => ({ ...f, categoryId: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Payment Status</label>
              <Select
                value={filters.paymentStatus || "ALL"}
                onValueChange={(v) => setFilters((f) => ({ ...f, paymentStatus: v as any }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Payment Statuses</SelectItem>
                  <SelectItem value="APPROVED_NOT_PAID">Approved – Not Paid</SelectItem>
                  <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
                  <SelectItem value="FULLY_PAID">Fully Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">VAT</label>
              <Select
                value={filters.vatClaimable || "ALL"}
                onValueChange={(v) => setFilters((f) => ({ ...f, vatClaimable: v as any }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="CLAIMABLE">VAT Claimable</SelectItem>
                  <SelectItem value="NON_CLAIMABLE">Non-Claimable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-2">
              <X className="h-4 w-4" />Reset
            </Button>
          </div>
        </SectionCard>

        {/* Category Summaries */}
        <SectionCard title="Category Summary" icon={<Tag className="h-5 w-5" />}>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : summaries.length === 0 ? (
            <EmptyState icon={<Tag className="h-12 w-12" />} title="No spend yet" description="Approved transactions will appear here grouped by category." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {summaries.map((s) => (
                <button
                  key={s.categoryId || s.categoryName}
                  type="button"
                  onClick={() => setCategoryDrillDown(s)}
                  className="text-left"
                >
                  <Card className="hover:shadow-md hover:border-primary/40 transition-all">
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold truncate">{s.categoryName}</p>
                        <Badge variant="outline" className="text-xs">{s.categoryType}</Badge>
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

        {/* Transactions Table */}
        <SectionCard title="All Expenses" icon={<Receipt className="h-5 w-5" />}>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : records.length === 0 ? (
            <EmptyState icon={<Receipt className="h-12 w-12" />} title="No expenses" description="No transactions match the current filters." />
          ) : (
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Transaction</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">VAT</TableHead>
                    <TableHead>VAT Status</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => {
                    const meta = paymentStatusMeta[r.paymentStatus];
                    return (
                      <TableRow key={r.id} className="hover:bg-muted/20">
                        <TableCell>
                          <p className="font-medium truncate max-w-[260px]">{r.title}</p>
                          <p className="text-xs text-muted-foreground font-mono">{r.transactionId}</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{r.supplierName}</p>
                          {r.supplierVatNumber && (
                            <p className="text-xs text-muted-foreground">VAT: {r.supplierVatNumber}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{r.categoryName}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(r.amount, r.currency)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.vatAmount, r.currency)}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              r.vatClaimable
                                ? "bg-success/10 text-success border-success/30"
                                : "bg-muted text-muted-foreground"
                            }
                          >
                            <BadgePercent className="h-3 w-3 mr-1" />
                            {r.vatClaimable ? "Claimable" : "Non-Claimable"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.approvalDate ? format(new Date(r.approvalDate), "dd MMM yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Category Drill-down */}
      <Dialog open={!!categoryDrillDown} onOpenChange={(o) => !o && setCategoryDrillDown(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              {categoryDrillDown?.categoryName} — Transactions
            </DialogTitle>
          </DialogHeader>
          {categoryDrillDown && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Card><CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Total Spent</p>
                  <p className="text-xl font-bold text-primary">{formatCurrency(categoryDrillDown.totalSpent)}</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">VAT</p>
                  <p className="text-xl font-bold text-warning">{formatCurrency(categoryDrillDown.totalVat)}</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Transactions</p>
                  <p className="text-xl font-bold">{categoryDrillDown.count}</p>
                </CardContent></Card>
              </div>
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Transaction</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">VAT</TableHead>
                      <TableHead>Approved</TableHead>
                      <TableHead>Payment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillRecords.map((r) => {
                      const meta = paymentStatusMeta[r.paymentStatus];
                      return (
                        <TableRow key={r.id}>
                          <TableCell>
                            <p className="font-medium truncate max-w-[220px]">{r.title}</p>
                            <p className="text-xs text-muted-foreground font-mono">{r.transactionId}</p>
                          </TableCell>
                          <TableCell>{r.supplierName}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(r.amount, r.currency)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(r.vatAmount, r.currency)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {r.approvalDate ? format(new Date(r.approvalDate), "dd MMM yyyy") : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
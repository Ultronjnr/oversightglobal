import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  User,
  FileText,
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Eye,
  X,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  getPRHistory,
  exportPRHistoryToCSV,
  type PRHistoryFilters,
} from "@/services/pr-history.service";
import { DocumentViewerModal } from "@/components/pr/DocumentViewerModal";
import type { PurchaseRequisition, PRStatus, UrgencyLevel, PRItem } from "@/types/pr.types";

const STATUS_OPTIONS: { value: PRStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Statuses" },
  { value: "PENDING_HOD_APPROVAL", label: "Pending HOD" },
  { value: "HOD_APPROVED", label: "HOD Approved" },
  { value: "HOD_DECLINED", label: "HOD Declined" },
  { value: "PENDING_FINANCE_APPROVAL", label: "Pending Finance" },
  { value: "FINANCE_APPROVED", label: "Approved" },
  { value: "FINANCE_DECLINED", label: "Declined" },
  { value: "SPLIT", label: "Split" },
];

const URGENCY_OPTIONS: { value: UrgencyLevel | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Urgencies" },
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

const statusConfig: Record<string, { label: string; className: string }> = {
  PENDING_HOD_APPROVAL: { label: "Pending HOD", className: "bg-warning/10 text-warning" },
  HOD_APPROVED: { label: "HOD Approved", className: "bg-blue-500/10 text-blue-600" },
  HOD_DECLINED: { label: "HOD Declined", className: "bg-destructive/10 text-destructive" },
  PENDING_FINANCE_APPROVAL: { label: "Pending Finance", className: "bg-orange-500/10 text-orange-600" },
  FINANCE_APPROVED: { label: "Approved", className: "bg-success/10 text-success" },
  FINANCE_DECLINED: { label: "Declined", className: "bg-destructive/10 text-destructive" },
  SPLIT: { label: "Split", className: "bg-purple-500/10 text-purple-600" },
};

const urgencyConfig: Record<string, { label: string; className: string }> = {
  LOW: { label: "Low", className: "bg-muted text-muted-foreground" },
  NORMAL: { label: "Normal", className: "bg-blue-500/10 text-blue-600" },
  HIGH: { label: "High", className: "bg-warning/10 text-warning" },
  URGENT: { label: "Urgent", className: "bg-destructive/10 text-destructive" },
};

const PAGE_SIZE = 10;

export default function PRHistory() {
  const { user, role, profile } = useAuth();
  const navigate = useNavigate();
  
  const [prs, setPrs] = useState<PurchaseRequisition[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPR, setSelectedPR] = useState<PurchaseRequisition | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [documentModal, setDocumentModal] = useState<{
    isOpen: boolean;
    url: string;
    transactionId: string;
  }>({ isOpen: false, url: "", transactionId: "" });

  const openDocumentViewer = (url: string, transactionId: string) => {
    setDocumentModal({ isOpen: true, url, transactionId });
  };

  const closeDocumentViewer = () => {
    setDocumentModal({ isOpen: false, url: "", transactionId: "" });
  };

  // Filters
  const [filters, setFilters] = useState<PRHistoryFilters>({
    status: "ALL",
    urgency: "ALL",
    dateFrom: "",
    dateTo: "",
    search: "",
  });

  const getNavItems = () => {
    const baseHref = role === "EMPLOYEE"
      ? "/employee/portal"
      : role === "HOD"
      ? "/hod/portal"
      : role === "FINANCE"
      ? "/finance/portal"
      : "/admin/portal";

    return [
      { label: "My Portal", href: baseHref, icon: <User className="h-4 w-4" /> },
      { label: "PR History", href: "/pr-history", icon: <FileText className="h-4 w-4" /> },
    ];
  };

  const fetchHistory = useCallback(async () => {
    if (!user || !role) return;

    setIsLoading(true);
    const result = await getPRHistory(
      role,
      user.id,
      profile?.department || null,
      filters,
      currentPage,
      PAGE_SIZE
    );

    if (result.success) {
      setPrs(result.data);
      setTotalCount(result.totalCount);
    } else {
      toast.error(result.error || "Failed to load PR history");
    }
    setIsLoading(false);
  }, [user, role, profile?.department, filters, currentPage]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSearch = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
    setCurrentPage(1);
  };

  const handleFilterChange = (key: keyof PRHistoryFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      status: "ALL",
      urgency: "ALL",
      dateFrom: "",
      dateTo: "",
      search: "",
    });
    setCurrentPage(1);
  };

  const handleExport = () => {
    if (prs.length === 0) {
      toast.error("No data to export");
      return;
    }

    const csvContent = exportPRHistoryToCSV(prs);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `pr-history-${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("PR history exported successfully");
  };

  const handleViewDetails = (pr: PurchaseRequisition) => {
    setSelectedPR(pr);
    setShowDetailModal(true);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const formatCurrency = (amount: number, currency: string = "ZAR") => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency,
    }).format(amount);
  };

  return (
    <DashboardLayout title="Purchase Requisition History" navItems={getNavItems()}>
      <div className="space-y-6">
        {/* Subtitle */}
        <p className="text-muted-foreground -mt-4">
          View and search through all your purchase requisitions
        </p>

        {/* Search and Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Transaction ID or Requester..."
              value={filters.search || ""}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
              {(filters.status !== "ALL" || filters.urgency !== "ALL" || filters.dateFrom || filters.dateTo) && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                  !
                </Badge>
              )}
            </Button>
            <Button variant="outline" onClick={fetchHistory} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <SectionCard title="Filters" icon={<Filter className="h-5 w-5" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={filters.status || "ALL"}
                  onValueChange={(value) => handleFilterChange("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Urgency</label>
                <Select
                  value={filters.urgency || "ALL"}
                  onValueChange={(value) => handleFilterChange("urgency", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select urgency" />
                  </SelectTrigger>
                  <SelectContent>
                    {URGENCY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">From Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={filters.dateFrom || ""}
                    onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">To Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={filters.dateTo || ""}
                    onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <Button variant="ghost" onClick={clearFilters} className="gap-2">
                <X className="h-4 w-4" />
                Clear Filters
              </Button>
            </div>
          </SectionCard>
        )}

        {/* Results Summary */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {prs.length} of {totalCount} requisitions
          </p>
        </div>

        {/* Table */}
        <SectionCard>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : prs.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-16 w-16" />}
              title="No Requisitions Found"
              description="No purchase requisitions match your search criteria."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Urgency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prs.map((pr) => (
                    <TableRow key={pr.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">
                        {pr.transaction_id}
                      </TableCell>
                      <TableCell className="font-medium">
                        {pr.requested_by_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {pr.requested_by_department || "N/A"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(pr.total_amount, pr.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge className={urgencyConfig[pr.urgency]?.className}>
                          {urgencyConfig[pr.urgency]?.label || pr.urgency}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig[pr.status]?.className}>
                          {statusConfig[pr.status]?.label || pr.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(pr.created_at), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(pr)}
                          className="gap-1"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border pt-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Detail Modal */}
        <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {selectedPR?.transaction_id}
              </DialogTitle>
            </DialogHeader>

            {selectedPR && (
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Requester</p>
                    <p className="font-medium">{selectedPR.requested_by_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Department</p>
                    <p className="font-medium">{selectedPR.requested_by_department || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Amount</p>
                    <p className="font-medium text-success">
                      {formatCurrency(selectedPR.total_amount, selectedPR.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-medium">
                      {format(new Date(selectedPR.created_at), "MMM dd, yyyy HH:mm")}
                    </p>
                  </div>
                </div>

                {/* Status */}
                <div className="flex gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Status</p>
                    <Badge className={statusConfig[selectedPR.status]?.className}>
                      {statusConfig[selectedPR.status]?.label || selectedPR.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Urgency</p>
                    <Badge className={urgencyConfig[selectedPR.urgency]?.className}>
                      {urgencyConfig[selectedPR.urgency]?.label || selectedPR.urgency}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">HOD Status</p>
                    <Badge variant="outline">{selectedPR.hod_status}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Finance Status</p>
                    <Badge variant="outline">{selectedPR.finance_status}</Badge>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <p className="text-sm font-medium mb-2">Items</p>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(selectedPR.items as PRItem[]).map((item, index) => (
                          <TableRow key={item.id || index}>
                            <TableCell>{item.description}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.unit_price, selectedPR.currency)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(item.total, selectedPR.currency)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* History */}
                {selectedPR.history && selectedPR.history.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">History</p>
                    <div className="space-y-2">
                      {selectedPR.history.map((entry, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">{entry.action}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(entry.timestamp), "MMM dd, yyyy HH:mm")}
                              </p>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              by {entry.user_name}
                            </p>
                            {entry.details && (
                              <p className="text-sm mt-1">{entry.details}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">Due Date</p>
                    <p className="font-medium">
                      {selectedPR.due_date
                        ? format(new Date(selectedPR.due_date), "MMM dd, yyyy")
                        : "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Due Date</p>
                    <p className="font-medium">
                      {selectedPR.payment_due_date
                        ? format(new Date(selectedPR.payment_due_date), "MMM dd, yyyy")
                        : "Not set"}
                    </p>
                  </div>
                </div>

                {/* Document */}
                {selectedPR.document_url && (
                  <div className="pt-4 border-t">
                    <button
                      onClick={() => openDocumentViewer(selectedPR.document_url!, selectedPR.transaction_id)}
                      className="inline-flex items-center gap-2 text-primary hover:underline font-medium cursor-pointer bg-transparent border-none p-0"
                    >
                      <FileText className="h-4 w-4" />
                      View Attached Document
                    </button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Document Viewer Modal */}
        <DocumentViewerModal
          isOpen={documentModal.isOpen}
          onClose={closeDocumentViewer}
          documentUrl={documentModal.url}
          transactionId={documentModal.transactionId}
        />
      </div>
    </DashboardLayout>
  );
}

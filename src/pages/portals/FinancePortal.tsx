import { useState, useEffect } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  User,
  DollarSign,
  BarChart3,
  Building2,
  FileText,
  Inbox,
  X,
  RefreshCw,
  ShoppingCart,
  Check,
  Scissors,
  Send,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Clock,
} from "lucide-react";

import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { SectionCard } from "@/components/ui/section-card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinalizationModal } from "@/components/pr/FinalizationModal";
import { SplitPRModal } from "@/components/pr/SplitPRModal";
import { PurchaseRequisitionModal } from "@/components/pr/PurchaseRequisitionModal";
import { QuoteRequestModal } from "@/components/finance/QuoteRequestModal";
import { SupplierList } from "@/components/finance/SupplierList";
import { QuotesTable } from "@/components/finance/QuotesTable";
import {
  getFinancePendingPRs,
  getQuotes,
  financeApprovePR,
  financeDeclinePR,
} from "@/services/finance.service";
import type { PurchaseRequisition, PRItem } from "@/types/pr.types";

const urgencyConfig: Record<string, { label: string; className: string }> = {
  LOW: { label: "Low", className: "bg-muted text-muted-foreground" },
  NORMAL: { label: "Normal", className: "bg-blue-500/10 text-blue-600" },
  HIGH: { label: "High", className: "bg-warning/10 text-warning" },
  URGENT: { label: "Urgent", className: "bg-destructive/10 text-destructive" },
};

export default function FinancePortal() {
  const [prs, setPrs] = useState<PurchaseRequisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({ pending: 0, quotes: 0, approved: 0, declined: 0 });
  const [showCleared, setShowCleared] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Modal states
  const [selectedPR, setSelectedPR] = useState<PurchaseRequisition | null>(null);
  const [modalAction, setModalAction] = useState<"approve" | "decline" | null>(null);
  const [showFinalizationModal, setShowFinalizationModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showIncomingModal, setShowIncomingModal] = useState(false);
  const [showPRModal, setShowPRModal] = useState(false);

  const navItems = [
    { label: "My Portal", href: "/finance/portal", icon: <User className="h-4 w-4" /> },
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prsResult, quotesResult] = await Promise.all([
        getFinancePendingPRs(),
        getQuotes(),
      ]);

      if (prsResult.success) {
        setPrs(prsResult.data);
        setStats((prev) => ({ ...prev, pending: prsResult.data.length }));
      } else {
        toast.error(prsResult.error || "Failed to fetch PRs");
      }
      
      if (quotesResult.success) {
        const pendingQuotes = quotesResult.data.filter(q => q.status === "SUBMITTED").length;
        setStats((prev) => ({ ...prev, quotes: pendingQuotes }));
      }
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openApproveModal = (pr: PurchaseRequisition) => {
    setSelectedPR(pr);
    setModalAction("approve");
    setShowFinalizationModal(true);
  };

  const openDeclineModal = (pr: PurchaseRequisition) => {
    setSelectedPR(pr);
    setModalAction("decline");
    setShowFinalizationModal(true);
  };

  const openSplitModal = (pr: PurchaseRequisition) => {
    setSelectedPR(pr);
    setShowSplitModal(true);
  };

  const openQuoteModal = (pr: PurchaseRequisition) => {
    setSelectedPR(pr);
    setShowQuoteModal(true);
  };

  const handleFinalization = async (
    prId: string,
    action: "approve" | "decline",
    comments: string
  ) => {
    try {
      const result =
        action === "approve"
          ? await financeApprovePR(prId, comments)
          : await financeDeclinePR(prId, comments);

      if (result.success) {
        toast.success(
          action === "approve"
            ? "PR approved successfully"
            : "PR declined and returned"
        );
        setStats((prev) => ({
          ...prev,
          [action === "approve" ? "approved" : "declined"]:
            prev[action === "approve" ? "approved" : "declined"] + 1,
        }));
        fetchData();
      } else {
        toast.error(result.error || "Action failed");
      }
    } catch (error) {
      console.error("Finalization error:", error);
      toast.error("An error occurred");
    }
  };

  const handleClearDashboard = () => {
    setShowCleared(true);
    toast.success("Dashboard cleared");
  };

  const handleRefreshDashboard = () => {
    setShowCleared(false);
    setRefreshTrigger((prev) => prev + 1);
    toast.success("Dashboard refreshed");
  };

  const handlePRFormSuccess = () => {
    setShowPRModal(false);
    setShowCleared(false);
    setRefreshTrigger((prev) => prev + 1);
    toast.success("Purchase requisition submitted successfully");
  };

  const formatCurrency = (amount: number, currency: string = "ZAR") => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency,
    }).format(amount);
  };

  return (
    <DashboardLayout title="Finance Dashboard" navItems={navItems}>
      <div className="space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            label="Pending Review"
            value={stats.pending}
            valueColor="warning"
            isLoading={loading}
          />
          <StatCard
            label="Pending Quotes"
            value={stats.quotes}
            valueColor="primary"
            isLoading={loading}
          />
          <StatCard
            label="Approved Today"
            value={stats.approved}
            valueColor="success"
            isLoading={loading}
          />
          <StatCard
            label="Declined Today"
            value={stats.declined}
            valueColor="destructive"
            isLoading={loading}
          />
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            className="bg-foreground text-background hover:bg-foreground/90 gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Procurement Analytics
          </Button>
          <Button
            variant="outline"
            className="gap-2 bg-white hover:bg-muted/50"
            onClick={() => setShowPRModal(true)}
          >
            <ShoppingCart className="h-4 w-4" />
            New Purchase Requisition
          </Button>
          
          {/* Prominent blue circled button */}
          <Button
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-6"
            onClick={() => setShowIncomingModal(true)}
          >
            <Inbox className="h-4 w-4" />
            Incoming Purchase Requisitions
            {stats.pending > 0 && (
              <Badge variant="secondary" className="ml-1 bg-white text-primary">
                {stats.pending}
              </Badge>
            )}
          </Button>

          <Button
            variant="outline"
            className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/5 bg-destructive/5"
            onClick={handleClearDashboard}
          >
            <X className="h-4 w-4" />
            Clear Dashboard
          </Button>
          <Button
            variant="outline"
            className="gap-2 text-success border-success/30 hover:bg-success/5 bg-success/5"
            onClick={handleRefreshDashboard}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Dashboard
          </Button>
        </div>

        {/* Main Content Card */}
        <SectionCard
          title="Finance Overview"
          icon={<DollarSign className="h-5 w-5" />}
        >
          {showCleared ? (
            <EmptyState
              icon={<FileText className="h-16 w-16" />}
              title="Dashboard Cleared"
              description="Your dashboard is now clean. Click 'Incoming Purchase Requisitions' to review pending approvals."
            />
          ) : (
            <Tabs defaultValue="approvals" className="space-y-4">
              <TabsList>
                <TabsTrigger value="approvals" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Approvals
                </TabsTrigger>
                <TabsTrigger value="suppliers" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Suppliers
                </TabsTrigger>
                <TabsTrigger value="quotes" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Quotes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="approvals">
                <EmptyState
                  icon={<DollarSign className="h-16 w-16" />}
                  title="No Pending Approvals"
                  description="Requisitions requiring your approval will appear here. Click 'Incoming Purchase Requisitions' to view the full queue."
                />
              </TabsContent>

              <TabsContent value="suppliers">
                <SupplierList />
              </TabsContent>

              <TabsContent value="quotes">
                <QuotesTable />
              </TabsContent>
            </Tabs>
          )}
        </SectionCard>
      </div>

      {/* Incoming Purchase Requisitions Modal */}
      <Dialog open={showIncomingModal} onOpenChange={setShowIncomingModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Inbox className="h-5 w-5" />
              Incoming Purchase Requisitions
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : prs.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-16 w-16" />}
                title="No Pending Approvals"
                description="There are no requisitions waiting for your approval at this time."
              />
            ) : (
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead>Requester</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Urgency</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prs.map((pr) => (
                      <>
                        <TableRow
                          key={pr.id}
                          className="cursor-pointer hover:bg-muted/20"
                          onClick={() => toggleRow(pr.id)}
                        >
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              {expandedRows.has(pr.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {pr.transaction_id}
                          </TableCell>
                          <TableCell>{pr.requested_by_name}</TableCell>
                          <TableCell>{pr.requested_by_department || "-"}</TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                urgencyConfig[pr.urgency]?.className || ""
                              }`}
                            >
                              {urgencyConfig[pr.urgency]?.label || pr.urgency}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(pr.total_amount, pr.currency)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(pr.created_at), "dd MMM yyyy")}
                          </TableCell>
                          <TableCell>
                            <div
                              className="flex items-center justify-end gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                                onClick={() => openApproveModal(pr)}
                                title="Approve"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => openDeclineModal(pr)}
                                title="Decline"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                onClick={() => openSplitModal(pr)}
                                title="Split"
                              >
                                <Scissors className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                onClick={() => openQuoteModal(pr)}
                                title="Request Quote"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Details */}
                        {expandedRows.has(pr.id) && (
                          <TableRow key={`${pr.id}-details`}>
                            <TableCell colSpan={8} className="bg-muted/10 p-4">
                              <div className="space-y-4">
                                {/* Items */}
                                <div>
                                  <h4 className="font-medium mb-2">Line Items</h4>
                                  <div className="rounded-lg border border-border/30 overflow-hidden">
                                    <table className="w-full text-sm">
                                      <thead className="bg-muted/30">
                                        <tr>
                                          <th className="text-left p-2">Description</th>
                                          <th className="text-right p-2">Qty</th>
                                          <th className="text-right p-2">Unit Price</th>
                                          <th className="text-right p-2">Total</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(pr.items as PRItem[]).map((item, idx) => (
                                          <tr key={idx} className="border-t border-border/30">
                                            <td className="p-2">{item.description}</td>
                                            <td className="text-right p-2">{item.quantity}</td>
                                            <td className="text-right p-2">
                                              {formatCurrency(item.unit_price, pr.currency)}
                                            </td>
                                            <td className="text-right p-2 font-medium">
                                              {formatCurrency(item.total, pr.currency)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                {/* Additional Info */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Due Date:</span>
                                    <p className="font-medium">
                                      {pr.due_date
                                        ? format(new Date(pr.due_date), "dd MMM yyyy")
                                        : "-"}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Payment Due:</span>
                                    <p className="font-medium">
                                      {pr.payment_due_date
                                        ? format(new Date(pr.payment_due_date), "dd MMM yyyy")
                                        : "-"}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Items:</span>
                                    <p className="font-medium">
                                      {(pr.items as PRItem[]).length} item(s)
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Total:</span>
                                    <p className="font-medium text-primary">
                                      {formatCurrency(pr.total_amount, pr.currency)}
                                    </p>
                                  </div>
                                </div>

                                {/* Document */}
                                {pr.document_url && (
                                  <div>
                                    <a
                                      href={pr.document_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 text-primary hover:underline"
                                    >
                                      <FileText className="h-4 w-4" />
                                      View Attached Document
                                    </a>
                                  </div>
                                )}

                                {/* History */}
                                {pr.history && (pr.history as any[]).length > 0 && (
                                  <div>
                                    <h4 className="font-medium mb-2">History</h4>
                                    <div className="space-y-2">
                                      {(pr.history as any[]).map((entry, idx) => (
                                        <div
                                          key={idx}
                                          className="text-sm p-2 bg-background rounded"
                                        >
                                          <span className="font-medium">{entry.action}</span>
                                          <span className="text-muted-foreground">
                                            {" "}by {entry.user_name} on{" "}
                                            {format(new Date(entry.timestamp), "dd MMM yyyy HH:mm")}
                                          </span>
                                          {entry.details && (
                                            <p className="text-muted-foreground mt-1">{entry.details}</p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* New PR Modal */}
      <PurchaseRequisitionModal
        open={showPRModal}
        onOpenChange={setShowPRModal}
        onSuccess={handlePRFormSuccess}
      />

      {/* Finalization Modal */}
      <FinalizationModal
        pr={selectedPR}
        action={modalAction}
        open={showFinalizationModal}
        onClose={() => {
          setShowFinalizationModal(false);
          setSelectedPR(null);
          setModalAction(null);
        }}
        onConfirm={handleFinalization}
      />

      {/* Split Modal */}
      <SplitPRModal
        pr={selectedPR}
        open={showSplitModal}
        onClose={() => {
          setShowSplitModal(false);
          setSelectedPR(null);
        }}
        onSuccess={() => {
          setShowSplitModal(false);
          setSelectedPR(null);
          fetchData();
        }}
        role="FINANCE"
      />

      {/* Quote Request Modal */}
      {selectedPR && (
        <QuoteRequestModal
          open={showQuoteModal}
          onClose={() => {
            setShowQuoteModal(false);
            setSelectedPR(null);
          }}
          pr={selectedPR}
          onSuccess={() => {
            setShowQuoteModal(false);
            setSelectedPR(null);
            fetchData();
          }}
        />
      )}
    </DashboardLayout>
  );
}

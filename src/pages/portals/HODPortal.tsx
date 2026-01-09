import { useState, useEffect } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  User,
  FileText,
  ClipboardCheck,
  Check,
  X,
  Scissors,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Loader2,
} from "lucide-react";

import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FinalizationModal } from "@/components/pr/FinalizationModal";
import { SplitPRModal } from "@/components/pr/SplitPRModal";
import {
  getHODPendingPRs,
  hodApprovePR,
  hodDeclinePR,
  hodSplitPR,
} from "@/services/approval.service";
import type { PurchaseRequisition, PRItem } from "@/types/pr.types";

const urgencyConfig: Record<string, { label: string; className: string }> = {
  LOW: { label: "Low", className: "bg-muted text-muted-foreground" },
  NORMAL: { label: "Normal", className: "bg-blue-500/10 text-blue-600" },
  HIGH: { label: "High", className: "bg-warning/10 text-warning" },
  URGENT: { label: "Urgent", className: "bg-destructive/10 text-destructive" },
};

export default function HODPortal() {
  const [prs, setPrs] = useState<PurchaseRequisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({ pending: 0, approved: 0, declined: 0 });

  // Modal states
  const [selectedPR, setSelectedPR] = useState<PurchaseRequisition | null>(null);
  const [modalAction, setModalAction] = useState<"approve" | "decline" | null>(null);
  const [showFinalizationModal, setShowFinalizationModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);

  const navItems = [
    { label: "My Portal", href: "/hod/portal", icon: <User className="h-4 w-4" /> },
    { label: "Pending Approvals", href: "/hod/portal", icon: <ClipboardCheck className="h-4 w-4" /> },
  ];

  const fetchPRs = async () => {
    setLoading(true);
    try {
      const result = await getHODPendingPRs();
      if (result.success) {
        setPrs(result.data);
        setStats((prev) => ({ ...prev, pending: result.data.length }));
      } else {
        toast.error(result.error || "Failed to fetch PRs");
      }
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPRs();
  }, []);

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

  const handleFinalization = async (
    prId: string,
    action: "approve" | "decline",
    comments: string
  ) => {
    try {
      const result =
        action === "approve"
          ? await hodApprovePR(prId, comments)
          : await hodDeclinePR(prId, comments);

      if (result.success) {
        toast.success(
          action === "approve"
            ? "PR approved and forwarded to Finance"
            : "PR declined and returned to employee"
        );
        setStats((prev) => ({
          ...prev,
          [action === "approve" ? "approved" : "declined"]:
            prev[action === "approve" ? "approved" : "declined"] + 1,
        }));
        fetchPRs();
      } else {
        toast.error(result.error || "Action failed");
      }
    } catch (error) {
      console.error("Finalization error:", error);
      toast.error("An error occurred");
    }
  };

  const handleSplit = async (
    prId: string,
    splits: { items: PRItem[]; comments: string }[]
  ) => {
    try {
      const result = await hodSplitPR(prId, splits);

      if (result.success) {
        toast.success(`PR split into ${splits.length} child PRs`);
        fetchPRs();
      } else {
        toast.error(result.error || "Split failed");
      }
    } catch (error) {
      console.error("Split error:", error);
      toast.error("An error occurred");
    }
  };

  return (
    <DashboardLayout title="HOD Dashboard" navItems={navItems}>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="dashboard-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Pending Review</p>
              <p className="text-3xl font-bold text-warning mt-1">{stats.pending}</p>
            </CardContent>
          </Card>
          <Card className="dashboard-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Approved Today</p>
              <p className="text-3xl font-bold text-success mt-1">{stats.approved}</p>
            </CardContent>
          </Card>
          <Card className="dashboard-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Declined Today</p>
              <p className="text-3xl font-bold text-destructive mt-1">{stats.declined}</p>
            </CardContent>
          </Card>
        </div>

        {/* Pending Approvals Queue */}
        <Card className="dashboard-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Pending Approvals
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={fetchPRs} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : prs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-foreground mb-1">No Pending Approvals</h3>
                <p className="text-sm text-muted-foreground">
                  Requisitions requiring your approval will appear here.
                </p>
              </div>
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
                            {pr.currency} {pr.total_amount.toLocaleString()}
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
                                              R {item.unit_price.toFixed(2)}
                                            </td>
                                            <td className="text-right p-2 font-medium">
                                              R {item.total.toFixed(2)}
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
                                      {pr.currency} {pr.total_amount.toLocaleString()}
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
          </CardContent>
        </Card>
      </div>

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
        onConfirm={handleSplit}
      />
    </DashboardLayout>
  );
}

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, FileText, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { DocumentViewerModal } from "./DocumentViewerModal";
import { PRChatButton } from "./PRChatButton";
import { PRChatSlidePanel } from "./PRChatSlidePanel";
import { getUserPurchaseRequisitions } from "@/services/pr.service";
import { formatCurrency } from "@/lib/utils";
import type { PurchaseRequisition, PRItem, PRStatus } from "@/types/pr.types";

interface ChatState {
  open: boolean;
  prId: string;
  transactionId: string;
}

interface PurchaseRequisitionTableProps {
  refreshTrigger?: number;
}

export function PurchaseRequisitionTable({ refreshTrigger }: PurchaseRequisitionTableProps) {
  const [prs, setPrs] = useState<PurchaseRequisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [chatPanel, setChatPanel] = useState<ChatState>({ open: false, prId: "", transactionId: "" });
  const [documentModal, setDocumentModal] = useState<{
    isOpen: boolean;
    url: string;
    transactionId: string;
    prId: string;
  }>({ isOpen: false, url: "", transactionId: "", prId: "" });

  const openDocumentViewer = (url: string, transactionId: string, prId: string) => {
    setDocumentModal({ isOpen: true, url, transactionId, prId });
  };

  const closeDocumentViewer = () => {
    setDocumentModal({ isOpen: false, url: "", transactionId: "", prId: "" });
  };

  const fetchPRs = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getUserPurchaseRequisitions();
      if (!result.success) {
        setError(result.error || "Failed to fetch PRs");
        return;
      }
      setPrs(result.data);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPRs();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-destructive mb-4">{error}</p>
        <Button variant="outline" onClick={fetchPRs}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (prs.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-16 w-16" />}
        title="No Purchase Requisitions"
        description="You haven't submitted any purchase requisitions yet. Click 'New Purchase Requisition' to get started."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-10"></TableHead>
              <TableHead className="font-semibold">Transaction ID</TableHead>
              <TableHead className="font-semibold">Department</TableHead>
              <TableHead className="font-semibold">Urgency</TableHead>
              <TableHead className="text-right font-semibold">Amount</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Created</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prs.map((pr, index) => (
              <>
                <TableRow
                  key={pr.id}
                  className={`cursor-pointer hover:bg-muted/20 ${index % 2 === 1 ? 'bg-muted/10' : ''}`}
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
                  <TableCell className="font-mono text-sm text-foreground">
                    {pr.transaction_id}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{pr.requested_by_department || "-"}</TableCell>
                  <TableCell>
                    <StatusBadge type="urgency" status={pr.urgency} showIcon={pr.urgency === 'HIGH' || pr.urgency === 'URGENT'} />
                  </TableCell>
                  <TableCell className="text-right font-semibold text-foreground">
                    {formatCurrency(pr.total_amount, pr.currency)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge type="pr" status={pr.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(pr.created_at), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <PRChatButton
                      prId={pr.id}
                      onClick={() => setChatPanel({ open: true, prId: pr.id, transactionId: pr.transaction_id })}
                    />
                  </TableCell>
                </TableRow>

                {/* Expanded Details */}
                {expandedRows.has(pr.id) && (
                  <TableRow key={`${pr.id}-details`}>
                    <TableCell colSpan={8} className="bg-muted/5 p-6">
                      <div className="space-y-4">
                        {/* Items */}
                        <div>
                          <h4 className="font-semibold mb-3 text-foreground">Line Items</h4>
                          <div className="rounded-lg border border-border/30 overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/30">
                                <tr>
                                  <th className="text-left p-3 font-semibold">Description</th>
                                  <th className="text-right p-3 font-semibold">Qty</th>
                                  <th className="text-right p-3 font-semibold">Unit Price</th>
                                  <th className="text-right p-3 font-semibold">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(pr.items as PRItem[]).map((item, idx) => (
                                  <tr key={idx} className="border-t border-border/30">
                                    <td className="p-3">{item.description}</td>
                                    <td className="text-right p-3">{item.quantity}</td>
                                    <td className="text-right p-3">
                                      {formatCurrency(item.unit_price)}
                                    </td>
                                    <td className="text-right p-3 font-medium">
                                      {formatCurrency(item.total)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Additional Info */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="bg-white rounded-lg p-3 border border-border/30">
                            <span className="text-muted-foreground text-xs">Due Date</span>
                            <p className="font-medium mt-1">
                              {pr.due_date
                                ? format(new Date(pr.due_date), "dd MMM yyyy")
                                : "-"}
                            </p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-border/30">
                            <span className="text-muted-foreground text-xs">Payment Due</span>
                            <p className="font-medium mt-1">
                              {pr.payment_due_date
                                ? format(new Date(pr.payment_due_date), "dd MMM yyyy")
                                : "-"}
                            </p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-border/30">
                            <span className="text-muted-foreground text-xs">HOD Status</span>
                            <p className="font-medium mt-1">{pr.hod_status}</p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-border/30">
                            <span className="text-muted-foreground text-xs">Finance Status</span>
                            <p className="font-medium mt-1">{pr.finance_status}</p>
                          </div>
                        </div>

                        {/* Document */}
                        {pr.document_url && (
                          <div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openDocumentViewer(pr.document_url!, pr.transaction_id, pr.id);
                              }}
                              className="inline-flex items-center gap-2 text-primary hover:underline font-medium cursor-pointer bg-transparent border-none p-0"
                            >
                              <FileText className="h-4 w-4" />
                              View Attached Document
                            </button>
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

      {/* Document Viewer Modal */}
      <DocumentViewerModal
        isOpen={documentModal.isOpen}
        onClose={closeDocumentViewer}
        documentUrl={documentModal.url}
        prId={documentModal.prId}
        transactionId={documentModal.transactionId}
      />

      {/* PR Chat Slide Panel */}
      <PRChatSlidePanel
        open={chatPanel.open}
        onClose={() => setChatPanel({ open: false, prId: "", transactionId: "" })}
        prId={chatPanel.prId}
        transactionId={chatPanel.transactionId}
      />
    </div>
  );
}

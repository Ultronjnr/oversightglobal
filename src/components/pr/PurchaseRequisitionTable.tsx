import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, FileText, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";

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
import { EmptyState } from "@/components/ui/empty-state";
import { getUserPurchaseRequisitions } from "@/services/pr.service";
import type { PurchaseRequisition, PRItem, PRStatus } from "@/types/pr.types";

const statusConfig: Record<
  PRStatus,
  { label: string; className: string }
> = {
  PENDING_HOD_APPROVAL: { label: "Pending HOD", className: "bg-warning/10 text-warning border-warning/20" },
  HOD_APPROVED: { label: "HOD Approved", className: "bg-success/10 text-success border-success/20" },
  HOD_DECLINED: { label: "HOD Declined", className: "bg-destructive/10 text-destructive border-destructive/20" },
  PENDING_FINANCE_APPROVAL: { label: "Pending Finance", className: "bg-warning/10 text-warning border-warning/20" },
  FINANCE_APPROVED: { label: "Approved", className: "bg-success/10 text-success border-success/20" },
  FINANCE_DECLINED: { label: "Declined", className: "bg-destructive/10 text-destructive border-destructive/20" },
  SPLIT: { label: "Split", className: "bg-primary/10 text-primary border-primary/20" },
};

const urgencyConfig: Record<string, { label: string; className: string }> = {
  LOW: { label: "Low", className: "bg-muted text-muted-foreground" },
  NORMAL: { label: "Normal", className: "bg-primary/10 text-primary" },
  HIGH: { label: "High", className: "bg-warning/10 text-warning" },
  URGENT: { label: "Urgent", className: "bg-destructive/10 text-destructive" },
};

interface PurchaseRequisitionTableProps {
  refreshTrigger?: number;
}

export function PurchaseRequisitionTable({ refreshTrigger }: PurchaseRequisitionTableProps) {
  const [prs, setPrs] = useState<PurchaseRequisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        urgencyConfig[pr.urgency]?.className || ""
                      }`}
                    >
                      {urgencyConfig[pr.urgency]?.label || pr.urgency}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-foreground">
                    {pr.currency} {pr.total_amount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={statusConfig[pr.status]?.className || ""}
                    >
                      {statusConfig[pr.status]?.label || pr.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(pr.created_at), "dd MMM yyyy")}
                  </TableCell>
                </TableRow>

                {/* Expanded Details */}
                {expandedRows.has(pr.id) && (
                  <TableRow key={`${pr.id}-details`}>
                    <TableCell colSpan={7} className="bg-muted/5 p-6">
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
                                      R {item.unit_price.toFixed(2)}
                                    </td>
                                    <td className="text-right p-3 font-medium">
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
                            <a
                              href={pr.document_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
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
    </div>
  );
}

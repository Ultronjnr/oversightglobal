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
import { getUserPurchaseRequisitions } from "@/services/pr.service";
import type { PurchaseRequisition, PRItem, PRStatus } from "@/types/pr.types";

const statusConfig: Record<
  PRStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING_HOD_APPROVAL: { label: "Pending HOD", variant: "secondary" },
  HOD_APPROVED: { label: "HOD Approved", variant: "default" },
  HOD_DECLINED: { label: "HOD Declined", variant: "destructive" },
  PENDING_FINANCE_APPROVAL: { label: "Pending Finance", variant: "secondary" },
  FINANCE_APPROVED: { label: "Approved", variant: "default" },
  FINANCE_DECLINED: { label: "Declined", variant: "destructive" },
  SPLIT: { label: "Split", variant: "outline" },
};

const urgencyConfig: Record<string, { label: string; className: string }> = {
  LOW: { label: "Low", className: "bg-muted text-muted-foreground" },
  NORMAL: { label: "Normal", className: "bg-blue-500/10 text-blue-600" },
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
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
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No purchase requisitions yet.</p>
        <p className="text-sm">Create your first PR using the form above.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Your Purchase Requisitions</h3>
        <Button variant="ghost" size="sm" onClick={fetchPRs}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="rounded-lg border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-10"></TableHead>
              <TableHead>Transaction ID</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Urgency</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
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
                  <TableCell>
                    <Badge variant={statusConfig[pr.status]?.variant || "secondary"}>
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
                    <TableCell colSpan={7} className="bg-muted/10 p-4">
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
                            <span className="text-muted-foreground">HOD Status:</span>
                            <p className="font-medium">{pr.hod_status}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Finance Status:</span>
                            <p className="font-medium">{pr.finance_status}</p>
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
    </div>
  );
}

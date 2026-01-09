import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Check,
  X,
  Split,
  FileText,
  Send,
  AlertTriangle,
  Clock,
} from "lucide-react";
import {
  getFinancePendingPRs,
  financeApprovePR,
  financeDeclinePR,
} from "@/services/finance.service";
import { FinalizationModal } from "@/components/pr/FinalizationModal";
import { SplitPRModal } from "@/components/pr/SplitPRModal";
import { QuoteRequestModal } from "./QuoteRequestModal";
import type { PurchaseRequisition, PRItem } from "@/types/pr.types";
import { format } from "date-fns";

export function FinanceApprovalQueue() {
  const [prs, setPRs] = useState<PurchaseRequisition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [approveModalPR, setApproveModalPR] = useState<PurchaseRequisition | null>(null);
  const [declineModalPR, setDeclineModalPR] = useState<PurchaseRequisition | null>(null);
  const [splitModalPR, setSplitModalPR] = useState<PurchaseRequisition | null>(null);
  const [quoteModalPR, setQuoteModalPR] = useState<PurchaseRequisition | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchPRs();
  }, []);

  const fetchPRs = async () => {
    setIsLoading(true);
    try {
      const result = await getFinancePendingPRs();
      if (result.success) {
        setPRs(result.data);
      } else {
        toast.error("Failed to load PRs");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRow = (prId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(prId)) {
      newExpanded.delete(prId);
    } else {
      newExpanded.add(prId);
    }
    setExpandedRows(newExpanded);
  };

  const handleApprove = async (comments: string) => {
    if (!approveModalPR) return;
    setActionLoading(true);
    try {
      const result = await financeApprovePR(approveModalPR.id, comments);
      if (result.success) {
        toast.success("PR approved successfully");
        setApproveModalPR(null);
        fetchPRs();
      } else {
        toast.error(result.error || "Failed to approve PR");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async (comments: string) => {
    if (!declineModalPR) return;
    setActionLoading(true);
    try {
      const result = await financeDeclinePR(declineModalPR.id, comments);
      if (result.success) {
        toast.success("PR declined");
        setDeclineModalPR(null);
        fetchPRs();
      } else {
        toast.error(result.error || "Failed to decline PR");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = "ZAR") => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "URGENT":
        return (
          <Badge variant="destructive">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Urgent
          </Badge>
        );
      case "HIGH":
        return (
          <Badge className="bg-warning/20 text-warning border-warning/30">
            High
          </Badge>
        );
      case "NORMAL":
        return <Badge variant="secondary">Normal</Badge>;
      case "LOW":
        return <Badge variant="outline">Low</Badge>;
      default:
        return <Badge variant="secondary">{urgency}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            Pending Finance Approvals
          </CardTitle>
        </CardHeader>
        <CardContent>
          {prs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground mb-1">
                No Pending Approvals
              </h3>
              <p className="text-sm text-muted-foreground">
                Requisitions requiring finance approval will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Urgency</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prs.map((pr) => (
                    <Collapsible key={pr.id} asChild>
                      <>
                        <TableRow className="cursor-pointer hover:bg-muted/50">
                          <TableCell>
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleRow(pr.id)}
                              >
                                {expandedRows.has(pr.id) ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          </TableCell>
                          <TableCell className="font-medium">
                            {pr.transaction_id}
                          </TableCell>
                          <TableCell>{pr.requested_by_name}</TableCell>
                          <TableCell>
                            {pr.requested_by_department || "-"}
                          </TableCell>
                          <TableCell className="font-semibold text-primary">
                            {formatCurrency(pr.total_amount, pr.currency)}
                          </TableCell>
                          <TableCell>{getUrgencyBadge(pr.urgency)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {format(new Date(pr.created_at), "dd MMM yyyy")}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => setApproveModalPR(pr)}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setDeclineModalPR(pr)}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Decline
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSplitModalPR(pr)}
                              >
                                <Split className="h-4 w-4 mr-1" />
                                Split
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setQuoteModalPR(pr)}
                              >
                                <Send className="h-4 w-4 mr-1" />
                                Quote
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={8}>
                              <div className="p-4 space-y-4">
                                {/* Items */}
                                <div>
                                  <h4 className="font-medium mb-2">
                                    Line Items
                                  </h4>
                                  <div className="border rounded-lg divide-y">
                                    {(pr.items as PRItem[]).map((item) => (
                                      <div
                                        key={item.id}
                                        className="flex items-center justify-between p-3"
                                      >
                                        <div>
                                          <p className="font-medium">
                                            {item.description}
                                          </p>
                                          <p className="text-sm text-muted-foreground">
                                            Qty: {item.quantity} ×{" "}
                                            {formatCurrency(
                                              item.unit_price,
                                              pr.currency
                                            )}
                                          </p>
                                        </div>
                                        <p className="font-semibold">
                                          {formatCurrency(
                                            item.total,
                                            pr.currency
                                          )}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Dates */}
                                <div className="grid grid-cols-2 gap-4">
                                  {pr.due_date && (
                                    <div>
                                      <p className="text-sm text-muted-foreground">
                                        Due Date
                                      </p>
                                      <p className="font-medium">
                                        {format(
                                          new Date(pr.due_date),
                                          "dd MMM yyyy"
                                        )}
                                      </p>
                                    </div>
                                  )}
                                  {pr.payment_due_date && (
                                    <div>
                                      <p className="text-sm text-muted-foreground">
                                        Payment Due
                                      </p>
                                      <p className="font-medium">
                                        {format(
                                          new Date(pr.payment_due_date),
                                          "dd MMM yyyy"
                                        )}
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {/* History */}
                                {pr.history && (pr.history as any[]).length > 0 && (
                                  <div>
                                    <h4 className="font-medium mb-2">
                                      History
                                    </h4>
                                    <div className="space-y-2">
                                      {(pr.history as any[]).map(
                                        (entry, idx) => (
                                          <div
                                            key={idx}
                                            className="text-sm p-2 bg-background rounded"
                                          >
                                            <span className="font-medium">
                                              {entry.action}
                                            </span>
                                            <span className="text-muted-foreground">
                                              {" "}
                                              by {entry.user_name} on{" "}
                                              {format(
                                                new Date(entry.timestamp),
                                                "dd MMM yyyy HH:mm"
                                              )}
                                            </span>
                                            {entry.details && (
                                              <p className="text-muted-foreground mt-1">
                                                {entry.details}
                                              </p>
                                            )}
                                          </div>
                                        )
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve Modal */}
      {approveModalPR && (
        <FinalizationModal
          open={!!approveModalPR}
          pr={approveModalPR}
          action="approve"
          onClose={() => setApproveModalPR(null)}
          onConfirm={async (prId, action, comments) => {
            await handleApprove(comments);
          }}
        />
      )}

      {/* Decline Modal */}
      {declineModalPR && (
        <FinalizationModal
          open={!!declineModalPR}
          pr={declineModalPR}
          action="decline"
          onClose={() => setDeclineModalPR(null)}
          onConfirm={async (prId, action, comments) => {
            await handleDecline(comments);
          }}
        />
      )}

      {/* Split Modal */}
      {splitModalPR && (
        <SplitPRModal
          open={!!splitModalPR}
          onClose={() => setSplitModalPR(null)}
          pr={splitModalPR}
          onSuccess={() => {
            setSplitModalPR(null);
            fetchPRs();
          }}
          role="FINANCE"
        />
      )}

      {/* Quote Request Modal */}
      {quoteModalPR && (
        <QuoteRequestModal
          open={!!quoteModalPR}
          onClose={() => setQuoteModalPR(null)}
          pr={quoteModalPR}
          onSuccess={fetchPRs}
        />
      )}
    </>
  );
}

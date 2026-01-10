import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  FileText,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertTriangle,
  Check,
  X,
  Split,
} from "lucide-react";
import { getAllOrganizationPRs } from "@/services/admin.service";
import { DocumentViewerModal } from "@/components/pr/DocumentViewerModal";
import type { PurchaseRequisition, PRItem } from "@/types/pr.types";
import { format } from "date-fns";

export function AllPRsTab() {
  const [prs, setPRs] = useState<PurchaseRequisition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
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

  useEffect(() => {
    fetchPRs();
  }, []);

  const fetchPRs = async () => {
    setIsLoading(true);
    try {
      const result = await getAllOrganizationPRs();
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

  const filteredPRs = prs.filter((pr) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      pr.transaction_id.toLowerCase().includes(searchLower) ||
      pr.requested_by_name.toLowerCase().includes(searchLower) ||
      (pr.requested_by_department?.toLowerCase().includes(searchLower) ?? false);

    const matchesStatus = statusFilter === "ALL" || pr.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number, currency: string = "ZAR") => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING_HOD_APPROVAL":
        return (
          <Badge variant="outline" className="border-warning/30 text-warning">
            <Clock className="h-3 w-3 mr-1" />
            Pending HOD
          </Badge>
        );
      case "HOD_APPROVED":
        return (
          <Badge className="bg-success/20 text-success border-success/30">
            <Check className="h-3 w-3 mr-1" />
            HOD Approved
          </Badge>
        );
      case "HOD_DECLINED":
        return (
          <Badge variant="destructive">
            <X className="h-3 w-3 mr-1" />
            HOD Declined
          </Badge>
        );
      case "PENDING_FINANCE_APPROVAL":
        return (
          <Badge variant="outline" className="border-primary/30 text-primary">
            <Clock className="h-3 w-3 mr-1" />
            Pending Finance
          </Badge>
        );
      case "FINANCE_APPROVED":
        return (
          <Badge className="bg-success/20 text-success border-success/30">
            <Check className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "FINANCE_DECLINED":
        return (
          <Badge variant="destructive">
            <X className="h-3 w-3 mr-1" />
            Declined
          </Badge>
        );
      case "SPLIT":
        return (
          <Badge variant="secondary">
            <Split className="h-3 w-3 mr-1" />
            Split
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
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
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            All Purchase Requisitions
          </CardTitle>
          <div className="flex gap-2">
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="PENDING_HOD_APPROVAL">Pending HOD</SelectItem>
                <SelectItem value="HOD_APPROVED">HOD Approved</SelectItem>
                <SelectItem value="HOD_DECLINED">HOD Declined</SelectItem>
                <SelectItem value="PENDING_FINANCE_APPROVAL">Pending Finance</SelectItem>
                <SelectItem value="FINANCE_APPROVED">Approved</SelectItem>
                <SelectItem value="FINANCE_DECLINED">Declined</SelectItem>
                <SelectItem value="SPLIT">Split</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredPRs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-1">No Requisitions Found</h3>
            <p className="text-sm text-muted-foreground">
              {searchTerm || statusFilter !== "ALL"
                ? "Try adjusting your filters."
                : "Purchase requisitions will appear here."}
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
                  <TableHead>Amount</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPRs.map((pr) => (
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
                        <TableCell>
                          <div>
                            <p>{pr.requested_by_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {pr.requested_by_department || "-"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-primary">
                          {formatCurrency(pr.total_amount, pr.currency)}
                        </TableCell>
                        <TableCell>{getUrgencyBadge(pr.urgency)}</TableCell>
                        <TableCell>{getStatusBadge(pr.status)}</TableCell>
                        <TableCell>
                          {format(new Date(pr.created_at), "dd MMM yyyy")}
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={7}>
                            <div className="p-4 space-y-4">
                              {/* Items */}
                              <div>
                                <h4 className="font-medium mb-2">Line Items</h4>
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
                                          {formatCurrency(item.unit_price, pr.currency)}
                                        </p>
                                      </div>
                                      <p className="font-semibold">
                                        {formatCurrency(item.total, pr.currency)}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>

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
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Document */}
                              {pr.document_url && (
                                <div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDocumentViewer(pr.document_url!, pr.transaction_id);
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
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Document Viewer Modal */}
      <DocumentViewerModal
        isOpen={documentModal.isOpen}
        onClose={closeDocumentViewer}
        documentUrl={documentModal.url}
        transactionId={documentModal.transactionId}
      />
    </Card>
  );
}

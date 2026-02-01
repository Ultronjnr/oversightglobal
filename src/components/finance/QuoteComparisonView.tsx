import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2,
  FileText,
  Check,
  X,
  Clock,
  Calendar,
  Truck,
  DollarSign,
  Download,
  ExternalLink,
  Building2,
} from "lucide-react";
import {
  getQuotes,
  acceptQuote,
  rejectQuote,
  type Quote,
} from "@/services/finance.service";
import { getQuoteDocumentUrl } from "@/services/quote-document.service";
import { format } from "date-fns";

interface QuoteComparisonViewProps {
  prId?: string;
  onQuoteAction?: () => void;
}

export function QuoteComparisonView({ prId, onQuoteAction }: QuoteComparisonViewProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [filteredQuotes, setFilteredQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [documentModal, setDocumentModal] = useState<{
    isOpen: boolean;
    url: string;
    supplierName: string;
  }>({ isOpen: false, url: "", supplierName: "" });

  useEffect(() => {
    fetchQuotes();
  }, []);

  useEffect(() => {
    if (prId) {
      setFilteredQuotes(quotes.filter(q => q.pr_id === prId));
    } else {
      // Group quotes by PR for comparison
      setFilteredQuotes(quotes);
    }
  }, [quotes, prId]);

  const fetchQuotes = async () => {
    setIsLoading(true);
    try {
      const result = await getQuotes();
      if (result.success) {
        setQuotes(result.data);
      } else {
        toast.error("Failed to load quotes");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async (quote: Quote) => {
    setActionLoading(quote.id);
    try {
      const result = await acceptQuote(quote.id, quote.pr_id);
      if (result.success) {
        toast.success("Quote accepted");
        fetchQuotes();
        onQuoteAction?.();
      } else {
        toast.error(result.error || "Failed to accept quote");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (quoteId: string) => {
    setActionLoading(quoteId);
    try {
      const result = await rejectQuote(quoteId);
      if (result.success) {
        toast.success("Quote rejected");
        fetchQuotes();
        onQuoteAction?.();
      } else {
        toast.error(result.error || "Failed to reject quote");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewDocument = async (quote: Quote) => {
    if (!quote.document_url) return;

    const result = await getQuoteDocumentUrl(quote.document_url);
    if (result.success && result.url) {
      setDocumentModal({
        isOpen: true,
        url: result.url,
        supplierName: quote.supplier?.company_name || "Supplier",
      });
    } else {
      toast.error("Failed to load document");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUBMITTED":
        return (
          <Badge variant="outline" className="border-primary/30 text-primary bg-primary/10">
            <Clock className="h-3 w-3 mr-1" />
            Pending Review
          </Badge>
        );
      case "ACCEPTED":
        return (
          <Badge className="bg-success/20 text-success border-success/30">
            <Check className="h-3 w-3 mr-1" />
            Accepted
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge variant="destructive">
            <X className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      case "EXPIRED":
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Group quotes by PR for comparison
  const quotesByPR = filteredQuotes.reduce((acc, quote) => {
    if (!acc[quote.pr_id]) {
      acc[quote.pr_id] = [];
    }
    acc[quote.pr_id].push(quote);
    return acc;
  }, {} as Record<string, Quote[]>);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (filteredQuotes.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 rounded-full bg-muted mb-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground mb-1">No Quotes Yet</h3>
          <p className="text-sm text-muted-foreground">
            Supplier quotes will appear here when submitted.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {Object.entries(quotesByPR).map(([prIdKey, prQuotes]) => (
          <Card key={prIdKey}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Quotes Comparison
                <Badge variant="secondary" className="ml-2">
                  {prQuotes.length} {prQuotes.length === 1 ? "quote" : "quotes"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full">
                <div className="flex gap-4 pb-2" style={{ minWidth: prQuotes.length > 2 ? `${prQuotes.length * 320}px` : undefined }}>
                  {prQuotes.map((quote) => (
                    <div
                      key={quote.id}
                      className={`flex-1 min-w-[300px] max-w-[400px] border rounded-lg p-4 ${
                        quote.status === "ACCEPTED" 
                          ? "border-success bg-success/5" 
                          : quote.status === "REJECTED"
                          ? "border-destructive/30 bg-destructive/5 opacity-60"
                          : "border-border"
                      }`}
                    >
                      {/* Supplier Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-full bg-muted">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">
                              {quote.supplier?.company_name || "Unknown Supplier"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {quote.supplier?.contact_email}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(quote.status)}
                      </div>

                      {/* Quote Amount - Prominent */}
                      <div className="bg-muted/50 rounded-lg p-4 mb-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Total Amount</p>
                        <p className="text-2xl font-bold text-primary">
                          {formatCurrency(quote.amount)}
                        </p>
                      </div>

                      {/* Quote Details */}
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <Truck className="h-4 w-4" />
                            Delivery
                          </span>
                          <span className="font-medium">
                            {quote.delivery_time || "Not specified"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            Valid Until
                          </span>
                          <span className="font-medium">
                            {quote.valid_until
                              ? format(new Date(quote.valid_until), "dd MMM yyyy")
                              : "Not specified"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            Submitted
                          </span>
                          <span className="font-medium">
                            {format(new Date(quote.created_at), "dd MMM yyyy")}
                          </span>
                        </div>
                      </div>

                      {/* Notes */}
                      {quote.notes && (
                        <div className="bg-muted/30 rounded-md p-3 mb-4">
                          <p className="text-xs text-muted-foreground mb-1">Notes</p>
                          <p className="text-sm">{quote.notes}</p>
                        </div>
                      )}

                      {/* Document */}
                      {quote.document_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mb-4 gap-2"
                          onClick={() => handleViewDocument(quote)}
                        >
                          <FileText className="h-4 w-4" />
                          View Quote Document
                        </Button>
                      )}

                      {/* Actions */}
                      {quote.status === "SUBMITTED" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 gap-1"
                            onClick={() => handleAccept(quote)}
                            disabled={actionLoading === quote.id}
                          >
                            {actionLoading === quote.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Check className="h-4 w-4" />
                                Accept
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1 gap-1"
                            onClick={() => handleReject(quote.id)}
                            disabled={actionLoading === quote.id}
                          >
                            <X className="h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Document Viewer Modal */}
      <Dialog open={documentModal.isOpen} onOpenChange={(open) => setDocumentModal({ ...documentModal, isOpen: open })}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Quote Document - {documentModal.supplierName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 h-full min-h-[500px]">
            <iframe
              src={documentModal.url}
              className="w-full h-full rounded-lg border"
              title="Quote Document"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => window.open(documentModal.url, "_blank")}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Open in New Tab
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const link = document.createElement("a");
                link.href = documentModal.url;
                link.download = `quote-${documentModal.supplierName}.pdf`;
                link.click();
              }}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

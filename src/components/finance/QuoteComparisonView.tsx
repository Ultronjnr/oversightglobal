import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, FileText, Check, X, Clock, Calendar, Truck, Wallet, Download, ExternalLink, Building2, Handshake, Package } from "lucide-react";
import {
  getQuotes,
  acceptQuote,
  rejectQuote,
  sendCounterOffer,
  type Quote,
} from "@/services/finance.service";
import { getQuoteDocumentUrl } from "@/services/quote-document.service";
import { useCurrency } from "@/contexts/CurrencyContext";
import { format } from "date-fns";

interface QuoteComparisonViewProps {
  prId?: string;
  onQuoteAction?: () => void;
}

export function QuoteComparisonView({ prId, onQuoteAction }: QuoteComparisonViewProps) {
  const { format: formatCurrency } = useCurrency();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [filteredQuotes, setFilteredQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [documentModal, setDocumentModal] = useState<{
    isOpen: boolean;
    url: string;
    supplierName: string;
  }>({ isOpen: false, url: "", supplierName: "" });
  const [counterModal, setCounterModal] = useState<{
    isOpen: boolean;
    quote: Quote | null;
    amount: string;
    notes: string;
  }>({ isOpen: false, quote: null, amount: "", notes: "" });

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

  const openCounterOffer = (quote: Quote) => {
    setCounterModal({
      isOpen: true,
      quote,
      amount: String(quote.amount || ""),
      notes: "",
    });
  };

  const submitCounterOffer = async () => {
    if (!counterModal.quote) return;
    const amt = parseFloat(counterModal.amount);
    if (!(amt > 0)) {
      toast.error("Enter a valid counter-offer amount");
      return;
    }
    setActionLoading(counterModal.quote.id);
    try {
      const res = await sendCounterOffer(counterModal.quote.id, amt, counterModal.notes || undefined);
      if (res.success) {
        toast.success("Counter-offer sent to supplier");
        setCounterModal({ isOpen: false, quote: null, amount: "", notes: "" });
        fetchQuotes();
        onQuoteAction?.();
      } else {
        toast.error(res.error || "Failed to send counter-offer");
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUBMITTED":
        return (
          <Badge variant="outline" className="border-primary/30 text-primary bg-primary/10">
            <Clock className="h-3 w-3 mr-1" />
            Pending Review
          </Badge>
        );
      case "COUNTER_OFFERED":
        return (
          <Badge className="bg-warning/20 text-warning border-warning/30">
            <Handshake className="h-3 w-3 mr-1" />
            Counter-Offer Sent
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
                        {quote.status === "COUNTER_OFFERED" && quote.counter_offer_amount != null && (
                          <div className="mt-2 pt-2 border-t border-border/60 text-xs">
                            <p className="text-muted-foreground">Your counter-offer</p>
                            <p className="font-semibold text-warning">
                              {formatCurrency(quote.counter_offer_amount)}
                            </p>
                            {quote.counter_offer_notes && (
                              <p className="italic text-muted-foreground mt-1">
                                "{quote.counter_offer_notes}"
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Items breakdown */}
                      {(quote.item_prices && quote.item_prices.length > 0) || (quote.pr_items && quote.pr_items.length > 0) ? (
                        <div className="bg-muted/30 rounded-md p-3 mb-4 space-y-1">
                          <p className="text-xs font-medium flex items-center gap-1 mb-2">
                            <Package className="h-3 w-3" />
                            {quote.item_prices && quote.item_prices.length > 0 ? "Supplier line items" : "Requested items"}
                          </p>
                          {(quote.item_prices && quote.item_prices.length > 0 ? quote.item_prices : quote.pr_items || []).map((it, idx) => (
                            <div key={idx} className="text-xs flex justify-between gap-2">
                              <span className="text-muted-foreground truncate">
                                {it.quantity}× {it.description}
                              </span>
                              <span className="font-mono whitespace-nowrap">
                                {formatCurrency(it.total || 0)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}

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
                      {(quote.status === "SUBMITTED" || quote.status === "COUNTER_OFFERED") && (
                        <div className="flex flex-col gap-2">
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
                          {quote.status === "SUBMITTED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full gap-1"
                              onClick={() => openCounterOffer(quote)}
                              disabled={actionLoading === quote.id}
                            >
                              <Handshake className="h-4 w-4" />
                              Negotiate Price
                            </Button>
                          )}
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

      {/* Counter-offer dialog */}
      <Dialog
        open={counterModal.isOpen}
        onOpenChange={(open) => setCounterModal({ ...counterModal, isOpen: open })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Handshake className="h-5 w-5 text-primary" />
              Send Counter-Offer
            </DialogTitle>
            <DialogDescription>
              Propose a revised price to {counterModal.quote?.supplier?.company_name || "the supplier"}.
              They will be notified and can accept or reject your offer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {counterModal.quote && (
              <div className="bg-muted/40 rounded-md p-3 text-sm flex justify-between">
                <span className="text-muted-foreground">Supplier's current price</span>
                <span className="font-mono font-semibold">
                  {formatCurrency(counterModal.quote.amount)}
                </span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="counter-amount">Your Counter-Offer Amount *</Label>
              <div className="relative">
                <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="counter-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={counterModal.amount}
                  onChange={(e) => setCounterModal({ ...counterModal, amount: e.target.value })}
                  className="pl-10"
                  placeholder="Enter revised price"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="counter-notes">Message to supplier (optional)</Label>
              <Textarea
                id="counter-notes"
                value={counterModal.notes}
                onChange={(e) => setCounterModal({ ...counterModal, notes: e.target.value })}
                placeholder="Explain your counter-offer or requested changes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCounterModal({ isOpen: false, quote: null, amount: "", notes: "" })}
              disabled={actionLoading === counterModal.quote?.id}
            >
              Cancel
            </Button>
            <Button
              onClick={submitCounterOffer}
              disabled={actionLoading === counterModal.quote?.id}
              className="gap-1"
            >
              {actionLoading === counterModal.quote?.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Handshake className="h-4 w-4" />
                  Send Counter-Offer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

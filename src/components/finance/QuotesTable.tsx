import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "sonner";
import {
  Loader2,
  FileText,
  Check,
  X,
  Calendar,
  Truck,
} from "lucide-react";
import {
  getQuotes,
  acceptQuote,
  rejectQuote,
  type Quote,
} from "@/services/finance.service";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

export function QuotesTable() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchQuotes();
  }, []);

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
        toast.success("Quote accepted", {
          description: "The supplier has been notified and can now upload their invoice.",
        });
        fetchQuotes();
      } else {
        toast.error("Failed to accept quote", {
          description: result.error || "Please try again or contact support.",
        });
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
        toast.success("Quote rejected", {
          description: "The quote has been marked as rejected.",
        });
        fetchQuotes();
      } else {
        toast.error("Failed to reject quote", {
          description: result.error || "Please try again.",
        });
      }
    } finally {
      setActionLoading(null);
    }
  };

  // Map quote status for StatusBadge
  const getQuoteStatusForBadge = (status: string) => {
    if (status === "ACCEPTED") return "QUOTE_ACCEPTED";
    return status;
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
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          Received Quotes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {quotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-1">No Quotes Yet</h3>
            <p className="text-sm text-muted-foreground">
              Supplier quotes will appear here when submitted.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {quote.supplier?.company_name || "Unknown Supplier"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {quote.supplier?.contact_email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-primary">
                        {formatCurrency(quote.amount)}
                      </p>
                    </TableCell>
                    <TableCell>
                      {quote.delivery_time ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Truck className="h-3 w-3 text-muted-foreground" />
                          {quote.delivery_time}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {quote.valid_until ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {format(new Date(quote.valid_until), "dd MMM yyyy")}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{<StatusBadge type="quote" status={getQuoteStatusForBadge(quote.status)} />}</TableCell>
                    <TableCell>
                      {quote.status === "SUBMITTED" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleAccept(quote)}
                            disabled={actionLoading === quote.id}
                          >
                            {actionLoading === quote.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReject(quote.id)}
                            disabled={actionLoading === quote.id}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

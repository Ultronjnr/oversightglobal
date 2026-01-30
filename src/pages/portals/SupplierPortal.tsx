import { useEffect, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Truck,
  FileText,
  ClipboardList,
  Package,
  CheckCircle,
  Clock,
  DollarSign,
  Send,
  XCircle,
  AlertCircle,
  Eye,
} from "lucide-react";
import {
  getSupplierProfile,
  getSupplierQuoteRequests,
  getSupplierQuotes,
  getSupplierStats,
  acceptQuoteRequest,
  declineQuoteRequest,
  type SupplierProfile,
  type SupplierQuoteRequest,
  type SupplierQuote,
  type SupplierStats,
} from "@/services/supplier.service";
import { SubmitQuoteModal } from "@/components/supplier/SubmitQuoteModal";
import { QuoteRequestDetailsModal } from "@/components/supplier/QuoteRequestDetailsModal";
import { format } from "date-fns";
import { toast } from "sonner";

export default function SupplierPortal() {
  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [quoteRequests, setQuoteRequests] = useState<SupplierQuoteRequest[]>([]);
  const [quotes, setQuotes] = useState<SupplierQuote[]>([]);
  const [stats, setStats] = useState<SupplierStats>({
    pendingRequests: 0,
    submittedQuotes: 0,
    acceptedQuotes: 0,
    totalValue: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");

  // Quote submission modal
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SupplierQuoteRequest | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Quote request details modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsRequest, setDetailsRequest] = useState<SupplierQuoteRequest | null>(null);

  const navItems = [
    { label: "Dashboard", href: "/supplier/portal", icon: <Truck className="h-4 w-4" /> },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [profileResult, requestsResult, quotesResult, statsResult] = await Promise.all([
        getSupplierProfile(),
        getSupplierQuoteRequests(),
        getSupplierQuotes(),
        getSupplierStats(),
      ]);

      if (profileResult.success && profileResult.data) {
        setProfile(profileResult.data);
      }

      if (requestsResult.success) {
        setQuoteRequests(requestsResult.data);
      }

      if (quotesResult.success) {
        setQuotes(quotesResult.data);
      }

      if (statsResult.success) {
        setStats(statsResult.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitQuote = (request: SupplierQuoteRequest) => {
    setSelectedRequest(request);
    setQuoteModalOpen(true);
  };

  const handleViewDetails = (request: SupplierQuoteRequest) => {
    setDetailsRequest(request);
    setDetailsModalOpen(true);
  };

  const handleAcceptRequest = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const result = await acceptQuoteRequest(requestId);
      if (result.success) {
        toast.success("Quote request accepted! You can now submit your quote.");
        loadData();
      } else {
        toast.error(result.error || "Failed to accept request");
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const result = await declineQuoteRequest(requestId);
      if (result.success) {
        toast.success("Quote request declined");
        loadData();
      } else {
        toast.error(result.error || "Failed to decline request");
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleQuoteSuccess = () => {
    setQuoteModalOpen(false);
    setSelectedRequest(null);
    loadData();
    toast.success("Quote submitted successfully!");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(amount);
  };

  const getQuoteStatusBadge = (status: string) => {
    switch (status) {
      case "SUBMITTED":
        return (
          <Badge variant="outline" className="border-primary/30 text-primary">
            <Clock className="h-3 w-3 mr-1" />
            Pending Review
          </Badge>
        );
      case "ACCEPTED":
        return (
          <Badge className="bg-success/20 text-success border-success/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Accepted
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getRequestStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge variant="outline" className="border-warning/30 text-warning">
            <Clock className="h-3 w-3 mr-1" />
            Awaiting Response
          </Badge>
        );
      case "ACCEPTED":
        return (
          <Badge className="bg-primary/20 text-primary border-primary/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Accepted - Submit Quote
          </Badge>
        );
      case "DECLINED":
        return (
          <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
            <XCircle className="h-3 w-3 mr-1" />
            Declined
          </Badge>
        );
      case "QUOTED":
        return (
          <Badge className="bg-success/20 text-success border-success/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Quote Submitted
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Check if supplier has already quoted for this request
  const hasQuotedForRequest = (requestId: string) => {
    return quotes.some((q) => q.quote_request_id === requestId);
  };

  return (
    <DashboardLayout title="Supplier Dashboard" navItems={navItems}>
      <div className="space-y-6">
        {/* Verification Status */}
        {profile && !profile.is_verified && (
          <Card className="dashboard-card border-warning/30 bg-warning/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-warning/20">
                  <AlertCircle className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="font-medium">Account Verification Pending</p>
                  <p className="text-sm text-muted-foreground">
                    Your account is pending verification. You can still receive quote requests and submit quotes.
                  </p>
                </div>
                <Badge variant="outline" className="ml-auto border-warning text-warning">
                  Pending Verification
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {profile?.is_verified && (
          <Card className="dashboard-card border-success/30 bg-success/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-success/20">
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="font-medium">Verified Supplier</p>
                  <p className="text-sm text-muted-foreground">
                    Your account is verified and active.
                  </p>
                </div>
                <Badge className="ml-auto bg-success/20 text-success border-success/30">
                  Verified
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="requests" className="relative">
              Quote Requests
              {stats.pendingRequests > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold px-1">
                  {stats.pendingRequests}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="quotes">My Quotes</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="dashboard-card">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-warning/10">
                      <ClipboardList className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pending Requests</p>
                      <p className="text-2xl font-bold">{stats.pendingRequests}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="dashboard-card">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Send className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Quotes Submitted</p>
                      <p className="text-2xl font-bold text-primary">{stats.submittedQuotes}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="dashboard-card">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-success/10">
                      <CheckCircle className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Accepted Quotes</p>
                      <p className="text-2xl font-bold text-success">{stats.acceptedQuotes}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="dashboard-card">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-accent/10">
                      <DollarSign className="h-5 w-5 text-accent-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Value</p>
                      <p className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  Recent Quote Requests
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : quoteRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="p-4 rounded-full bg-muted mb-4">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-medium text-foreground mb-1">No Quote Requests</h3>
                    <p className="text-sm text-muted-foreground">
                      New quote requests from organizations will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {quoteRequests.slice(0, 5).map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer group"
                        onClick={() => handleViewDetails(request)}
                      >
                        <div className="space-y-1 flex-1">
                          <p className="font-medium">
                            {request.organization_name || "Organization Assigned"} - {request.pr_transaction_id || "PR Pending"}
                            <span className="text-muted-foreground font-normal"> (from {request.requester_name || "Finance Department"})</span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {request.items?.length || 0} item(s) •{" "}
                            {format(new Date(request.created_at), "MMM d, yyyy")}
                          </p>
                        </div>
                        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                          {getRequestStatusBadge(request.status)}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetails(request);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          {request.status === "PENDING" && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAcceptRequest(request.id);
                                }}
                                disabled={processingId === request.id}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeclineRequest(request.id);
                                }}
                                disabled={processingId === request.id}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Decline
                              </Button>
                            </div>
                          )}
                          {request.status === "ACCEPTED" && !hasQuotedForRequest(request.id) && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSubmitQuote(request);
                              }}
                            >
                              <Send className="h-4 w-4 mr-1" />
                              Submit Quote
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quote Requests Tab */}
          <TabsContent value="requests">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-muted-foreground" />
                  Quote Requests
                </CardTitle>
              </CardHeader>
              <CardContent>
                {quoteRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="p-4 rounded-full bg-muted mb-4">
                      <ClipboardList className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-medium text-foreground mb-1">No Quote Requests</h3>
                    <p className="text-sm text-muted-foreground">
                      Quote requests from organizations will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Organization</TableHead>
                          <TableHead>PR Reference</TableHead>
                          <TableHead>Request Date</TableHead>
                          <TableHead>Items</TableHead>
                          <TableHead>Estimated Value</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {quoteRequests.map((request) => {
                          const totalValue = (request.items || []).reduce(
                            (sum, item) => sum + (item.total || 0),
                            0
                          );
                          const quoted = hasQuotedForRequest(request.id);

                          return (
                            <TableRow key={request.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{request.organization_name || "Organization Assigned"}</p>
                                  <p className="text-xs text-muted-foreground">from {request.requester_name || "Finance Department"}</p>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {request.pr_transaction_id || "PR Pending"}
                              </TableCell>
                              <TableCell>
                                {format(new Date(request.created_at), "MMM d, yyyy")}
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  {(request.items || []).slice(0, 2).map((item, idx) => (
                                    <p key={idx} className="text-sm">
                                      {item.quantity}x {item.description}
                                    </p>
                                  ))}
                                  {(request.items || []).length > 2 && (
                                    <p className="text-xs text-muted-foreground">
                                      +{(request.items || []).length - 2} more items
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="font-mono">
                                {formatCurrency(totalValue)}
                              </TableCell>
                              <TableCell>{getRequestStatusBadge(request.status)}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleViewDetails(request)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {request.status === "PENDING" ? (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="default"
                                        onClick={() => handleAcceptRequest(request.id)}
                                        disabled={processingId === request.id}
                                      >
                                        <CheckCircle className="h-4 w-4 mr-1" />
                                        Accept
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleDeclineRequest(request.id)}
                                        disabled={processingId === request.id}
                                      >
                                        <XCircle className="h-4 w-4 mr-1" />
                                        Decline
                                      </Button>
                                    </>
                                  ) : request.status === "ACCEPTED" && !quoted ? (
                                    <Button
                                      size="sm"
                                      onClick={() => handleSubmitQuote(request)}
                                    >
                                      <Send className="h-4 w-4 mr-1" />
                                      Submit Quote
                                    </Button>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">
                                      {quoted ? "Quote Submitted" : request.status === "DECLINED" ? "Declined" : "—"}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* My Quotes Tab */}
          <TabsContent value="quotes">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  My Submitted Quotes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {quotes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="p-4 rounded-full bg-muted mb-4">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-medium text-foreground mb-1">No Quotes Submitted</h3>
                    <p className="text-sm text-muted-foreground">
                      Quotes you submit will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Submitted</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Delivery</TableHead>
                          <TableHead>Valid Until</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {quotes.map((quote) => (
                          <TableRow key={quote.id}>
                            <TableCell>
                              {format(new Date(quote.created_at), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="font-mono font-semibold text-primary">
                              {formatCurrency(quote.amount)}
                            </TableCell>
                            <TableCell>
                              {quote.delivery_time || "—"}
                            </TableCell>
                            <TableCell>
                              {quote.valid_until
                                ? format(new Date(quote.valid_until), "MMM d, yyyy")
                                : "—"}
                            </TableCell>
                            <TableCell>{getQuoteStatusBadge(quote.status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Submit Quote Modal */}
      <SubmitQuoteModal
        open={quoteModalOpen}
        onOpenChange={setQuoteModalOpen}
        quoteRequest={selectedRequest}
        onSuccess={handleQuoteSuccess}
      />

      {/* Quote Request Details Modal */}
      <QuoteRequestDetailsModal
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        request={detailsRequest}
      />
    </DashboardLayout>
  );
}

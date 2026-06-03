import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  Loader2, 
  Search, 
  Building2, 
  Mail, 
  Phone, 
  CheckCircle, 
  UserPlus,
  Send,
  RefreshCw,
  XCircle,
  Clock,
  Ban,
} from "lucide-react";
import { getOrganizationSuppliers, type Supplier } from "@/services/admin.service";
import { getSafeErrorMessage } from "@/lib/error-handler";
import { format } from "date-fns";
import {
  createSupplierInvite,
  resendSupplierInvite,
  cancelSupplierInvite,
  listSupplierInvitations,
  type SupplierInvitation,
} from "@/services/supplier-invite.service";

const INDUSTRY_OPTIONS = [
  "Construction & Building Materials",
  "IT & Technology",
  "Office Supplies & Stationery",
  "Cleaning & Sanitation",
  "Electrical & Electronics",
  "Plumbing & Water Systems",
  "Catering & Food Services",
  "Transport & Logistics",
  "Security Services",
  "Furniture & Fittings",
  "Printing & Signage",
  "Consulting & Professional Services",
  "Medical & Healthcare Supplies",
  "Agriculture & Farming",
  "Other",
];

function InvitationStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "ACCEPTED":
      return (
        <Badge className="bg-success/20 text-success border-success/30">
          <CheckCircle className="h-3 w-3 mr-1" /> Accepted
        </Badge>
      );
    case "PENDING":
      return (
        <Badge className="bg-warning/20 text-warning border-warning/30">
          <Clock className="h-3 w-3 mr-1" /> Pending
        </Badge>
      );
    case "EXPIRED":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <XCircle className="h-3 w-3 mr-1" /> Expired
        </Badge>
      );
    case "CANCELLED":
      return (
        <Badge className="bg-destructive/15 text-destructive border-destructive/30">
          <Ban className="h-3 w-3 mr-1" /> Cancelled
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function SuppliersTab() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [invitations, setInvitations] = useState<SupplierInvitation[]>([]);
  const [actionId, setActionId] = useState<string | null>(null);
  const [form, setForm] = useState({
    companyName: "",
    contactPerson: "",
    email: "",
    industry: "",
    registrationNumber: "",
    vatNumber: "",
  });

  useEffect(() => {
    fetchSuppliers();
    fetchInvitations();
  }, []);

  const fetchSuppliers = async () => {
    setIsLoading(true);
    try {
      const result = await getOrganizationSuppliers();
      if (result.success) {
        setSuppliers(result.data);
      } else {
        toast.error("Failed to load suppliers");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInvitations = async () => {
    const result = await listSupplierInvitations();
    if (result.success) setInvitations(result.data);
  };

  const resetForm = () =>
    setForm({
      companyName: "",
      contactPerson: "",
      email: "",
      industry: "",
      registrationNumber: "",
      vatNumber: "",
    });

  const handleInviteSupplier = async () => {
    const email = form.email.trim();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!form.companyName.trim() || !form.contactPerson.trim() || !email) {
      toast.error("Company name, contact person and email are required");
      return;
    }
    if (!emailValid) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsInviting(true);
    try {
      const result = await createSupplierInvite({
        email,
        companyName: form.companyName.trim(),
        contactPerson: form.contactPerson.trim(),
        industry: form.industry || undefined,
        registrationNumber: form.registrationNumber.trim() || undefined,
        vatNumber: form.vatNumber.trim() || undefined,
      });

      if (!result.success) {
        toast.error(result.error || "Failed to create invitation");
        return;
      }

      if (result.emailSent) {
        toast.success("Invitation email sent successfully");
      } else {
        toast.warning("Invitation created, but the email failed to send. Try resending.");
      }
      setIsInviteModalOpen(false);
      resetForm();
      fetchInvitations();
    } catch (err: any) {
      toast.error(getSafeErrorMessage(err));
    } finally {
      setIsInviting(false);
    }
  };

  const handleResend = async (id: string) => {
    setActionId(id);
    try {
      const result = await resendSupplierInvite(id);
      if (!result.success) {
        toast.error(result.error || "Failed to resend invitation");
        return;
      }
      if (result.emailSent) {
        toast.success("Invitation resent successfully");
      } else {
        toast.warning("Invitation refreshed, but the email failed to send.");
      }
      fetchInvitations();
    } finally {
      setActionId(null);
    }
  };

  const handleCancel = async (id: string) => {
    setActionId(id);
    try {
      const result = await cancelSupplierInvite(id);
      if (!result.success) {
        toast.error(result.error || "Failed to cancel invitation");
        return;
      }
      toast.success("Invitation cancelled");
      fetchInvitations();
    } finally {
      setActionId(null);
    }
  };

  const filteredSuppliers = suppliers.filter((supplier) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      supplier.company_name.toLowerCase().includes(searchLower) ||
      supplier.contact_email.toLowerCase().includes(searchLower) ||
      (supplier.industry?.toLowerCase().includes(searchLower) ?? false)
    );
  });

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
    <div className="space-y-6">
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            Internal Suppliers
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search suppliers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Supplier
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Invite Supplier</DialogTitle>
                  <DialogDescription>
                    We'll email the supplier a secure registration link automatically.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name *</Label>
                    <Input
                      id="companyName"
                      placeholder="ABC Supplies Ltd"
                      value={form.companyName}
                      onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactPerson">Contact Person *</Label>
                    <Input
                      id="contactPerson"
                      placeholder="Full name"
                      value={form.contactPerson}
                      onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supplierEmail">Supplier Email *</Label>
                    <Input
                      id="supplierEmail"
                      type="email"
                      placeholder="supplier@company.com"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <select
                      id="industry"
                      value={form.industry}
                      onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="">Select industry (optional)</option>
                      {INDUSTRY_OPTIONS.map((ind) => (
                        <option key={ind} value={ind}>{ind}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="registrationNumber">Registration Number</Label>
                      <Input
                        id="registrationNumber"
                        placeholder="e.g. 2024/123456/07"
                        value={form.registrationNumber}
                        onChange={(e) => setForm((f) => ({ ...f, registrationNumber: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vatNumber">VAT Number</Label>
                      <Input
                        id="vatNumber"
                        placeholder="Optional"
                        value={form.vatNumber}
                        onChange={(e) => setForm((f) => ({ ...f, vatNumber: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsInviteModalOpen(false);
                      resetForm();
                    }}
                    disabled={isInviting}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleInviteSupplier} disabled={isInviting}>
                    {isInviting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Invite Supplier
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredSuppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-1">
              {searchTerm ? "No Matching Suppliers" : "No Suppliers Yet"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchTerm
                ? "Try adjusting your search terms."
                : "Invite suppliers to your organization to get started."}
            </p>
            {!searchTerm && (
              <Button onClick={() => setIsInviteModalOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite First Supplier
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Contact Details</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Registration #</TableHead>
                  <TableHead>VAT #</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium">{supplier.company_name}</p>
                          {supplier.address && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {supplier.address}
                            </p>
                          )}
                        </div>
                        {supplier.is_verified && (
                          <Badge className="bg-success/20 text-success border-success/30">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {supplier.contact_person || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate max-w-[150px]">
                            {supplier.contact_email}
                          </span>
                        </div>
                        {supplier.phone && (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span>{supplier.phone}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {supplier.industry ? (
                        <Badge variant="outline">{supplier.industry}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {supplier.registration_number || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {supplier.vat_number || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(supplier.created_at), "dd MMM yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>

      {/* Invitations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-muted-foreground" />
            Supplier Invitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Mail className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No invitations sent yet. Invite a supplier to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((inv) => {
                    const canManage = inv.status === "PENDING" || inv.status === "EXPIRED";
                    const busy = actionId === inv.id;
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.company_name}</TableCell>
                        <TableCell>
                          {inv.contact_person || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="truncate max-w-[180px]">{inv.email}</TableCell>
                        <TableCell>
                          <InvitationStatusBadge status={inv.status} />
                        </TableCell>
                        <TableCell>{format(new Date(inv.created_at), "dd MMM yyyy")}</TableCell>
                        <TableCell>{format(new Date(inv.expires_at), "dd MMM yyyy")}</TableCell>
                        <TableCell className="text-right">
                          {canManage ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                onClick={() => handleResend(inv.id)}
                              >
                                {busy ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-3.5 w-3.5" />
                                )}
                                <span className="ml-1">Resend</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={() => handleCancel(inv.id)}
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
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
    </div>
  );
}

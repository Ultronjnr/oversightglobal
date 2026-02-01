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
  Copy,
  ExternalLink
} from "lucide-react";
import { getOrganizationSuppliers, type Supplier } from "@/services/admin.service";
import { createSupplierInvitation } from "@/services/supplier-invitation.service";
import { format } from "date-fns";

export function SuppliersTab() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCompanyName, setInviteCompanyName] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");

  useEffect(() => {
    fetchSuppliers();
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

  const handleInviteSupplier = async () => {
    if (!inviteEmail || !inviteCompanyName) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsInviting(true);
    try {
      const result = await createSupplierInvitation({
        email: inviteEmail,
        companyName: inviteCompanyName,
      });

      if (result.success && result.inviteLink) {
        setGeneratedLink(result.inviteLink);
        toast.success("Supplier invitation created!");
      } else {
        toast.error(result.error || "Failed to create invitation");
      }
    } finally {
      setIsInviting(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    toast.success("Invitation link copied to clipboard!");
  };

  const handleCloseModal = () => {
    setIsInviteModalOpen(false);
    setInviteEmail("");
    setInviteCompanyName("");
    setGeneratedLink("");
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
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Supplier</DialogTitle>
                  <DialogDescription>
                    Send an invitation to a supplier to join your organization.
                  </DialogDescription>
                </DialogHeader>

                {!generatedLink ? (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="supplierEmail">Supplier Email *</Label>
                      <Input
                        id="supplierEmail"
                        type="email"
                        placeholder="supplier@company.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name *</Label>
                      <Input
                        id="companyName"
                        placeholder="ABC Supplies Ltd"
                        value={inviteCompanyName}
                        onChange={(e) => setInviteCompanyName(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 py-4">
                    <div className="p-4 bg-success/10 border border-success/30 rounded-lg">
                      <p className="text-sm text-success font-medium mb-2">
                        Invitation Created Successfully!
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Share this link with <strong>{inviteCompanyName}</strong> to complete registration:
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        value={generatedLink}
                        readOnly
                        className="text-xs"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCopyLink}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This link expires in 7 days and can only be used once.
                    </p>
                  </div>
                )}

                <DialogFooter>
                  {!generatedLink ? (
                    <>
                      <Button variant="outline" onClick={handleCloseModal}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleInviteSupplier}
                        disabled={isInviting}
                      >
                        {isInviting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Generate Invitation Link"
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button onClick={handleCloseModal}>
                      Done
                    </Button>
                  )}
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
  );
}

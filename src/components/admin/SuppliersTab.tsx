import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { 
  Loader2, 
  Search, 
  Building2, 
  Mail, 
  Phone, 
  CheckCircle, 
  Check, 
  X,
  UserPlus,
  Users
} from "lucide-react";
import { 
  getUnlinkedSuppliers, 
  getLinkedSuppliers,
  acceptSupplier,
  declineSupplier,
  type Supplier,
  type SupplierWithStatus
} from "@/services/admin.service";
import { format } from "date-fns";

export function SuppliersTab() {
  const [unlinkedSuppliers, setUnlinkedSuppliers] = useState<SupplierWithStatus[]>([]);
  const [linkedSuppliers, setLinkedSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("available");

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setIsLoading(true);
    try {
      const [unlinkedResult, linkedResult] = await Promise.all([
        getUnlinkedSuppliers(),
        getLinkedSuppliers(),
      ]);
      
      if (unlinkedResult.success) {
        setUnlinkedSuppliers(unlinkedResult.data);
      } else {
        toast.error("Failed to load available suppliers");
      }
      
      if (linkedResult.success) {
        setLinkedSuppliers(linkedResult.data);
      } else {
        toast.error("Failed to load linked suppliers");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async (supplierId: string) => {
    setProcessingId(supplierId);
    try {
      const result = await acceptSupplier(supplierId);
      if (result.success) {
        toast.success("Supplier accepted successfully");
        await fetchSuppliers();
      } else {
        toast.error(result.error || "Failed to accept supplier");
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (supplierId: string) => {
    setProcessingId(supplierId);
    try {
      const result = await declineSupplier(supplierId);
      if (result.success) {
        toast.success("Supplier declined");
        await fetchSuppliers();
      } else {
        toast.error(result.error || "Failed to decline supplier");
      }
    } finally {
      setProcessingId(null);
    }
  };

  const filteredUnlinked = unlinkedSuppliers.filter((supplier) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      supplier.company_name.toLowerCase().includes(searchLower) ||
      supplier.contact_email.toLowerCase().includes(searchLower) ||
      (supplier.industry?.toLowerCase().includes(searchLower) ?? false)
    );
  });

  const filteredLinked = linkedSuppliers.filter((supplier) => {
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

  const renderSupplierRow = (supplier: Supplier | SupplierWithStatus, showActions: boolean) => (
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
          <Badge className="bg-success/20 text-success border-success/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        </div>
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
        {format(new Date(supplier.created_at), "dd MMM yyyy")}
      </TableCell>
      {showActions && (
        <TableCell>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={() => handleAccept(supplier.id)}
              disabled={processingId === supplier.id}
            >
              {processingId === supplier.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Accept
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDecline(supplier.id)}
              disabled={processingId === supplier.id}
            >
              <X className="h-4 w-4 mr-1" />
              Decline
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );

  const renderEmptyState = (isLinked: boolean) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="p-4 rounded-full bg-muted mb-4">
        <Building2 className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-medium text-foreground mb-1">
        {searchTerm 
          ? "No Matching Suppliers" 
          : isLinked 
            ? "No Linked Suppliers" 
            : "No Available Suppliers"}
      </h3>
      <p className="text-sm text-muted-foreground">
        {searchTerm
          ? "Try adjusting your search terms."
          : isLinked
            ? "Accept suppliers from the Available tab to link them."
            : "All verified suppliers have been processed."}
      </p>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            Suppliers
          </CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search suppliers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="available" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Available ({unlinkedSuppliers.length})
            </TabsTrigger>
            <TabsTrigger value="linked" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Linked ({linkedSuppliers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="available">
            {filteredUnlinked.length === 0 ? (
              renderEmptyState(false)
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Industry</TableHead>
                      <TableHead>Registration #</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnlinked.map((supplier) => renderSupplierRow(supplier, true))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="linked">
            {filteredLinked.length === 0 ? (
              renderEmptyState(true)
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Industry</TableHead>
                      <TableHead>Registration #</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLinked.map((supplier) => renderSupplierRow(supplier, false))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
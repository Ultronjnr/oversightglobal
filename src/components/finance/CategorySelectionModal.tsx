import { useState, useEffect, useMemo } from "react";
import {
  Loader2,
  Tag,
  Plus,
  Check,
  Search,
  FolderTree,
  Package,
  Building2,
  Star,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PurchaseRequisition } from "@/types/pr.types";
import {
  getCategories,
  createCategory,
  groupCategoriesByType,
  type Category,
  type CategoryType,
} from "@/services/category.service";
import {
  getAllSuppliers,
  createManualSupplier,
  type Supplier,
} from "@/services/finance.service";
import { Badge } from "@/components/ui/badge";

interface CategorySelectionModalProps {
  pr: PurchaseRequisition | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (
    prId: string,
    categoryId: string,
    comments: string,
    supplierId: string,
  ) => Promise<void>;
}

export function CategorySelectionModal({
  pr,
  open,
  onClose,
  onConfirm,
}: CategorySelectionModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // New category form state
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<CategoryType>("EXPENSE");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  // Suppliers
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [showNewSupplierForm, setShowNewSupplierForm] = useState(false);
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    company_name: "",
    registration_number: "",
    vat_number: "",
    contact_person: "",
    contact_email: "",
    phone: "",
    address: "",
    supplier_type: "REGISTERED" as "REGISTERED" | "PREFERRED" | "ONE_TIME",
  });

  useEffect(() => {
    if (open) {
      fetchCategories();
      fetchSuppliers();
      // Reset state when modal opens
      setSelectedCategoryId(null);
      setComments("");
      setSearchQuery("");
      setShowNewCategoryForm(false);
      setNewCategoryName("");
      setNewCategoryType("EXPENSE");
      setNewCategoryDescription("");
      setSelectedSupplierId(null);
      setSupplierQuery("");
      setShowNewSupplierForm(false);
      setNewSupplier({
        company_name: "",
        registration_number: "",
        vat_number: "",
        contact_person: "",
        contact_email: "",
        phone: "",
        address: "",
        supplier_type: "REGISTERED",
      });
    }
  }, [open]);

  const fetchCategories = async () => {
    setLoading(true);
    const result = await getCategories();
    if (result.success) {
      setCategories(result.data);
    } else {
      toast.error(result.error || "Failed to load categories");
    }
    setLoading(false);
  };

  const fetchSuppliers = async () => {
    setLoadingSuppliers(true);
    const result = await getAllSuppliers();
    if (result.success) {
      setSuppliers(result.data);
    } else {
      toast.error(result.error || "Failed to load suppliers");
    }
    setLoadingSuppliers(false);
  };

  const groupedCategories = useMemo(() => {
    return groupCategoriesByType(categories);
  }, [categories]);

  const filteredGrouped = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return {
      expenses: groupedCategories.expenses.filter((c) =>
        c.name.toLowerCase().includes(query)
      ),
      assets: groupedCategories.assets.filter((c) =>
        c.name.toLowerCase().includes(query)
      ),
    };
  }, [groupedCategories, searchQuery]);

  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.id === selectedCategoryId);
  }, [categories, selectedCategoryId]);

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === selectedSupplierId),
    [suppliers, selectedSupplierId],
  );

  const groupedSuppliers = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    const match = (s: Supplier) => {
      if (!q) return true;
      return (
        s.company_name.toLowerCase().includes(q) ||
        (s.supplier_code ?? "").toLowerCase().includes(q) ||
        (s.contact_person ?? "").toLowerCase().includes(q)
      );
    };
    const filtered = suppliers.filter(match).filter((s) => s.is_active !== false);
    const recent = [...filtered]
      .sort(
        (a: any, b: any) =>
          new Date(b.created_at ?? 0).getTime() -
          new Date(a.created_at ?? 0).getTime(),
      )
      .slice(0, 3);
    const recentIds = new Set(recent.map((s) => s.id));
    return {
      preferred: filtered.filter(
        (s) => s.supplier_type === "PREFERRED" && !recentIds.has(s.id),
      ),
      registered: filtered.filter(
        (s) =>
          (s.supplier_type === "REGISTERED" || !s.supplier_type) &&
          !recentIds.has(s.id),
      ),
      oneTime: filtered.filter(
        (s) => s.supplier_type === "ONE_TIME" && !recentIds.has(s.id),
      ),
      recent,
    };
  }, [suppliers, supplierQuery]);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Category name is required");
      return;
    }

    setIsCreatingCategory(true);
    const result = await createCategory({
      name: newCategoryName.trim(),
      type: newCategoryType,
      description: newCategoryDescription.trim() || undefined,
    });

    if (result.success && result.data) {
      setCategories((prev) => [...prev, result.data!]);
      setSelectedCategoryId(result.data.id);
      setShowNewCategoryForm(false);
      setNewCategoryName("");
      setNewCategoryDescription("");
      toast.success("Category created successfully");
    } else {
      toast.error(result.error || "Failed to create category");
    }
    setIsCreatingCategory(false);
  };

  const handleCreateSupplier = async () => {
    const name = newSupplier.company_name.trim();
    if (!name) {
      toast.error("Supplier name is required");
      return;
    }
    // Duplicate detection (case-insensitive on name)
    const dup = suppliers.find(
      (s) => s.company_name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (dup) {
      toast.error(`Supplier "${dup.company_name}" already exists`);
      setSelectedSupplierId(dup.id);
      setShowNewSupplierForm(false);
      return;
    }
    setIsCreatingSupplier(true);
    const result = await createManualSupplier(newSupplier);
    if (result.success && result.data) {
      setSuppliers((prev) => [result.data!, ...prev]);
      setSelectedSupplierId(result.data.id);
      setShowNewSupplierForm(false);
      toast.success("Supplier created successfully");
    } else {
      toast.error(result.error || "Failed to create supplier");
    }
    setIsCreatingSupplier(false);
  };

  const handleConfirm = async () => {
    if (!pr || !selectedCategoryId) {
      toast.error("Please select a category");
      return;
    }
    if (!selectedSupplierId) {
      toast.error("Please select a supplier");
      return;
    }

    if (!comments.trim()) {
      toast.error("Please provide approval comments");
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(pr.id, selectedCategoryId, comments, selectedSupplierId);
    } catch (error) {
      console.error("Category selection error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting && !isCreatingCategory && !isCreatingSupplier) {
      onClose();
    }
  };

  if (!pr) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Categorize Purchase Requisition
          </DialogTitle>
          <DialogDescription>
            Select or create a category for this PR before approval. This classification is
            immutable after approval.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* PR Summary */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-1">
            <p className="text-sm font-medium">{pr.transaction_id}</p>
            <p className="text-sm text-muted-foreground">
              {pr.requested_by_name} • {pr.requested_by_department}
            </p>
            <p className="text-sm font-semibold text-primary">
              {pr.currency} {pr.total_amount.toLocaleString()}
            </p>
          </div>

          {/* Category Selection */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : showNewCategoryForm ? (
            // New Category Form
            <div className="space-y-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create New Category
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewCategoryForm(false)}
                >
                  Cancel
                </Button>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="categoryName">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="categoryName"
                    placeholder="e.g., Office Supplies"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="categoryType">
                    Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={newCategoryType}
                    onValueChange={(v) => setNewCategoryType(v as CategoryType)}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EXPENSE">
                        <div className="flex items-center gap-2">
                          <FolderTree className="h-4 w-4 text-warning" />
                          Expense
                        </div>
                      </SelectItem>
                      <SelectItem value="ASSET">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-primary" />
                          Fixed Asset
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="categoryDescription">Description (optional)</Label>
                  <Textarea
                    id="categoryDescription"
                    placeholder="Brief description of this category..."
                    value={newCategoryDescription}
                    onChange={(e) => setNewCategoryDescription(e.target.value)}
                    rows={2}
                    className="bg-background"
                  />
                </div>

                <Button
                  onClick={handleCreateCategory}
                  disabled={isCreatingCategory || !newCategoryName.trim()}
                  className="w-full"
                >
                  {isCreatingCategory ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Category
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            // Category Search & Selection
            <div className="space-y-3">
              <Label>
                Category <span className="text-destructive">*</span>
              </Label>
              
              <Command className="rounded-lg border border-border">
                <div className="flex items-center border-b border-border px-3">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <input
                    className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Search categories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <CommandList className="max-h-[200px]">
                  <CommandEmpty>
                    <p className="text-sm text-muted-foreground py-2">
                      No categories found.
                    </p>
                  </CommandEmpty>
                  
                  {filteredGrouped.expenses.length > 0 && (
                    <CommandGroup heading="Expenses">
                      {filteredGrouped.expenses.map((category) => (
                        <CommandItem
                          key={category.id}
                          value={category.name}
                          onSelect={() => setSelectedCategoryId(category.id)}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <FolderTree className="h-4 w-4 text-warning" />
                            <span>{category.name}</span>
                          </div>
                          {selectedCategoryId === category.id && (
                            <Check className="h-4 w-4 text-success" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  
                  {filteredGrouped.expenses.length > 0 && filteredGrouped.assets.length > 0 && (
                    <CommandSeparator />
                  )}
                  
                  {filteredGrouped.assets.length > 0 && (
                    <CommandGroup heading="Fixed Assets">
                      {filteredGrouped.assets.map((category) => (
                        <CommandItem
                          key={category.id}
                          value={category.name}
                          onSelect={() => setSelectedCategoryId(category.id)}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <Package className="h-4 w-4 text-primary" />
                            <span>{category.name}</span>
                          </div>
                          {selectedCategoryId === category.id && (
                            <Check className="h-4 w-4 text-success" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>

              {/* Selected Category Display */}
              {selectedCategory && (
                <div className="p-2 rounded-lg bg-success/10 border border-success/30 flex items-center gap-2">
                  {selectedCategory.type === "EXPENSE" ? (
                    <FolderTree className="h-4 w-4 text-warning" />
                  ) : (
                    <Package className="h-4 w-4 text-primary" />
                  )}
                  <span className="text-sm font-medium">{selectedCategory.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {selectedCategory.type === "EXPENSE" ? "Expense" : "Fixed Asset"}
                  </span>
                </div>
              )}

              {/* Create New Category Button */}
              <Button
                variant="outline"
                onClick={() => setShowNewCategoryForm(true)}
                className="w-full border-dashed"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Category
              </Button>
            </div>
          )}

          {/* Supplier Assignment Section */}
          {!showNewCategoryForm && (
            <div className="space-y-3 pt-2 border-t border-border/50">
              {showNewSupplierForm ? (
                <div className="space-y-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Create New Supplier
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowNewSupplierForm(false)}
                      disabled={isCreatingSupplier}
                    >
                      Cancel
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="sup_name">
                        Supplier Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="sup_name"
                        value={newSupplier.company_name}
                        onChange={(e) =>
                          setNewSupplier((s) => ({ ...s, company_name: e.target.value }))
                        }
                        placeholder="e.g., ABC Office Supplies"
                        className="bg-background"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sup_reg">Reg. Number</Label>
                      <Input
                        id="sup_reg"
                        value={newSupplier.registration_number}
                        onChange={(e) =>
                          setNewSupplier((s) => ({ ...s, registration_number: e.target.value }))
                        }
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sup_vat">VAT Number</Label>
                      <Input
                        id="sup_vat"
                        value={newSupplier.vat_number}
                        onChange={(e) =>
                          setNewSupplier((s) => ({ ...s, vat_number: e.target.value }))
                        }
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sup_contact">Contact Person</Label>
                      <Input
                        id="sup_contact"
                        value={newSupplier.contact_person}
                        onChange={(e) =>
                          setNewSupplier((s) => ({ ...s, contact_person: e.target.value }))
                        }
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sup_email">Email</Label>
                      <Input
                        id="sup_email"
                        type="email"
                        value={newSupplier.contact_email}
                        onChange={(e) =>
                          setNewSupplier((s) => ({ ...s, contact_email: e.target.value }))
                        }
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sup_phone">Phone</Label>
                      <Input
                        id="sup_phone"
                        value={newSupplier.phone}
                        onChange={(e) =>
                          setNewSupplier((s) => ({ ...s, phone: e.target.value }))
                        }
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="sup_addr">Physical Address</Label>
                      <Input
                        id="sup_addr"
                        value={newSupplier.address}
                        onChange={(e) =>
                          setNewSupplier((s) => ({ ...s, address: e.target.value }))
                        }
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="sup_type">Supplier Type</Label>
                      <Select
                        value={newSupplier.supplier_type}
                        onValueChange={(v) =>
                          setNewSupplier((s) => ({
                            ...s,
                            supplier_type: v as "REGISTERED" | "PREFERRED" | "ONE_TIME",
                          }))
                        }
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="REGISTERED">Registered Vendor</SelectItem>
                          <SelectItem value="PREFERRED">Preferred Vendor</SelectItem>
                          <SelectItem value="ONE_TIME">One-Time Supplier</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowNewSupplierForm(false)}
                      disabled={isCreatingSupplier}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateSupplier}
                      disabled={isCreatingSupplier || !newSupplier.company_name.trim()}
                      className="flex-1"
                    >
                      {isCreatingSupplier ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Save Supplier
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <Label>
                      Supplier <span className="text-destructive">*</span>
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Select or create a supplier for this PR before approval.
                    </p>
                  </div>

                  {loadingSuppliers ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  ) : (
                    <Command className="rounded-lg border border-border" shouldFilter={false}>
                      <div className="flex items-center border-b border-border px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <input
                          className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          placeholder="Search suppliers..."
                          value={supplierQuery}
                          onChange={(e) => setSupplierQuery(e.target.value)}
                        />
                      </div>
                      <CommandList className="max-h-[220px]">
                        <CommandEmpty>
                          <p className="text-sm text-muted-foreground py-2">
                            No suppliers found.
                          </p>
                        </CommandEmpty>

                        {groupedSuppliers.recent.length > 0 && (
                          <CommandGroup heading="Recently Used">
                            {groupedSuppliers.recent.map((s) => (
                              <SupplierRow
                                key={s.id}
                                supplier={s}
                                icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                                selected={selectedSupplierId === s.id}
                                onSelect={() => setSelectedSupplierId(s.id)}
                              />
                            ))}
                          </CommandGroup>
                        )}

                        {groupedSuppliers.preferred.length > 0 && (
                          <>
                            {groupedSuppliers.recent.length > 0 && <CommandSeparator />}
                            <CommandGroup heading="Preferred Vendors">
                              {groupedSuppliers.preferred.map((s) => (
                                <SupplierRow
                                  key={s.id}
                                  supplier={s}
                                  icon={<Star className="h-4 w-4 text-warning" />}
                                  selected={selectedSupplierId === s.id}
                                  onSelect={() => setSelectedSupplierId(s.id)}
                                />
                              ))}
                            </CommandGroup>
                          </>
                        )}

                        {groupedSuppliers.registered.length > 0 && (
                          <>
                            {(groupedSuppliers.recent.length > 0 ||
                              groupedSuppliers.preferred.length > 0) && <CommandSeparator />}
                            <CommandGroup heading="Registered Suppliers">
                              {groupedSuppliers.registered.map((s) => (
                                <SupplierRow
                                  key={s.id}
                                  supplier={s}
                                  icon={<Building2 className="h-4 w-4 text-primary" />}
                                  selected={selectedSupplierId === s.id}
                                  onSelect={() => setSelectedSupplierId(s.id)}
                                />
                              ))}
                            </CommandGroup>
                          </>
                        )}

                        {groupedSuppliers.oneTime.length > 0 && (
                          <>
                            <CommandSeparator />
                            <CommandGroup heading="One-Time Suppliers">
                              {groupedSuppliers.oneTime.map((s) => (
                                <SupplierRow
                                  key={s.id}
                                  supplier={s}
                                  icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
                                  selected={selectedSupplierId === s.id}
                                  onSelect={() => setSelectedSupplierId(s.id)}
                                />
                              ))}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  )}

                  {selectedSupplier && (
                    <div className="p-3 rounded-lg bg-success/10 border border-success/30 space-y-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">
                          {selectedSupplier.company_name}
                        </span>
                        {selectedSupplier.supplier_code && (
                          <Badge variant="outline" className="ml-auto text-[10px]">
                            {selectedSupplier.supplier_code}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {selectedSupplier.supplier_type && (
                          <span>
                            {selectedSupplier.supplier_type === "PREFERRED"
                              ? "Preferred Vendor"
                              : selectedSupplier.supplier_type === "ONE_TIME"
                              ? "One-Time Supplier"
                              : "Registered Vendor"}
                          </span>
                        )}
                        {selectedSupplier.contact_email && (
                          <span>• {selectedSupplier.contact_email}</span>
                        )}
                        {selectedSupplier.vat_number && (
                          <span>• VAT {selectedSupplier.vat_number}</span>
                        )}
                      </div>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    onClick={() => setShowNewSupplierForm(true)}
                    className="w-full border-dashed"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Supplier
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Approval Comments */}
          {!showNewCategoryForm && !showNewSupplierForm && (
            <div className="space-y-2">
              <Label htmlFor="comments">
                Approval Comments <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="comments"
                placeholder="Enter approval comments..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
                className="bg-background/50"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              isSubmitting ||
              !selectedCategoryId ||
              !selectedSupplierId ||
              !comments.trim() ||
              showNewCategoryForm ||
              showNewSupplierForm
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Approve &amp; Assign Supplier
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SupplierRow({
  supplier,
  icon,
  selected,
  onSelect,
}: {
  supplier: Supplier;
  icon: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      value={`${supplier.company_name} ${supplier.supplier_code ?? ""} ${supplier.contact_person ?? ""}`}
      onSelect={onSelect}
      className="cursor-pointer"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {icon}
        <div className="flex flex-col min-w-0">
          <span className="truncate text-sm">{supplier.company_name}</span>
          <span className="text-[11px] text-muted-foreground truncate">
            {supplier.supplier_code ? `${supplier.supplier_code} • ` : ""}
            {supplier.contact_email || supplier.contact_person || "—"}
          </span>
        </div>
      </div>
      {selected && <Check className="h-4 w-4 text-success shrink-0" />}
    </CommandItem>
  );
}

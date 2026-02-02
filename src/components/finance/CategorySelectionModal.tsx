import { useState, useEffect, useMemo } from "react";
import { Loader2, Tag, Plus, Check, Search, FolderTree, Package } from "lucide-react";
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

interface CategorySelectionModalProps {
  pr: PurchaseRequisition | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (prId: string, categoryId: string, comments: string) => Promise<void>;
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

  useEffect(() => {
    if (open) {
      fetchCategories();
      // Reset state when modal opens
      setSelectedCategoryId(null);
      setComments("");
      setSearchQuery("");
      setShowNewCategoryForm(false);
      setNewCategoryName("");
      setNewCategoryType("EXPENSE");
      setNewCategoryDescription("");
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

  const handleConfirm = async () => {
    if (!pr || !selectedCategoryId) {
      toast.error("Please select a category");
      return;
    }

    if (!comments.trim()) {
      toast.error("Please provide approval comments");
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(pr.id, selectedCategoryId, comments);
    } catch (error) {
      console.error("Category selection error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting && !isCreatingCategory) {
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

          {/* Approval Comments */}
          {!showNewCategoryForm && (
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
            disabled={isSubmitting || !selectedCategoryId || !comments.trim() || showNewCategoryForm}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Approve with Category
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

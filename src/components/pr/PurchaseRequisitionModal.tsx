import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Upload, FileText, X, Loader2, Calendar, Clock, Calculator, Building, Hash, Paperclip, Check } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { createPurchaseRequisition, createPurchaseRequisitionBypassHOD } from "@/services/pr.service";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { PRItem, UrgencyLevel } from "@/types/pr.types";

const formSchema = z.object({
  department: z.string().min(1, "Department is required"),
  urgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  supplier_preference: z.string().optional(),
  supplier_address: z.string().optional(),
  special_instructions: z.string().optional(),
  due_date: z.string().optional(),
  payment_due_date: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface PRItemExtended extends Omit<PRItem, 'unit_price'> {
  name: string;
  unit_price: number | '';  // Allow empty string for display purposes
  vat_classification: 'STANDARD' | 'ZERO';
  technical_specs: string;
  business_justification: string;
}

interface PurchaseRequisitionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  bypassHODApproval?: boolean;
}

const createEmptyItem = (): PRItemExtended => ({
  id: uuidv4(),
  name: "",
  description: "",
  quantity: 1,
  unit_price: '',  // Empty by default, not 0
  total: 0,
  vat_classification: "STANDARD",  // Default: Standard Rated (15% VAT)
  technical_specs: "",
  business_justification: ""
});

// Helper to get numeric value for calculations
const getNumericPrice = (price: number | ''): number => {
  return price === '' ? 0 : price;
};

// Format currency for SA
const formatZAR = (amount: number): string => {
  return `ZAR ${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export function PurchaseRequisitionModal({ open, onOpenChange, onSuccess, bypassHODApproval = false }: PurchaseRequisitionModalProps) {
  const { user, profile } = useAuth();
  const [transactionId, setTransactionId] = useState("");
  const [items, setItems] = useState<PRItemExtended[]>([createEmptyItem()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      urgency: "NORMAL",
      department: profile?.department || "",
    },
  });

  const urgency = watch("urgency");

  // Generate transaction ID when modal opens
  useEffect(() => {
    if (open) {
      const now = new Date();
      const dateStr = format(now, "yyyyMMdd");
      const randomNum = Math.floor(Math.random() * 1000000000000).toString().padStart(12, "0");
      const randomChars = Array(6).fill(0).map(() => 
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]
      ).join("");
      setTransactionId(`PR-${dateStr}-${randomNum}-${randomChars}`);
      
      // Set default department from profile
      if (profile?.department) {
        setValue("department", profile.department);
      }
    }
  }, [open, profile, setValue]);

  // Add new item at TOP for better UX
  const addItem = () => {
    setItems((prev) => [createEmptyItem(), ...prev]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof PRItemExtended, value: string | number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        
        // Handle unit_price specially to allow empty string
        let updatedValue = value;
        if (field === "unit_price") {
          // Allow empty string or valid number
          updatedValue = value === '' ? '' : (parseFloat(String(value)) || 0);
        }
        
        const updated = { ...item, [field]: updatedValue };
        
        // Recalculate total when quantity or unit_price changes
        if (field === "quantity" || field === "unit_price" || field === "vat_classification") {
          const numericPrice = getNumericPrice(updated.unit_price);
          const vatMultiplier = updated.vat_classification === "STANDARD" ? 1.15 : 1;
          updated.total = updated.quantity * numericPrice * vatMultiplier;
        }
        
        return updated;
      })
    );
  };

  const calculateGrandTotal = () => {
    return items.reduce((sum, item) => {
      const numericPrice = getNumericPrice(item.unit_price);
      const vatMultiplier = item.vat_classification === "STANDARD" ? 1.15 : 1;
      return sum + (item.quantity * numericPrice * vatMultiplier);
    }, 0);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setUploadedFile(file);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
  };

  const uploadDocument = async (): Promise<string | null> => {
    if (!uploadedFile || !user) return null;

    setIsUploading(true);
    try {
      const fileExt = uploadedFile.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}-${uuidv4()}.${fileExt}`;

      const { error } = await supabase.storage
        .from("pr-documents")
        .upload(fileName, uploadedFile);

      if (error) {
        console.error("Upload error:", error);
        toast.error("Failed to upload document");
        return null;
      }

      const { data: urlData, error: urlError } = await supabase.storage
        .from("pr-documents")
        .createSignedUrl(fileName, 3600);

      if (urlError || !urlData?.signedUrl) {
        console.error("Failed to create signed URL:", urlError);
        toast.error("Failed to generate document URL");
        return null;
      }

      return urlData.signedUrl;
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload document");
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    // Validate items
    const validItems = items.filter(
      (item) => (item.name.trim() || item.description.trim()) && item.quantity > 0 && getNumericPrice(item.unit_price) > 0
    );

    if (validItems.length === 0) {
      toast.error("Please add at least one valid item");
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload document if exists
      let documentUrl: string | undefined;
      if (uploadedFile) {
        const url = await uploadDocument();
        if (url) documentUrl = url;
      }

      // Map extended items to base PRItem format
      const prItems: PRItem[] = validItems.map(item => ({
        id: item.id,
        description: item.name || item.description,
        quantity: item.quantity,
        unit_price: getNumericPrice(item.unit_price),
        total: item.total,
        supplier_preference: data.supplier_preference,
      }));

      // Use bypass function if HOD is submitting their own PR
      const createFn = bypassHODApproval ? createPurchaseRequisitionBypassHOD : createPurchaseRequisition;
      const result = await createFn({
        items: prItems,
        urgency: data.urgency as UrgencyLevel,
        department: data.department,
        supplier_preference: data.supplier_preference,
        due_date: data.due_date || undefined,
        payment_due_date: data.payment_due_date || undefined,
        document_url: documentUrl,
      });

      if (!result.success) {
        toast.error(result.error || "Failed to create PR");
        return;
      }

      toast.success(`PR ${result.data?.transaction_id} created successfully!`);
      
      // Reset form
      reset();
      setItems([createEmptyItem()]);
      setUploadedFile(null);
      
      onSuccess?.();
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error("An error occurred while creating the PR");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUrgencyLabel = () => {
    const labels: Record<string, string> = {
      LOW: "LOW",
      NORMAL: "NORMAL",
      HIGH: "HIGH",
      URGENT: "URGENT"
    };
    return labels[urgency] || "NORMAL";
  };

  const getUrgencyColor = () => {
    const colors: Record<string, string> = {
      LOW: "bg-muted text-muted-foreground",
      NORMAL: "bg-primary/10 text-primary",
      HIGH: "bg-warning/10 text-warning",
      URGENT: "bg-destructive/10 text-destructive"
    };
    return colors[urgency] || "bg-primary/10 text-primary";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden p-0 bg-white border-0 shadow-2xl">
        <div className="flex flex-col h-full max-h-[95vh]">
          {/* Header */}
          <div className="flex items-start justify-between px-8 py-6 border-b border-border/40 bg-white">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-foreground">Submit New Purchase Requisition</h1>
              <p className="text-sm text-muted-foreground">
                Submit a new purchase requisition for approval through the procurement process
              </p>
            </div>
            <Badge variant="outline" className="font-mono text-xs px-3 py-1.5 bg-muted/50 border-border/50 text-muted-foreground shrink-0">
              <Hash className="h-3 w-3 mr-1" />
              {transactionId}
            </Badge>
          </div>

          {/* Scrollable Content */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <div className="relative">
                {/* Blue left border indicator */}
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />
                
                <div className="p-8 pl-10 space-y-8">
                  {/* Header Fields Row */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        Request Date
                      </Label>
                      <Input
                        type="text"
                        value={format(new Date(), "yyyy/MM/dd")}
                        disabled
                        className="bg-muted/50 border-border/50 text-foreground h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        Approval Due Date
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="date"
                        {...register("due_date")}
                        className="bg-white border-border h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Calculator className="h-4 w-4 text-muted-foreground" />
                        Payment Due Date
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="date"
                        {...register("payment_due_date")}
                        className="bg-white border-border h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        Department
                      </Label>
                      <Input
                        {...register("department")}
                        placeholder="IT Department"
                        className="bg-white border-border h-11"
                      />
                      {errors.department && (
                        <p className="text-xs text-destructive">{errors.department.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Urgency Level</Label>
                      <Select
                        defaultValue="NORMAL"
                        onValueChange={(value) => setValue("urgency", value as any)}
                      >
                        <SelectTrigger className="bg-white border-border h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-border shadow-lg z-[100]">
                          <SelectItem value="LOW">Low Priority</SelectItem>
                          <SelectItem value="NORMAL">Normal Priority</SelectItem>
                          <SelectItem value="HIGH">High Priority</SelectItem>
                          <SelectItem value="URGENT">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Items Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-foreground">Items Required</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addItem}
                        className="bg-muted/50 hover:bg-muted border-border/50 gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add Item
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {items.map((item, index) => (
                        <div
                          key={item.id}
                          className="bg-white border border-border/60 rounded-lg overflow-hidden shadow-sm"
                        >
                          {/* Item Card with Blue Left Border */}
                          <div className="flex">
                            <div className="w-1.5 bg-primary shrink-0" />
                            <div className="flex-1 p-5 space-y-5">
                              {/* Item Header */}
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-foreground">Item {items.length - index}</h4>
                                {items.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeItem(index)}
                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>

                              {/* Item Fields Grid */}
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div className="space-y-2">
                                  <Label className="text-sm text-muted-foreground">
                                    Item Name <span className="text-destructive">*</span>
                                  </Label>
                                  <Input
                                    value={item.name}
                                    onChange={(e) => updateItem(index, "name", e.target.value)}
                                    placeholder="e.g., Laptop"
                                    className="bg-white border-border h-10"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-sm text-muted-foreground">
                                    Description <span className="text-destructive">*</span>
                                  </Label>
                                  <Input
                                    value={item.description}
                                    onChange={(e) => updateItem(index, "description", e.target.value)}
                                    placeholder="e.g., Dell Laptop Computer"
                                    className="bg-white border-border h-10"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-sm text-muted-foreground">Quantity</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={item.quantity}
                                    onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                                    className="bg-white border-border h-10"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-sm text-muted-foreground">
                                    Unit Price (ZAR) <span className="text-destructive">*</span>
                                  </Label>
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={item.unit_price}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      // Allow empty, or valid decimal number
                                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                        updateItem(index, "unit_price", val === '' ? '' : val);
                                      }
                                    }}
                                    onBlur={(e) => {
                                      // Format on blur if there's a value
                                      const val = e.target.value;
                                      if (val !== '' && !isNaN(parseFloat(val))) {
                                        updateItem(index, "unit_price", parseFloat(val));
                                      }
                                    }}
                                    placeholder="e.g. 12500.00"
                                    className="bg-white border-border h-10"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-sm text-muted-foreground">VAT Classification</Label>
                                  <Select
                                    value={item.vat_classification}
                                    onValueChange={(value) => updateItem(index, "vat_classification", value)}
                                  >
                                    <SelectTrigger className="bg-white border-border h-10">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white border border-border shadow-lg z-[100]">
                                      <SelectItem value="STANDARD">Standard Rated (15% VAT)</SelectItem>
                                      <SelectItem value="ZERO">Zero Rated (0% VAT)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              {/* Item Total */}
                              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border/30">
                                <span className="text-sm text-muted-foreground">Total (Inc. VAT):</span>
                                <span className="text-lg font-bold text-foreground">
                                  {formatZAR((item.quantity * getNumericPrice(item.unit_price)) * (item.vat_classification === "STANDARD" ? 1.15 : 1))}
                                </span>
                              </div>

                              {/* Technical Specs & Justification */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label className="text-sm text-muted-foreground">Technical Specifications</Label>
                                  <Textarea
                                    value={item.technical_specs}
                                    onChange={(e) => updateItem(index, "technical_specs", e.target.value)}
                                    placeholder="Model, specifications, technical requirements..."
                                    className="bg-white border-border min-h-[90px] resize-none"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-sm text-muted-foreground">Business Justification</Label>
                                  <Textarea
                                    value={item.business_justification}
                                    onChange={(e) => updateItem(index, "business_justification", e.target.value)}
                                    placeholder="Business need, purpose, expected benefits..."
                                    className="bg-white border-border min-h-[90px] resize-none"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Grand Total Bar */}
                  <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-6 py-4">
                    <span className="font-semibold text-foreground text-base">Grand Total (ZAR):</span>
                    <span className="text-2xl font-bold text-primary">
                      {formatZAR(calculateGrandTotal())}
                    </span>
                  </div>

                  {/* Supplier Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Preferred Supplier</Label>
                      <Select onValueChange={(value) => setValue("supplier_preference", value)}>
                        <SelectTrigger className="bg-white border-border h-11">
                          <SelectValue placeholder="Select a supplier or type manually..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-border shadow-lg z-[100]">
                          <SelectItem value="manual">Type manually...</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Supplier Address</Label>
                      <Input
                        {...register("supplier_address")}
                        placeholder="e.g., 123 Supplier Street, City, Postal Code"
                        className="bg-white border-border h-11"
                      />
                    </div>
                  </div>

                  {/* Special Instructions */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Special Instructions</Label>
                    <Textarea
                      {...register("special_instructions")}
                      placeholder="Any special requirements, installation needs, training requirements..."
                      className="bg-white border-border min-h-[100px] resize-none"
                    />
                  </div>

                  {/* File Upload */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      Supporting Documents
                    </Label>
                    {uploadedFile ? (
                      <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/30">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-success/20">
                          <Check className="h-4 w-4 text-success" />
                        </div>
                        <span className="flex-1 text-sm font-medium text-foreground truncate">{uploadedFile.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={removeFile}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 p-4 border border-border rounded-lg bg-white">
                        <label className="cursor-pointer shrink-0">
                          <span className="inline-flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 border border-border rounded-md text-sm font-medium transition-colors">
                            <Upload className="h-4 w-4" />
                            Choose File
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.doc,.docx,.xls,.xlsx"
                            onChange={handleFileChange}
                          />
                        </label>
                        <span className="text-sm text-muted-foreground">No file chosen</span>
                      </div>
                    )}
                  </div>

                  {/* Summary Bar */}
                  <div className="flex items-center gap-4 bg-muted/50 border border-border/50 rounded-lg px-6 py-4">
                    <Badge className={`font-semibold uppercase text-xs px-3 py-1 ${getUrgencyColor()}`}>
                      {getUrgencyLabel()} Priority
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {items.length} item(s) • {formatZAR(calculateGrandTotal())}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Submit Button */}
            <div className="shrink-0 p-6 bg-white border-t border-border/40">
              <Button
                type="submit"
                size="lg"
                className="w-full bg-foreground hover:bg-foreground/90 text-background font-semibold h-14 text-base shadow-lg"
                disabled={isSubmitting || isUploading}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Creating Purchase Requisition...
                  </>
                ) : (
                  "Submit Purchase Requisition"
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

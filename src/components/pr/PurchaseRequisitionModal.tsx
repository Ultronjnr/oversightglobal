import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Upload, FileText, X, Loader2, Calendar, Clock, Calculator, Building, Hash } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { createPurchaseRequisition } from "@/services/pr.service";
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

interface PRItemExtended extends PRItem {
  name: string;
  vat_classification: string;
  technical_specs: string;
  business_justification: string;
}

interface PurchaseRequisitionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function PurchaseRequisitionModal({ open, onOpenChange, onSuccess }: PurchaseRequisitionModalProps) {
  const { user, profile } = useAuth();
  const [transactionId, setTransactionId] = useState("");
  const [items, setItems] = useState<PRItemExtended[]>([
    { 
      id: uuidv4(), 
      name: "",
      description: "", 
      quantity: 1, 
      unit_price: 0, 
      total: 0,
      vat_classification: "VAT_APPLICABLE",
      technical_specs: "",
      business_justification: ""
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const vatRate = 15;

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

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { 
        id: uuidv4(), 
        name: "",
        description: "", 
        quantity: 1, 
        unit_price: 0, 
        total: 0,
        vat_classification: "VAT_APPLICABLE",
        technical_specs: "",
        business_justification: ""
      },
    ]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof PRItemExtended, value: string | number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        
        // Recalculate total when quantity or unit_price changes
        if (field === "quantity" || field === "unit_price") {
          const vatMultiplier = updated.vat_classification === "VAT_APPLICABLE" ? 1.15 : 1;
          updated.total = updated.quantity * updated.unit_price * vatMultiplier;
        }
        
        return updated;
      })
    );
  };

  const calculateGrandTotal = () => {
    return items.reduce((sum, item) => {
      const vatMultiplier = item.vat_classification === "VAT_APPLICABLE" ? 1.15 : 1;
      return sum + (item.quantity * item.unit_price * vatMultiplier);
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
      (item) => (item.name.trim() || item.description.trim()) && item.quantity > 0 && item.unit_price > 0
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
        unit_price: item.unit_price,
        total: item.total,
        supplier_preference: data.supplier_preference,
      }));

      const result = await createPurchaseRequisition({
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
      setItems([{ 
        id: uuidv4(), 
        name: "",
        description: "", 
        quantity: 1, 
        unit_price: 0, 
        total: 0,
        vat_classification: "VAT_APPLICABLE",
        technical_specs: "",
        business_justification: ""
      }]);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 bg-white">
        <DialogHeader className="px-6 py-4 border-b border-border/30 sticky top-0 bg-white z-10">
          <DialogTitle className="text-xl font-semibold">Submit New Purchase Requisition</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="relative">
          {/* Blue left border indicator */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
          
          <div className="p-6 pl-8 space-y-6">
            {/* Form Title with Transaction ID */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-primary" />
                <div>
                  <h2 className="text-xl font-bold text-foreground">New Purchase Requisition</h2>
                  <p className="text-sm text-muted-foreground">Submit a new purchase requisition for approval through the procurement process</p>
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-xs px-3 py-1.5 bg-muted/30">
                <Hash className="h-3 w-3 mr-1" />
                {transactionId}
              </Badge>
            </div>

            {/* Date and Department Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  Request Date
                </Label>
                <Input
                  type="date"
                  value={format(new Date(), "yyyy-MM-dd")}
                  disabled
                  className="bg-muted/30"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Approval Due Date *
                </Label>
                <Input
                  type="date"
                  {...register("due_date")}
                  className="bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Calculator className="h-4 w-4 text-muted-foreground" />
                  Payment Due Date *
                </Label>
                <Input
                  type="date"
                  {...register("payment_due_date")}
                  className="bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  Department
                </Label>
                <Input
                  {...register("department")}
                  placeholder="IT Department"
                  className="bg-white"
                />
                {errors.department && (
                  <p className="text-sm text-destructive">{errors.department.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Urgency Level</Label>
                <Select
                  defaultValue="NORMAL"
                  onValueChange={(value) => setValue("urgency", value as any)}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border shadow-lg z-50">
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
                <h3 className="font-semibold text-foreground">Items Required</h3>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  Add Item
                </Button>
              </div>

              {items.map((item, index) => (
                <div key={item.id} className="border-l-4 border-primary/50 bg-muted/10 rounded-r-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Item {index + 1}</h4>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Item Name *</Label>
                      <Input
                        value={item.name}
                        onChange={(e) => updateItem(index, "name", e.target.value)}
                        placeholder="e.g., Laptop"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Description *</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(index, "description", e.target.value)}
                        placeholder="e.g., Dell Laptop Computer with specifications"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Quantity</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Unit Price (ZAR) *</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">VAT Classification</Label>
                      <Select
                        value={item.vat_classification}
                        onValueChange={(value) => updateItem(index, "vat_classification", value)}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white border shadow-lg z-50">
                          <SelectItem value="VAT_APPLICABLE">VAT Applicable</SelectItem>
                          <SelectItem value="VAT_EXEMPT">VAT Exempt</SelectItem>
                          <SelectItem value="ZERO_RATED">Zero Rated</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Total (Inc. VAT)</Label>
                      <p className="text-lg font-semibold bg-muted/50 px-3 py-1 rounded">
                        ZAR {((item.quantity * item.unit_price) * (item.vat_classification === "VAT_APPLICABLE" ? 1.15 : 1)).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Technical Specifications</Label>
                      <Textarea
                        value={item.technical_specs}
                        onChange={(e) => updateItem(index, "technical_specs", e.target.value)}
                        placeholder="Model, specifications, technical requirements..."
                        className="bg-white min-h-[80px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Business Justification</Label>
                      <Textarea
                        value={item.business_justification}
                        onChange={(e) => updateItem(index, "business_justification", e.target.value)}
                        placeholder="Business need, purpose, expected benefits..."
                        className="bg-white min-h-[80px]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Grand Total Bar */}
            <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-6 py-4">
              <span className="font-semibold text-foreground">Grand Total (ZAR):</span>
              <span className="text-2xl font-bold text-primary">
                ZAR {calculateGrandTotal().toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Supplier Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Preferred Supplier</Label>
                <Select
                  onValueChange={(value) => setValue("supplier_preference", value)}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select a supplier or type manually..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white border shadow-lg z-50">
                    <SelectItem value="manual">Type manually...</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Supplier Address</Label>
                <Input
                  {...register("supplier_address")}
                  placeholder="e.g., 123 Supplier Street, City, Postal Code"
                  className="bg-white"
                />
              </div>
            </div>

            {/* Special Instructions */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Special Instructions</Label>
              <Textarea
                {...register("special_instructions")}
                placeholder="Any special requirements, installation needs, training requirements..."
                className="bg-white min-h-[100px]"
              />
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Upload className="h-4 w-4" />
                Supporting Documents
              </Label>
              {uploadedFile ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="flex-1 text-sm truncate">{uploadedFile.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={removeFile}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-4 p-3 border border-border/50 rounded-lg">
                  <label className="cursor-pointer">
                    <span className="px-4 py-2 bg-muted rounded text-sm font-medium hover:bg-muted/80 transition-colors">
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
            <div className="flex items-center gap-4 bg-primary/5 border border-primary/20 rounded-lg px-6 py-3">
              <Badge className="bg-primary/10 text-primary border-primary/20 font-medium">
                {getUrgencyLabel()} Priority
              </Badge>
              <span className="text-sm text-muted-foreground">
                {items.length} item(s) • ZAR {calculateGrandTotal().toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <div className="sticky bottom-0 p-6 pt-4 bg-white border-t border-border/30">
            <Button
              type="submit"
              size="lg"
              className="w-full bg-foreground hover:bg-foreground/90 text-white font-semibold py-6 text-base"
              disabled={isSubmitting || isUploading}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Creating PR...
                </>
              ) : (
                "Submit Purchase Requisition"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

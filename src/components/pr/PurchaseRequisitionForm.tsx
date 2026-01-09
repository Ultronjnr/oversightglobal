import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Upload, FileText, X, Loader2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRItemRow } from "./PRItemRow";
import { createPurchaseRequisition } from "@/services/pr.service";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { PRItem, UrgencyLevel } from "@/types/pr.types";

const formSchema = z.object({
  department: z.string().min(1, "Department is required"),
  urgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  supplier_preference: z.string().optional(),
  due_date: z.string().optional(),
  payment_due_date: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface PurchaseRequisitionFormProps {
  onSuccess?: () => void;
}

export function PurchaseRequisitionForm({ onSuccess }: PurchaseRequisitionFormProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<PRItem[]>([
    { id: uuidv4(), description: "", quantity: 1, unit_price: 0, total: 0 },
  ]);
  const [includeVAT, setIncludeVAT] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const vatRate = includeVAT ? 15 : 0;

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      urgency: "NORMAL",
    },
  });

  // Recalculate totals when VAT changes
  useEffect(() => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        total: item.quantity * item.unit_price * (1 + vatRate / 100),
      }))
    );
  }, [vatRate]);

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: uuidv4(), description: "", quantity: 1, unit_price: 0, total: 0 },
    ]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof PRItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const calculateSubtotal = () => {
    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );
    return subtotal;
  };

  const calculateVAT = () => {
    return calculateSubtotal() * (vatRate / 100);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateVAT();
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

      // Use signed URL for private bucket (1 hour expiration)
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
      (item) => item.description.trim() && item.quantity > 0 && item.unit_price > 0
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

      const result = await createPurchaseRequisition({
        items: validItems,
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
      setItems([{ id: uuidv4(), description: "", quantity: 1, unit_price: 0, total: 0 }]);
      setUploadedFile(null);
      
      onSuccess?.();
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error("An error occurred while creating the PR");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Header Fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="department">Department *</Label>
          <Input
            id="department"
            placeholder="e.g., Marketing"
            {...register("department")}
            className="bg-background/50"
          />
          {errors.department && (
            <p className="text-sm text-destructive">{errors.department.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Urgency *</Label>
          <Select
            defaultValue="NORMAL"
            onValueChange={(value) => setValue("urgency", value as any)}
          >
            <SelectTrigger className="bg-background/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="NORMAL">Normal</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="URGENT">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="supplier_preference">Preferred Supplier</Label>
          <Input
            id="supplier_preference"
            placeholder="Optional"
            {...register("supplier_preference")}
            className="bg-background/50"
          />
        </div>
      </div>

      {/* Date Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="due_date">Required By Date</Label>
          <Input
            id="due_date"
            type="date"
            {...register("due_date")}
            className="bg-background/50"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment_due_date">Payment Due Date</Label>
          <Input
            id="payment_due_date"
            type="date"
            {...register("payment_due_date")}
            className="bg-background/50"
          />
        </div>
      </div>

      {/* VAT Toggle */}
      <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border/50">
        <Switch
          id="vat"
          checked={includeVAT}
          onCheckedChange={setIncludeVAT}
        />
        <Label htmlFor="vat" className="cursor-pointer">
          Include VAT ({includeVAT ? "15%" : "0%"})
        </Label>
      </div>

      {/* Line Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Line Items</Label>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-4 w-4 mr-1" />
            Add Item
          </Button>
        </div>

        {/* Header Row */}
        <div className="grid grid-cols-12 gap-3 text-sm font-medium text-muted-foreground px-1">
          <div className="col-span-5">Description</div>
          <div className="col-span-2">Quantity</div>
          <div className="col-span-2">Unit Price (R)</div>
          <div className="col-span-2">Total</div>
          <div className="col-span-1"></div>
        </div>

        {/* Item Rows */}
        <div className="space-y-2">
          {items.map((item, index) => (
            <PRItemRow
              key={item.id}
              item={item}
              index={index}
              vatRate={vatRate}
              onUpdate={updateItem}
              onRemove={removeItem}
              canRemove={items.length > 1}
            />
          ))}
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-2 p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span>R {calculateSubtotal().toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">VAT ({vatRate}%):</span>
              <span>R {calculateVAT().toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg border-t border-border/50 pt-2">
              <span>Total:</span>
              <span className="text-primary">R {calculateTotal().toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* File Upload */}
      <div className="space-y-3">
        <Label>Supporting Document</Label>
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
          <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border/50 rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors">
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">
              Click to upload or drag and drop
            </span>
            <span className="text-xs text-muted-foreground mt-1">
              PDF, DOC, DOCX, XLS, XLSX (max 10MB)
            </span>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              onChange={handleFileChange}
            />
          </label>
        )}
      </div>

      {/* Submit */}
      <Button
        type="submit"
        variant="gradient"
        size="lg"
        className="w-full"
        disabled={isSubmitting || isUploading}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Creating PR...
          </>
        ) : (
          "Submit Purchase Requisition"
        )}
      </Button>
    </form>
  );
}

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
import { CostCenterDropdown } from "@/components/pr/CostCenterDropdown";
import { createPurchaseRequisition, createPurchaseRequisitionBypassHOD } from "@/services/pr.service";
import { getApprovedSuppliers, type ApprovedSupplier } from "@/services/supplier.service";
import { SuggestSupplierModal } from "@/components/pr/SuggestSupplierModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import type { PRItem, UrgencyLevel } from "@/types/pr.types";
import { ProjectDonorSelect, type ProjectDonorValue } from "@/components/pr/ProjectDonorSelect";
import { ProjectBudgetPreview } from "@/components/finance/ProjectBudgetPreview";
import {
  PRSupplierQuotesInput,
  createEmptyQuoteDraft,
  type SupplierQuoteDraft,
} from "@/components/pr/PRSupplierQuotesInput";
import {
  addManualQuote,
  uploadManualQuoteDocument,
} from "@/services/pr-sourcing.service";


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

export function PurchaseRequisitionModal({ open, onOpenChange, onSuccess, bypassHODApproval = false }: PurchaseRequisitionModalProps) {
  const { user, profile } = useAuth();
  const { currency, format: formatZAR } = useCurrency();
  const [transactionId, setTransactionId] = useState("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [suppliers, setSuppliers] = useState<ApprovedSupplier[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [projectDonor, setProjectDonor] = useState<ProjectDonorValue>({
    projectId: null,
    donorId: null,
  });
  const [supplierQuotes, setSupplierQuotes] = useState<SupplierQuoteDraft[]>([
    createEmptyQuoteDraft(),
  ]);
  const [overBudget, setOverBudget] = useState(false);




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
  const selectedSupplier = watch("supplier_preference");

  const loadSuppliers = async () => {
    const result = await getApprovedSuppliers();
    if (result.success) setSuppliers(result.data);
  };

  // Load approved suppliers when the modal opens
  useEffect(() => {
    if (open) loadSuppliers();
  }, [open]);

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

  // ---- Supplier quote maths -------------------------------------------------
  const quoteTotalOf = (q: SupplierQuoteDraft) =>
    (Number(q.quantity) || 0) * (Number(q.price) || 0);

  const pricedQuotes = supplierQuotes.filter(
    (q) => (q.supplierId || q.supplierName.trim()) && quoteTotalOf(q) > 0,
  );
  const lowestQuote =
    pricedQuotes.length > 0
      ? pricedQuotes.reduce((a, b) => (quoteTotalOf(a) <= quoteTotalOf(b) ? a : b))
      : null;

  const calculateGrandTotal = () => (lowestQuote ? quoteTotalOf(lowestQuote) : 0);

  // Amount used for the project budget reservation preview.
  const fundingTotal = calculateGrandTotal();

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

      // Upload succeeded — return the storage path.
      // The edge function generates fresh signed URLs on demand.
      return `pr-documents/${fileName}`;
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload document");
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!lowestQuote) {
      toast.error("Add at least one supplier quote with a supplier and price");
      return;
    }

    if (overBudget) {
      toast.error("This requisition exceeds the remaining budget on the selected project");
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

      // The requisition line is derived from the lowest quote; every captured
      // quote is attached below so Finance can pick a different winner.
      const prItems: PRItem[] = [
        {
          id: lowestQuote.id,
          description:
            lowestQuote.description ||
            lowestQuote.supplierName ||
            "Supplier quote",
          quantity: Number(lowestQuote.quantity) || 1,
          unit_price: Number(lowestQuote.price) || 0,
          total: quoteTotalOf(lowestQuote),
        },
      ];

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
        project_id: projectDonor.projectId || undefined,
        donor_id: projectDonor.donorId || undefined,

      });

      if (!result.success) {
        toast.error(result.error || "Failed to create PR");
        return;
      }

      // Attach the captured supplier quotes so Finance can choose a winner.
      const newPrId = result.data?.id;
      if (newPrId && pricedQuotes.length > 0) {
        for (const q of pricedQuotes) {
          let path: string | null = null;
          if (q.file) {
            const up = await uploadManualQuoteDocument(q.file, newPrId);
            if (up.success && up.path) path = up.path;
          }
          await addManualQuote({
            prId: newPrId,
            supplierId: q.supplierId,
            supplierName: q.supplierId ? null : q.supplierName.trim(),
            amount: quoteTotalOf(q),
            notes: [q.description, q.notes].filter(Boolean).join(" — ") || null,
            documentPath: path,
          });
        }
      }

      toast.success(`PR ${result.data?.transaction_id} created successfully!`);

      // Reset form
      reset();
      
      setUploadedFile(null);
      setSupplierQuotes([createEmptyQuoteDraft()]);


      
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
    <>
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

                    <CostCenterDropdown
                      id="department"
                      value={watch("department")}
                      onChange={(value) =>
                        setValue("department", value, { shouldValidate: true })
                      }
                      error={errors.department?.message}
                    />

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

                  {/* Supplier quotes — the core of the requisition */}
                  <div className="space-y-3">
                    <PRSupplierQuotesInput
                      value={supplierQuotes}
                      onChange={setSupplierQuotes}
                    />
                    <button
                      type="button"
                      onClick={() => setSuggestOpen(true)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      + Suggest New Supplier
                    </button>
                  </div>

                  {/* Requisition total (based on the lowest quote) */}
                  <div className="bg-primary/5 border border-primary/20 rounded-lg px-6 py-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <span className="font-semibold text-foreground text-base">
                          Requisition Total ({currency})
                        </span>
                        <p className="text-xs text-muted-foreground">
                          Based on the lowest quote — Finance may approve a different supplier.
                        </p>
                      </div>
                      <span className="text-2xl font-bold text-primary">
                        {formatZAR(calculateGrandTotal())}
                      </span>
                    </div>
                  </div>


                  {/* Funding source — links this PR to a donation project / donor */}
                  <div className="space-y-3">
                    <ProjectDonorSelect
                      value={projectDonor}
                      onChange={setProjectDonor}
                    />
                    <ProjectBudgetPreview
                      projectId={projectDonor.projectId}
                      amount={fundingTotal}
                      onOverBudgetChange={setOverBudget}
                    />
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
                      {supplierQuotes.length} quote(s) • {formatZAR(calculateGrandTotal())}
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
      <SuggestSupplierModal
        open={suggestOpen}
        onOpenChange={setSuggestOpen}
        onSuggested={loadSuppliers}
      />
    </>
  );
}

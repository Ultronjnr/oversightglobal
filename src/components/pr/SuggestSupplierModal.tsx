import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createSupplierSuggestion } from "@/services/supplier.service";

interface SuggestSupplierModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuggested?: () => void;
}

export function SuggestSupplierModal({
  open,
  onOpenChange,
  onSuggested,
}: SuggestSupplierModalProps) {
  const [companyName, setCompanyName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setCompanyName("");
    setContactEmail("");
    setPhone("");
    setAddress("");
    setNotes("");
  };

  const handleSubmit = async () => {
    if (!companyName.trim()) {
      toast.error("Please enter the supplier company name");
      return;
    }

    setIsSubmitting(true);
    const result = await createSupplierSuggestion({
      company_name: companyName,
      contact_email: contactEmail,
      phone,
      address,
      notes,
    });
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error || "Failed to submit suggestion");
      return;
    }

    toast.success("Supplier suggestion sent to Finance for approval");
    reset();
    onSuggested?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle>Suggest a New Supplier</DialogTitle>
          <DialogDescription>
            Your suggestion will be sent to the Finance Manager for review and approval.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="suggest-company">Company Name *</Label>
            <Input
              id="suggest-company"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g., Acme Supplies Pty Ltd"
              maxLength={120}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="suggest-email">Contact Email</Label>
              <Input
                id="suggest-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="supplier@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="suggest-phone">Phone</Label>
              <Input
                id="suggest-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+27 ..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="suggest-address">Address</Label>
            <Input
              id="suggest-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Supplier Street, City, Postal Code"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="suggest-notes">Notes</Label>
            <Textarea
              id="suggest-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why should we use this supplier? Any context for Finance..."
              className="min-h-[80px] resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Send to Finance"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

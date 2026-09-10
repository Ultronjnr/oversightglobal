import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddressAutocomplete } from "@/components/onboarding/AddressAutocomplete";
import { toast } from "sonner";
import { Loader2, Building2, Save } from "lucide-react";
import {
  getOrganizationProfile,
  updateOrganizationProfile,
  type Organization,
} from "@/services/admin.service";

export function CompanyProfileTab() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    company_email: "",
    address: "",
    phone: "",
    registration_number: "",
    tax_number: "",
    organisation_type: "" as "" | "NGO" | "NPO",
    pbo_registered: "NO" as "YES" | "NO",
    pbo_number: "",
  });

  useEffect(() => {
    fetchOrganization();
  }, []);

  const fetchOrganization = async () => {
    setIsLoading(true);
    try {
      const result = await getOrganizationProfile();
      if (result.success && result.data) {
        setOrg(result.data);
        setFormData({
          name: result.data.name || "",
          company_email: result.data.company_email || "",
          address: result.data.address || "",
          phone: result.data.phone || "",
          registration_number: result.data.registration_number || "",
          tax_number: result.data.tax_number || "",
          organisation_type: result.data.organisation_type || "",
          pbo_registered: result.data.pbo_registered ? "YES" : "NO",
          pbo_number: result.data.pbo_number || "",
        });
      } else {
        toast.error("Failed to load organisation profile");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Organisation name is required");
      return;
    }
    if (formData.pbo_registered === "YES" && formData.pbo_number.trim().length < 2) {
      toast.error("Please enter your PBO/PVO number");
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateOrganizationProfile({
        name: formData.name,
        company_email: formData.company_email || null,
        address: formData.address || null,
        phone: formData.phone || null,
        registration_number: formData.registration_number || null,
        tax_number: formData.tax_number || null,
        organisation_type: formData.organisation_type || null,
        pbo_registered: formData.pbo_registered === "YES",
        pbo_number:
          formData.pbo_registered === "YES" ? formData.pbo_number || null : null,
      });

      if (result.success) {
        toast.success("Organisation profile updated");
        fetchOrganization();
      } else {
        toast.error(result.error || "Failed to update profile");
      }
    } finally {
      setIsSaving(false);
    }
  };

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
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          Organisation Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Organisation Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Enter organisation name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Organisation Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.company_email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, company_email: e.target.value }))
              }
              placeholder="contact@organisation.org"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Organisation Address</Label>
          <AddressAutocomplete
            id="address"
            value={formData.address}
            onChange={(v) => setFormData((prev) => ({ ...prev, address: v }))}
            placeholder="Start typing your address..."
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, phone: e.target.value }))
              }
              placeholder="+27 12 345 6789"
            />
          </div>

          <div className="space-y-2">
            <Label>Organisation Type</Label>
            <Select
              value={formData.organisation_type}
              onValueChange={(v) =>
                setFormData((prev) => ({
                  ...prev,
                  organisation_type: v as "NGO" | "NPO",
                }))
              }
            >
              <SelectTrigger id="organisation_type">
                <SelectValue placeholder="Select organisation type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NGO">NGO</SelectItem>
                <SelectItem value="NPO">NPO</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="registration_number">Registration Number</Label>
            <Input
              id="registration_number"
              value={formData.registration_number}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  registration_number: e.target.value,
                }))
              }
              placeholder="2023/123456/07"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tax_number">Tax Number</Label>
            <Input
              id="tax_number"
              value={formData.tax_number}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, tax_number: e.target.value }))
              }
              placeholder="9876543210"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Are you registered for PBO/PVO?</Label>
            <Select
              value={formData.pbo_registered}
              onValueChange={(v) =>
                setFormData((prev) => ({
                  ...prev,
                  pbo_registered: v as "YES" | "NO",
                  pbo_number: v === "YES" ? prev.pbo_number : "",
                }))
              }
            >
              <SelectTrigger id="pbo_registered">
                <SelectValue placeholder="Select an answer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="YES">Yes</SelectItem>
                <SelectItem value="NO">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.pbo_registered === "YES" && (
            <div className="space-y-2">
              <Label htmlFor="pbo_number">PBO/PVO Exemption Number *</Label>
              <Input
                id="pbo_number"
                value={formData.pbo_number}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, pbo_number: e.target.value }))
                }
                placeholder="930012345"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

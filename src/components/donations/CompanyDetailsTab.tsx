import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw, Building2 } from "lucide-react";
import {
  getOrgProfile, saveOrgProfile, uploadAsset, getAssetDataUrl,
  type DonationOrgProfile,
} from "@/services/donation.service";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type AssetKind = "logo" | "signature" | "stamp";

/** Company Profile fields that feed Section 18A company details. */
type CompanyProfile = {
  legal_name: string;
  registration_number: string;
  vat_number: string;
  pbo_number: string;
  physical_address: string;
  contact_email: string;
  contact_phone: string;
};

const EMPTY_COMPANY: CompanyProfile = {
  legal_name: "", registration_number: "", vat_number: "",
  pbo_number: "", physical_address: "", contact_email: "", contact_phone: "",
};

/** Keys that are inherited from the organisation's Company Profile. */
const INHERITED = Object.keys(EMPTY_COMPANY) as (keyof CompanyProfile)[];

export function CompanyDetailsTab() {
  const { profile: authProfile } = useAuth();
  const [form, setForm] = useState<any>({});
  const [company, setCompany] = useState<CompanyProfile>(EMPTY_COMPANY);
  const [declaration, setDeclaration] = useState("");
  const [previews, setPreviews] = useState<Record<AssetKind, string | null>>({ logo: null, signature: null, stamp: null });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const orgId = authProfile?.organization_id;
        let base: CompanyProfile = EMPTY_COMPANY;
        if (orgId) {
          const { data: org } = await supabase
            .from("organizations")
            .select("name, registration_number, tax_number, pbo_number, address, company_email, phone")
            .eq("id", orgId)
            .maybeSingle();
          if (org) {
            base = {
              legal_name: (org as any).name ?? "",
              registration_number: (org as any).registration_number ?? "",
              vat_number: (org as any).tax_number ?? "",
              pbo_number: (org as any).pbo_number ?? "",
              physical_address: (org as any).address ?? "",
              contact_email: (org as any).company_email ?? "",
              contact_phone: (org as any).phone ?? "",
            };
          }
        }
        setCompany(base);

        const p = await getOrgProfile();
        // Section 18A reuses the Company Profile: anything not captured here yet
        // is filled in automatically so nothing is typed twice.
        const merged: any = { receipt_prefix: "18A", template: {}, ...(p || {}) };
        INHERITED.forEach((k) => {
          if (!String(merged[k] ?? "").trim() && base[k]) merged[k] = base[k];
        });
        setForm(merged);
        setDeclaration((p?.template as any)?.declaration || "");
        if (p) {
          const [logo, sig, stamp] = await Promise.all([
            getAssetDataUrl(p.logo_path), getAssetDataUrl(p.signature_path), getAssetDataUrl(p.stamp_path),
          ]);
          setPreviews({ logo, signature: sig, stamp });
        }
      } finally { setLoading(false); }
    })();
  }, [authProfile?.organization_id]);

  const pullFromCompanyProfile = () => {
    setForm((f: any) => {
      const next = { ...f };
      INHERITED.forEach((k) => { if (company[k]) next[k] = company[k]; });
      return next;
    });
    toast.success("Refreshed from Company Profile");
  };

  const onUpload = async (kind: AssetKind, file: File) => {
    try {
      const path = await uploadAsset(file, kind);
      setForm((f: any) => ({ ...f, [`${kind}_path`]: path }));
      setPreviews((p) => ({ ...p, [kind]: URL.createObjectURL(file) }));
      toast.success(`${kind} uploaded`);
    } catch { toast.error(`Failed to upload ${kind}`); }
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveOrgProfile({ ...form, template: { ...(form.template || {}), declaration } } as Partial<DonationOrgProfile>);
      toast.success("Company details saved");
    } catch { toast.error("Failed to save company details"); }
    finally { setSaving(false); }
  };

  if (loading) return <Card className="p-8 text-center text-muted-foreground">Loading…</Card>;

  const field = (key: string, label: string, type = "text") => {
    const inherited =
      (INHERITED as string[]).includes(key) &&
      !!company[key as keyof CompanyProfile] &&
      String(form[key] ?? "") === company[key as keyof CompanyProfile];
    return (
      <div>
        <div className="flex items-center gap-2">
          <Label>{label}</Label>
          {inherited && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5">Company Profile</Badge>
          )}
        </div>
        <Input type={type} value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
      </div>
    );
  };

  const AssetUpload = ({ kind, label }: { kind: AssetKind; label: string }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      {previews[kind] && <img src={previews[kind]!} alt={label} className="h-16 object-contain border rounded bg-white p-1" />}
      <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onUpload(kind, e.target.files[0])} />
    </div>
  );

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Company Details</h3>
          </div>
          <Button variant="outline" size="sm" onClick={pullFromCompanyProfile}>
            <RefreshCw className="h-3.5 w-3.5 mr-2" />
            Refresh from Company Profile
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          These details come from your organisation profile and are used on Section 18A receipts.
          Edit anything that should appear differently on receipts.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field("legal_name", "Legal Name")}
          {field("registration_number", "Registration Number")}
          {field("npo_number", "NPO Number")}
          {field("pbo_number", "PBO Number")}
          {field("vat_number", "VAT Number")}
          {field("receipt_prefix", "Receipt Prefix")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Label>Physical Address</Label>
              {!!company.physical_address && form.physical_address === company.physical_address && (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5">Company Profile</Badge>
              )}
            </div>
            <Textarea value={form.physical_address || ""} onChange={(e) => setForm({ ...form, physical_address: e.target.value })} />
          </div>
          <div><Label>Postal Address</Label><Textarea value={form.postal_address || ""} onChange={(e) => setForm({ ...form, postal_address: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {field("contact_name", "Contact Name")}
          {field("contact_email", "Contact Email")}
          {field("contact_phone", "Contact Phone")}
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Signatory & Branding</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field("signatory_name", "Signatory Name")}
          {field("signatory_designation", "Signatory Designation")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <AssetUpload kind="logo" label="Logo" />
          <AssetUpload kind="signature" label="Digital Signature" />
          <AssetUpload kind="stamp" label="Organization Stamp" />
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Receipt Template</h3>
        <div>
          <Label>Section 18A Declaration Text</Label>
          <Textarea rows={4} value={declaration} placeholder="Leave blank to use the standard SARS declaration."
            onChange={(e) => setDeclaration(e.target.value)} />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Company Details"}</Button>
      </div>
    </div>
  );
}

/** Legacy export name — the tab was renamed from "Branding" to "Company Details". */
export const BrandingTab = CompanyDetailsTab;

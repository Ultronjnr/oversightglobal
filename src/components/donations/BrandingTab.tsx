import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getOrgProfile, saveOrgProfile, uploadAsset, getAssetDataUrl,
  type DonationOrgProfile,
} from "@/services/donation.service";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type AssetKind = "logo" | "signature" | "stamp";

export function BrandingTab() {
  const { profile: authProfile } = useAuth();
  const [form, setForm] = useState<any>({});
  const [declaration, setDeclaration] = useState("");
  const [previews, setPreviews] = useState<Record<AssetKind, string | null>>({ logo: null, signature: null, stamp: null });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        let p = await getOrgProfile();
        if (!p && authProfile?.organization_id) {
          const { data: org } = await supabase
            .from("organizations")
            .select("name")
            .eq("id", authProfile.organization_id)
            .maybeSingle();
          p = { legal_name: (org as any)?.name ?? "", receipt_prefix: "18A", template: {} } as DonationOrgProfile;
        }
        setForm(p || {});
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
      await saveOrgProfile({ ...form, template: { ...(form.template || {}), declaration } });
      toast.success("Organization profile saved");
    } catch { toast.error("Failed to save profile"); }
    finally { setSaving(false); }
  };

  if (loading) return <Card className="p-8 text-center text-muted-foreground">Loading…</Card>;

  const field = (key: string, label: string, type = "text") => (
    <div><Label>{label}</Label><Input type={type} value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></div>
  );

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
        <h3 className="font-semibold">Organization Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field("legal_name", "Legal Name")}
          {field("registration_number", "Registration Number")}
          {field("npo_number", "NPO Number")}
          {field("pbo_number", "PBO Number")}
          {field("vat_number", "VAT Number")}
          {field("receipt_prefix", "Receipt Prefix")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Physical Address</Label><Textarea value={form.physical_address || ""} onChange={(e) => setForm({ ...form, physical_address: e.target.value })} /></div>
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
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Profile"}</Button>
      </div>
    </div>
  );
}
import { useEffect, useState } from "react";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Save, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type CompanyType = "PTY_LTD" | "PLC" | "NPO";
type VatCycle = "MONTHLY" | "BI_MONTHLY";

const schema = z
  .object({
    full_name: z.string().trim().min(1, "Full name is required").max(150),
    company_name: z.string().trim().min(1, "Company name is required").max(200),
    registration_number: z
      .string()
      .trim()
      .min(1, "Registration number is required")
      .max(50),
    company_type: z.enum(["PTY_LTD", "PLC", "NPO"]),
    vat_registered: z.boolean(),
    vat_number: z.string().trim().max(50).optional().nullable(),
    vat_cycle: z.enum(["MONTHLY", "BI_MONTHLY"]).optional().nullable(),
    next_vat_submission_date: z.date().optional().nullable(),
  })
  .refine(
    (d) =>
      !d.vat_registered ||
      (d.vat_number && d.vat_number.trim().length > 0),
    { path: ["vat_number"], message: "VAT number is required" }
  )
  .refine((d) => !d.vat_registered || !!d.vat_cycle, {
    path: ["vat_cycle"],
    message: "VAT cycle is required",
  })
  .refine((d) => !d.vat_registered || !!d.next_vat_submission_date, {
    path: ["next_vat_submission_date"],
    message: "Next VAT submission date is required",
  });

interface State {
  full_name: string;
  company_name: string;
  registration_number: string;
  company_type: CompanyType | "";
  vat_registered: boolean;
  vat_number: string;
  vat_cycle: VatCycle | "";
  next_vat_submission_date: Date | null;
}

const initial: State = {
  full_name: "",
  company_name: "",
  registration_number: "",
  company_type: "",
  vat_registered: false,
  vat_number: "",
  vat_cycle: "",
  next_vat_submission_date: null,
};

export function FreemiumBusinessProfile() {
  const { user } = useAuth();
  const [form, setForm] = useState<State>(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("freemium_business_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        toast.error("Failed to load business profile");
      } else if (data) {
        setExistingId(data.id);
        setForm({
          full_name: data.full_name,
          company_name: data.company_name,
          registration_number: data.registration_number,
          company_type: data.company_type as CompanyType,
          vat_registered: data.vat_registered,
          vat_number: data.vat_number || "",
          vat_cycle: (data.vat_cycle as VatCycle) || "",
          next_vat_submission_date: data.next_vat_submission_date
            ? new Date(data.next_vat_submission_date)
            : null,
        });
      }
      setLoading(false);
    })();
  }, [user?.id]);

  const update = <K extends keyof State>(k: K, v: State[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!user) return;
    const parsed = schema.safeParse({
      ...form,
      company_type: form.company_type || undefined,
      vat_cycle: form.vat_registered ? form.vat_cycle || undefined : null,
      vat_number: form.vat_registered ? form.vat_number : null,
      next_vat_submission_date: form.vat_registered
        ? form.next_vat_submission_date
        : null,
    });
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      toast.error(first?.message || "Please complete all required fields");
      return;
    }

    setSaving(true);
    const payload = {
      user_id: user.id,
      full_name: parsed.data.full_name,
      company_name: parsed.data.company_name,
      registration_number: parsed.data.registration_number,
      company_type: parsed.data.company_type,
      vat_registered: parsed.data.vat_registered,
      vat_number: parsed.data.vat_registered ? parsed.data.vat_number ?? null : null,
      vat_cycle: parsed.data.vat_registered ? parsed.data.vat_cycle ?? null : null,
      next_vat_submission_date:
        parsed.data.vat_registered && parsed.data.next_vat_submission_date
          ? format(parsed.data.next_vat_submission_date, "yyyy-MM-dd")
          : null,
    };

    const { error } = existingId
      ? await supabase
          .from("freemium_business_profiles")
          .update(payload)
          .eq("id", existingId)
      : await supabase.from("freemium_business_profiles").insert(payload);

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Business profile saved");
    if (!existingId) {
      const { data } = await supabase
        .from("freemium_business_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setExistingId(data.id);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Business Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 max-w-2xl">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="full_name">Full Name *</Label>
            <Input
              id="full_name"
              value={form.full_name}
              maxLength={150}
              onChange={(e) => update("full_name", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="company_name">Company Name *</Label>
            <Input
              id="company_name"
              value={form.company_name}
              maxLength={200}
              onChange={(e) => update("company_name", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="registration_number">Registration Number *</Label>
            <Input
              id="registration_number"
              value={form.registration_number}
              maxLength={50}
              onChange={(e) => update("registration_number", e.target.value)}
            />
          </div>
          <div>
            <Label>Company Type *</Label>
            <Select
              value={form.company_type}
              onValueChange={(v) => update("company_type", v as CompanyType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select company type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PTY_LTD">PTY LTD</SelectItem>
                <SelectItem value="PLC">PLC</SelectItem>
                <SelectItem value="NPO">NPO</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium text-sm">VAT Registered</p>
            <p className="text-xs text-muted-foreground">
              Toggle on if your business is registered for VAT.
            </p>
          </div>
          <Switch
            checked={form.vat_registered}
            onCheckedChange={(v) => update("vat_registered", v)}
          />
        </div>

        {form.vat_registered && (
          <div className="grid sm:grid-cols-2 gap-4 rounded-lg border border-dashed p-4">
            <div>
              <Label htmlFor="vat_number">VAT Number *</Label>
              <Input
                id="vat_number"
                value={form.vat_number}
                maxLength={50}
                onChange={(e) => update("vat_number", e.target.value)}
              />
            </div>
            <div>
              <Label>VAT Cycle *</Label>
              <Select
                value={form.vat_cycle}
                onValueChange={(v) => update("vat_cycle", v as VatCycle)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select cycle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="BI_MONTHLY">Bi-Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Next VAT Submission Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.next_vat_submission_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.next_vat_submission_date
                      ? format(form.next_vat_submission_date, "PPP")
                      : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.next_vat_submission_date ?? undefined}
                    onSelect={(d) => update("next_vat_submission_date", d ?? null)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {existingId ? "Save changes" : "Create profile"}
        </Button>
      </CardContent>
    </Card>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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
import { Logo } from "@/components/Logo";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PageSeo } from "@/components/site/PageSeo";
import { getOnboarding, saveOnboarding } from "@/services/onboarding.service";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Building2, Loader2, PartyPopper } from "lucide-react";

interface Option {
  value: string;
  label: string;
  hint?: string;
  emoji: string;
}

interface Step {
  key: "pain_point" | "cause" | "team_size" | "heard_about";
  eyebrow: string;
  title: string;
  subtitle: string;
  options: Option[];
}

const STEPS: Step[] = [
  {
    key: "pain_point",
    eyebrow: "So we can help faster",
    title: "What's your biggest headache right now?",
    subtitle: "We'll start you exactly where it hurts most.",
    options: [
      { value: "DOCUMENTS_MISSING", label: "Documents go missing", hint: "Chasing slips & invoices for money already spent", emoji: "📄" },
      { value: "DONOR_REPORTS", label: "Donor reports are a nightmare", hint: "Tracking how each donor's money was spent takes forever", emoji: "📊" },
      { value: "REIMBURSEMENTS", label: "Reimbursements are messy", hint: "Staff pay out of pocket, no clean way to track & repay", emoji: "💸" },
      { value: "APPROVALS_WHATSAPP", label: "Approvals live in WhatsApp", hint: "Sign-offs scattered across chats and email", emoji: "💬" },
    ],
  },
  {
    key: "cause",
    eyebrow: "A bit about your work",
    title: "What does your organisation do?",
    subtitle: "So we can tailor things to your work.",
    options: [
      { value: "EDUCATION", label: "Education & youth", emoji: "🎓" },
      { value: "FOOD_RELIEF", label: "Food security & relief", emoji: "🥘" },
      { value: "HEALTH", label: "Health & wellbeing", emoji: "❤️" },
      { value: "COMMUNITY", label: "Community development", emoji: "🏘️" },
      { value: "ENVIRONMENT", label: "Environment & conservation", emoji: "🌍" },
      { value: "OTHER", label: "Something else", emoji: "➕" },
    ],
  },
  {
    key: "team_size",
    eyebrow: "To set up your workspace",
    title: "How big is your team?",
    subtitle: "This sets up roles and approvals the right way for you.",
    options: [
      { value: "SOLO", label: "Just me for now", hint: "You'll run everything — add people anytime", emoji: "🧍" },
      { value: "2_5", label: "2–5 people", hint: "A small team sharing the work", emoji: "👥" },
      { value: "6_20", label: "6–20 people", hint: "Departments and approval chains", emoji: "🏢" },
      { value: "20_PLUS", label: "20+ people", hint: "Multiple departments & projects", emoji: "🏛️" },
    ],
  },
  {
    key: "heard_about",
    eyebrow: "Last one",
    title: "How did you hear about Ovasyt?",
    subtitle: "Helps us reach more NPOs like yours.",
    options: [
      { value: "ACCOUNTANT", label: "An accountant or partner", emoji: "🤝" },
      { value: "SOCIAL", label: "Social media", emoji: "📱" },
      { value: "FUNDER", label: "A funder or NPO network", emoji: "🏦" },
      { value: "WORD_OF_MOUTH", label: "Word of mouth", emoji: "💡" },
      { value: "SEARCH", label: "Google / search", emoji: "🔎" },
    ],
  },
];

// Formats raw input into the SA registration number mask YYYY/NNNNNN/NN
const formatRegistrationNumber = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 12);
  const parts: string[] = [];
  parts.push(digits.slice(0, 4));
  if (digits.length > 4) parts.push(digits.slice(4, 10));
  if (digits.length > 10) parts.push(digits.slice(10, 12));
  return parts.join("/");
};

// Keeps only digits, max 10 (Tax numbers)
const formatTaxDigits = (value: string): string =>
  value.replace(/\D/g, "").slice(0, 10);

interface CompanyForm {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  registrationNumber: string;
  taxNumber: string;
  companyType: "" | "PTY_LTD" | "PLC" | "NPO";
}

const EMPTY_COMPANY: CompanyForm = {
  companyName: "",
  companyAddress: "",
  companyPhone: "",
  registrationNumber: "",
  taxNumber: "",
  companyType: "",
};

export default function Onboarding() {
  const { user, profile, isLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(true);

  // Company setup (first step for brand-new signups that have no organisation yet)
  const [orgId, setOrgId] = useState<string | null>(null);
  const [companyDone, setCompanyDone] = useState(false);
  const [company, setCompany] = useState<CompanyForm>(EMPTY_COMPANY);
  const [companySaving, setCompanySaving] = useState(false);

  const effectiveOrgId = orgId || profile?.organization_id || null;
  // Show the company step whenever the user has no organisation yet. Once the
  // profile refreshes with the new org id, this flips off automatically.
  const needsCompany = !companyDone && !effectiveOrgId;
  const totalSteps = STEPS.length + 1; // company step always counted in the bar

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (!profile?.organization_id) {
      // Brand-new signup: start at the company details step.
      setChecking(false);
      return;
    }
    getOnboarding(profile.organization_id).then((rec) => {
      if (rec?.completed_at) {
        navigate("/admin/portal", { replace: true });
        return;
      }
      if (rec) {
        setAnswers({
          ...(rec.pain_point ? { pain_point: rec.pain_point } : {}),
          ...(rec.cause ? { cause: rec.cause } : {}),
          ...(rec.team_size ? { team_size: rec.team_size } : {}),
          ...(rec.heard_about ? { heard_about: rec.heard_about } : {}),
        });
      }
      setCompanyDone(true);
      setChecking(false);
    });
  }, [isLoading, user, profile?.organization_id, navigate]);

  if (isLoading || checking) return <LoadingScreen />;

  const isDone = !needsCompany && step >= STEPS.length;
  const current = STEPS[Math.min(step, STEPS.length - 1)];
  const progressIndex = needsCompany ? 0 : step + 1;

  const submitCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const reg = (user.user_metadata as Record<string, any> | undefined)?.company_registration;
    const name = reg?.name || "";
    const surname = reg?.surname || "";

    if (company.companyName.trim().length < 2) {
      toast.error("Please enter your company name");
      return;
    }
    if (company.companyAddress.trim().length < 5) {
      toast.error("Please enter your company address");
      return;
    }
    if (!company.companyType) {
      toast.error("Please select your company type");
      return;
    }
    if (company.registrationNumber.trim().length < 2) {
      toast.error("Please enter your registration number");
      return;
    }
    if (company.taxNumber.trim().length < 2) {
      toast.error("Please enter your tax number");
      return;
    }

    setCompanySaving(true);
    const { data, error } = await supabase.rpc("complete_company_registration", {
      _user_id: user.id,
      _email: (user.email || "").toLowerCase(),
      _name: name,
      _surname: surname,
      _phone: company.companyPhone.trim(),
      _organization_id: reg?.organization_id || crypto.randomUUID(),
      _company_name: company.companyName.trim(),
      _company_address: company.companyAddress.trim(),
      _registration_number: company.registrationNumber.trim(),
      _tax_number: company.taxNumber.trim(),
      _company_type: company.companyType,
      _vat_registered: false,
      _vat_number: null,
      _vat_cycle: null,
      _next_vat_submission_date: null,
    });
    setCompanySaving(false);

    if (error) {
      toast.error(error.message || "Company setup could not be completed.");
      return;
    }

    const newOrgId =
      (data as { organization_id?: string } | null)?.organization_id ||
      reg?.organization_id ||
      null;
    if (newOrgId) setOrgId(newOrgId);
    await refreshProfile();
    setCompanyDone(true);
    toast.success("Your organisation is ready!");
  };

  const persist = async (complete: boolean, next: Record<string, string>) => {
    if (!effectiveOrgId || !user) return;
    setSaving(true);
    const res = await saveOnboarding(effectiveOrgId, user.id, next, complete);
    setSaving(false);
    if (!res.success) toast.error(res.error || "Could not save your answers");
  };

  const choose = async (value: string) => {
    const next = { ...answers, [current.key]: value };
    setAnswers(next);
    const last = step === STEPS.length - 1;
    await persist(last, next);
    setStep(step + 1);
  };

  const skip = async () => {
    const last = step === STEPS.length - 1;
    if (last) await persist(true, answers);
    setStep(step + 1);
  };

  const finish = () => {
    navigate("/admin/portal?firstrun=1", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-indigo-50/60 flex flex-col items-center px-4 py-10">
      <PageSeo
        title="Set up your Ovasyt workspace"
        description="Answer four quick questions so Ovasyt can tailor your NPO finance workspace."
        path="/onboarding"
      />
      <Logo size="md" />

      <div className="w-full max-w-xl mt-8 rounded-2xl bg-white shadow-xl shadow-indigo-900/5 border border-slate-200/70 p-6 sm:p-8">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-6" aria-hidden>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i <= Math.min(progressIndex, totalSteps - 1) ? "bg-primary" : "bg-slate-200",
              )}
            />
          ))}
        </div>

        {needsCompany ? (
          <>
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                <Building2 className="h-7 w-7 text-primary" />
              </div>
            </div>
            <p className="text-[11px] font-semibold tracking-widest uppercase text-primary text-center">
              Let's set up your organisation
            </p>
            <h1 className="text-2xl font-bold mt-2 text-center">Your company details</h1>
            <p className="text-muted-foreground text-sm mt-1 text-center">
              These keep your documents and reports audit-ready. VAT settings can be added later in Settings.
            </p>

            <form onSubmit={submitCompany} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ob-companyName">Company Name *</Label>
                <Input
                  id="ob-companyName"
                  placeholder="Acme Corporation"
                  autoComplete="organization"
                  value={company.companyName}
                  onChange={(e) => setCompany({ ...company, companyName: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ob-companyAddress">Company Address *</Label>
                <Input
                  id="ob-companyAddress"
                  placeholder="123 Business Street, City"
                  autoComplete="street-address"
                  value={company.companyAddress}
                  onChange={(e) => setCompany({ ...company, companyAddress: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ob-companyPhone">Company Phone (Optional)</Label>
                <Input
                  id="ob-companyPhone"
                  placeholder="+27 12 345 6789"
                  autoComplete="tel"
                  value={company.companyPhone}
                  onChange={(e) => setCompany({ ...company, companyPhone: e.target.value })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ob-registrationNumber">Registration Number *</Label>
                  <Input
                    id="ob-registrationNumber"
                    inputMode="numeric"
                    placeholder="2023/123456/07"
                    maxLength={14}
                    value={company.registrationNumber}
                    onChange={(e) =>
                      setCompany({ ...company, registrationNumber: formatRegistrationNumber(e.target.value) })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ob-taxNumber">Tax Number *</Label>
                  <Input
                    id="ob-taxNumber"
                    inputMode="numeric"
                    placeholder="9876543210"
                    maxLength={10}
                    value={company.taxNumber}
                    onChange={(e) =>
                      setCompany({ ...company, taxNumber: formatTaxDigits(e.target.value) })
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Company Type *</Label>
                <Select
                  value={company.companyType}
                  onValueChange={(v) => setCompany({ ...company, companyType: v as CompanyForm["companyType"] })}
                >
                  <SelectTrigger id="ob-companyType">
                    <SelectValue placeholder="Select company type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NPO">NPO</SelectItem>
                    <SelectItem value="PTY_LTD">PTY LTD</SelectItem>
                    <SelectItem value="PLC">PLC</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={companySaving}>
                {companySaving ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Setting up...
                  </span>
                ) : (
                  "Continue →"
                )}
              </Button>
            </form>

            <p className="text-xs text-muted-foreground text-center mt-4">
              Step 1 of {totalSteps}
            </p>
          </>
        ) : isDone ? (
          <div className="text-center py-8">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <PartyPopper className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mt-6">You're all set.</h1>
            <p className="text-muted-foreground mt-2">
              You're already ahead of most NPOs in South Africa. Ovi, your Ovasyt guide,
              will help you capture your first expense.
            </p>
            <Button className="w-full mt-8" size="lg" onClick={finish}>
              Capture my first expense →
            </Button>
            <p className="text-xs text-muted-foreground mt-3">Takes under a minute</p>
          </div>
        ) : (
          <>
            <p className="text-[11px] font-semibold tracking-widest uppercase text-primary">
              {current.eyebrow}
            </p>
            <h1 className="text-2xl font-bold mt-2">{current.title}</h1>
            <p className="text-muted-foreground text-sm mt-1">{current.subtitle}</p>

            <div className="mt-6 space-y-3">
              {current.options.map((opt) => {
                const selected = answers[current.key] === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={saving}
                    onClick={() => choose(opt.value)}
                    className={cn(
                      "w-full text-left rounded-xl border p-4 flex items-start gap-3 transition-all hover:border-primary/60 hover:shadow-sm disabled:opacity-60",
                      selected ? "border-primary bg-primary/5" : "border-slate-200 bg-white",
                    )}
                  >
                    <span className="text-lg leading-none mt-0.5">{opt.emoji}</span>
                    <span>
                      <span className="block font-semibold text-sm">{opt.label}</span>
                      {opt.hint && (
                        <span className="block text-xs text-muted-foreground mt-0.5">
                          {opt.hint}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-8">
              <button
                type="button"
                onClick={skip}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Skip
              </button>
              <span className="text-xs text-muted-foreground">
                Step {step + 2} of {totalSteps}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

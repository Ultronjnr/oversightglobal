import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PageSeo } from "@/components/site/PageSeo";
import { getOnboarding, saveOnboarding } from "@/services/onboarding.service";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PartyPopper } from "lucide-react";

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

export default function Onboarding() {
  const { user, profile, isLoading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (!profile?.organization_id) {
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
      setChecking(false);
    });
  }, [isLoading, user, profile?.organization_id, navigate]);

  if (isLoading || checking) return <LoadingScreen />;

  const isDone = step >= STEPS.length;
  const current = STEPS[Math.min(step, STEPS.length - 1)];

  const persist = async (complete: boolean, next: Record<string, string>) => {
    if (!profile?.organization_id || !user) return;
    setSaving(true);
    const res = await saveOnboarding(profile.organization_id, user.id, next, complete);
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
          {STEPS.map((s, i) => (
            <span
              key={s.key}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i <= Math.min(step, STEPS.length - 1) ? "bg-primary" : "bg-slate-200",
              )}
            />
          ))}
        </div>

        {isDone ? (
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
                Step {step + 1} of {STEPS.length}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

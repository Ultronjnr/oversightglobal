import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { UserRound, Eye, EyeOff, CheckCircle2, Loader2, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage, logError } from "@/lib/error-handler";
import { PageSeo } from "@/components/site/PageSeo";

const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(100, "Name is too long"),
    surname: z.string().trim().min(2, "Surname is required").max(100, "Surname is too long"),
    email: z.string().trim().toLowerCase().email("Invalid email address").max(255, "Email is too long"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password is too long")
      .regex(/[A-Z]/, "Password must include an uppercase letter")
      .regex(/[a-z]/, "Password must include a lowercase letter")
      .regex(/[0-9]/, "Password must include a number")
      .regex(/[^A-Za-z0-9]/, "Password must include a special character"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupCompany() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitted },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  });

  const errCls = (field: keyof SignupForm) =>
    errors[field] ? "border-destructive focus-visible:ring-destructive" : "";

  const onInvalid = (formErrors: typeof errors) => {
    const order: (keyof SignupForm)[] = ["name", "surname", "email", "password", "confirmPassword"];
    const first = order.find((k) => formErrors[k]);
    if (!first) return;
    const el =
      document.getElementById(first) ||
      (document.querySelector(`[name="${first}"]`) as HTMLElement | null);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => (el as HTMLElement).focus?.(), 400);
    }
  };

  const password = watch("password") || "";

  const passwordChecks = [
    { label: "8+ characters", valid: password.length >= 8 },
    { label: "Uppercase", valid: /[A-Z]/.test(password) },
    { label: "Lowercase", valid: /[a-z]/.test(password) },
    { label: "Number", valid: /[0-9]/.test(password) },
    { label: "Special character", valid: /[^A-Za-z0-9]/.test(password) },
  ];

  const onSubmit = async (data: SignupForm) => {
    setIsLoading(true);
    setIsSuccess(false);

    try {
      const normalizedEmail = data.email.trim().toLowerCase();
      const organizationId = crypto.randomUUID();

      // Personal details are stored in the user's auth metadata. Company
      // details are captured during onboarding after email verification, where
      // complete_company_registration runs with an authenticated session.
      const company_registration = {
        organization_id: organizationId,
        name: data.name.trim(),
        surname: data.surname.trim(),
      };

      const { error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: { company_registration },
        },
      });

      if (authError) {
        const alreadyRegistered =
          /already.*registered|already.*exists|user.*exists/i.test(authError.message || "");
        if (alreadyRegistered) {
          toast.error("This email is already registered. Please log in instead.");
        } else {
          toast.error(getSafeErrorMessage(authError));
        }
        setIsLoading(false);
        return;
      }

      // Signup succeeded — email verification required before login.
      setPendingEmail(normalizedEmail);
      setIsSuccess(true);
      toast.success("Verification email sent!");
    } catch (error: unknown) {
      logError("signup", error);
      if (import.meta.env.DEV) {
        console.log("AUTH ERROR:", error);
      }
      toast.error(getSafeErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!pendingEmail) return;
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingEmail,
        options: { emailRedirectTo: `${window.location.origin}/login` },
      });
      if (error) {
        toast.error(getSafeErrorMessage(error));
      } else {
        toast.success("Verification email resent");
      }
    } finally {
      setIsResending(false);
    }
  };

  if (isSuccess && pendingEmail) {
    return (
      <div className="min-h-screen hero-gradient flex items-center justify-center p-4 py-12">
        <div className="auth-card animate-slide-up max-w-md text-center">
          <div className="flex justify-center mb-5">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
              <MailCheck className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Almost there!</h1>
          <p className="text-muted-foreground text-sm mt-3">
            We've sent a verification email to{" "}
            <span className="font-semibold text-foreground">{pendingEmail}</span>.
            Please check your inbox and click the link to activate your account.
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            The email comes from <strong>noreply@ovasyt.tech</strong> — if you don't
            see it within a couple of minutes, check your spam folder.
          </p>
          <div className="mt-6 space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleResend}
              disabled={isResending}
            >
              {isResending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Resending...
                </span>
              ) : (
                "Resend verification email"
              )}
            </Button>
            <Button
              type="button"
              variant="gradient"
              size="lg"
              className="w-full"
              onClick={() => navigate("/login")}
            >
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen hero-gradient flex items-center justify-center p-4 py-12">
      <PageSeo
        title="Create your Ovasyt account"
        description="Start your 14-day Ovasyt trial. Create your account to run procurement approvals, donor tracking and audit-ready compliance from day one."
        path="/signup/company"
      />
      <div className="auth-card animate-slide-up max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
              <UserRound className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Create Your Account</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Verify your email, then we'll set up your organisation together
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4" noValidate>
          <fieldset disabled={isLoading || isSuccess} className="space-y-4 disabled:opacity-70">
          {isSubmitted && Object.keys(errors).length > 0 && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
            >
              Please fix the errors below to continue
            </div>
          )}
          {/* Personal */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">First Name *</Label>
              <Input id="name" placeholder="John" autoComplete="given-name" className={errCls("name")} {...register("name")} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="surname">Surname *</Label>
              <Input id="surname" placeholder="Doe" autoComplete="family-name" className={errCls("surname")} {...register("surname")} />
              {errors.surname && <p className="text-sm text-destructive">{errors.surname.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input id="email" type="email" placeholder="john@company.com" autoComplete="email" className={errCls("email")} {...register("email")} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Password *</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="new-password"
                aria-describedby="password-strength"
                className={errCls("password")}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div id="password-strength" className="grid grid-cols-2 gap-1 text-xs text-muted-foreground sm:grid-cols-5">
              {passwordChecks.map((check) => (
                <span key={check.label} className={cn("flex items-center gap-1", check.valid && "text-success")}>
                  <CheckCircle2 className="h-3 w-3" />
                  {check.label}
                </span>
              ))}
            </div>
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password *</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="new-password"
                className={errCls("confirmPassword")}
                {...register("confirmPassword")}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Note:</strong> You will become the Super User of
              your organisation. After verifying your email, a short setup captures your company
              details and tailors your workspace.
            </p>
          </div>

          <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={isLoading || isSuccess}>
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating Account...
              </span>
            ) : isSuccess ? (
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Success!
              </span>
            ) : (
              "Create Account →"
            )}
          </Button>
          </fieldset>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline font-medium">
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}

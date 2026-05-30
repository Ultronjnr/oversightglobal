import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, Eye, EyeOff, CalendarIcon, CheckCircle2, Loader2 } from "lucide-react";
import { format } from "date-fns";

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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage, logError } from "@/lib/error-handler";

// Formats raw input into the SA registration number mask YYYY/NNNNNN/NN
const formatRegistrationNumber = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 12);
  const parts: string[] = [];
  parts.push(digits.slice(0, 4));
  if (digits.length > 4) parts.push(digits.slice(4, 10));
  if (digits.length > 10) parts.push(digits.slice(10, 12));
  return parts.join("/");
};

// Keeps only digits, max 9 (VAT / Tax numbers)
const formatNineDigits = (value: string): string =>
  value.replace(/\D/g, "").slice(0, 9);

const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(100, "Name is too long"),
    surname: z.string().trim().min(2, "Surname is required").max(100, "Surname is too long"),
    email: z.string().trim().toLowerCase().email("Invalid email address").max(255, "Email is too long"),
    companyName: z.string().trim().min(2, "Company name is required").max(160, "Company name is too long"),
    companyAddress: z.string().trim().min(5, "Company address is required").max(500, "Company address is too long"),
    companyPhone: z.string().trim().max(40, "Phone number is too long").optional(),
    registrationNumber: z
      .string()
      .trim()
      .min(1, "Registration number is required")
      .regex(/^\d{4}\/\d{6}\/\d{2}$/, "Registration number format: 2023/123456/07"),
    taxNumber: z
      .string()
      .trim()
      .min(1, "Tax number is required")
      .regex(/^\d{9}$/, "Tax number must be exactly 9 digits"),
    companyType: z.enum(["PTY_LTD", "PLC", "NPO"], {
      required_error: "Company type is required",
    }),
    vatRegistered: z.boolean().default(false),
    vatNumber: z.string().trim().optional(),
    vatCycle: z.enum(["MONTHLY", "BI_MONTHLY"]).optional(),
    nextVatSubmissionDate: z.date().optional(),
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
  })
  .refine(
    (data) =>
      !data.vatRegistered ||
      (!!data.vatNumber && /^\d{9}$/.test(data.vatNumber.trim())),
    { message: "VAT number must be exactly 9 digits", path: ["vatNumber"] }
  )
  .refine((data) => !data.vatRegistered || !!data.vatCycle, {
    message: "VAT cycle is required",
    path: ["vatCycle"],
  })
  .refine((data) => !data.vatRegistered || !!data.nextVatSubmissionDate, {
    message: "Next VAT submission date is required",
    path: ["nextVatSubmissionDate"],
  });

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupCompany() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitted },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { vatRegistered: false },
  });

  const errCls = (field: keyof SignupForm) =>
    errors[field] ? "border-destructive focus-visible:ring-destructive" : "";

  const onInvalid = (formErrors: typeof errors) => {
    const order: (keyof SignupForm)[] = [
      "name",
      "surname",
      "email",
      "companyName",
      "companyAddress",
      "companyPhone",
      "registrationNumber",
      "taxNumber",
      "companyType",
      "vatNumber",
      "vatCycle",
      "nextVatSubmissionDate",
      "password",
      "confirmPassword",
    ];
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

  const vatRegistered = watch("vatRegistered");
  const companyType = watch("companyType");
  const vatCycle = watch("vatCycle");
  const nextVatDate = watch("nextVatSubmissionDate");
  const registrationNumber = watch("registrationNumber") || "";
  const taxNumber = watch("taxNumber") || "";
  const vatNumber = watch("vatNumber") || "";
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

      // Company registration data is stored in the user's auth metadata and
      // applied on the first verified login (the DB function requires an
      // authenticated session, which only exists after email verification).
      const company_registration = {
        organization_id: organizationId,
        name: data.name.trim(),
        surname: data.surname.trim(),
        phone: data.companyPhone?.trim() || "",
        company_name: data.companyName.trim(),
        company_address: data.companyAddress.trim(),
        registration_number: data.registrationNumber.trim(),
        tax_number: data.taxNumber.trim(),
        company_type: data.companyType,
        vat_registered: data.vatRegistered,
        vat_number: data.vatRegistered ? data.vatNumber?.trim() || null : null,
        vat_cycle: data.vatRegistered ? data.vatCycle || null : null,
        next_vat_submission_date:
          data.vatRegistered && data.nextVatSubmissionDate
            ? format(data.nextVatSubmissionDate, "yyyy-MM-dd")
            : null,
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
      <div className="auth-card animate-slide-up max-w-lg">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Register Your Company</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create your company and become the administrator
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
            <Label htmlFor="email">Company Email *</Label>
            <Input id="email" type="email" placeholder="john@company.com" autoComplete="email" className={errCls("email")} {...register("email")} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          {/* Company */}
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name *</Label>
            <Input id="companyName" placeholder="Acme Corporation" autoComplete="organization" className={errCls("companyName")} {...register("companyName")} />
            {errors.companyName && <p className="text-sm text-destructive">{errors.companyName.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyAddress">Company Address *</Label>
            <Input id="companyAddress" placeholder="123 Business Street, City" autoComplete="street-address" className={errCls("companyAddress")} {...register("companyAddress")} />
            {errors.companyAddress && <p className="text-sm text-destructive">{errors.companyAddress.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyPhone">Company Phone (Optional)</Label>
            <Input id="companyPhone" placeholder="+27 12 345 6789" autoComplete="tel" {...register("companyPhone")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="registrationNumber">Registration Number *</Label>
              <Input
                id="registrationNumber"
                inputMode="numeric"
                placeholder="2023/123456/07"
                maxLength={14}
                value={registrationNumber}
                className={errCls("registrationNumber")}
                onChange={(e) =>
                  setValue("registrationNumber", formatRegistrationNumber(e.target.value), {
                    shouldValidate: true,
                  })
                }
              />
              {errors.registrationNumber && (
                <p className="text-sm text-destructive">{errors.registrationNumber.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxNumber">Tax Number *</Label>
              <Input
                id="taxNumber"
                inputMode="numeric"
                placeholder="987654321"
                maxLength={9}
                value={taxNumber}
                className={errCls("taxNumber")}
                onChange={(e) =>
                  setValue("taxNumber", formatNineDigits(e.target.value), {
                    shouldValidate: true,
                  })
                }
              />
              {errors.taxNumber && <p className="text-sm text-destructive">{errors.taxNumber.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Company Type *</Label>
            <Select
              value={companyType}
              onValueChange={(v) => setValue("companyType", v as SignupForm["companyType"], { shouldValidate: true })}
            >
              <SelectTrigger id="companyType" className={errCls("companyType")}>
                <SelectValue placeholder="Select company type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PTY_LTD">PTY LTD</SelectItem>
                <SelectItem value="PLC">PLC</SelectItem>
                <SelectItem value="NPO">NPO</SelectItem>
              </SelectContent>
            </Select>
            {errors.companyType && <p className="text-sm text-destructive">{errors.companyType.message}</p>}
          </div>

          {/* VAT */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="vatRegistered" className="cursor-pointer">VAT Registered</Label>
              <p className="text-xs text-muted-foreground mt-1">Toggle if your company is VAT registered</p>
            </div>
            <Switch
              id="vatRegistered"
              checked={vatRegistered}
              onCheckedChange={(checked) => setValue("vatRegistered", checked, { shouldValidate: true })}
            />
          </div>

          {vatRegistered && (
            <div className="space-y-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="space-y-2">
                <Label htmlFor="vatNumber">VAT Number *</Label>
                <Input
                  id="vatNumber"
                  inputMode="numeric"
                  placeholder="412345678"
                  maxLength={9}
                  value={vatNumber}
                  className={errCls("vatNumber")}
                  onChange={(e) =>
                    setValue("vatNumber", formatNineDigits(e.target.value), {
                      shouldValidate: true,
                    })
                  }
                />
                {errors.vatNumber && <p className="text-sm text-destructive">{errors.vatNumber.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>VAT Cycle *</Label>
                <Select
                  value={vatCycle}
                  onValueChange={(v) => setValue("vatCycle", v as "MONTHLY" | "BI_MONTHLY", { shouldValidate: true })}
                >
                  <SelectTrigger id="vatCycle" className={errCls("vatCycle")}>
                    <SelectValue placeholder="Select VAT cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="BI_MONTHLY">Bi-Monthly</SelectItem>
                  </SelectContent>
                </Select>
                {errors.vatCycle && <p className="text-sm text-destructive">{errors.vatCycle.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Next VAT Submission Date *</Label>
                {isMobile ? (
                  <Input
                    type="date"
                    value={nextVatDate ? format(nextVatDate, "yyyy-MM-dd") : ""}
                    onChange={(e) =>
                      setValue(
                        "nextVatSubmissionDate",
                        e.target.value ? new Date(e.target.value) : undefined,
                        { shouldValidate: true }
                      )
                    }
                  />
                ) : (
                  <Popover open={dateOpen} onOpenChange={setDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !nextVatDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {nextVatDate ? format(nextVatDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0"
                      align="start"
                      side="top"
                      sideOffset={4}
                    >
                      <Calendar
                        mode="single"
                        selected={nextVatDate}
                        onSelect={(d) => {
                          setValue("nextVatSubmissionDate", d, { shouldValidate: true });
                          setDateOpen(false);
                        }}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                )}
                {errors.nextVatSubmissionDate && (
                  <p className="text-sm text-destructive">{errors.nextVatSubmissionDate.message}</p>
                )}
              </div>
            </div>
          )}

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
              <strong className="text-foreground">Note:</strong> You will be registered as the Administrator for this
              company and taken straight to the Admin portal.
            </p>
          </div>

          <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={isLoading || isSuccess}>
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating Company...
              </span>
            ) : isSuccess ? (
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Success! Opening Admin Portal...
              </span>
            ) : (
              "Register Company →"
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

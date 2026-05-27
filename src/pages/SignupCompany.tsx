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
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage, logError } from "@/lib/error-handler";

const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(100, "Name is too long"),
    surname: z.string().trim().min(2, "Surname is required").max(100, "Surname is too long"),
    email: z.string().trim().toLowerCase().email("Invalid email address").max(255, "Email is too long"),
    companyName: z.string().trim().min(2, "Company name is required").max(160, "Company name is too long"),
    companyAddress: z.string().trim().min(5, "Company address is required").max(500, "Company address is too long"),
    companyPhone: z.string().trim().max(40, "Phone number is too long").optional(),
    registrationNumber: z.string().trim().min(2, "Registration number is required").max(80, "Registration number is too long"),
    taxNumber: z.string().trim().min(2, "Tax number is required").max(80, "Tax number is too long"),
    companyType: z.enum(["PTY_LTD", "PLC", "NPO"], {
      required_error: "Company type is required",
    }),
    vatRegistered: z.boolean().default(false),
    vatNumber: z.string().trim().max(40, "VAT number is too long").optional(),
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
      (data.vatNumber && data.vatNumber.trim().length > 0),
    { message: "VAT number is required", path: ["vatNumber"] }
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { vatRegistered: false },
  });

  const vatRegistered = watch("vatRegistered");
  const companyType = watch("companyType");
  const vatCycle = watch("vatCycle");
  const nextVatDate = watch("nextVatSubmissionDate");
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

      if (import.meta.env.DEV) {
        console.log("FORM DATA:", data);
      }

      // STEP 1: Sign up user
      let { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: data.password,
        options: { emailRedirectTo: window.location.origin },
      });

      if (import.meta.env.DEV) {
        console.log("AUTH ERROR:", authError);
      }

      // Recovery: if a prior signup attempt created the auth user but failed
      // before saving the profile/org, try to sign in with the supplied password
      // and continue the onboarding flow from where it stopped.
      const alreadyRegistered =
        authError &&
        /already.*registered|already.*exists|user.*exists/i.test(authError.message || "");

      if (alreadyRegistered) {
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password: data.password,
          });

        if (signInError || !signInData.user) {
          toast.error(
            "This email is already registered. Please log in or use a different email."
          );
          setIsLoading(false);
          return;
        }

        // Check whether onboarding already completed
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id, organization_id")
          .eq("id", signInData.user.id)
          .maybeSingle();

        if (existingProfile?.organization_id) {
          // Verify the referenced organization still exists.
          const { data: orgStillThere } = await supabase
            .from("organizations")
            .select("id")
            .eq("id", existingProfile.organization_id)
            .maybeSingle();

          if (orgStillThere) {
            toast.success("Welcome back!");
            navigate("/admin/portal");
            return;
          }

          // Stale reference from a failed previous attempt — clear it so
          // the organizations INSERT RLS policy allows a fresh org.
          await supabase
            .from("profiles")
            .update({ organization_id: null })
            .eq("id", signInData.user.id);
        }

        // Continue onboarding with the existing auth user
        authData = { user: signInData.user, session: signInData.session } as typeof authData;
        authError = null;
      } else if (authError) {
        toast.error(getSafeErrorMessage(authError));
        setIsLoading(false);
        return;
      }
      if (!authData.user) {
        toast.error("Failed to create user account");
        setIsLoading(false);
        return;
      }
      const payload = {
        _user_id: authData.user.id,
        _email: normalizedEmail,
        _name: data.name.trim(),
        _surname: data.surname.trim(),
        _phone: data.companyPhone?.trim() || "",
        _organization_id: organizationId,
        _company_name: data.companyName.trim(),
        _company_address: data.companyAddress.trim(),
        _registration_number: data.registrationNumber.trim(),
        _tax_number: data.taxNumber.trim(),
        _company_type: data.companyType,
        _vat_registered: data.vatRegistered,
        _vat_number: data.vatRegistered ? data.vatNumber?.trim() || null : null,
        _vat_cycle: data.vatRegistered ? data.vatCycle || null : null,
        _next_vat_submission_date:
          data.vatRegistered && data.nextVatSubmissionDate
            ? format(data.nextVatSubmissionDate, "yyyy-MM-dd")
            : null,
      };

      if (import.meta.env.DEV) {
        console.log("API PAYLOAD:", payload);
      }

      const { data: response, error: registrationError } = await supabase.rpc(
        "complete_company_registration",
        payload
      );

      if (import.meta.env.DEV) {
        console.log("SERVER RESPONSE:", response);
        console.log("AUTH ERROR:", registrationError);
      }

      if (registrationError) {
        logError("completeCompanyRegistration", registrationError);
        toast.error(getSafeErrorMessage(registrationError));
        return;
      }

      setIsSuccess(true);
      toast.success("Company registered successfully!");
      setTimeout(() => navigate("/admin/portal"), 500);
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <fieldset disabled={isLoading || isSuccess} className="space-y-4 disabled:opacity-70">
          {/* Personal */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">First Name *</Label>
              <Input id="name" placeholder="John" autoComplete="given-name" {...register("name")} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="surname">Surname *</Label>
              <Input id="surname" placeholder="Doe" autoComplete="family-name" {...register("surname")} />
              {errors.surname && <p className="text-sm text-destructive">{errors.surname.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Company Email *</Label>
            <Input id="email" type="email" placeholder="john@company.com" autoComplete="email" {...register("email")} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          {/* Company */}
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name *</Label>
            <Input id="companyName" placeholder="Acme Corporation" autoComplete="organization" {...register("companyName")} />
            {errors.companyName && <p className="text-sm text-destructive">{errors.companyName.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyAddress">Company Address *</Label>
            <Input id="companyAddress" placeholder="123 Business Street, City" autoComplete="street-address" {...register("companyAddress")} />
            {errors.companyAddress && <p className="text-sm text-destructive">{errors.companyAddress.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyPhone">Company Phone (Optional)</Label>
            <Input id="companyPhone" placeholder="+27 12 345 6789" autoComplete="tel" {...register("companyPhone")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="registrationNumber">Registration Number *</Label>
              <Input id="registrationNumber" placeholder="2023/123456/07" {...register("registrationNumber")} />
              {errors.registrationNumber && (
                <p className="text-sm text-destructive">{errors.registrationNumber.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxNumber">Tax Number *</Label>
              <Input id="taxNumber" placeholder="9876543210" {...register("taxNumber")} />
              {errors.taxNumber && <p className="text-sm text-destructive">{errors.taxNumber.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Company Type *</Label>
            <Select
              value={companyType}
              onValueChange={(v) => setValue("companyType", v as SignupForm["companyType"], { shouldValidate: true })}
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
                <Input id="vatNumber" placeholder="4123456789" {...register("vatNumber")} />
                {errors.vatNumber && <p className="text-sm text-destructive">{errors.vatNumber.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>VAT Cycle *</Label>
                <Select
                  value={vatCycle}
                  onValueChange={(v) => setValue("vatCycle", v as "MONTHLY" | "BI_MONTHLY", { shouldValidate: true })}
                >
                  <SelectTrigger>
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
                <Popover>
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
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={nextVatDate}
                      onSelect={(d) => setValue("nextVatSubmissionDate", d, { shouldValidate: true })}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
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
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password *</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
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
            {isLoading ? "Creating Company..." : "Register Company →"}
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

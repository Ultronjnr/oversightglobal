import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage, logError } from "@/lib/error-handler";

const signupSchema = z
  .object({
    name: z.string().min(2, "Name is required"),
    surname: z.string().min(2, "Surname is required"),
    email: z.string().email("Invalid email address"),
    companyName: z.string().min(2, "Company name is required"),
    companyAddress: z.string().min(5, "Company address is required"),
    companyPhone: z.string().optional(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupCompany() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupForm) => {
    setIsLoading(true);
    let createdOrgId: string | null = null;
    let createdUserId: string | null = null;

    try {
      // STEP 1: Sign up user FIRST (must be authenticated before creating org)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (authError) {
        toast.error(getSafeErrorMessage(authError));
        setIsLoading(false);
        return;
      }

      if (!authData.user) {
        toast.error("Failed to create user account");
        setIsLoading(false);
        return;
      }

      createdUserId = authData.user.id;

      // STEP 2: Create organization (now authenticated)
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: data.companyName,
          company_email: data.email,
          address: data.companyAddress,
        })
        .select("id")
        .single();

      if (orgError) {
        logError("createOrganization", orgError);
        if (orgError.code === "23505") {
          toast.error("A company with this email already exists. Please use a different email.");
        } else {
          toast.error(getSafeErrorMessage(orgError));
        }
        setIsLoading(false);
        return;
      }

      createdOrgId = orgData.id;

      // STEP 3: Create profile and link to organization
      const { error: profileError } = await supabase.from("profiles").insert({
        id: authData.user.id,
        email: data.email,
        name: data.name,
        surname: data.surname,
        organization_id: createdOrgId,
        phone: data.companyPhone || null,
        status: "ACTIVE",
      });

      if (profileError) {
        logError("createProfile", profileError);
        await supabase.from("organizations").delete().eq("id", createdOrgId);
        toast.error(getSafeErrorMessage(profileError));
        setIsLoading(false);
        return;
      }

      // STEP 4: Assign ADMIN role using secure function
      const { data: roleAssigned, error: roleError } = await supabase.rpc(
        "assign_invitation_role",
        { _user_id: authData.user.id, _role: "ADMIN" }
      );

      if (roleError || !roleAssigned) {
        logError("assignRole", roleError);
        await supabase.from("organizations").delete().eq("id", createdOrgId);
        toast.error(getSafeErrorMessage(roleError));
        setIsLoading(false);
        return;
      }

      toast.success("Company registered successfully!");
      navigate("/admin/portal");
    } catch (error: any) {
      logError("signup", error);
      if (createdOrgId) {
        await supabase.from("organizations").delete().eq("id", createdOrgId);
      }
      toast.error(getSafeErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen hero-gradient flex items-center justify-center p-4 py-12">
      <div className="auth-card animate-slide-up max-w-lg">
        {/* Header */}
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

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">First Name *</Label>
              <Input id="name" placeholder="John" {...register("name")} />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="surname">Surname *</Label>
              <Input id="surname" placeholder="Doe" {...register("surname")} />
              {errors.surname && (
                <p className="text-sm text-destructive">{errors.surname.message}</p>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Company Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="john@company.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name *</Label>
            <Input
              id="companyName"
              placeholder="Acme Corporation"
              {...register("companyName")}
            />
            {errors.companyName && (
              <p className="text-sm text-destructive">{errors.companyName.message}</p>
            )}
          </div>

          {/* Company Address */}
          <div className="space-y-2">
            <Label htmlFor="companyAddress">Company Address *</Label>
            <Input
              id="companyAddress"
              placeholder="123 Business Street, City"
              {...register("companyAddress")}
            />
            {errors.companyAddress && (
              <p className="text-sm text-destructive">{errors.companyAddress.message}</p>
            )}
          </div>

          {/* Company Phone */}
          <div className="space-y-2">
            <Label htmlFor="companyPhone">Company Phone (Optional)</Label>
            <Input
              id="companyPhone"
              placeholder="+27 12 345 6789"
              {...register("companyPhone")}
            />
          </div>

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
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          {/* Confirm Password */}
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

          {/* Info box */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Note:</strong> You will be registered as the Administrator for this company. Only one admin is allowed per company.
            </p>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            variant="gradient"
            size="lg"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Creating Company..." : "Register Company →"}
          </Button>
        </form>

        {/* Link to login */}
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

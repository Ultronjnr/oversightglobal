import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Building2,
  User,
  Loader2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/error-handler";

const joinSchema = z
  .object({
    email: z.string().email(),
    companyName: z.string().min(1, "Company name is required").max(200),
    contactPerson: z.string().min(1, "Contact person name is required").max(200),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type JoinForm = z.infer<typeof joinSchema>;

interface InvitationData {
  id: string;
  email: string;
  company_name: string;
  organization_id: string;
}

export default function JoinSupplier() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<JoinForm>({ resolver: zodResolver(joinSchema) });

  useEffect(() => {
    if (!token) {
      setError("No invitation token provided.");
      setLoading(false);
      return;
    }
    validateToken(token);
  }, [token]);

  const validateToken = async (t: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from("supplier_invitations")
        .select("id, email, company_name, organization_id")
        .eq("token", t)
        .eq("status", "PENDING")
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (fetchError) {
        setError("Unable to validate invitation.");
        return;
      }
      if (!data) {
        setError("This invitation is invalid or has expired.");
        return;
      }

      setInvitation(data);
      setValue("email", data.email);
      setValue("companyName", data.company_name);
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (formData: JoinForm) => {
    if (!invitation) return;
    setSubmitting(true);

    try {
      // 1. Sign up
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: { emailRedirectTo: window.location.origin },
      });

      if (authError) {
        toast.error(getSafeErrorMessage(authError));
        return;
      }
      if (!authData.user) {
        toast.error("Failed to create account.");
        return;
      }

      const userId = authData.user.id;

      // 2. Create profile
      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        email: formData.email.toLowerCase(),
        name: formData.companyName,
        organization_id: invitation.organization_id,
      });

      if (profileError) {
        toast.error(getSafeErrorMessage(profileError));
        return;
      }

      // 3. Create supplier record
      const { error: supplierError } = await supabase.from("suppliers").insert({
        user_id: userId,
        company_name: formData.companyName,
        contact_email: formData.email.toLowerCase(),
        contact_person: formData.contactPerson,
        organization_id: invitation.organization_id,
        is_public: false,
        is_verified: true,
      });

      if (supplierError) {
        toast.error(getSafeErrorMessage(supplierError));
        return;
      }

      // 4. Assign SUPPLIER role
      const { error: roleError } = await supabase.rpc("assign_invitation_role", {
        _user_id: userId,
        _role: "SUPPLIER",
      });

      if (roleError) {
        toast.error(getSafeErrorMessage(roleError));
        return;
      }

      // 5. Mark invitation as accepted
      const { error: updateError } = await supabase
        .from("supplier_invitations")
        .update({ status: "ACCEPTED" })
        .eq("id", invitation.id);

      if (updateError) {
        console.error("Failed to update invitation status", updateError);
      }

      toast.success("Account created! Please check your email to confirm, then log in.");
      navigate("/login");
    } catch (err: any) {
      toast.error(getSafeErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen hero-gradient flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen hero-gradient flex items-center justify-center p-4">
        <div className="auth-card animate-slide-up text-center">
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>
          <div className="flex items-center justify-center gap-2 text-destructive mb-4">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Invalid Invitation</span>
          </div>
          <p className="text-muted-foreground text-sm mb-6">{error}</p>
          <Button variant="outline" onClick={() => navigate("/login")}>
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen hero-gradient flex items-center justify-center p-4">
      <div className="auth-card animate-slide-up">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-1">
            Supplier Registration
          </h1>
          <p className="text-sm text-muted-foreground">
            You've been invited to join as a supplier. Complete your details below.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                className="pl-10 bg-muted/50"
                readOnly
                {...register("email")}
              />
            </div>
          </div>

          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="companyName"
                placeholder="Your company name"
                className="pl-10"
                {...register("companyName")}
              />
            </div>
            {errors.companyName && (
              <p className="text-sm text-destructive">{errors.companyName.message}</p>
            )}
          </div>

          {/* Contact Person */}
          <div className="space-y-2">
            <Label htmlFor="contactPerson">Contact Person Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="contactPerson"
                placeholder="Full name"
                className="pl-10"
                {...register("contactPerson")}
              />
            </div>
            {errors.contactPerson && (
              <p className="text-sm text-destructive">{errors.contactPerson.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min 8 characters"
                className="pl-10 pr-10"
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
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                placeholder="Repeat password"
                className="pl-10 pr-10"
                {...register("confirmPassword")}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button
            type="submit"
            variant="gradient"
            size="lg"
            className="w-full"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Account...
              </>
            ) : (
              "Create Supplier Account"
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <a href="/login" className="text-primary hover:underline font-medium">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

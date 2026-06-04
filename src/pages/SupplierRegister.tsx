import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
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
  Clock,
  Phone,
  MapPin,
  Briefcase,
  Hash,
  Receipt,
} from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/error-handler";

interface InvitationData {
  id: string;
  email: string;
  company_name: string;
  contact_person: string | null;
  industry: string | null;
  registration_number: string | null;
  vat_number: string | null;
  organization_id: string;
}

export default function SupplierRegister() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [industry, setIndustry] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const INDUSTRY_OPTIONS = [
    "Construction & Building Materials",
    "IT & Technology",
    "Office Supplies & Stationery",
    "Cleaning & Sanitation",
    "Electrical & Electronics",
    "Plumbing & Water Systems",
    "Catering & Food Services",
    "Transport & Logistics",
    "Security Services",
    "Furniture & Fittings",
    "Printing & Signage",
    "Consulting & Professional Services",
    "Medical & Healthcare Supplies",
    "Agriculture & Farming",
    "Other",
  ];

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
      const { data, error: fetchError } = await supabase.rpc(
        "validate_supplier_invitation",
        { _token: t }
      );

      if (fetchError) {
        setError("Unable to validate invitation.");
        return;
      }

      const result = data as unknown as {
        valid: boolean;
        error?: string;
        reason?: string;
        id?: string;
        email?: string;
        company_name?: string;
        contact_person?: string;
        industry?: string;
        registration_number?: string;
        vat_number?: string;
        organization_id?: string;
      };

      if (!result?.valid) {
        setError(result?.error || "This invitation is invalid or has expired.");
        setErrorReason(result?.reason || null);
        return;
      }

      setInvitation({
        id: result.id!,
        email: result.email!,
        company_name: result.company_name!,
        contact_person: result.contact_person ?? null,
        industry: result.industry ?? null,
        registration_number: result.registration_number ?? null,
        vat_number: result.vat_number ?? null,
        organization_id: result.organization_id!,
      });
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation || !token) return;

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      // All account creation happens server-side (service role) to avoid
      // RLS/session issues during signup.
      const { data, error: fnError } = await supabase.functions.invoke(
        "register-supplier",
        {
          body: {
            token,
            password,
            industry: industry || null,
            registrationNumber: registrationNumber.trim() || null,
            vatNumber: vatNumber.trim() || null,
            phone: phone.trim() || null,
            address: address.trim() || null,
          },
        }
      );

      if (fnError) {
        toast.error(getSafeErrorMessage(fnError));
        return;
      }

      const result = data as { success: boolean; error?: string };
      if (!result?.success) {
        toast.error(result?.error || "Registration failed. Please try again.");
        return;
      }

      toast.success("Registration completed! You can now log in.");
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
    const expired = errorReason === "expired";
    return (
      <div className="min-h-screen hero-gradient flex items-center justify-center p-4">
        <div className="auth-card animate-slide-up text-center">
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>
          <div className="flex items-center justify-center gap-2 text-destructive mb-4">
            {expired ? <Clock className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            <span className="font-medium">
              {expired ? "Invitation Expired" : "Invalid Invitation"}
            </span>
          </div>
          <p className="text-muted-foreground text-sm mb-6">
            {expired ? "Invitation has expired." : error}
          </p>
          {expired ? (
            <Button
              variant="gradient"
              onClick={() =>
                toast.info("Please contact the organization that invited you to request a new invitation.")
              }
            >
              Request New Invitation
            </Button>
          ) : (
            <Button variant="outline" onClick={() => navigate("/login")}>
              Go to Login
            </Button>
          )}
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
            Set a password to complete your registration.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>Company Name</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-10 bg-muted/50" readOnly value={invitation?.company_name ?? ""} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Contact Person</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-10 bg-muted/50" readOnly value={invitation?.contact_person ?? ""} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-10 bg-muted/50" readOnly value={invitation?.email ?? ""} />
            </div>
          </div>

          <div className="border-t border-border pt-2">
            <p className="text-xs text-muted-foreground mb-3">Business Details</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <select
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select industry</option>
                {INDUSTRY_OPTIONS.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="registrationNumber">Registration Number</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="registrationNumber"
                  className="pl-10"
                  placeholder="e.g. 2024/123456/07"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vatNumber">VAT Number</Label>
              <div className="relative">
                <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="vatNumber"
                  className="pl-10"
                  placeholder="Optional"
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                className="pl-10"
                placeholder="Optional"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="address"
                className="pl-10"
                placeholder="Optional"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </div>

          <div className="border-t border-border pt-2">
            <p className="text-xs text-muted-foreground mb-3">Account Credentials</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min 8 characters"
                className="pl-10 pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                placeholder="Repeat password"
                className="pl-10 pr-10"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={submitting}>
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
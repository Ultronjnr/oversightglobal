import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, Eye, EyeOff } from "lucide-react";

import { Logo } from "@/components/Logo";
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
import { supabase } from "@/integrations/supabase/client";

const signupSchema = z
  .object({
    name: z.string().min(2, "Name is required"),
    surname: z.string().min(2, "Surname is required"),
    email: z.string().email("Invalid email address"),
    companyName: z.string().min(2, "Company name is required"),
    companyPhone: z.string().optional(),
    role: z.enum(["EMPLOYEE", "HOD", "FINANCE", "ADMIN"], {
      required_error: "Please select a role",
    }),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type SignupForm = z.infer<typeof signupSchema>;

interface Organization {
  id: string;
  name: string;
}

export default function SignupCompany() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  });

  const selectedRole = watch("role");

  // Fetch existing organizations
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const { data, error } = await supabase
          .from("organizations")
          .select("id, name")
          .order("name");

        if (error) throw error;
        setOrganizations(data || []);
      } catch (error) {
        console.error("Error fetching organizations:", error);
      } finally {
        setLoadingOrgs(false);
      }
    };

    fetchOrganizations();
  }, []);

  const onSubmit = async (data: SignupForm) => {
    setIsLoading(true);
    try {
      // If admin role and selecting existing org, check if admin exists
      if (data.role === "ADMIN" && selectedOrgId) {
        const { data: existingAdmins, error: adminCheckError } = await supabase
          .rpc("organization_has_admin", { _org_id: selectedOrgId });

        if (adminCheckError) throw adminCheckError;

        if (existingAdmins) {
          toast.error("This company already has an admin. Please contact them.");
          setIsLoading(false);
          return;
        }
      }

      // Sign up user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (authError) {
        toast.error(authError.message);
        return;
      }

      if (!authData.user) {
        toast.error("Failed to create account");
        return;
      }

      let organizationId = selectedOrgId;

      // Create new organization if not selecting existing
      if (!selectedOrgId) {
        const { data: orgData, error: orgError } = await supabase
          .from("organizations")
          .insert({
            name: data.companyName,
            company_email: data.email,
          })
          .select("id")
          .single();

        if (orgError) {
          toast.error("Failed to create organization");
          return;
        }

        organizationId = orgData.id;
      }

      // Create profile
      const { error: profileError } = await supabase.from("profiles").insert({
        id: authData.user.id,
        email: data.email,
        name: data.name,
        surname: data.surname,
        organization_id: organizationId,
        phone: data.companyPhone || null,
      });

      if (profileError) {
        console.error("Profile error:", profileError);
        toast.error("Failed to create profile");
        return;
      }

      // Create user role
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: authData.user.id,
        role: data.role,
      });

      if (roleError) {
        console.error("Role error:", roleError);
        toast.error("Failed to assign role");
        return;
      }

      toast.success("Account created successfully!");

      // Redirect based on role
      const rolePortalMap: Record<string, string> = {
        EMPLOYEE: "/employee/portal",
        HOD: "/hod/portal",
        FINANCE: "/finance/portal",
        ADMIN: "/admin/portal",
      };

      navigate(rolePortalMap[data.role]);
    } catch (error: any) {
      console.error("Signup error:", error);
      toast.error("An error occurred during signup");
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
          <h1 className="text-2xl font-bold text-foreground">Company Signup</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create your company account and get started
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
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

          {/* Existing Company Selection */}
          <div className="space-y-2">
            <Label>Select Existing Company</Label>
            {loadingOrgs ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                Loading companies...
              </p>
            ) : organizations.length > 0 ? (
              <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a company (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Create new company</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">No existing companies</p>
            )}
            <p className="text-xs text-muted-foreground">
              Or enter new company details below
            </p>
          </div>

          {/* Company Name */}
          {!selectedOrgId && (
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name *</Label>
              <Input
                id="companyName"
                placeholder="Enter company name"
                {...register("companyName")}
              />
              {errors.companyName && (
                <p className="text-sm text-destructive">{errors.companyName.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Required if not selecting an existing company
              </p>
            </div>
          )}

          {/* Company Phone */}
          <div className="space-y-2">
            <Label htmlFor="companyPhone">Company Phone (Optional)</Label>
            <Input
              id="companyPhone"
              placeholder="+27 12 345 6789"
              {...register("companyPhone")}
            />
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label>Role *</Label>
            <Select onValueChange={(value) => setValue("role", value as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Select your role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EMPLOYEE">Employee (Requester)</SelectItem>
                <SelectItem value="HOD">Head of Department</SelectItem>
                <SelectItem value="FINANCE">Finance Manager</SelectItem>
                <SelectItem value="ADMIN">Administrator</SelectItem>
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-sm text-destructive">{errors.role.message}</p>
            )}
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

          {/* Submit */}
          <Button
            type="submit"
            variant="gradient"
            size="lg"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Creating Account..." : "Create Account →"}
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

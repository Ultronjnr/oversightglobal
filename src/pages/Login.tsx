import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ArrowLeft,
  ShieldCheck,
  Zap,
  BarChart3,
} from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (authData.user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", authData.user.id)
          .single();

        toast.success("Welcome back!");

        const rolePortalMap: Record<string, string> = {
          EMPLOYEE: "/employee/portal",
          HOD: "/hod/portal",
          FINANCE: "/finance/portal",
          ADMIN: "/admin/portal",
          SUPPLIER: "/supplier/portal",
        };

        const redirectPath = roleData?.role
          ? rolePortalMap[roleData.role] || "/dashboard"
          : "/dashboard";

        navigate(redirectPath);
      }
    } catch (error: any) {
      toast.error("An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen hero-gradient flex items-stretch">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary via-primary to-[hsl(245_70%_55%)] text-primary-foreground p-12 flex-col justify-between">
        {/* Decorative blobs */}
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

        <div className="relative z-10">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-primary-foreground/80 hover:text-primary-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>

        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Quote Request & Approval System</span>
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              Welcome back to <br /> Oversight
            </h1>
            <p className="text-primary-foreground/80 text-base max-w-md">
              Sign in to manage purchase requisitions, approvals, and supplier
              quotes — all in one premium workspace.
            </p>
          </div>

          <div className="space-y-4 max-w-md">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-white/15 backdrop-blur p-2">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">Enterprise-grade security</p>
                <p className="text-sm text-primary-foreground/75">
                  Multi-tenant isolation with strict role-based access.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-white/15 backdrop-blur p-2">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">Faster approvals</p>
                <p className="text-sm text-primary-foreground/75">
                  Streamlined HOD → Finance workflow with real-time updates.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-white/15 backdrop-blur p-2">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">Insightful analytics</p>
                <p className="text-sm text-primary-foreground/75">
                  Track spend, suppliers, and VAT exposure at a glance.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-primary-foreground/70">
          © {new Date().getFullYear()} Oversight. All rights reserved.
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
        {/* Mobile back link */}
        <Link
          to="/"
          className="lg:hidden absolute top-6 left-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="w-full max-w-md animate-slide-up">
          <div className="bg-card/90 backdrop-blur-xl border border-border/60 rounded-2xl shadow-xl p-8 sm:p-10">
            {/* Logo + heading */}
            <div className="text-center mb-8">
              <div className="flex justify-center mb-5">
                <Logo size="lg" />
              </div>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">
                Sign in to your account
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                Enter your credentials to continue
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Company Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@company.com"
                    className="pl-10 h-11"
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    className="pl-10 pr-10 h-11"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="gradient"
                size="lg"
                className="w-full h-11"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="relative my-7">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground tracking-wider">
                  New to Oversight?
                </span>
              </div>
            </div>

            <div className="space-y-2 text-center">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link
                  to="/signup/company"
                  className="text-primary hover:underline font-semibold"
                >
                  Sign up here
                </Link>
              </p>
              <p className="text-sm text-muted-foreground">
                Want to be a supplier?{" "}
                <Link
                  to="/signup/supplier"
                  className="text-primary hover:underline font-semibold"
                >
                  Register here
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

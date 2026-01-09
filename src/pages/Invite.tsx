import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { LoadingScreen } from "@/components/LoadingScreen";
import { validateInvitation, acceptInvitation } from "@/services/invitation.service";
import { AlertCircle, CheckCircle2, Clock, Shield, User, Lock, UserCircle } from "lucide-react";

type InvitationStatus = "loading" | "valid" | "expired" | "invalid" | "used" | "accepting";

interface InvitationData {
  id: string;
  email: string;
  role: string;
  department: string | null;
  organization_id: string;
  status: string;
  expires_at: string;
}

const roleLabels: Record<string, string> = {
  EMPLOYEE: "Employee",
  HOD: "Head of Department",
  FINANCE: "Finance",
  ADMIN: "Administrator",
};

const rolePortals: Record<string, string> = {
  EMPLOYEE: "/employee/portal",
  HOD: "/hod/portal",
  FINANCE: "/finance/portal",
  ADMIN: "/admin/portal",
};

export default function Invite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState<InvitationStatus>("loading");
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string>("");
  
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const token = searchParams.get("token");
  const email = searchParams.get("email");

  useEffect(() => {
    async function checkInvitation() {
      if (!token || !email) {
        setStatus("invalid");
        setError("Invalid invitation link. Please check your email for the correct link.");
        return;
      }

      const result = await validateInvitation(token, email);
      
      if (!result.success) {
        if (result.error?.includes("expired")) {
          setStatus("expired");
          setError("This invitation has expired. Please contact your administrator for a new invitation.");
        } else if (result.error?.includes("already been used")) {
          setStatus("used");
          setError("This invitation has already been used. If you already have an account, please log in.");
        } else {
          setStatus("invalid");
          setError(result.error || "Invalid invitation");
        }
        return;
      }

      setInvitation(result.data!);
      setStatus("valid");
    }

    checkInvitation();
  }, [token, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (!token || !email || !invitation) {
      toast.error("Invalid invitation");
      return;
    }

    setStatus("accepting");

    const result = await acceptInvitation(token, email, password, name, surname);

    if (!result.success) {
      setStatus("valid");
      toast.error(result.error || "Failed to accept invitation");
      return;
    }

    toast.success("Account created successfully!");
    
    // Redirect to the appropriate portal
    const portal = rolePortals[result.role || "EMPLOYEE"] || "/login";
    navigate(portal);
  };

  if (status === "loading") {
    return <LoadingScreen />;
  }

  if (status === "expired" || status === "invalid" || status === "used") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <Logo size="lg" />
            </div>
            <div className="mx-auto p-3 rounded-full bg-destructive/10">
              {status === "expired" ? (
                <Clock className="h-8 w-8 text-destructive" />
              ) : status === "used" ? (
                <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
              ) : (
                <AlertCircle className="h-8 w-8 text-destructive" />
              )}
            </div>
            <CardTitle>
              {status === "expired"
                ? "Invitation Expired"
                : status === "used"
                ? "Already Accepted"
                : "Invalid Invitation"}
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/login")}
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Logo size="lg" />
          </div>
          <div className="mx-auto p-3 rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>You're Invited!</CardTitle>
          <CardDescription>
            You've been invited to join as <strong>{roleLabels[invitation?.role || "EMPLOYEE"]}</strong>
            {invitation?.department && (
              <> in the <strong>{invitation.department}</strong> department</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email (Read-only) */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email || ""}
                  disabled
                  className="pl-10 bg-muted"
                />
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">First Name *</Label>
              <div className="relative">
                <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your first name"
                  className="pl-10"
                  required
                  disabled={status === "accepting"}
                />
              </div>
            </div>

            {/* Surname */}
            <div className="space-y-2">
              <Label htmlFor="surname">Last Name</Label>
              <div className="relative">
                <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="surname"
                  type="text"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  placeholder="Enter your last name"
                  className="pl-10"
                  disabled={status === "accepting"}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  className="pl-10"
                  required
                  minLength={8}
                  disabled={status === "accepting"}
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="pl-10"
                  required
                  minLength={8}
                  disabled={status === "accepting"}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={status === "accepting"}
            >
              {status === "accepting" ? "Creating Account..." : "Accept Invitation"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { LoadingScreen } from "@/components/LoadingScreen";
import { validateInvitation, acceptInvitation } from "@/services/invitation.service";
import { validateSupplierInvitation, acceptSupplierInvitation } from "@/services/supplier-invitation.service";
import { AlertCircle, CheckCircle2, Clock, Shield, User, Lock, UserCircle, Truck, Building2 } from "lucide-react";

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

interface SupplierInvitationData {
  companyName: string;
  organizationName: string;
  organizationId: string;
}

const roleLabels: Record<string, string> = {
  EMPLOYEE: "Employee",
  HOD: "Head of Department",
  FINANCE: "Finance",
  ADMIN: "Administrator",
  SUPPLIER: "Supplier",
};

const rolePortals: Record<string, string> = {
  EMPLOYEE: "/employee/portal",
  HOD: "/hod/portal",
  FINANCE: "/finance/portal",
  ADMIN: "/admin/portal",
  SUPPLIER: "/supplier/portal",
};

const industries = [
  "Construction",
  "Manufacturing",
  "Technology",
  "Healthcare",
  "Logistics",
  "Retail",
  "Food & Beverage",
  "Agriculture",
  "Energy",
  "Other",
];

export default function Invite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState<InvitationStatus>("loading");
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [supplierInvitation, setSupplierInvitation] = useState<SupplierInvitationData | null>(null);
  const [error, setError] = useState<string>("");
  const [isSupplierInvite, setIsSupplierInvite] = useState(false);
  
  // Common fields
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Supplier-specific fields
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [vatNumber, setVatNumber] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");

  const token = searchParams.get("token");
  const email = searchParams.get("email");
  const inviteType = searchParams.get("type");

  useEffect(() => {
    async function checkInvitation() {
      if (!token || !email) {
        setStatus("invalid");
        setError("Invalid invitation link. Please check your email for the correct link.");
        return;
      }

      // Check if this is a supplier invitation
      if (inviteType === "supplier") {
        const result = await validateSupplierInvitation(token, email);
        
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

        setSupplierInvitation(result.data!);
        setCompanyName(result.data!.companyName);
        setIsSupplierInvite(true);
        setStatus("valid");
      } else {
        // Regular user invitation
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
    }

    checkInvitation();
  }, [token, email, inviteType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (!token || !email) {
      toast.error("Invalid invitation");
      return;
    }

    setStatus("accepting");

    if (isSupplierInvite) {
      // Supplier registration - validate all required fields
      if (!companyName.trim()) {
        toast.error("Please enter your company name");
        setStatus("valid");
        return;
      }

      if (!contactPerson.trim()) {
        toast.error("Please enter a contact person name");
        setStatus("valid");
        return;
      }

      if (!phone.trim()) {
        toast.error("Please enter a contact phone number");
        setStatus("valid");
        return;
      }

      if (!address.trim()) {
        toast.error("Please enter your business address");
        setStatus("valid");
        return;
      }

      if (!registrationNumber.trim()) {
        toast.error("Please enter your company registration number");
        setStatus("valid");
        return;
      }

      if (selectedIndustries.length === 0) {
        toast.error("Please select at least one industry");
        setStatus("valid");
        return;
      }

      const result = await acceptSupplierInvitation({
        token,
        email,
        password,
        companyName: companyName.trim(),
        industries: selectedIndustries,
        vatNumber: vatNumber.trim() || undefined,
        registrationNumber: registrationNumber.trim(),
        phone: phone.trim(),
        address: address.trim(),
        contactPerson: contactPerson.trim(),
      });

      if (!result.success) {
        setStatus("valid");
        toast.error(result.error || "Failed to complete registration");
        return;
      }

      toast.success("Supplier account created successfully!");
      navigate("/supplier/portal");
    } else {
      // Regular user registration
      if (!name.trim()) {
        toast.error("Please enter your name");
        setStatus("valid");
        return;
      }

      if (!invitation) {
        toast.error("Invalid invitation");
        setStatus("valid");
        return;
      }

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
    }
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

  // Supplier invitation form
  if (isSupplierInvite && supplierInvitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 py-8">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <Logo size="lg" />
            </div>
            <div className="mx-auto p-3 rounded-full bg-primary/10">
              <Truck className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Supplier Invitation</CardTitle>
            <CardDescription>
              <strong>{supplierInvitation.organizationName}</strong> has invited you to join as a supplier.
              Complete your registration below.
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

              {/* Company Name */}
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="companyName"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="ABC Supplies Ltd"
                    className="pl-10"
                    required
                    disabled={status === "accepting"}
                  />
                </div>
              </div>

              {/* Registration Number */}
              <div className="space-y-2">
                <Label htmlFor="registrationNumber">Registration Number *</Label>
                <Input
                  id="registrationNumber"
                  type="text"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  placeholder="REG-2024-001234"
                  required
                  disabled={status === "accepting"}
                />
              </div>

              {/* VAT Number */}
              <div className="space-y-2">
                <Label htmlFor="vatNumber">VAT Number</Label>
                <Input
                  id="vatNumber"
                  type="text"
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  placeholder="VAT12345678"
                  disabled={status === "accepting"}
                />
              </div>

              {/* Industry Multi-select */}
              <div className="space-y-2">
                <Label>Industry * <span className="text-xs text-muted-foreground">(select all that apply)</span></Label>
                <div className="grid grid-cols-2 gap-2 p-3 border rounded-md bg-muted/30">
                  {industries.map((ind) => (
                    <label key={ind} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={selectedIndustries.includes(ind)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIndustries([...selectedIndustries, ind]);
                          } else {
                            setSelectedIndustries(selectedIndustries.filter(i => i !== ind));
                          }
                        }}
                        disabled={status === "accepting"}
                        className="rounded border-input"
                      />
                      {ind}
                    </label>
                  ))}
                </div>
                {selectedIndustries.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {selectedIndustries.join(", ")}
                  </p>
                )}
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="address">Address *</Label>
                <Textarea
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Business St, City, Country"
                  rows={2}
                  required
                  disabled={status === "accepting"}
                />
              </div>

              {/* Contact Person */}
              <div className="space-y-2">
                <Label htmlFor="contactPerson">Contact Person *</Label>
                <div className="relative">
                  <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="contactPerson"
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="John Smith"
                    className="pl-10"
                    required
                    disabled={status === "accepting"}
                  />
                </div>
              </div>

              {/* Contact Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone">Contact Phone *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+27 12 345 6789"
                  required
                  disabled={status === "accepting"}
                />
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
                {status === "accepting" ? "Creating Account..." : "Complete Registration"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Regular user invitation form
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

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Mail,
  Send,
  UserPlus,
  Copy,
  Clock,
  CheckCircle2,
  XCircle,
  Link as LinkIcon,
  Trash2,
} from "lucide-react";
import {
  createInvitation,
  getOrganizationInvitations,
  cancelInvitation,
  type Invitation,
} from "@/services/invitation.service";
import { format, formatDistanceToNow, isPast } from "date-fns";

const roleLabels: Record<string, string> = {
  EMPLOYEE: "Employee",
  HOD: "Head of Department",
  FINANCE: "Finance",
  ADMIN: "Administrator",
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "default" },
  accepted: { label: "Accepted", variant: "secondary" },
  expired: { label: "Expired", variant: "destructive" },
};

export function InvitationsTab() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("");
  const [department, setDepartment] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Link dialog
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");

  useEffect(() => {
    loadInvitations();
  }, []);

  const loadInvitations = async () => {
    setIsLoading(true);
    const result = await getOrganizationInvitations();
    if (result.success) {
      setInvitations(result.data);
    }
    setIsLoading(false);
  };

  const handleInvite = async () => {
    if (!email.trim()) {
      toast.error("Email is required");
      return;
    }

    if (!role) {
      toast.error("Please select a role");
      return;
    }

    setIsSending(true);
    try {
      const result = await createInvitation({
        email: email.trim(),
        role: role as "EMPLOYEE" | "HOD" | "FINANCE" | "ADMIN",
        department: department.trim() || undefined,
      });

      if (!result.success) {
        toast.error(result.error || "Failed to create invitation");
        return;
      }

      toast.success("Invitation created successfully!");
      setGeneratedLink(result.inviteLink || "");
      setLinkDialogOpen(true);
      setEmail("");
      setRole("");
      setDepartment("");
      loadInvitations();
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(generatedLink);
      toast.success("Invite link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    const result = await cancelInvitation(invitationId);
    if (result.success) {
      toast.success("Invitation cancelled");
      loadInvitations();
    } else {
      toast.error(result.error || "Failed to cancel invitation");
    }
  };

  const getDisplayStatus = (invitation: Invitation) => {
    if (invitation.status === "pending" && isPast(new Date(invitation.expires_at))) {
      return "expired";
    }
    return invitation.status;
  };

  return (
    <div className="space-y-6">
      {/* Invite Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-muted-foreground" />
            Invite Team Member
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  <SelectItem value="HOD">Head of Department</SelectItem>
                  <SelectItem value="FINANCE">Finance</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department (Optional)</Label>
              <Input
                id="department"
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Engineering"
              />
            </div>

            <div className="flex items-end">
              <Button onClick={handleInvite} disabled={isSending} className="w-full">
                <Send className="h-4 w-4 mr-2" />
                {isSending ? "Sending..." : "Send Invitation"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invitations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-muted-foreground" />
            Invitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : invitations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Mail className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground mb-1">No Invitations Yet</h3>
              <p className="text-sm text-muted-foreground">
                Invitations you send will appear here.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => {
                    const displayStatus = getDisplayStatus(invitation);
                    const statusInfo = statusConfig[displayStatus] || statusConfig.pending;
                    
                    return (
                      <TableRow key={invitation.id}>
                        <TableCell className="font-medium">{invitation.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {roleLabels[invitation.role] || invitation.role}
                          </Badge>
                        </TableCell>
                        <TableCell>{invitation.department || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.variant}>
                            {displayStatus === "pending" && <Clock className="h-3 w-3 mr-1" />}
                            {displayStatus === "accepted" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {displayStatus === "expired" && <XCircle className="h-3 w-3 mr-1" />}
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {isPast(new Date(invitation.expires_at))
                            ? "Expired"
                            : formatDistanceToNow(new Date(invitation.expires_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(invitation.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          {displayStatus === "pending" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelInvitation(invitation.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generated Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-primary" />
              Invitation Created
            </DialogTitle>
            <DialogDescription>
              Share this link with the invitee. The link will expire in 7 days.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={generatedLink}
                readOnly
                className="bg-muted font-mono text-sm"
              />
              <Button onClick={handleCopyLink}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> The invitee will use this link to create their account with a pre-assigned role.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

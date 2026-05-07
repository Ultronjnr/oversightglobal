import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Loader2,
  Undo2,
  FileText,
  ExternalLink,
  Check,
  X,
  CheckCircle2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Reimbursement {
  id: string;
  employee_id: string;
  employee_name: string;
  amount: number;
  currency: string;
  description: string;
  proof_document_url: string | null;
  status: "PENDING" | "APPROVED" | "DECLINED" | "PAID";
  paid_by_employee: boolean;
  created_at: string;
}

const statusConfig: Record<Reimbursement["status"], { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-warning/10 text-warning border-warning/30" },
  APPROVED: { label: "Approved", className: "bg-primary/10 text-primary border-primary/30" },
  PAID: { label: "Paid", className: "bg-success/10 text-success border-success/30" },
  DECLINED: { label: "Declined", className: "bg-destructive/10 text-destructive border-destructive/30" },
};

export function ReimbursementsTab() {
  const [items, setItems] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    void fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reimbursements")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load reimbursements", { description: error.message });
      setLoading(false);
      return;
    }
    setItems((data || []) as Reimbursement[]);
    setLoading(false);
  };

  const handleViewProof = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("reimbursement-documents")
      .createSignedUrl(path, 600);
    if (error || !data?.signedUrl) {
      toast.error("Failed to load proof document", { description: error?.message });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleApprove = async (r: Reimbursement) => {
    setActingId(r.id);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("reimbursements")
      .update({
        status: "APPROVED",
        paid_by_employee: true,
        approved_by: user?.id || null,
        approved_at: new Date().toISOString(),
      })
      .eq("id", r.id);
    setActingId(null);
    if (error) {
      toast.error("Approval failed", { description: error.message });
      return;
    }
    toast.success("Reimbursement approved", {
      description: "Moved to Approved – Not Paid queue.",
    });
    fetchItems();
  };

  const handleDecline = async (r: Reimbursement) => {
    setActingId(r.id);
    const { error } = await supabase
      .from("reimbursements")
      .update({ status: "DECLINED" })
      .eq("id", r.id);
    setActingId(null);
    if (error) {
      toast.error("Decline failed", { description: error.message });
      return;
    }
    toast.success("Reimbursement declined");
    fetchItems();
  };

  const handleMarkPaid = async (r: Reimbursement) => {
    setActingId(r.id);
    const { error } = await supabase
      .from("reimbursements")
      .update({ status: "PAID", paid_at: new Date().toISOString() })
      .eq("id", r.id);
    setActingId(null);
    if (error) {
      toast.error("Mark as paid failed", { description: error.message });
      return;
    }
    toast.success("Reimbursement marked as paid");
    fetchItems();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Undo2 className="h-16 w-16" />}
        title="No Reimbursements"
        description="Employee reimbursement requests will appear here once submitted."
      />
    );
  }

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Employee</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Proof</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((r) => {
            const cfg = statusConfig[r.status];
            return (
              <TableRow key={r.id} className="hover:bg-muted/20">
                <TableCell>
                  <div>
                    <p className="font-medium">{r.employee_name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{r.description}</p>
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(Number(r.amount), r.currency)}
                </TableCell>
                <TableCell>
                  {r.proof_document_url ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewProof(r.proof_document_url!)}
                      className="gap-1 text-primary hover:text-primary h-8 px-2"
                    >
                      <FileText className="h-4 w-4" />
                      View
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">No proof</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1 items-start">
                    <Badge variant="outline" className={cfg.className}>
                      {cfg.label}
                    </Badge>
                    {r.paid_by_employee && (
                      <Badge
                        variant="outline"
                        className="bg-accent/30 text-foreground border-border text-[10px]"
                      >
                        Employee Paid
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(r.created_at), "dd MMM yyyy")}
                </TableCell>
                <TableCell className="text-right">
                  {r.status === "PENDING" && (
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actingId === r.id}
                        onClick={() => handleDecline(r)}
                        className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                      >
                        <X className="h-3 w-3" />
                        Decline
                      </Button>
                      <Button
                        size="sm"
                        disabled={actingId === r.id}
                        onClick={() => handleApprove(r)}
                        className="gap-1"
                      >
                        <Check className="h-3 w-3" />
                        Approve
                      </Button>
                    </div>
                  )}
                  {r.status === "APPROVED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actingId === r.id}
                      onClick={() => handleMarkPaid(r)}
                      className="gap-1"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Mark as Paid
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
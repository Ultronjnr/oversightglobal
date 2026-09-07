import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stamp } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { getApprovalEvents, type ApprovalEvent } from "@/services/permission.service";

const TYPE_LABELS: Record<string, string> = {
  REQUISITION: "Requisition approved",
  REQUISITION_DECLINE: "Requisition declined",
  REIMBURSEMENT: "Reimbursement approved",
  TRANSACTION: "Transaction approved",
};

interface Props {
  /** Show only approvals made by this person. */
  approverId?: string;
  /** Show only approvals against this requisition/reimbursement. */
  entityId?: string;
  /** Name shown next to each entry. */
  approverName?: string;
  title?: string;
}

export function ApprovalTrail({ approverId, entityId, approverName, title }: Props) {
  const { format } = useCurrency();
  const [events, setEvents] = useState<ApprovalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getApprovalEvents({ approverId, entityId, limit: 25 }).then((rows) => {
      if (!active) return;
      setEvents(rows);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [approverId, entityId]);

  return (
    <Card className="dashboard-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Stamp className="h-4 w-4" /> {title ?? "Approval history"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No approvals recorded yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {events.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center gap-2 justify-between border-b pb-2 last:border-0"
              >
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {TYPE_LABELS[e.approval_type] ?? e.approval_type}
                  </Badge>
                  {approverName && <span>by {approverName}</span>}
                  {e.amount != null && (
                    <span className="tabular-nums">{format(e.amount)}</span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString("en-ZA")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

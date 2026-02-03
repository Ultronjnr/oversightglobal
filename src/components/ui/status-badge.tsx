import { Badge } from "@/components/ui/badge";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Receipt,
  DollarSign,
  Truck,
  SplitSquareVertical,
  HourglassIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PRStatus } from "@/types/pr.types";

type StatusVariant = "pending" | "success" | "error" | "warning" | "info" | "neutral";

interface StatusConfig {
  label: string;
  variant: StatusVariant;
  icon: React.ReactNode;
}

const variantStyles: Record<StatusVariant, string> = {
  pending: "bg-warning/10 text-warning border-warning/30",
  success: "bg-success/10 text-success border-success/30",
  error: "bg-destructive/10 text-destructive border-destructive/30",
  warning: "bg-warning/10 text-warning border-warning/30",
  info: "bg-primary/10 text-primary border-primary/30",
  neutral: "bg-muted text-muted-foreground border-border",
};

// PR Status configurations
const prStatusConfig: Record<PRStatus, StatusConfig> = {
  PENDING_HOD_APPROVAL: {
    label: "Pending HOD Review",
    variant: "pending",
    icon: <Clock className="h-3 w-3" />,
  },
  HOD_APPROVED: {
    label: "HOD Approved",
    variant: "success",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  HOD_DECLINED: {
    label: "HOD Declined",
    variant: "error",
    icon: <XCircle className="h-3 w-3" />,
  },
  PENDING_FINANCE_APPROVAL: {
    label: "Pending Finance Review",
    variant: "pending",
    icon: <HourglassIcon className="h-3 w-3" />,
  },
  FINANCE_APPROVED: {
    label: "Approved",
    variant: "success",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  FINANCE_DECLINED: {
    label: "Declined",
    variant: "error",
    icon: <XCircle className="h-3 w-3" />,
  },
  SPLIT: {
    label: "Split into Parts",
    variant: "info",
    icon: <SplitSquareVertical className="h-3 w-3" />,
  },
};

// Quote Status configurations
const quoteStatusConfig: Record<string, StatusConfig> = {
  PENDING: {
    label: "Awaiting Response",
    variant: "pending",
    icon: <Clock className="h-3 w-3" />,
  },
  ACCEPTED: {
    label: "Request Accepted",
    variant: "info",
    icon: <FileText className="h-3 w-3" />,
  },
  DECLINED: {
    label: "Request Declined",
    variant: "error",
    icon: <XCircle className="h-3 w-3" />,
  },
  SUBMITTED: {
    label: "Quote Submitted",
    variant: "info",
    icon: <FileText className="h-3 w-3" />,
  },
  QUOTE_ACCEPTED: {
    label: "Quote Accepted",
    variant: "success",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  REJECTED: {
    label: "Quote Rejected",
    variant: "error",
    icon: <XCircle className="h-3 w-3" />,
  },
  EXPIRED: {
    label: "Expired",
    variant: "neutral",
    icon: <AlertCircle className="h-3 w-3" />,
  },
};

// Invoice Status configurations
const invoiceStatusConfig: Record<string, StatusConfig> = {
  UPLOADED: {
    label: "Invoice Received",
    variant: "info",
    icon: <Receipt className="h-3 w-3" />,
  },
  AWAITING_PAYMENT: {
    label: "Awaiting Payment",
    variant: "warning",
    icon: <DollarSign className="h-3 w-3" />,
  },
  PAID: {
    label: "Paid",
    variant: "success",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
};

// Urgency configurations
const urgencyConfig: Record<string, StatusConfig> = {
  LOW: {
    label: "Low Priority",
    variant: "neutral",
    icon: null,
  },
  NORMAL: {
    label: "Normal",
    variant: "info",
    icon: null,
  },
  HIGH: {
    label: "High Priority",
    variant: "warning",
    icon: <AlertCircle className="h-3 w-3" />,
  },
  URGENT: {
    label: "Urgent",
    variant: "error",
    icon: <AlertCircle className="h-3 w-3" />,
  },
};

interface StatusBadgeProps {
  type: "pr" | "quote" | "invoice" | "urgency";
  status: string;
  showIcon?: boolean;
  className?: string;
}

export function StatusBadge({
  type,
  status,
  showIcon = true,
  className,
}: StatusBadgeProps) {
  let config: StatusConfig | undefined;

  switch (type) {
    case "pr":
      config = prStatusConfig[status as PRStatus];
      break;
    case "quote":
      config = quoteStatusConfig[status];
      break;
    case "invoice":
      config = invoiceStatusConfig[status];
      break;
    case "urgency":
      config = urgencyConfig[status];
      break;
  }

  if (!config) {
    return (
      <Badge variant="outline" className={className}>
        {status}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 font-medium",
        variantStyles[config.variant],
        className
      )}
    >
      {showIcon && config.icon}
      {config.label}
    </Badge>
  );
}
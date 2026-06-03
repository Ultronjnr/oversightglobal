import { format } from "date-fns";
import {
  FilePlus2,
  CheckCircle2,
  XCircle,
  Send,
  Scissors,
  ScanLine,
  Banknote,
  RefreshCw,
  History as HistoryIcon,
  CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface PRHistoryEntry {
  action: string;
  user_name?: string;
  user_id?: string;
  timestamp: string;
  details?: string;
}

interface StyleMeta {
  icon: typeof CircleDot;
  ring: string;
  dot: string;
  text: string;
}

/**
 * Maps a free-form / coded history action to an icon + status colors.
 */
function metaFor(action: string): StyleMeta {
  const a = (action || "").toLowerCase();
  if (a.includes("declin") || a.includes("reject") || a.includes("cancel")) {
    return {
      icon: XCircle,
      ring: "border-destructive/30 bg-destructive/10",
      dot: "text-destructive",
      text: "text-destructive",
    };
  }
  if (a.includes("approv")) {
    return {
      icon: CheckCircle2,
      ring: "border-success/30 bg-success/10",
      dot: "text-success",
      text: "text-success",
    };
  }
  if (a.includes("paid") || a.includes("payment")) {
    return {
      icon: Banknote,
      ring: "border-success/30 bg-success/10",
      dot: "text-success",
      text: "text-success",
    };
  }
  if (a.includes("creat") || a.includes("submit")) {
    return {
      icon: FilePlus2,
      ring: "border-primary/30 bg-primary/10",
      dot: "text-primary",
      text: "text-primary",
    };
  }
  if (a.includes("quote") || a.includes("sent")) {
    return {
      icon: Send,
      ring: "border-blue-500/30 bg-blue-500/10",
      dot: "text-blue-600",
      text: "text-blue-600",
    };
  }
  if (a.includes("split")) {
    return {
      icon: Scissors,
      ring: "border-warning/30 bg-warning/10",
      dot: "text-warning",
      text: "text-warning",
    };
  }
  if (a.includes("scan") || a.includes("ocr")) {
    return {
      icon: ScanLine,
      ring: "border-primary/30 bg-primary/10",
      dot: "text-primary",
      text: "text-primary",
    };
  }
  if (a.includes("refresh") || a.includes("updat")) {
    return {
      icon: RefreshCw,
      ring: "border-muted-foreground/30 bg-muted",
      dot: "text-muted-foreground",
      text: "text-foreground",
    };
  }
  return {
    icon: CircleDot,
    ring: "border-muted-foreground/30 bg-muted",
    dot: "text-muted-foreground",
    text: "text-foreground",
  };
}

function formatStamp(ts: string): string {
  try {
    return format(new Date(ts), "dd MMM yyyy HH:mm");
  } catch {
    return ts;
  }
}

interface Props {
  history?: PRHistoryEntry[] | null;
  title?: string;
  className?: string;
}

export function PRHistoryTimeline({ history, title = "History / Activity", className }: Props) {
  const entries = (history || []).filter(Boolean);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <HistoryIcon className="h-4 w-4 text-primary" />
        <h4 className="font-semibold text-sm text-foreground">{title}</h4>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground italic pl-1">No activity recorded yet.</p>
      ) : (
        <ol className="relative space-y-1">
          {entries.map((entry, idx) => {
            const meta = metaFor(entry.action);
            const Icon = meta.icon;
            const isLast = idx === entries.length - 1;
            return (
              <li key={idx} className="relative flex gap-3 pb-4 last:pb-0">
                {/* connector line */}
                {!isLast && (
                  <span className="absolute left-[15px] top-8 bottom-0 w-px bg-border" aria-hidden />
                )}
                {/* node */}
                <span
                  className={cn(
                    "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                    meta.ring,
                  )}
                >
                  <Icon className={cn("h-4 w-4", meta.dot)} />
                </span>

                <div className="flex-1 min-w-0 rounded-lg border border-border/60 bg-card px-3 py-2 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                    <p className={cn("text-sm font-semibold tracking-tight", meta.text)}>
                      {entry.action}
                      {entry.user_name ? (
                        <span className="text-foreground font-medium"> — {entry.user_name}</span>
                      ) : null}
                    </p>
                    <time className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatStamp(entry.timestamp)}
                    </time>
                  </div>
                  {entry.details && (
                    <p className="text-sm text-muted-foreground mt-1 leading-snug">{entry.details}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

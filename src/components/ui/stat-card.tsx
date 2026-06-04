import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  valueColor?: "default" | "success" | "warning" | "destructive" | "primary";
  isLoading?: boolean;
  className?: string;
  icon?: ReactNode;
  footer?: ReactNode;
  badge?: number;
}

export function StatCard({ 
  label, 
  value, 
  valueColor = "default", 
  isLoading = false,
  className,
  icon,
  footer,
  badge,
}: StatCardProps) {
  const colorClasses = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
    primary: "text-primary",
  };

  return (
    <div className={cn(
      "relative bg-white rounded-xl border border-border/50 p-4 sm:p-5 lg:p-6 shadow-sm hover:shadow-md transition-shadow",
      className
    )}>
      {badge && badge > 0 ? (
        <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold flex items-center justify-center shadow-md border-2 border-white animate-in zoom-in">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 sm:space-y-2 min-w-0 flex-1">
          <p className="text-xs sm:text-sm text-muted-foreground font-medium truncate">{label}</p>
          {isLoading ? (
            <div className="h-8 sm:h-9 lg:h-10 w-2/3 rounded-md bg-muted animate-pulse" />
          ) : (
            <p className={cn(
              "text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight break-words",
              colorClasses[valueColor]
            )}>
              {value}
            </p>
          )}
          {footer && <div className="pt-1">{footer}</div>}
        </div>
        {icon && (
          <div className="text-muted-foreground/50 flex-shrink-0">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  valueColor?: "default" | "success" | "warning" | "destructive" | "primary";
  isLoading?: boolean;
  className?: string;
  icon?: ReactNode;
}

export function StatCard({ 
  label, 
  value, 
  valueColor = "default", 
  isLoading = false,
  className,
  icon
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
      "bg-white rounded-xl border border-border/50 p-6 shadow-sm hover:shadow-md transition-shadow",
      className
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium mb-2">{label}</p>
          <p className={cn(
            "text-4xl font-bold",
            colorClasses[valueColor]
          )}>
            {isLoading ? "-" : value}
          </p>
        </div>
        {icon && (
          <div className="text-muted-foreground/50">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

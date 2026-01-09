import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { FileText } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  className?: string;
}

export function EmptyState({ 
  icon, 
  title, 
  description, 
  className 
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-16 text-center",
      className
    )}>
      <div className="text-muted-foreground/40 mb-4">
        {icon || <FileText className="h-16 w-16" />}
      </div>
      <h3 className="text-lg font-semibold text-muted-foreground mb-1">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground/70 max-w-sm">
        {description}
      </p>
    </div>
  );
}

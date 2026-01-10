import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface SectionCardProps {
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  headerActions?: ReactNode;
}

export function SectionCard({ 
  title, 
  icon, 
  children, 
  className,
  headerActions
}: SectionCardProps) {
  const hasHeader = title || icon || headerActions;

  return (
    <div className={cn(
      "bg-white rounded-xl border border-border/50 shadow-sm overflow-hidden",
      className
    )}>
      {hasHeader && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="text-foreground">
                {icon}
              </div>
            )}
            {title && <h2 className="text-lg font-semibold text-foreground">{title}</h2>}
          </div>
          {headerActions && (
            <div className="flex items-center gap-2">
              {headerActions}
            </div>
          )}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

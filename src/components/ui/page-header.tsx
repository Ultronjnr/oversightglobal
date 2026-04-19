import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Shared page header used across Signup, Freemium, and Admin to keep
 * titles, spacing, and visual hierarchy consistent.
 */
export function PageHeader({ title, description, icon, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-8", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {icon && (
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary shrink-0">
              {icon}
            </div>
          )}
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              {title}
            </h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="h-1 w-16 bg-primary rounded-full mt-4" />
    </div>
  );
}

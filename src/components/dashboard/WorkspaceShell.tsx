import { ReactNode, useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WorkspaceShellProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  /** Buttons or filters rendered on the right of the header. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Hide the expand control (e.g. for small read-only panels). */
  focusable?: boolean;
}

/**
 * Module container with a full-screen "focus" mode.
 *
 * Layer 7 of the build: every workspace module (finance tabs, donations,
 * expense history) can be expanded to fill the viewport so dense tables are
 * readable without the surrounding dashboard chrome. Escape exits focus mode.
 */
export function WorkspaceShell({
  title,
  description,
  icon,
  actions,
  children,
  className,
  focusable = true,
}: WorkspaceShellProps) {
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocused(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [focused]);

  const header = (
    <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-border/30">
      <div className="flex items-start gap-3 min-w-0">
        {icon && <div className="text-foreground pt-0.5">{icon}</div>}
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground truncate">{title}</h2>
          {description && (
            <p className="text-xs sm:text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {actions}
        {focusable && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => setFocused((v) => !v)}
            aria-label={focused ? "Exit full screen" : "Open full screen workspace"}
          >
            {focused ? (
              <>
                <Minimize2 className="h-4 w-4" />
                <span className="hidden sm:inline">Exit full screen</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4" />
                <span className="hidden sm:inline">Full screen</span>
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );

  if (focused) {
    return (
      <div className="fixed inset-0 z-[70] bg-white flex flex-col animate-fade-in">
        {header}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-border/50 shadow-sm overflow-hidden",
        className,
      )}
    >
      {header}
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

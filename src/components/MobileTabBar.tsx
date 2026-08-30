import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MobileTabItem {
  label: string;
  href: string;
  icon?: ReactNode;
}

interface MobileTabBarProps {
  items: MobileTabItem[];
  activePath: string;
  /** Opens the full navigation drawer. */
  onMore: () => void;
  showMore?: boolean;
}

/**
 * Thumb-reachable bottom navigation for phones.
 * Shows up to four primary destinations plus a "More" entry that opens the
 * complete grouped drawer.
 */
export function MobileTabBar({ items, activePath, onMore, showMore = true }: MobileTabBarProps) {
  if (items.length === 0) return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border/60 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length + (showMore ? 1 : 0)}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const isActive = activePath === item.href;
          return (
            <li key={item.href}>
              <Link
                to={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 min-h-[56px] px-1 text-[11px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("flex h-6 w-6 items-center justify-center", isActive && "scale-110 transition-transform")}>
                  {item.icon}
                </span>
                <span className="truncate max-w-full leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
        {showMore && (
          <li>
            <button
              type="button"
              onClick={onMore}
              className="w-full flex flex-col items-center justify-center gap-1 min-h-[56px] px-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Open full navigation menu"
            >
              <span className="flex h-6 w-6 items-center justify-center">
                <MoreHorizontal className="h-5 w-5" />
              </span>
              <span className="leading-none">More</span>
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}

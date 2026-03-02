import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, iconOnly = false, size = "md" }: LogoProps) {
  const sizeClasses = {
    sm: "h-6",
    md: "h-8",
    lg: "h-12",
  };

  const textSizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-3xl",
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Icon */}
      <div className={cn("relative flex items-center justify-center", sizeClasses[size])}>
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn("h-full w-auto")}
        >
          {/* Outer ring */}
          <circle
            cx="20"
            cy="20"
            r="16"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="4 2"
          />
          {/* Inner bars */}
          <rect x="14" y="14" width="3" height="12" rx="1.5" fill="hsl(var(--primary))" />
          <rect x="18.5" y="10" width="3" height="16" rx="1.5" fill="hsl(var(--primary))" />
          <rect x="23" y="16" width="3" height="10" rx="1.5" fill="hsl(var(--primary))" />
        </svg>
      </div>
      
      {/* Text */}
      {!iconOnly && (
        <span className={cn("font-bold text-foreground", textSizeClasses[size])}>
          Oversight
        </span>
      )}
    </div>
  );
}

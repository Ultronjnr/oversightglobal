import { cn } from "@/lib/utils";
import logoImage from "@/assets/ovasyt-logo.jpeg";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, iconOnly = false, size = "md" }: LogoProps) {
  // Heights tuned to match the prior visual weight of the Oversight mark.
  // The new logo is wide (logo + wordmark), so we constrain by height only.
  const sizeClasses = {
    sm: "h-8",
    md: "h-10",
    lg: "h-14",
  };

  return (
    <div className={cn("flex items-center", className)}>
      <img
        src={logoImage}
        alt="Ovasyt"
        className={cn("w-auto object-contain", sizeClasses[size])}
      />
    </div>
  );
}

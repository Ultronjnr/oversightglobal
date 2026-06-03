import { cn } from "@/lib/utils";
import logoImage from "@/assets/ovasyt-logo.png";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, size = "md" }: LogoProps) {
  const sizeClasses = {
    sm: "h-10",
    md: "h-16",
    lg: "h-28",
  };

  return (
    <div className={cn("flex items-center shrink-0", className)}>
      <img
        src={logoImage}
        alt="Ovasyt"
        className={cn("w-auto object-contain", sizeClasses[size])}
      />
    </div>
  );
}

import { cn } from "@/lib/utils";
import logoImage from "@/assets/ovasyt-logo.png";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, size = "md" }: LogoProps) {
  const sizeClasses = {
    sm: "h-24",
    md: "h-36",
    lg: "h-56",
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

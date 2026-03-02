import { cn } from "@/lib/utils";
import logoFull from "@/assets/oversight-logo.png";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, iconOnly = false, size = "md" }: LogoProps) {
  const heightClasses = {
    sm: "h-14",
    md: "h-16",
    lg: "h-20",
  };

  return (
    <div className={cn("flex items-center", className)}>
      <img
        src={logoFull}
        alt="Oversight"
        className={cn("w-auto object-contain", heightClasses[size])}
      />
    </div>
  );
}

import { cn } from "@/lib/utils";
import logoFull from "@/assets/oversight-logo.png";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, iconOnly = false, size = "md" }: LogoProps) {
  if (size === "lg") {
    return (
      <div className={cn("flex items-center justify-center mx-auto mb-6", className)}>
        <img
          src={logoFull}
          alt="Oversight"
          className="h-48 w-auto object-contain drop-shadow-lg hover:scale-110 transition-all duration-300"
        />
      </div>
    );
  }

  // Header logo - 36px height, no background, no absolute positioning
  return (
    <img
      src={logoFull}
      alt="Oversight"
      className={cn(
        "h-9 w-auto object-contain shrink-0 md:h-10",
        className
      )}
    />
  );
}

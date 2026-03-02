import { cn } from "@/lib/utils";
import logoFull from "@/assets/oversight-logo.png";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, iconOnly = false, size = "md" }: LogoProps) {
  if (size === "lg") {
    // Login/Signup pages - 192px height
    return (
      <div className={cn("flex items-center justify-center mx-auto mb-6", className)}>
        <img
          src={logoFull}
          alt="Oversight"
          className="w-auto object-contain drop-shadow-lg hover:scale-110 transition-all duration-300"
          style={{ height: "192px" }}
        />
      </div>
    );
  }

  // Header logo - 119px height with overflow effect
  return (
    <div className={cn("flex items-center group", className)}>
      <img
        src={logoFull}
        alt="Oversight"
        className="w-auto object-contain hover:scale-110 transition-transform duration-300"
        style={{ height: "119px", marginRight: "-1px", paddingRight: "2px" }}
      />
    </div>
  );
}

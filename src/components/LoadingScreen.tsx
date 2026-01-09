import { Logo } from "./Logo";

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = "Preparing your workspace..." }: LoadingScreenProps) {
  return (
    <div className="min-h-screen hero-gradient flex flex-col items-center justify-center">
      {/* Logo container with glow effect */}
      <div className="relative mb-8">
        {/* Glow background */}
        <div className="absolute inset-0 bg-primary/10 rounded-3xl blur-2xl scale-150" />
        
        {/* Logo card */}
        <div className="relative glass-card rounded-2xl px-8 py-6">
          <Logo size="lg" />
        </div>
      </div>

      {/* Loading text */}
      <h2 className="text-xl font-semibold text-primary mb-3">Loading</h2>
      
      {/* Animated dots */}
      <div className="loading-dots flex gap-1 mb-4">
        <span className="w-2 h-2 rounded-full bg-primary" />
        <span className="w-2 h-2 rounded-full bg-primary" />
        <span className="w-2 h-2 rounded-full bg-primary" />
      </div>

      {/* Message */}
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

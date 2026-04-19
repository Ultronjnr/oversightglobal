import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import {
  AlertTriangle,
  CircleAlert,
  CircleDot,
  CheckCircle2,
  ChevronDown,
  Search,
  FolderOpen,
  BarChart3,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Logo size="md" />
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
            <a href="#contact" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Contact
            </a>
            <Link to="/login">
              <Button variant="default" size="sm">
                Sign In
              </Button>
            </Link>
          </div>
          <div className="md:hidden">
            <Link to="/login">
              <Button variant="default" size="sm">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-center text-foreground mb-12">
            From financial chaos to{" "}
            <span className="text-primary">complete control.</span>
          </h1>

          {/* Split Hero Panels */}
          <div className="grid md:grid-cols-2 gap-6 lg:gap-8 mb-10">
            {/* Left - Chaos Panel */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-foreground/95 to-foreground/80 p-6 min-h-[320px] flex flex-col justify-center shadow-2xl">
              {/* Scattered paper effect - decorative shapes */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-4 left-4 w-16 h-20 bg-white/20 rotate-12 rounded" />
                <div className="absolute top-12 right-12 w-14 h-18 bg-white/15 -rotate-6 rounded" />
                <div className="absolute bottom-8 left-16 w-12 h-16 bg-white/10 rotate-3 rounded" />
                <div className="absolute bottom-4 right-8 w-10 h-14 bg-white/10 -rotate-12 rounded" />
                <div className="absolute top-1/2 left-1/3 w-8 h-10 bg-white/10 rotate-45 rounded" />
              </div>

              <div className="relative z-10">
                <div className="rounded-xl overflow-hidden border border-destructive/30">
                  <div className="bg-destructive flex items-center justify-between px-4 py-3">
                    <span className="font-semibold text-destructive-foreground text-lg">
                      Missing Documents
                    </span>
                    <ChevronDown className="h-5 w-5 text-destructive-foreground" />
                  </div>
                  <div className="bg-destructive/90 divide-y divide-destructive-foreground/10">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <AlertTriangle className="h-5 w-5 text-warning-foreground shrink-0" />
                      <span className="text-destructive-foreground font-medium">
                        Missing Documents
                      </span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <CircleDot className="h-5 w-5 text-warning shrink-0" />
                      <span className="text-destructive-foreground font-medium">
                        Untracked Spending
                      </span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <CircleAlert className="h-5 w-5 text-destructive-foreground shrink-0" />
                      <span className="text-destructive-foreground font-medium">
                        SARS Risk
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right - Control Panel */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-secondary to-accent p-6 min-h-[320px] flex flex-col justify-center shadow-2xl border border-border/50">
              {/* Clean desk decorative elements */}
              <div className="absolute bottom-4 right-4 opacity-10">
                <div className="w-16 h-20 bg-primary/30 rounded" />
                <div className="w-12 h-16 bg-success/20 rounded mt-1 ml-4" />
              </div>

              <div className="relative z-10">
                <div className="rounded-xl overflow-hidden border-2 border-primary/30 shadow-lg">
                  <div className="bg-primary flex items-center justify-between px-4 py-3">
                    <span className="font-semibold text-primary-foreground text-lg">
                      Complete Control
                    </span>
                    <ChevronDown className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="bg-card divide-y divide-border">
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                      <span className="font-medium text-foreground">
                        All Invoices Stored
                      </span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                      <span className="font-medium text-foreground">
                        VAT Under Control
                      </span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                      <span className="font-medium text-foreground">
                        Audit Ready
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <div className="text-center">
            <Link to="/signup/company">
              <Button
                size="lg"
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground text-lg px-10 py-6 font-semibold shadow-xl hover:shadow-2xl transition-all"
              >
                Start Free Check
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section id="features" className="bg-secondary/50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <Search className="h-10 w-10 text-primary" />,
                title: "Lost Invoices",
                description: "Missing documents lead to rejected VAT claims",
              },
              {
                icon: <FolderOpen className="h-10 w-10 text-warning" />,
                title: "Poor Tracking",
                description: "No visibility over where money is going",
              },
              {
                icon: <BarChart3 className="h-10 w-10 text-primary" />,
                title: "Track VAT in Real Time",
                description: "See what SARS sees before submissions",
              },
              {
                icon: <ShieldCheck className="h-10 w-10 text-success" />,
                title: "Get Audit Ready",
                description: "Generate compliance packs instantly",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="bg-card rounded-xl p-6 text-center shadow-md border border-border/50 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-center mb-4">{feature.icon}</div>
                <h3 className="font-bold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Oversight. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

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
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import landingBg from "@/assets/landing-bg.jpg";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Premium background image */}
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${landingBg})` }}
        aria-hidden="true"
      />
      {/* Background overlays for premium depth */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-background/85 via-background/70 to-background/95 backdrop-blur-sm" aria-hidden="true" />
      <div
        className="fixed inset-0 -z-10 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 10%, hsl(var(--primary) / 0.25), transparent 45%), radial-gradient(circle at 85% 80%, hsl(var(--accent) / 0.35), transparent 50%)",
        }}
        aria-hidden="true"
      />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl">
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
              <Button variant="default" size="sm" className="shadow-md">
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
      <section className="relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
          {/* Badge */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5" />
              Trusted by finance teams across South Africa
            </div>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-center text-foreground mb-4 tracking-tight">
            From financial chaos to{" "}
            <span className="bg-gradient-to-r from-primary to-accent-foreground bg-clip-text text-transparent">
              complete control.
            </span>
          </h1>
          <p className="text-center text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-12">
            Oversight gives you a single source of truth for every transaction — invoices, VAT, approvals and audits, all in one elegant workspace.
          </p>

          {/* Split Hero Panels */}
          <div className="grid md:grid-cols-2 gap-6 lg:gap-8 mb-12">
            {/* Left - Chaos Panel */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-foreground/95 via-foreground/90 to-foreground/80 p-8 min-h-[340px] flex flex-col justify-center shadow-2xl border border-foreground/20">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-4 left-4 w-16 h-20 bg-white/20 rotate-12 rounded" />
                <div className="absolute top-12 right-12 w-14 h-18 bg-white/15 -rotate-6 rounded" />
                <div className="absolute bottom-8 left-16 w-12 h-16 bg-white/10 rotate-3 rounded" />
                <div className="absolute bottom-4 right-8 w-10 h-14 bg-white/10 -rotate-12 rounded" />
                <div className="absolute top-1/2 left-1/3 w-8 h-10 bg-white/10 rotate-45 rounded" />
              </div>

              <div className="relative z-10">
                <div className="rounded-2xl overflow-hidden border border-destructive/30 shadow-xl">
                  <div className="bg-destructive flex items-center justify-between px-4 py-3">
                    <span className="font-semibold text-destructive-foreground text-lg">
                      Without Oversight
                    </span>
                    <ChevronDown className="h-5 w-5 text-destructive-foreground" />
                  </div>
                  <div className="bg-destructive/90 divide-y divide-destructive-foreground/10">
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <AlertTriangle className="h-5 w-5 text-warning-foreground shrink-0" />
                      <span className="text-destructive-foreground font-medium">
                        Missing Documents
                      </span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <CircleDot className="h-5 w-5 text-warning shrink-0" />
                      <span className="text-destructive-foreground font-medium">
                        Untracked Spending
                      </span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3.5">
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
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-card via-secondary to-accent p-8 min-h-[340px] flex flex-col justify-center shadow-2xl border border-primary/20">
              <div className="absolute bottom-4 right-4 opacity-10">
                <div className="w-16 h-20 bg-primary/30 rounded" />
                <div className="w-12 h-16 bg-success/20 rounded mt-1 ml-4" />
              </div>

              <div className="relative z-10">
                <div className="rounded-2xl overflow-hidden border-2 border-primary/30 shadow-xl">
                  <div className="bg-primary flex items-center justify-between px-4 py-3">
                    <span className="font-semibold text-primary-foreground text-lg">
                      With Oversight
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

        </div>
      </section>

      {/* Feature Cards */}
      <section id="features" className="relative py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
              Everything finance teams need
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Replace spreadsheets, scattered emails and manual checks with one connected platform.
            </p>
          </div>
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
                className="group bg-card/80 backdrop-blur-md rounded-2xl p-6 text-center shadow-md border border-border/50 hover:shadow-xl hover:border-primary/30 hover:-translate-y-1 transition-all"
              >
                <div className="flex justify-center mb-4 transition-transform group-hover:scale-110">
                  {feature.icon}
                </div>
                <h3 className="font-bold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative bg-background/70 backdrop-blur-xl border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Oversight. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

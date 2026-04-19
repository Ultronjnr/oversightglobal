import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import landingBg from "@/assets/landing-bg.jpg";
import iconLostInvoices from "@/assets/icon-lost-invoices.png";
import iconPoorTracking from "@/assets/icon-poor-tracking.png";
import iconVatRealtime from "@/assets/icon-vat-realtime.png";
import iconAuditReady from "@/assets/icon-audit-ready.png";
import {
  AlertTriangle,
  CircleAlert,
  CircleDot,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/90 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Logo size="md" />
          <div className="hidden md:flex items-center gap-8">
            <a href="#pricing" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors">
              Pricing
            </a>
            <a href="#features" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#blog" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors">
              Blog
            </a>
            <a href="#contact" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors">
              Contact
            </a>
            <Link to="/login">
              <Button variant="default" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5">
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

      {/* Hero Section with split background */}
      <section
        className="relative overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: `url(${landingBg})` }}
      >
        {/* Subtle overlay to ensure card legibility while preserving the split */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/10 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 min-h-[640px]">
          {/* Headline with split-color text */}
          <h1 className="text-center text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-14 max-w-5xl mx-auto">
            <span
              className="bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
              style={{
                backgroundImage:
                  "linear-gradient(to right, #ffffff 0%, #ffffff 50%, hsl(222 47% 11%) 50%, hsl(222 47% 11%) 100%)",
              }}
            >
              From financial chaos to complete control.
            </span>
          </h1>

          {/* Cards with bridging CTA */}
          <div className="relative grid md:grid-cols-2 gap-6 lg:gap-10 max-w-5xl mx-auto">
            {/* Left - Chaos Card */}
            <div className="rounded-2xl overflow-hidden shadow-2xl border border-destructive/40 backdrop-blur-md">
              <div
                className="flex items-center justify-between px-5 py-4"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(0 75% 50%), hsl(0 70% 42%))",
                }}
              >
                <span className="font-bold text-white text-lg tracking-tight">
                  Missing Documents
                </span>
                <ChevronDown className="h-5 w-5 text-white" />
              </div>
              <div
                className="divide-y divide-white/15"
                style={{
                  background:
                    "linear-gradient(135deg, hsla(0,70%,45%,0.92), hsla(0,65%,38%,0.92))",
                }}
              >
                <div className="flex items-center gap-3 px-5 py-4">
                  <AlertTriangle className="h-5 w-5 text-yellow-300 shrink-0" />
                  <span className="text-white font-medium">Missing Documents</span>
                </div>
                <div className="flex items-center gap-3 px-5 py-4">
                  <CircleDot className="h-5 w-5 text-orange-300 shrink-0" />
                  <span className="text-white font-medium">Untracked Spending</span>
                </div>
                <div className="flex items-center gap-3 px-5 py-4">
                  <CircleAlert className="h-5 w-5 text-white shrink-0" />
                  <span className="text-white font-medium">SARS Risk</span>
                </div>
              </div>
            </div>

            {/* Right - Control Card */}
            <div className="rounded-2xl overflow-hidden shadow-2xl border border-primary/40 bg-white">
              <div className="bg-primary flex items-center justify-between px-5 py-4">
                <span className="font-bold text-primary-foreground text-lg tracking-tight">
                  Complete Control
                </span>
                <ChevronDown className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="divide-y divide-border bg-white">
                <div className="flex items-center gap-3 px-5 py-4">
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  <span className="font-medium text-slate-900">All Invoices Stored</span>
                </div>
                <div className="flex items-center gap-3 px-5 py-4">
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  <span className="font-medium text-slate-900">VAT Under Control</span>
                </div>
                <div className="flex items-center gap-3 px-5 py-4">
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  <span className="font-medium text-slate-900">Audit Ready</span>
                </div>
              </div>
            </div>

            {/* Bridging CTA Button - centered between the two cards */}
            <div className="md:absolute md:left-1/2 md:-translate-x-1/2 md:bottom-0 md:translate-y-1/2 mt-6 md:mt-0 flex justify-center w-full md:w-auto z-10">
              <Link to="/signup/company">
                <Button
                  size="lg"
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground text-base sm:text-lg px-10 py-6 font-bold shadow-2xl rounded-xl border-2 border-white/20"
                >
                  Start Free Check
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Features Section */}
      <section id="features" className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {[
              {
                icon: iconLostInvoices,
                title: "Lost Invoices",
                description: "Missing documents led to rejected VAT claims",
              },
              {
                icon: iconPoorTracking,
                title: "Poor Tracking",
                description: "No visibility over where money is going",
              },
              {
                icon: iconVatRealtime,
                title: "Track VAT in Real Time",
                description: "See what SARS sees before submissions",
              },
              {
                icon: iconAuditReady,
                title: "Get Audit Ready",
                description: "Generate compliance packs instantly",
              },
            ].map((feature, idx) => (
              <div
                key={feature.title}
                className={`text-center px-4 ${
                  idx < 3 ? "lg:border-r lg:border-border/60" : ""
                }`}
              >
                <div className="flex justify-center mb-5 h-32 items-center">
                  <img
                    src={feature.icon}
                    alt={feature.title}
                    loading="lazy"
                    className="h-32 w-auto object-contain drop-shadow-lg"
                  />
                </div>
                <h3 className="font-bold text-slate-900 text-lg mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed max-w-[220px] mx-auto">
                  {feature.description}
                </p>
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

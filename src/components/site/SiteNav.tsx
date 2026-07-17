import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Home", to: "/" },
  { label: "About", to: "/about" },
  { label: "Insights", to: "/insights" },
  { label: "Pricing", to: "/pricing" },
  { label: "Contact", to: "/contact" },
];

export function SiteNav() {
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={cn(
        "sticky top-0 z-50 transition-all duration-300 backdrop-blur-xl",
        scrolled
          ? "border-b border-white/60 bg-white/80 shadow-[0_10px_30px_-15px_hsl(225_73%_57%/0.25)]"
          : "border-b border-transparent bg-white/50"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <Link to="/" aria-label="Ovasyt home" className="transition-transform hover:scale-[1.02]">
          <Logo size="md" />
        </Link>
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                data-active={active}
                className={cn(
                  "nav-underline text-sm font-medium transition-colors",
                  active ? "text-primary" : "text-foreground/70 hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            );
          })}
          <Link to="/login">
            <Button
              size="sm"
              className="relative overflow-hidden font-semibold px-5 text-primary-foreground bg-gradient-to-r from-primary to-[hsl(265_70%_58%)] shadow-lg shadow-primary/25 hover:shadow-primary/45 hover:scale-[1.03] transition-all"
            >
              Sign In
            </Button>
          </Link>
        </div>
        <div className="md:hidden flex items-center gap-2">
          <Link to="/login">
            <Button size="sm" className="bg-gradient-to-r from-primary to-[hsl(265_70%_58%)] text-primary-foreground font-semibold">
              Sign In
            </Button>
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            className="p-2 rounded-lg border border-border/60 bg-white/70 hover:bg-white transition-colors"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-border/50 bg-white/95 backdrop-blur-xl animate-fade-in">
          <div className="px-4 py-3 flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  pathname === link.to
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/80 hover:bg-muted"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
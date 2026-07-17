import { Link } from "react-router-dom";
import { Mail, MapPin, Phone, ShieldCheck, Linkedin, Twitter, Facebook, ArrowRight } from "lucide-react";

const PRODUCT = [
  { label: "Procurement workflow", to: "/insights" },
  { label: "Invoice scanning", to: "/insights" },
  { label: "Supplier portal", to: "/insights" },
  { label: "Donations & 18A", to: "/blog/section-18a-donations-in-kind" },
  { label: "Pricing", to: "/pricing" },
];

const COMPANY = [
  { label: "About us", to: "/about" },
  { label: "Insights", to: "/insights" },
  { label: "Contact us", to: "/contact" },
  { label: "Book a demo", to: "/signup/company" },
];

const RESOURCES = [
  { label: "Section 18A in-kind guide", to: "/blog/section-18a-donations-in-kind" },
  { label: "Register a PBO", to: "/blog/how-to-register-pbo-section-18a" },
  { label: "SARS VAT compliance", to: "/insights" },
  { label: "Reset password", to: "/reset-password" },
];

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-border/60 bg-gradient-to-b from-white via-[hsl(220_40%_97%)] to-[hsl(225_45%_94%)]">
      {/* ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(50% 60% at 15% 0%, hsl(225 73% 57% / 0.10), transparent 70%), radial-gradient(50% 60% at 90% 100%, hsl(265 70% 60% / 0.12), transparent 70%)",
        }}
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        {/* CTA strip */}
        <div className="mb-14 rounded-2xl border border-white/70 bg-white/70 backdrop-blur-xl p-6 sm:p-8 shadow-[0_20px_60px_-30px_hsl(225_73%_57%/0.4)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-mono tracking-[0.2em] uppercase text-primary mb-1">● Get started</p>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
              Ready to see Ovasyt in action?
            </h3>
          </div>
          <Link
            to="/signup/company"
            className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-[hsl(265_70%_58%)] px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.03] transition-all"
          >
            Book a demo
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-2 max-w-sm">
            <span className="text-xl font-extrabold gradient-text">Ovasyt</span>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              Audit-ready procurement, VAT and Section&nbsp;18A compliance for
              South African NGOs, NPOs and SMEs — every rand approved, evidenced
              and reclaimable.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <a href="mailto:hello@ovasyt.tech" className="hover:text-primary transition-colors">
                  hello@ovasyt.tech
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                <span>+27 (0) 11 000 0000</span>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span>Johannesburg, South Africa</span>
              </li>
            </ul>
            <div className="mt-5 flex items-center gap-2">
              {[
                { Icon: Linkedin, label: "LinkedIn" },
                { Icon: Twitter, label: "Twitter" },
                { Icon: Facebook, label: "Facebook" },
              ].map(({ Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="p-2 rounded-lg border border-border/60 bg-white/70 text-slate-600 hover:text-primary hover:border-primary/50 hover:-translate-y-0.5 transition-all"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {[
            { title: "Product", items: PRODUCT },
            { title: "Company", items: COMPANY },
            { title: "Resources", items: RESOURCES },
          ].map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-slate-900 mb-4">{col.title}</h3>
              <ul className="space-y-3 text-sm text-slate-600">
                {col.items.map((item) => (
                  <li key={item.label}>
                    <Link
                      to={item.to}
                      className="inline-flex items-center gap-1 hover:text-primary transition-colors group"
                    >
                      <span className="story-link">{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} Ovasyt (Pty) Ltd. All rights reserved.</span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Built for South African SMEs · POPIA aligned · SARS-ready
          </span>
        </div>
      </div>
    </footer>
  );
}
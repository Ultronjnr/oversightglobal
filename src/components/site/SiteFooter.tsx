import { Link } from "react-router-dom";

export function SiteFooter() {
  return (
    <footer className="bg-background border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="max-w-xs">
            <span className="text-lg font-bold text-foreground">Ovasyt</span>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Smart procurement and approval software that gives South African
              SMEs control over every transaction and confidence in every audit.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4">Product</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>Procurement workflow</li>
              <li>AI invoice scanning</li>
              <li>Supplier portal</li>
              <li>
                <Link to="/pricing" className="hover:text-foreground transition-colors">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4">Company</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>About us</li>
              <li>Blog</li>
              <li>Contact us</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4">Get started</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <Link to="/signup/company" className="hover:text-foreground transition-colors">
                  Book a demo
                </Link>
              </li>
              <li>Talk to sales</li>
              <li>hello@ovasyt.com</li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Ovasyt (Pty) Ltd. All rights reserved.</span>
          <span>Built for South African SMEs · POPIA aligned</span>
        </div>
      </div>
    </footer>
  );
}
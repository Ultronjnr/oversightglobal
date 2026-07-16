import { useState } from "react";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PageSeo } from "@/components/site/PageSeo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";

const LOCAL_BUSINESS_JSONLD = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Ovasyt",
  email: "hello@ovasyt.tech",
  url: "https://ovasyt.tech/",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Johannesburg",
    addressCountry: "ZA",
  },
  areaServed: "ZA",
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "08:00",
      closes: "17:00",
    },
  ],
};

export default function Contact() {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "");
    const email = String(data.get("email") ?? "");
    const message = String(data.get("message") ?? "");
    const subject = encodeURIComponent(`Ovasyt enquiry from ${name}`);
    const body = encodeURIComponent(`${message}\n\n— ${name} <${email}>`);
    window.location.href = `mailto:hello@ovasyt.tech?subject=${subject}&body=${body}`;
    toast.success("Opening your email client…");
    setTimeout(() => setSubmitting(false), 500);
  };

  return (
    <div className="min-h-screen bg-background">
      <PageSeo
        title="Contact Ovasyt | Book a demo or talk to sales"
        description="Get in touch with Ovasyt — book a demo, ask about pricing, or speak to our team about procurement, VAT and Section 18A compliance for South African NGOs."
        path="/contact"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(LOCAL_BUSINESS_JSONLD)}
        </script>
      </Helmet>
      <SiteNav />
      <main>
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-xs font-mono font-semibold tracking-[0.2em] uppercase text-primary mb-3">
              ● Contact us
            </p>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight mb-6">
              Talk to the Ovasyt team.
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed mb-8">
              Book a walkthrough, ask about pricing, or send us a note about
              your organisation's procurement, VAT or Section 18A compliance
              needs. We usually reply within one business day.
            </p>

            <ul className="space-y-4 text-sm text-slate-700">
              <li className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900">Email</p>
                  <a href="mailto:hello@ovasyt.tech" className="text-primary hover:underline">
                    hello@ovasyt.tech
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900">Based in</p>
                  <p>Johannesburg, South Africa · Remote-first team</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900">Support hours</p>
                  <p>Mon–Fri, 08:00–17:00 SAST</p>
                </div>
              </li>
            </ul>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-border/60 bg-card/80 p-6 sm:p-8 space-y-5"
          >
            <div className="grid gap-2">
              <Label htmlFor="name">Your name</Label>
              <Input id="name" name="name" required placeholder="Jane Dube" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" name="email" type="email" required placeholder="jane@ngo.org.za" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="organisation">Organisation</Label>
              <Input id="organisation" name="organisation" placeholder="Sunrise Community Trust" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="message">How can we help?</Label>
              <Textarea id="message" name="message" required rows={5} placeholder="Tell us about your workflow and what you'd like to improve." />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Sending…" : "Send message"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              By sending you agree to be contacted about Ovasyt.
            </p>
          </form>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
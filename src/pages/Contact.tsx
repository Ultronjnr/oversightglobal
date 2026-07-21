import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PageSeo } from "@/components/site/PageSeo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, MapPin, Clock, Phone, Linkedin, Twitter, Facebook, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";

const LOCAL_BUSINESS_JSONLD = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Ovasyt",
  email: "info@ovasyt.tech",
  telephone: "+27849231405",
  url: "https://ovasyt.tech/",
  address: [
    {
      "@type": "PostalAddress",
      streetAddress: "2 Willowbrooke, Vlakhaas Ave, Weltevredenpark",
      addressLocality: "Roodepoort",
      postalCode: "1709",
      addressCountry: "ZA",
    },
    {
      "@type": "PostalAddress",
      streetAddress: "96 Rivonia Road",
      addressLocality: "Sandton",
      addressRegion: "Gauteng",
      postalCode: "2196",
      addressCountry: "ZA",
    },
  ],
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

const SUBJECTS = [
  "Book a demo",
  "Pricing enquiry",
  "Section 18A / donations",
  "VAT & compliance",
  "Partnerships",
  "Support",
  "Other",
];

export default function Contact() {
  const [submitting, setSubmitting] = useState(false);
  const [subject, setSubject] = useState("Book a demo");

  const schema = z.object({
    name: z.string().trim().min(1, "Please enter your name").max(120),
    email: z.string().trim().email("Enter a valid email address").max(255),
    phone: z
      .string()
      .trim()
      .min(6, "Enter a valid phone number")
      .max(40),
    organisation: z.string().trim().max(160).optional().or(z.literal("")),
    subject: z.string().trim().min(1).max(120),
    message: z.string().trim().min(5, "Tell us a little more").max(4000),
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    const parsed = schema.safeParse({
      name: data.get("name"),
      email: data.get("email"),
      phone: data.get("phone"),
      organisation: data.get("organisation") ?? "",
      subject,
      message: data.get("message"),
    });

    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? "Please check the form.";
      toast.error(first);
      setSubmitting(false);
      return;
    }

    try {
      const { data: res, error } = await supabase.functions.invoke("submit-contact", {
        body: { ...parsed.data, source: "contact-page" },
      });
      if (error) {
        const detail =
          (error as any)?.context && typeof (error as any).context.text === "function"
            ? await (error as any).context.text()
            : error.message;
        console.error("submit-contact failed:", detail);
        throw new Error("We couldn't send your message. Please try again or email info@ovasyt.tech.");
      }
      if (!res?.ok) {
        throw new Error("We couldn't send your message. Please try again or email info@ovasyt.tech.");
      }
      toast.success("Message sent! We'll reply within one business day.");
      form.reset();
      setSubject("Book a demo");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PageSeo
        title="Contact Ovasyt | Book a demo or talk to sales"
        description="Book a demo, ask about pricing, or speak to our team about procurement, VAT and Section 18A compliance for South African NGOs. Roodepoort & Sandton offices."
        path="/contact"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(LOCAL_BUSINESS_JSONLD)}
        </script>
      </Helmet>
      <SiteNav />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50 to-[hsl(220_40%_96%)] pt-20 pb-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(50% 60% at 10% 0%, hsl(225 73% 57% / 0.10), transparent 70%), radial-gradient(50% 60% at 95% 100%, hsl(200 90% 55% / 0.12), transparent 70%)",
            }}
          />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-xs font-mono font-semibold tracking-[0.2em] uppercase text-primary mb-3">
              ● Contact us
            </p>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight mb-4">
              Let's talk about your{" "}
              <span className="bg-gradient-to-r from-primary to-[hsl(200_90%_52%)] bg-clip-text text-transparent">
                next audit-ready year
              </span>
              .
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Book a walkthrough, ask about pricing, or speak to our team about
              procurement, VAT and Section 18A compliance. We usually reply
              within one business day.
            </p>
          </div>
        </section>

        {/* Form + info */}
        <section className="relative -mt-8 pb-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-8 lg:grid-cols-[1fr_1.15fr]">
            {/* Info panel */}
            <div className="rounded-2xl border border-white/70 bg-white/70 backdrop-blur-xl p-7 shadow-[0_20px_60px_-30px_hsl(225_73%_57%/0.35)]">
              <h2 className="text-lg font-bold text-slate-900 mb-6">Reach us directly</h2>

              <ul className="space-y-5 text-sm text-slate-700">
                <li className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Email</p>
                    <a href="mailto:info@ovasyt.tech" className="text-primary hover:underline">
                      info@ovasyt.tech
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Phone</p>
                    <a href="tel:+27849231405" className="text-primary hover:underline font-mono">
                      +27 84 923 1405
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Roodepoort office</p>
                    <p className="text-slate-600">
                      2 Willowbrooke, Vlakhaas Ave,<br />
                      Weltevredenpark, Roodepoort, 1709
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Sandton office</p>
                    <p className="text-slate-600">
                      96 Rivonia Road, Sandton, Gauteng, 2196
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Support hours</p>
                    <p className="text-slate-600">Mon–Fri, 08:00–17:00 SAST</p>
                  </div>
                </li>
              </ul>

              <div className="mt-8 pt-6 border-t border-border/60">
                <p className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500 mb-3">
                  Follow us
                </p>
                <div className="flex items-center gap-2">
                  {[
                    { Icon: Linkedin, label: "LinkedIn", href: "https://www.linkedin.com/company/ovasyt" },
                    { Icon: Twitter, label: "Twitter", href: "https://twitter.com/ovasyt" },
                    { Icon: Facebook, label: "Facebook", href: "https://www.facebook.com/ovasyt" },
                  ].map(({ Icon, label, href }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={label}
                      className="p-2 rounded-lg border border-border/60 bg-white text-slate-600 hover:text-primary hover:border-primary/50 hover:-translate-y-0.5 transition-all"
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-white/70 bg-white/80 backdrop-blur-xl p-6 sm:p-8 shadow-[0_20px_60px_-30px_hsl(225_73%_57%/0.35)] space-y-5"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="name">Your name</Label>
                  <Input id="name" name="name" required placeholder="Jane Dube" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="organisation">Organisation</Label>
                  <Input id="organisation" name="organisation" placeholder="Sunrise Community Trust" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Work email</Label>
                  <Input id="email" name="email" type="email" required placeholder="jane@ngo.org.za" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input id="phone" name="phone" type="tel" required placeholder="+27 82 123 4567" />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="subject">Subject</Label>
                <select
                  id="subject"
                  name="subject"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="message">How can we help?</Label>
                <Textarea
                  id="message"
                  name="message"
                  required
                  rows={5}
                  placeholder="Tell us about your workflow and what you'd like to improve."
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full group bg-gradient-to-r from-primary to-[hsl(200_90%_52%)] text-primary-foreground font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.01] transition-all"
              >
                {submitting ? "Sending…" : (
                  <>
                    Send message
                    <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                By sending you agree to be contacted about Ovasyt. We reply within one business day.
              </p>
            </form>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
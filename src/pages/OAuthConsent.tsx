import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

// Minimal typed wrapper for the beta supabase.auth.oauth namespace.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};
const oauthApi = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauthApi().approveAuthorization(authorizationId)
      : await oauthApi().denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("No redirect returned by the authorization server.");
    }
    window.location.href = target;
  }

  return (
    <div className="min-h-screen hero-gradient flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-card/90 backdrop-blur-xl border border-border/60 rounded-2xl shadow-xl p-8">
        <div className="flex justify-center mb-6">
          <Logo size="lg" />
        </div>
        {error ? (
          <p className="text-sm text-destructive text-center">
            Could not load this authorization request: {error}
          </p>
        ) : !details ? (
          <p className="text-sm text-muted-foreground text-center">Loading…</p>
        ) : (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-foreground">
                Connect {details.client?.name ?? "an app"} to your account
              </h1>
              <p className="text-sm text-muted-foreground">
                This lets {details.client?.name ?? "the client"} access Oversight
                data on your behalf, scoped to what you can already see.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => decide(false)}
              >
                Deny
              </Button>
              <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
                Approve
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
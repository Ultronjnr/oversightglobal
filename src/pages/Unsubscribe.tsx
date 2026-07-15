import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Mail, CheckCircle2, XCircle } from "lucide-react";

type State = "loading" | "valid" | "already" | "invalid" | "success" | "error";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<State>("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const validate = async () => {
      if (!token) {
        setState("invalid");
        return;
      }
      try {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } }
        );
        const data = await response.json();
        if (response.ok && data.valid) {
          setState("valid");
        } else if (data.reason === "already_unsubscribed") {
          setState("already");
        } else {
          setState("invalid");
        }
      } catch {
        setState("invalid");
      }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "handle-email-unsubscribe",
        { body: { token } }
      );
      if (error) {
        setState("error");
      } else if (data?.success) {
        setState("success");
      } else if (data?.reason === "already_unsubscribed") {
        setState("already");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-foreground mb-4 text-center">
          Manage Email Subscriptions
        </h1>
        <Card className="w-full shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Email Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === "loading" && (
            <p className="text-sm text-muted-foreground">Validating your request…</p>
          )}

          {state === "valid" && (
            <>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to unsubscribe from these emails?
              </p>
              <Button onClick={handleUnsubscribe} disabled={submitting} className="w-full">
                {submitting ? "Processing…" : "Confirm Unsubscribe"}
              </Button>
            </>
          )}

          {state === "success" && (
            <div className="flex flex-col items-center text-center gap-2 py-4">
              <CheckCircle2 className="h-10 w-10 text-success" />
              <p className="text-sm text-muted-foreground">
                You've been unsubscribed successfully.
              </p>
            </div>
          )}

          {state === "already" && (
            <div className="flex flex-col items-center text-center gap-2 py-4">
              <CheckCircle2 className="h-10 w-10 text-success" />
              <p className="text-sm text-muted-foreground">
                You're already unsubscribed.
              </p>
            </div>
          )}

          {(state === "invalid" || state === "error") && (
            <div className="flex flex-col items-center text-center gap-2 py-4">
              <XCircle className="h-10 w-10 text-destructive" />
              <p className="text-sm text-muted-foreground">
                {state === "invalid"
                  ? "This unsubscribe link is invalid or has expired."
                  : "Something went wrong. Please try again later."}
              </p>
            </div>
          )}
        </CardContent>
        </Card>
      </div>
    </div>
  );
}
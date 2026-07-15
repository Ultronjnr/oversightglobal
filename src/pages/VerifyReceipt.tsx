import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2, ShieldCheck, ShieldX } from "lucide-react";
import { PageSeo } from "@/components/site/PageSeo";

export default function VerifyReceipt() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const hash = params.get("h") || "";
  const [state, setState] = useState<"loading" | "valid" | "invalid">("loading");
  const [info, setInfo] = useState<any>(null);

  useEffect(() => {
    (async () => {
      if (!id || !hash) { setState("invalid"); return; }
      const { data, error } = await supabase.rpc("verify_donation_receipt", {
        _id: id, _hash: hash,
      } as any);
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) { setState("invalid"); return; }
      setInfo(row);
      setState("valid");
    })();
  }, [id, hash]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(220,30%,97%)] p-4">
      <PageSeo
        title="Verify Section 18A Receipt | Ovasyt"
        description="Confirm the authenticity of a Section 18A donation receipt issued by an Ovasyt-registered NGO. Instant, tamper-evident receipt verification."
        path="/verify/receipt"
      />
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        {state === "loading" && (
          <><Loader2 className="h-10 w-10 mx-auto animate-spin text-muted-foreground" /><p>Verifying receipt…</p></>
        )}
        {state === "valid" && (
          <>
            <ShieldCheck className="h-14 w-14 mx-auto text-success" />
            <h1 className="text-xl font-bold">Valid Section 18A Receipt</h1>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><span className="font-medium text-foreground">Receipt No:</span> {info?.receipt_number}</p>
              <p><span className="font-medium text-foreground">Status:</span> {info?.status}</p>
              {info?.issued_at && <p><span className="font-medium text-foreground">Issued:</span> {new Date(info.issued_at).toLocaleDateString("en-ZA")}</p>}
              {info?.snapshot?.donor && <p><span className="font-medium text-foreground">Donor:</span> {info.snapshot.donor}</p>}
            </div>
          </>
        )}
        {state === "invalid" && (
          <>
            <ShieldX className="h-14 w-14 mx-auto text-destructive" />
            <h1 className="text-xl font-bold">Receipt Not Verified</h1>
            <p className="text-sm text-muted-foreground">This verification link is invalid or the receipt could not be confirmed.</p>
          </>
        )}
      </Card>
    </div>
  );
}
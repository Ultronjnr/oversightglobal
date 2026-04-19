import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  onSetDate?: () => void;
}

export function VatCountdownCard({ onSetDate }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [vatRegistered, setVatRegistered] = useState(false);
  const [nextDate, setNextDate] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("freemium_business_profiles")
        .select("vat_registered, next_vat_submission_date")
        .eq("user_id", user.id)
        .maybeSingle();
      setVatRegistered(!!data?.vat_registered);
      setNextDate(data?.next_vat_submission_date ?? null);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) return null;

  // Not VAT registered or no date set
  if (!vatRegistered || !nextDate) {
    return (
      <Card className="border-muted bg-muted/30">
        <CardContent className="py-5 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <CalendarClock className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              No VAT submission date set
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Add your VAT details in Profile Settings to track your next submission.
            </p>
          </div>
          {onSetDate && (
            <Button variant="outline" size="sm" onClick={onSetDate}>
              Set up
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const overdue = diffDays < 0;
  const urgent = diffDays >= 0 && diffDays <= 7;

  const tone = overdue
    ? "border-destructive/40 bg-destructive/5"
    : urgent
    ? "border-warning/40 bg-warning/5"
    : "border-primary/30 bg-primary/5";

  const iconBg = overdue
    ? "bg-destructive/15"
    : urgent
    ? "bg-warning/15"
    : "bg-primary/10";

  const iconColor = overdue
    ? "text-destructive"
    : urgent
    ? "text-warning"
    : "text-primary";

  const formattedDate = due.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const label = overdue
    ? `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"}`
    : diffDays === 0
    ? "Due today"
    : `${diffDays} day${diffDays === 1 ? "" : "s"} remaining`;

  return (
    <Card className={tone}>
      <CardContent className="py-5 flex items-start gap-3">
        <div className={`p-2 rounded-lg ${iconBg}`}>
          {overdue ? (
            <AlertCircle className={`h-5 w-5 ${iconColor}`} />
          ) : (
            <CalendarClock className={`h-5 w-5 ${iconColor}`} />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">
              Next VAT Submission
            </p>
            <span className={`text-xs font-medium ${iconColor}`}>{label}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Due on <span className="font-medium text-foreground">{formattedDate}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

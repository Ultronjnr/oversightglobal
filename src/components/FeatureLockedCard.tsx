import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SCOPE_FREEZE_MESSAGE } from "@/lib/feature-scope";

/**
 * Shown in place of a feature that is temporarily switched off during the
 * scope freeze. Purely informational — nothing is removed underneath.
 */
export function FeatureLockedCard({ title }: { title: string }) {
  return (
    <Card className="mx-auto max-w-xl p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Lock className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">{title} is coming soon</h2>
      <p className="mt-2 text-sm text-muted-foreground">{SCOPE_FREEZE_MESSAGE}</p>
    </Card>
  );
}

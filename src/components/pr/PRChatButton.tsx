import { useState, useEffect } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface PRChatButtonProps {
  prId: string;
  onClick: () => void;
}

/**
 * Message counts are batched: every chat button rendered in the same tick
 * shares ONE lightweight query instead of each row firing several requests.
 * (Per-row loading flooded the browser with requests and slowed the whole
 * portal, including invoice scanning.)
 */
let pending = new Map<string, Array<(n: number) => void>>();
let scheduled = false;

function flush() {
  scheduled = false;
  const batch = pending;
  pending = new Map();
  const ids = [...batch.keys()];
  if (ids.length === 0) return;
  void (async () => {
    const counts = new Map<string, number>();
    // Chunk to keep the request URL short.
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { data } = await supabase
        .from("pr_messages")
        .select("pr_id")
        .in("pr_id", chunk);
      for (const row of data ?? []) {
        counts.set(row.pr_id, (counts.get(row.pr_id) ?? 0) + 1);
      }
    }
    for (const [id, callbacks] of batch) {
      const n = counts.get(id) ?? 0;
      callbacks.forEach((cb) => cb(n));
    }
  })();
}

function loadMessageCount(prId: string, cb: (n: number) => void) {
  const list = pending.get(prId) ?? [];
  list.push(cb);
  pending.set(prId, list);
  if (!scheduled) {
    scheduled = true;
    setTimeout(flush, 0);
  }
}

export function PRChatButton({ prId, onClick }: PRChatButtonProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    loadMessageCount(prId, (n) => {
      if (active) setCount(n);
    });
    return () => {
      active = false;
    };
  }, [prId]);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 text-muted-foreground hover:text-foreground"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <MessageSquare className="h-4 w-4" />
      {count > 0 && (
        <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </Button>
  );
}

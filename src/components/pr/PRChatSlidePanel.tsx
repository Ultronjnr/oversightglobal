/**
 * PRChatSlidePanel
 *
 * A right-side slide-in panel that wraps PRChatPanel for a single PR.
 * Opens/closes via the `open` prop. Polling is managed inside PRChatPanel.
 * No animations, no global state, no realtime sockets.
 */
import { X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRChatPanel } from "./PRChatPanel";

interface PRChatSlidePanelProps {
  open: boolean;
  onClose: () => void;
  prId: string;
  transactionId: string;
}

export function PRChatSlidePanel({
  open,
  onClose,
  prId,
  transactionId,
}: PRChatSlidePanelProps) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop — sits above any open dialog overlay so the chat is never blocked */}
      <div
        className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-[101] h-full w-full max-w-md bg-background border-l border-border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <div>
              <p className="font-semibold text-sm text-foreground">Transaction Conversation</p>
              <p className="text-xs text-muted-foreground font-mono">{transactionId}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Chat body — fills remaining height */}
        <div className="flex-1 overflow-hidden">
          <PRChatPanel prId={prId} transactionId={transactionId} />
        </div>
      </div>
    </>
  );
}

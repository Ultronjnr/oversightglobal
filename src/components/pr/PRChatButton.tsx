import { useState, useEffect } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPRMessages } from "@/services/pr-messaging.service";

interface PRChatButtonProps {
  prId: string;
  onClick: () => void;
}

export function PRChatButton({ prId, onClick }: PRChatButtonProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    getPRMessages(prId).then((result) => {
      if (result.success && result.data) {
        setCount(result.data.length);
      }
    });
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

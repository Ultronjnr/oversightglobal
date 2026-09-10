import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageCircleQuestion,
  ReceiptText,
  ScanLine,
  FileText,
  Truck,
  Wallet,
  BarChart3,
  LayoutDashboard,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import oviLogo from "@/assets/ovasyt-logo.png";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  route?: string | null;
  routeLabel?: string | null;
}

interface QuickAction {
  label: string;
  icon: typeof ReceiptText;
  question: string;
  route?: string;
}

/** Guided shortcuts — role aware, so people only see what they can reach. */
function quickActions(role?: string | null): QuickAction[] {
  const finance = role === "FINANCE" || role === "ADMIN";
  const supplier = role === "SUPPLIER";

  if (supplier) {
    return [
      { label: "Submit a quote", icon: FileText, question: "How do I submit a quote for a request?", route: "/supplier/portal" },
      { label: "Negotiations", icon: Truck, question: "How do counter offers work?", route: "/supplier/portal?tab=negotiations" },
      { label: "Upload an invoice", icon: ReceiptText, question: "How do I upload my invoice after a quote is accepted?", route: "/supplier/portal?tab=invoices" },
      { label: "Understand my dashboard", icon: LayoutDashboard, question: "Explain what I see on my supplier dashboard." },
    ];
  }

  const base: QuickAction[] = [
    { label: "Capture an expense", icon: ReceiptText, question: "How do I capture an expense?" },
    { label: "Scan an invoice", icon: ScanLine, question: "How do I scan an invoice with Scan AI?" },
    { label: "Purchase requisition", icon: FileText, question: "How do I create and track a purchase requisition?" },
    { label: "Supplier process", icon: Truck, question: "Explain the supplier quote to invoice process." },
  ];

  if (finance) {
    base.push(
      { label: "Payments", icon: Wallet, question: "How do I pay approved items and create a payment batch?", route: "/finance/portal?tab=payments" },
      { label: "Reports", icon: BarChart3, question: "What reports can I run and how do I export them?", route: "/finance/portal?tab=reports" },
    );
  }

  base.push({
    label: "Understanding the dashboard",
    icon: LayoutDashboard,
    question: "Explain what the numbers on my dashboard mean.",
  });

  return base;
}

/**
 * Ovi — the in-app assistant. Opens from the top bar (next to the notification
 * bell) so it never conflicts with the floating Scan Invoice button.
 */
export function OviAssistant() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const actions = quickActions(role);

  const ask = async (question: string, jumpTo?: string) => {
    if (!question.trim() || busy) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");
    setBusy(true);

    try {
      const { data, error } = await supabase.functions.invoke("ovi-assistant", {
        body: { messages: next.map(({ role: r, content }) => ({ role: r, content })), role },
      });
      if (error) throw error;

      setMessages([
        ...next,
        {
          role: "assistant",
          content:
            data?.answer ??
            "Ovi could not answer that right now. Please try again in a moment.",
          route: data?.route ?? jumpTo ?? null,
          routeLabel: data?.routeLabel ?? (jumpTo ? "Take me there" : null),
        },
      ]);
    } catch {
      setMessages([
        ...next,
        {
          role: "assistant",
          content:
            "Ovi is unavailable right now, so I can't answer that. Everything else in the workspace still works — use the menu on the left, or try again shortly.",
          route: jumpTo ?? null,
          routeLabel: jumpTo ? "Take me there" : null,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const go = (route: string) => {
    setOpen(false);
    navigate(route);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Ask Ovi, the Ovasyt assistant"
        title="Ask Ovi"
        onClick={() => setOpen(true)}
        className="relative h-9 w-9 text-primary hover:text-primary hover:bg-primary/10"
      >
        <MessageCircleQuestion className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col gap-0"
        >
          <SheetHeader className="p-4 border-b border-border/40 text-left">
            <SheetTitle className="flex items-center gap-3">
              <img
                src={oviLogo}
                alt="Ovi, the Ovasyt assistant"
                className="h-9 w-9 rounded-lg object-cover"
              />
              <span>Ovi AI Assistant</span>
            </SheetTitle>
            <SheetDescription>
              Ask anything about Ovasyt, or pick what you need help with.
            </SheetDescription>
          </SheetHeader>

          {/* Guided choices */}
          <div className="p-3 border-b border-border/40 grid grid-cols-2 gap-2">
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => ask(a.question, a.route)}
                className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-left text-xs font-medium hover:bg-primary/10 hover:border-primary/30 transition-colors"
              >
                <a.icon className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">{a.label}</span>
              </button>
            ))}
          </div>

          <Conversation className="flex-1 min-h-0">
            <ConversationContent className="gap-3">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground px-1">
                  For example: “How do I approve a requisition?” or “Where do I
                  find Section 18A receipts?”
                </p>
              )}
              {messages.map((m, i) => (
                <div key={i} className="space-y-2">
                  <Message from={m.role}>
                    <MessageContent>
                      <MessageResponse>{m.content}</MessageResponse>
                    </MessageContent>
                  </Message>
                  {m.role === "assistant" && m.route && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="gap-1.5 ml-1"
                      onClick={() => go(m.route as string)}
                    >
                      {m.routeLabel || "Take me there"}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              {busy && <Shimmer className="text-sm px-1">Ovi is thinking…</Shimmer>}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="p-3 border-t border-border/40">
            <PromptInput
              onSubmit={(_, e) => {
                e.preventDefault();
                ask(input);
              }}
            >
              <PromptInputTextarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Ovi how to do something…"
              />
              <PromptInputFooter className="justify-end">
                <PromptInputSubmit
                  status={busy ? "submitted" : undefined}
                  disabled={busy || !input.trim()}
                />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

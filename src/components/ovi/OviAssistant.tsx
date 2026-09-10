import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot,
  ReceiptText,
  ScanLine,
  FileText,
  Truck,
  Wallet,
  BarChart3,
  LayoutDashboard,
  ArrowRight,
  X,
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
import { ScanInvoiceModal } from "@/components/finance/ScanInvoiceModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import oviLogo from "@/assets/ovasyt-logo.png";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  route?: string | null;
  routeLabel?: string | null;
  /** In-app action the user can run straight from the answer. */
  action?: "scan" | null;
  actionLabel?: string | null;
}

interface QuickAction {
  label: string;
  icon: typeof ReceiptText;
  question: string;
  /** Written walkthrough of the real Ovasyt workflow. */
  steps: string[];
  route?: string;
  routeLabel?: string;
  action?: "scan";
  actionLabel?: string;
}

function portalFor(role?: string | null) {
  switch (role) {
    case "FINANCE":
      return "/finance/portal";
    case "HOD":
      return "/hod/portal";
    case "ADMIN":
      return "/admin/portal";
    case "SUPPLIER":
      return "/supplier/portal";
    default:
      return "/employee/portal";
  }
}

/** Guided shortcuts — role aware, each tied to a real Ovasyt workflow. */
function quickActions(role?: string | null): QuickAction[] {
  const finance = role === "FINANCE" || role === "ADMIN";
  const supplier = role === "SUPPLIER";
  const portal = portalFor(role);

  if (supplier) {
    return [
      {
        label: "Submit a quote",
        icon: FileText,
        question: "How do I submit a quote for a request?",
        steps: [
          "Open **Incoming Requests** in your supplier workspace.",
          "Click **Submit Quote** on the request you want to price.",
          "Quantities are fixed — enter only **your price per unit**; the row total updates live.",
          "Attach your formal quote document and submit. Finance sees it immediately.",
        ],
        route: "/supplier/portal",
        routeLabel: "Open incoming requests",
      },
      {
        label: "Negotiations",
        icon: Truck,
        question: "How do counter offers work?",
        steps: [
          "Counter offers from finance land in the **Negotiations** tab.",
          "Open the offer to see the price they proposed per item.",
          "Accept it, or send back a revised price per unit.",
          "Once accepted, the requisition moves to invoicing.",
        ],
        route: "/supplier/portal?tab=negotiations",
        routeLabel: "Open negotiations",
      },
      {
        label: "Upload an invoice",
        icon: ReceiptText,
        question: "How do I upload my invoice after a quote is accepted?",
        steps: [
          "Go to the **Invoices** tab — accepted quotes are listed there.",
          "Click **Upload Invoice** on the accepted job.",
          "Attach the invoice PDF and confirm the amount matches the accepted quote.",
          "Finance marks it awaiting payment and it joins their payment run.",
        ],
        route: "/supplier/portal?tab=invoices",
        routeLabel: "Open invoices",
      },
      {
        label: "Understand my dashboard",
        icon: LayoutDashboard,
        question: "Explain what I see on my supplier dashboard.",
        steps: [
          "**Incoming requests** — jobs waiting for your price.",
          "**Quotes submitted** — priced and awaiting a decision.",
          "**Negotiations** — counter offers needing your reply.",
          "**Invoices** — accepted work you have billed for, and its payment status.",
        ],
        route: "/supplier/portal",
        routeLabel: "Open my dashboard",
      },
    ];
  }

  const base: QuickAction[] = [
    {
      label: "Capture an expense",
      icon: ReceiptText,
      question: "How do I capture an expense?",
      steps: [
        "Click **Scan Invoice** — Ovi can open it for you below.",
        "Upload the invoice or receipt (PDF or photo). Scan AI reads it for you.",
        "Check the supplier, date, line items and total, then pick a category, project and donor.",
        "Confirm and save — the expense is recorded and, once approved, joins the payment queue.",
      ],
      action: "scan",
      actionLabel: "Open Scan Invoice",
    },
    {
      label: "Scan an invoice",
      icon: ScanLine,
      question: "How do I scan an invoice with Scan AI?",
      steps: [
        "Open **Scan Invoice** and drop in the PDF or image — multi-page PDFs are merged automatically.",
        "Wait for the extraction; repeat scans of the same file load instantly from cache.",
        "Review every field on the preview screen — you can fix anything before saving.",
        "Missing a project, donor or category? Create it inline at the bottom of each dropdown.",
      ],
      action: "scan",
      actionLabel: "Open Scan Invoice",
    },
    {
      label: "Requisition",
      icon: FileText,
      question: "How do I create and track a purchase requisition?",
      steps: [
        "In your workspace click **New Purchase Requisition**.",
        "Fill in the need, the project and donor it belongs to, and the required-by date.",
        "Add each **supplier quote** you collected, with the price per item and the quote attachment.",
        "Submit — it goes to your HOD, then finance, and you can follow it in the requisition list and chat.",
      ],
      route: portal,
      routeLabel: "Open my workspace",
    },
    {
      label: "Supplier process",
      icon: Truck,
      question: "Explain the supplier quote to invoice process.",
      steps: [
        "A requisition is sent to suppliers for quotes, or you attach the quotes yourself.",
        "Finance compares the quotes side by side and selects one — the cheapest is preselected.",
        "The chosen supplier uploads the invoice against the accepted quote.",
        "Finance marks it awaiting payment, and it moves into **Approved – Not Paid**.",
      ],
      route: finance ? "/finance/portal?tab=quotes" : portal,
      routeLabel: finance ? "Open supplier quotes" : "Open my workspace",
    },
  ];

  if (finance) {
    base.push(
      {
        label: "Payments",
        icon: Wallet,
        question: "How do I pay approved items and create a payment batch?",
        steps: [
          "Open **Approved – Not Paid** to see everything cleared for payment.",
          "Expand a row to preview the invoice and line items before you commit.",
          "Select the items and click **Create Payment Batch** — they leave the queue immediately.",
          "In **Batches**, export the payment file or PDF, then upload the proof of payment.",
        ],
        route: "/finance/portal?tab=payments",
        routeLabel: "Open payment queue",
      },
      {
        label: "Reports",
        icon: BarChart3,
        question: "What reports can I run and how do I export them?",
        steps: [
          "Open the **Reports** workspace.",
          "Choose the report — expense statement, payables ageing, project or donor spend.",
          "Set the date range and filters you need.",
          "Export as a branded PDF or Excel file.",
        ],
        route: "/finance/portal?tab=reports",
        routeLabel: "Open reports",
      },
    );
  }

  base.push({
    label: "Dashboard",
    icon: LayoutDashboard,
    question: "Explain what the numbers on my dashboard mean.",
    steps: [
      "The cards at the top are live totals for your organisation — tap one to expand the detail.",
      "Each card links straight to the list behind the number.",
      "Pending items are things waiting on someone; approved items are cleared for payment.",
      "Use the side menu to jump to any workspace: requisitions, suppliers, payments, reports.",
    ],
    route: portal,
    routeLabel: "Open my dashboard",
  });

  return base;
}

/**
 * Ovi — the in-app assistant. Floating speech bubble in the bottom-right of the
 * portal, stacked above the Scan Invoice button so the two never collide.
 */
export function OviAssistant() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const actions = quickActions(role);

  /** Guided action: answer instantly from the real workflow, no model needed. */
  const runQuickAction = (a: QuickAction) => {
    setMessages((prev) => [
      ...prev,
      { role: "user", content: a.question },
      {
        role: "assistant",
        content: `**${a.label}**\n\n${a.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
        route: a.route ?? null,
        routeLabel: a.routeLabel ?? (a.route ? "Take me there" : null),
        action: a.action ?? null,
        actionLabel: a.actionLabel ?? null,
      },
    ]);
  };

  const ask = async (question: string) => {
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
          route: data?.route ?? null,
          routeLabel: data?.routeLabel ?? null,
        },
      ]);
    } catch {
      setMessages([
        ...next,
        {
          role: "assistant",
          content:
            "Ovi is unavailable right now, so I can't answer that. Everything else in the workspace still works — use the shortcuts above or the menu on the left, and try again shortly.",
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

  const openScan = () => {
    setOpen(false);
    setScanOpen(true);
  };

  return (
    <>
      {/* Floating AI action — bottom right, aligned above Scan Invoice */}
      <Button
        type="button"
        size="icon"
        aria-label="Ask Ovi, the Ovasyt assistant"
        title="Ask Ovi"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-[calc(8rem+env(safe-area-inset-bottom))] md:bottom-[4.75rem] right-4 sm:right-6 z-40 h-11 w-11 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 hover:shadow-primary/50 hover:scale-105 active:scale-95 transition-all animate-fade-in"
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
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
                onClick={() => runQuickAction(a)}
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
                  Pick a shortcut above for a step-by-step walkthrough, or ask
                  something like “How do I approve a requisition?” or “Where do I
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
                  {m.role === "assistant" && (m.route || m.action) && (
                    <div className="flex flex-wrap gap-2 ml-1">
                      {m.action === "scan" && (
                        <Button size="sm" className="gap-1.5" onClick={openScan}>
                          <ScanLine className="h-3.5 w-3.5" />
                          {m.actionLabel || "Open Scan Invoice"}
                        </Button>
                      )}
                      {m.route && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="gap-1.5"
                          onClick={() => go(m.route as string)}
                        >
                          {m.routeLabel || "Take me there"}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
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

      <ScanInvoiceModal open={scanOpen} onOpenChange={setScanOpen} />
    </>
  );
}

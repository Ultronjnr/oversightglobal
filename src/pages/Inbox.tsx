/**
 * Inbox (Layer 5)
 *
 * One place to see every requisition conversation the user is part of.
 * Threads refresh on a 15s poll (matching the PR chat polling architecture),
 * and opening a thread marks it read and reveals the existing chat panel.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageSeo } from "@/components/site/PageSeo";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Search, Inbox as InboxIcon, RefreshCw, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { getPortalNavItems } from "@/lib/admin-nav";
import { PRChatSlidePanel } from "@/components/pr/PRChatSlidePanel";
import {
  getInboxThreads,
  markThreadRead,
  type InboxThread,
} from "@/services/pr-inbox.service";

const POLL_MS = 15000;

export default function Inbox() {
  const { role } = useAuth();
  const { format: formatCurrency } = useCurrency();
  const [params, setParams] = useSearchParams();

  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [active, setActive] = useState<InboxThread | null>(null);

  const navItems = useMemo(
    () =>
      role === "SUPPLIER"
        ? [{ label: "Dashboard", href: "/supplier/portal" }]
        : getPortalNavItems(role),
    [role]
  );

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    const result = await getInboxThreads();
    if (result.success) setThreads(result.data);
    setRefreshing(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Deep link: /inbox?pr=<id> opens that conversation straight away.
  useEffect(() => {
    const prId = params.get("pr");
    if (!prId || active || threads.length === 0) return;
    const match = threads.find((t) => t.prId === prId);
    if (match) openThread(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, threads]);

  const openThread = (thread: InboxThread) => {
    markThreadRead(thread.prId);
    setThreads((prev) =>
      prev.map((t) => (t.prId === thread.prId ? { ...t, unreadCount: 0 } : t))
    );
    setActive(thread);
  };

  const closeThread = () => {
    setActive(null);
    if (params.get("pr")) {
      params.delete("pr");
      setParams(params, { replace: true });
    }
    load(true);
  };

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return threads.filter((t) => {
      if (unreadOnly && t.unreadCount === 0) return false;
      if (!term) return true;
      return (
        t.transactionId?.toLowerCase().includes(term) ||
        t.lastMessage.toLowerCase().includes(term) ||
        (t.requestedByName || "").toLowerCase().includes(term) ||
        t.lastSenderName.toLowerCase().includes(term)
      );
    });
  }, [threads, search, unreadOnly]);

  const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  return (
    <DashboardLayout title="Messages" navItems={navItems as never}>
      <PageSeo
        title="Messages | Ovasyt"
        description="All your requisition conversations in one inbox."
        noindex
      />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <InboxIcon className="h-6 w-6 text-primary" />
              Messages
            </h1>
            <p className="text-sm text-muted-foreground">
              Every requisition conversation you have access to, newest first.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {totalUnread > 0 && (
              <Badge className="rounded-full">{totalUnread} unread</Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => load()}
              disabled={refreshing}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by transaction ID, person or message"
              className="pl-9 bg-background"
            />
          </div>
          <Button
            variant={unreadOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setUnreadOnly((v) => !v)}
          >
            Unread only
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <Card className="p-10 text-center">
            <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium text-foreground">No conversations yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              {threads.length === 0
                ? "Messages sent on a requisition will appear here."
                : "No conversation matches your filters."}
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {visible.map((t) => (
              <button
                key={t.prId}
                onClick={() => openThread(t)}
                className={`w-full text-left rounded-lg border p-4 transition-colors hover:bg-muted/50 ${
                  t.unreadCount > 0 ? "border-primary/40 bg-primary/[0.03]" : "bg-card"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {t.transactionId}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {t.status.replace(/_/g, " ")}
                    </Badge>
                    {t.unreadCount > 0 && (
                      <Badge className="text-[10px] rounded-full">
                        {t.unreadCount} new
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatCurrency(t.totalAmount)}</span>
                    <span>
                      {formatDistanceToNow(new Date(t.lastMessageAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>

                <p className="mt-2 text-sm text-muted-foreground truncate flex items-center gap-1.5">
                  {t.isLastSystemNote && (
                    <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="font-medium text-foreground">
                    {t.isLastSystemNote ? "System" : t.lastSenderName}:
                  </span>
                  {t.lastMessage}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  {t.requestedByName ? `Requested by ${t.requestedByName} · ` : ""}
                  {t.messageCount} message{t.messageCount === 1 ? "" : "s"}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {active && (
        <PRChatSlidePanel
          open
          onClose={closeThread}
          prId={active.prId}
          transactionId={active.transactionId}
        />
      )}
    </DashboardLayout>
  );
}

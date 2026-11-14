import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { NOTIFICATIONS_CHANGED } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Notification = Tables<"notifications">;

export const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(20);
    setItems(data ?? []);
    setLoading(false);
  }, [user]);

  const userId = user?.id;

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    window.addEventListener(NOTIFICATIONS_CHANGED, load);
    // New notifications (for example a message) show up without waiting for the next poll.
    const channel = userId
      ? supabase
          .channel(`notifications:${userId}:${Math.random().toString(36).slice(2)}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => { load(); })
          .subscribe()
      : null;
    return () => {
      clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_CHANGED, load);
      if (channel) supabase.removeChannel(channel);
    };
  }, [load, userId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const unread = items.filter(n => !n.read_at).length;

  const markRead = async (id: string) => {
    const readAt = new Date().toISOString();
    setItems(prev => prev.map(n => (n.id === id ? { ...n, read_at: readAt } : n)));
    await supabase.from("notifications").update({ read_at: readAt }).eq("id", id);
  };

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    const readAt = new Date().toISOString();
    setItems(prev => prev.map(n => (n.read_at ? n : { ...n, read_at: readAt })));
    await supabase.from("notifications").update({ read_at: readAt }).eq("user_id", user.id).is("read_at", null);
  };

  const openItem = (n: Notification) => {
    if (!n.read_at) markRead(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-display font-semibold text-sm">Notifications</h3>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={markAllRead} disabled={unread === 0}>
            <CheckCheck className="h-3.5 w-3.5 mr-1" /> Mark all read
          </Button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center">
              <BellOff className="h-8 w-8 mx-auto text-muted-foreground/60" />
              <div className="mt-3 text-sm font-medium">You are all caught up</div>
              <div className="text-xs text-muted-foreground mt-1">New activity on your ideas and proposals will show up here.</div>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map(n => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-muted transition-colors ${n.read_at ? "" : "bg-primary/5"}`}
                  >
                    <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-primary"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium leading-snug">{n.title}</span>
                      {n.body && <span className="block text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</span>}
                      <span className="block text-[11px] text-muted-foreground/80 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

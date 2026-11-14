import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { emit, MESSAGES_CHANGED, NOTIFICATIONS_CHANGED } from "@/lib/events";
import {
  ChatMessage, MAX_MESSAGE_LENGTH, displayName, groupByDay, initialsOf, isUuid, listTime,
} from "@/lib/messages";
import { cn } from "@/lib/utils";

type Peer = Pick<Tables<"profiles">, "id" | "full_name" | "avatar_url" | "headline" | "company">;

interface ConversationItem {
  id: string;
  name: string;
  avatar: string | null;
  headline: string | null;
  preview: string;
  at: string | null;
  unread: number;
}

const PersonAvatar = ({ name, src, className }: { name: string; src: string | null; className?: string }) => (
  <Avatar className={className}>
    {src && <AvatarImage src={src} alt={name} />}
    <AvatarFallback className="bg-gradient-primary text-white text-xs">{initialsOf(name)}</AvatarFallback>
  </Avatar>
);

const Messages = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const location = useLocation();
  const [params, setParams] = useSearchParams();

  const withParam = params.get("with");
  const peerId = isUuid(withParam) && withParam !== userId ? withParam : null;
  const stateDraft = (location.state as { draft?: string } | null)?.draft;

  const [conversations, setConversations] = useState<Awaited<ReturnType<typeof fetchConversations>>>([]);
  const [listLoading, setListLoading] = useState(true);
  const [peer, setPeer] = useState<Peer | null>(null);
  const [peerMissing, setPeerMissing] = useState(false);
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const peerIdRef = useRef<string | null>(null);
  const threadRef = useRef<ChatMessage[]>([]);
  peerIdRef.current = peerId;
  threadRef.current = thread;

  const loadConversations = useCallback(async () => {
    setConversations(await fetchConversations());
    setListLoading(false);
  }, []);

  // Opening a conversation marks what the other person sent as read, and clears its bell notification.
  const markRead = useCallback(async (otherId: string) => {
    if (!userId) return;
    const now = new Date().toISOString();
    setThread(prev => prev.map(m => (m.sender_id === otherId && m.recipient_id === userId && !m.read_at ? { ...m, read_at: now } : m)));
    await Promise.all([
      supabase.from("messages").update({ read_at: now })
        .eq("recipient_id", userId).eq("sender_id", otherId).is("read_at", null),
      supabase.from("notifications").update({ read_at: now })
        .eq("user_id", userId).eq("type", "message").eq("link", `/app/messages?with=${otherId}`).is("read_at", null),
    ]);
    emit(MESSAGES_CHANGED);
    emit(NOTIFICATIONS_CHANGED);
    loadConversations();
  }, [userId, loadConversations]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Load the open conversation.
  useEffect(() => {
    setDraft("");
    if (!userId || !peerId) { setThread([]); setPeer(null); setPeerMissing(false); return; }
    let cancelled = false;
    setThreadLoading(true);
    setPeerMissing(false);
    (async () => {
      const [{ data: msgs }, { data: profile }] = await Promise.all([
        supabase.from("messages").select("*")
          .or(`and(sender_id.eq.${userId},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${userId})`)
          .order("created_at", { ascending: false }).limit(200),
        supabase.from("profiles").select("id, full_name, avatar_url, headline, company").eq("id", peerId).maybeSingle(),
      ]);
      if (cancelled) return;
      const ordered = [...(msgs ?? [])].reverse();
      setThread(ordered);
      setPeer(profile);
      setPeerMissing(!profile);
      setThreadLoading(false);
      if (ordered.length === 0 && stateDraft) setDraft(stateDraft);
      if (ordered.some(m => m.recipient_id === userId && !m.read_at)) markRead(peerId);
    })();
    return () => { cancelled = true; };
    // stateDraft only seeds the first render of a brand-new conversation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, peerId, markRead]);

  // Live updates: new messages to me, and the other person reading mine.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`inbox:${userId}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${userId}` }, payload => {
        const message = payload.new as ChatMessage;
        if (message.sender_id === peerIdRef.current) {
          setThread(prev => (prev.some(m => m.id === message.id) ? prev : [...prev, message]));
          if (document.visibilityState === "visible") markRead(message.sender_id);
        }
        loadConversations();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `sender_id=eq.${userId}` }, payload => {
        const message = payload.new as ChatMessage;
        setThread(prev => prev.map(m => (m.id === message.id ? { ...m, read_at: message.read_at } : m)));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, markRead, loadConversations]);

  // Messages that arrived while the tab was hidden count as read once the user is back.
  useEffect(() => {
    const onVisible = () => {
      const open = peerIdRef.current;
      if (document.visibilityState !== "visible" || !open) return;
      if (threadRef.current.some(m => m.recipient_id === userId && !m.read_at)) markRead(open);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [userId, markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ block: "end" });
  }, [thread, threadLoading, peerId]);

  const send = async () => {
    const content = draft.trim();
    if (!content || !peerId || !userId || sending) return;
    setSending(true);
    const { data, error } = await supabase.from("messages")
      .insert({ sender_id: userId, recipient_id: peerId, content }).select().single();
    setSending(false);
    if (error || !data) {
      toast.error(error?.code === "23514" ? `Messages must be 1 to ${MAX_MESSAGE_LENGTH.toLocaleString()} characters.` : error?.message ?? "Message could not be sent");
      return;
    }
    setDraft("");
    setThread(prev => (prev.some(m => m.id === data.id) ? prev : [...prev, data]));
    loadConversations();
  };

  const items = useMemo<ConversationItem[]>(() => {
    const rows = conversations.map(c => ({
      id: c.other_id,
      name: displayName(c.other_name),
      avatar: c.other_avatar ?? null,
      headline: c.other_headline ?? null,
      preview: `${c.last_sender_id === userId ? "You: " : ""}${c.last_message}`,
      at: c.last_at,
      unread: Number(c.unread_count),
    }));
    // A conversation opened from an idea page has no messages yet, so show it at the top.
    if (peerId && peer && !rows.some(r => r.id === peerId)) {
      rows.unshift({ id: peerId, name: displayName(peer.full_name), avatar: peer.avatar_url, headline: peer.headline, preview: "New conversation", at: null, unread: 0 });
    }
    return rows;
  }, [conversations, peer, peerId, userId]);

  const peerName = displayName(peer?.full_name);
  const peerSubtitle = [peer?.headline, peer?.company].filter(Boolean).join(" · ");
  const lastMineId = [...thread].reverse().find(m => m.sender_id === userId)?.id;
  const groups = useMemo(() => groupByDay(thread), [thread]);

  return (
    <AppShell title="Messages">
      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* Inbox */}
        <aside className={cn("w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-border bg-card/40 flex flex-col", peerId && "hidden md:flex")}>
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-display font-semibold">Inbox</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {listLoading ? (
              <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="h-9 w-9 mx-auto text-muted-foreground/60" />
                <div className="mt-3 text-sm font-medium">No conversations yet</div>
                <p className="mt-1 text-xs text-muted-foreground">Open an idea and use the Message button to start talking to its founder.</p>
                <Link to="/explore"><Button variant="outline" size="sm" className="mt-4">Browse ideas</Button></Link>
              </div>
            ) : (
              <ul>
                {items.map(c => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setParams({ with: c.id })}
                      className={cn("w-full text-left px-4 py-3 flex gap-3 border-b border-border/60 hover:bg-muted transition-colors", c.id === peerId && "bg-muted")}
                    >
                      <PersonAvatar name={c.name} src={c.avatar} className="h-10 w-10 flex-shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className={cn("truncate text-sm", c.unread > 0 ? "font-semibold" : "font-medium")}>{c.name}</span>
                          {c.at && <span className="flex-shrink-0 text-[11px] text-muted-foreground">{listTime(c.at)}</span>}
                        </span>
                        <span className="mt-0.5 flex items-center justify-between gap-2">
                          <span className={cn("truncate text-xs", c.unread > 0 ? "text-foreground" : "text-muted-foreground")}>{c.preview}</span>
                          {c.unread > 0 && (
                            <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
                              {c.unread > 99 ? "99+" : c.unread}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Conversation */}
        <section className={cn("min-w-0 flex-1 flex flex-col", !peerId && "hidden md:flex")}>
          {!peerId ? (
            <div className="m-auto p-8 text-center text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto opacity-50" />
              <div className="mt-3 text-sm">Select a conversation to start messaging.</div>
            </div>
          ) : peerMissing ? (
            <div className="m-auto p-8 text-center">
              <div className="text-sm font-medium">This person could not be found.</div>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setParams({})}>Back to inbox</Button>
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-border px-4 py-3">
                <Button variant="ghost" size="icon" className="md:hidden -ml-2" aria-label="Back to inbox" onClick={() => setParams({})}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <PersonAvatar name={peerName} src={peer?.avatar_url ?? null} className="h-9 w-9" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{peerName}</div>
                  {peerSubtitle && <div className="truncate text-xs text-muted-foreground">{peerSubtitle}</div>}
                </div>
              </header>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {threadLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : thread.length === 0 ? (
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    No messages yet. Say hello to {peerName.split(" ")[0]}.
                  </div>
                ) : (
                  groups.map(group => (
                    <div key={group.key} className="space-y-2">
                      <div className="flex justify-center">
                        <span className="rounded-full bg-muted px-3 py-0.5 text-[11px] text-muted-foreground">{group.label}</span>
                      </div>
                      {group.messages.map(m => {
                        const mine = m.sender_id === userId;
                        return (
                          <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                            <div className={cn(
                              "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words",
                              mine ? "bg-gradient-primary text-white rounded-br-md" : "bg-muted text-foreground rounded-bl-md",
                            )}>
                              {m.content}
                              <div className={cn("mt-1 text-[10px]", mine ? "text-white/70" : "text-muted-foreground")}>
                                {format(new Date(m.created_at), "p")}
                                {mine && m.id === lastMineId && m.read_at ? " · Seen" : ""}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              <form
                onSubmit={e => { e.preventDefault(); send(); }}
                className="flex items-end gap-2 border-t border-border p-3"
              >
                <Textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
                  }}
                  rows={Math.min(5, Math.max(1, draft.split("\n").length))}
                  maxLength={MAX_MESSAGE_LENGTH}
                  placeholder={`Message ${peerName.split(" ")[0]}…`}
                  aria-label="Write a message"
                  className="min-h-[44px] resize-none"
                />
                <Button type="submit" disabled={!draft.trim() || sending} className="h-11 bg-gradient-primary px-4" aria-label="Send message">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
};

async function fetchConversations() {
  const { data } = await supabase.rpc("list_conversations");
  return data ?? [];
}

export default Messages;

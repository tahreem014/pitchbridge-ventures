import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MESSAGES_CHANGED } from "@/lib/events";

// Number of messages sent to the signed-in user that they have not opened yet.
export const useUnreadMessages = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) { setCount(0); return; }
    const { count: unread } = await supabase
      .from("messages").select("id", { count: "exact", head: true })
      .eq("recipient_id", userId).is("read_at", null);
    setCount(unread ?? 0);
  }, [userId]);

  useEffect(() => {
    refresh();
    if (!userId) return;
    // Unique topic: several components can use this hook at once.
    const channel = supabase
      .channel(`unread-messages:${userId}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `recipient_id=eq.${userId}` }, () => { refresh(); })
      .subscribe();
    window.addEventListener(MESSAGES_CHANGED, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener(MESSAGES_CHANGED, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [userId, refresh]);

  return count;
};

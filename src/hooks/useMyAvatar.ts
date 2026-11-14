import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PROFILE_CHANGED } from "@/lib/events";

// The signed-in user's profile photo URL (null when they have none yet).
export const useMyAvatar = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const [url, setUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) { setUrl(null); return; }
    const { data } = await supabase.from("profiles").select("avatar_url").eq("id", userId).maybeSingle();
    setUrl(data?.avatar_url ?? null);
  }, [userId]);

  useEffect(() => {
    refresh();
    window.addEventListener(PROFILE_CHANGED, refresh);
    return () => window.removeEventListener(PROFILE_CHANGED, refresh);
  }, [refresh]);

  return url;
};

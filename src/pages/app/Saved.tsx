import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { IdeaCardItem } from "@/components/IdeaCardItem";

const Saved = () => {
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("favorites").select("ideas(*)").eq("user_id", user.id);
      setIdeas((data ?? []).map((r: any) => r.ideas).filter(Boolean));
    })();
  }, [user]);

  return (
    <AppShell title="Saved Ideas">
      <div className="p-6 md:p-8 space-y-6 animate-fade-in">
        <div>
          <h2 className="font-display text-2xl font-bold">Your saved pitches</h2>
          <p className="text-sm text-muted-foreground">Ideas you're tracking for follow-up.</p>
        </div>
        {ideas.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">Nothing saved yet — explore the discover feed.</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ideas.map(i => <IdeaCardItem key={i.id} idea={i} />)}
          </div>
        )}
      </div>
    </AppShell>
  );
};
export default Saved;

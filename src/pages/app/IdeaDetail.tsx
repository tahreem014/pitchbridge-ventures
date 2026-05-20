import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { Heart, MessageSquare, Send, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const IdeaDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [idea, setIdea] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ideas").select("*").eq("id", id!).maybeSingle();
      setIdea(data);
      if (data) {
        const [{ data: p }, { data: f }] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", data.user_id).maybeSingle(),
          user ? supabase.from("favorites").select("id").eq("idea_id", id!).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null } as any),
        ]);
        setProfile(p); setIsFav(!!f);
      }
    })();
  }, [id, user]);

  const toggleFav = async () => {
    if (!user) return navigate("/auth");
    if (isFav) {
      await supabase.from("favorites").delete().eq("idea_id", id!).eq("user_id", user.id);
      setIsFav(false);
    } else {
      await supabase.from("favorites").insert({ idea_id: id!, user_id: user.id });
      setIsFav(true);
      toast.success("Saved to your collection");
    }
  };

  const sendProposal = async () => {
    if (!user) return navigate("/auth");
    const amt = prompt("Proposed investment (USD):");
    if (!amt) return;
    const { error } = await supabase.from("proposals").insert({
      idea_id: id!, investor_id: user.id, entrepreneur_id: idea.user_id,
      amount: Number(amt), message: "Interested in discussing further.",
    });
    if (error) toast.error(error.message); else toast.success("Proposal sent");
  };

  if (!idea) return <AppShell title="Idea"><div className="p-8 text-muted-foreground">Loading…</div></AppShell>;
  const pct = idea.funding_target ? Math.min(100, (Number(idea.funding_raised) / Number(idea.funding_target)) * 100) : 0;

  return (
    <AppShell title={idea.title}>
      <div className="p-6 md:p-8 max-w-5xl mx-auto animate-fade-in space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>

        <Card className="glass-card overflow-hidden">
          <div className="aspect-[21/9] bg-gradient-primary relative">
            {idea.cover_image_url ? <img src={idea.cover_image_url} alt={idea.title} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-primary via-primary-glow to-accent" />}
          </div>
          <div className="p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge>{idea.category}</Badge>
                  <Badge variant="outline">{idea.stage?.replace("_"," ")}</Badge>
                </div>
                <h1 className="font-display text-3xl md:text-4xl font-bold">{idea.title}</h1>
                {idea.tagline && <p className="mt-2 text-lg text-muted-foreground">{idea.tagline}</p>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={toggleFav}><Heart className={`h-4 w-4 mr-1 ${isFav ? "fill-destructive text-destructive" : ""}`} /> {isFav ? "Saved" : "Save"}</Button>
                {role === "investor" && user?.id !== idea.user_id && (
                  <Button className="bg-gradient-primary" onClick={sendProposal}><Send className="h-4 w-4 mr-1" /> Send proposal</Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="glass-card p-6 md:col-span-2">
            <h3 className="font-display font-semibold text-lg">About this venture</h3>
            <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground leading-relaxed">{idea.description ?? "No description provided yet."}</p>
            {idea.video_url && (
              <a href={idea.video_url} target="_blank" rel="noopener" className="inline-block mt-6 text-primary text-sm hover:underline">▶ Watch pitch video</a>
            )}
          </Card>
          <div className="space-y-4">
            <Card className="glass-card p-6">
              <div className="text-xs text-muted-foreground">Funding goal</div>
              <div className="font-display text-2xl font-bold mt-1">${Number(idea.funding_target).toLocaleString()}</div>
              <Progress value={pct} className="mt-3 h-2" />
              <div className="text-xs text-muted-foreground mt-2">${Number(idea.funding_raised).toLocaleString()} raised · {pct.toFixed(0)}%</div>
              {idea.equity_offered && <div className="mt-3 text-sm">Equity offered: <span className="font-semibold">{idea.equity_offered}%</span></div>}
            </Card>
            <Card className="glass-card p-6">
              <div className="text-xs text-muted-foreground mb-2">Founder</div>
              <div className="font-semibold">{profile?.full_name ?? "Founder"}</div>
              {profile?.headline && <div className="text-xs text-muted-foreground">{profile.headline}</div>}
              <Button variant="outline" className="w-full mt-4" size="sm"><MessageSquare className="h-3.5 w-3.5 mr-1" /> Message</Button>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
};
export default IdeaDetail;

import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Heart, MessageSquare, Send, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { sampleIdeas, sampleProfiles } from "@/lib/sampleData";

const IdeaDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isFav, setIsFav] = useState(false);

  const idea = sampleIdeas.find(i => i.id === id) ?? sampleIdeas[0];
  const profile = sampleProfiles[idea.user_id];
  const pct = Math.min(100, (idea.funding_raised / idea.funding_target) * 100);

  const sendProposal = () => {
    const amt = prompt("Proposed investment (USD):");
    if (!amt) return;
    toast.success(`Proposal of $${Number(amt).toLocaleString()} sent`);
  };

  return (
    <AppShell title={idea.title}>
      <div className="p-6 md:p-8 max-w-5xl mx-auto animate-fade-in space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>

        <Card className="glass-card overflow-hidden">
          <div className="aspect-[21/9] bg-gradient-to-br from-primary via-primary-glow to-accent" />
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
                <Button variant="outline" onClick={() => { setIsFav(!isFav); if (!isFav) toast.success("Saved to your collection"); }}>
                  <Heart className={`h-4 w-4 mr-1 ${isFav ? "fill-destructive text-destructive" : ""}`} /> {isFav ? "Saved" : "Save"}
                </Button>
                <Button className="bg-gradient-primary" onClick={sendProposal}><Send className="h-4 w-4 mr-1" /> Send proposal</Button>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="glass-card p-6 md:col-span-2">
            <h3 className="font-display font-semibold text-lg">About this venture</h3>
            <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground leading-relaxed">{idea.description}</p>
          </Card>
          <div className="space-y-4">
            <Card className="glass-card p-6">
              <div className="text-xs text-muted-foreground">Funding goal</div>
              <div className="font-display text-2xl font-bold mt-1">${idea.funding_target.toLocaleString()}</div>
              <Progress value={pct} className="mt-3 h-2" />
              <div className="text-xs text-muted-foreground mt-2">${idea.funding_raised.toLocaleString()} raised · {pct.toFixed(0)}%</div>
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

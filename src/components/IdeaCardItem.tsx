import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, TrendingUp, Eye, ArrowUpRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export interface IdeaCard {
  id: string;
  title: string;
  tagline?: string | null;
  category?: string | null;
  stage?: string | null;
  funding_target: number;
  funding_raised: number;
  cover_image_url?: string | null;
  views_count?: number;
}

const stageColors: Record<string, string> = {
  idea: "bg-muted text-muted-foreground",
  prototype: "bg-highlight/20 text-highlight-foreground",
  mvp: "bg-primary/15 text-primary",
  early_revenue: "bg-accent/20 text-accent",
  scaling: "bg-gradient-accent text-white",
};

export const IdeaCardItem = ({ idea, onFav, isFav }: { idea: IdeaCard; onFav?: () => void; isFav?: boolean }) => {
  const pct = idea.funding_target ? Math.min(100, (Number(idea.funding_raised) / Number(idea.funding_target)) * 100) : 0;
  return (
    <Card className="group overflow-hidden hover-lift glass-card border-border/60 flex flex-col">
      <Link to={`/app/ideas/${idea.id}`} className="block">
        <div className="aspect-[16/9] bg-gradient-primary relative overflow-hidden">
          {idea.cover_image_url ? (
            <img src={idea.cover_image_url} alt={idea.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary via-primary-glow to-accent opacity-90" />
          )}
          <div className="absolute top-3 left-3 flex gap-2">
            {idea.stage && <Badge className={stageColors[idea.stage] ?? "bg-muted"}>{idea.stage.replace("_", " ")}</Badge>}
          </div>
          {onFav && (
            <button onClick={e => { e.preventDefault(); onFav(); }} className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/90 backdrop-blur flex items-center justify-center hover:scale-110 transition-transform">
              <Heart className={`h-4 w-4 ${isFav ? "fill-destructive text-destructive" : "text-foreground"}`} />
            </button>
          )}
        </div>
      </Link>
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link to={`/app/ideas/${idea.id}`} className="font-display font-semibold text-lg leading-tight hover:text-primary transition-colors line-clamp-1">{idea.title}</Link>
            {idea.category && <div className="text-xs text-muted-foreground mt-0.5">{idea.category}</div>}
          </div>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </div>
        {idea.tagline && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{idea.tagline}</p>}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Raised</span>
            <span className="font-semibold">${Number(idea.funding_raised).toLocaleString()} / ${Number(idea.funding_target).toLocaleString()}</span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>
        <div className="mt-4 pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {idea.views_count ?? 0}</span>
          <span className="flex items-center gap-1 text-accent font-medium"><TrendingUp className="h-3 w-3" /> {pct.toFixed(0)}% funded</span>
        </div>
      </div>
    </Card>
  );
};

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { sampleIdeas } from "@/lib/sampleData";

const MyIdeas = () => {
  const ideas = sampleIdeas.slice(0, 4);

  return (
    <AppShell title="My Ideas">
      <div className="p-6 md:p-8 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold">Your pitches</h2>
            <p className="text-sm text-muted-foreground">Create and manage your startup ideas</p>
          </div>
          <Link to="/app/ideas/new"><Button className="bg-gradient-accent shadow-glow"><Plus className="h-4 w-4 mr-1" /> New idea</Button></Link>
        </div>

        <div className="grid gap-4">
          {ideas.map(i => (
            <Card key={i.id} className="glass-card p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center hover-lift">
              <div className="h-16 w-16 rounded-xl bg-gradient-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link to={`/app/ideas/${i.id}`} className="font-display font-semibold hover:text-primary">{i.title}</Link>
                  <Badge variant="outline" className="text-[10px]">{i.status}</Badge>
                  <Badge variant="outline" className="text-[10px]">{i.stage}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{i.tagline}</p>
                <div className="text-xs text-muted-foreground mt-2">Target: ${i.funding_target.toLocaleString()} • Raised: ${i.funding_raised.toLocaleString()}</div>
              </div>
              <div className="flex gap-2">
                <Link to={`/app/ideas/${i.id}/edit`}><Button variant="outline" size="sm"><Edit className="h-3.5 w-3.5 mr-1" />Edit</Button></Link>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
};
export default MyIdeas;

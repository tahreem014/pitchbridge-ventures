import { AppShell } from "@/components/AppShell";
import { IdeaCardItem } from "@/components/IdeaCardItem";
import { sampleIdeas } from "@/lib/sampleData";

const Saved = () => {
  const ideas = sampleIdeas.slice(0, 4);
  return (
    <AppShell title="Saved Ideas">
      <div className="p-6 md:p-8 space-y-6 animate-fade-in">
        <div>
          <h2 className="font-display text-2xl font-bold">Your saved pitches</h2>
          <p className="text-sm text-muted-foreground">Ideas you're tracking for follow-up.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ideas.map(i => <IdeaCardItem key={i.id} idea={i} isFav />)}
        </div>
      </div>
    </AppShell>
  );
};
export default Saved;

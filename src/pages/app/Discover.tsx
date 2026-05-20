import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { IdeaCardItem } from "@/components/IdeaCardItem";
import { toast } from "sonner";

const CATEGORIES = ["All", "AI / ML", "FinTech", "HealthTech", "ClimateTech", "SaaS", "Consumer", "Marketplace", "DeepTech", "Web3"];
const STAGES = ["All", "idea", "prototype", "mvp", "early_revenue", "scaling"];

const Discover = () => {
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<any[]>([]);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [stage, setStage] = useState("All");

  useEffect(() => {
    let cancel = false;
    (async () => {
      let q = supabase.from("ideas").select("*").eq("status", "published").eq("visibility", "public").order("created_at", { ascending: false });
      if (category !== "All") q = q.eq("category", category);
      if (stage !== "All") q = q.eq("stage", stage as any);
      if (search) q = q.ilike("title", `%${search}%`);
      const { data } = await q;
      if (cancel) return;
      setIdeas(data ?? []);
      if (user) {
        const { data: f } = await supabase.from("favorites").select("idea_id").eq("user_id", user.id);
        setFavs(new Set((f ?? []).map(x => x.idea_id)));
      }
    })();
    return () => { cancel = true; };
  }, [search, category, stage, user]);

  const toggleFav = async (id: string) => {
    if (!user) return;
    if (favs.has(id)) {
      await supabase.from("favorites").delete().eq("idea_id", id).eq("user_id", user.id);
      const n = new Set(favs); n.delete(id); setFavs(n);
    } else {
      await supabase.from("favorites").insert({ idea_id: id, user_id: user.id });
      setFavs(new Set([...favs, id]));
      toast.success("Saved");
    }
  };

  return (
    <AppShell title="Discover">
      <div className="p-6 md:p-8 space-y-6 animate-fade-in">
        <div>
          <h2 className="font-display text-2xl font-bold">Fresh deal flow</h2>
          <p className="text-sm text-muted-foreground">Curated startup pitches matching your interests.</p>
        </div>
        <div className="glass-card p-3 rounded-2xl flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s}>{s.replace("_"," ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {ideas.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">No ideas match your filters yet.</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ideas.map(i => <IdeaCardItem key={i.id} idea={i} onFav={() => toggleFav(i.id)} isFav={favs.has(i.id)} />)}
          </div>
        )}
      </div>
    </AppShell>
  );
};
export default Discover;

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { IdeaCardItem, IdeaCard } from "@/components/IdeaCardItem";
import { useAuth } from "@/hooks/useAuth";

const CATEGORIES = ["All", "AI / ML", "FinTech", "HealthTech", "ClimateTech", "SaaS", "Consumer", "Marketplace", "DeepTech", "Web3"];
const STAGES = ["All", "idea", "prototype", "mvp", "early_revenue", "scaling"];

const Explore = () => {
  const [ideas, setIdeas] = useState<IdeaCard[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [stage, setStage] = useState("All");
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      let q = supabase.from("ideas").select("*").eq("status", "published").eq("visibility", "public").order("created_at", { ascending: false }).limit(60);
      if (category !== "All") q = q.eq("category", category);
      if (stage !== "All") q = q.eq("stage", stage as any);
      if (search) q = q.ilike("title", `%${search}%`);
      const { data } = await q;
      if (!cancel) { setIdeas((data as any) ?? []); setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [search, category, stage]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="container mx-auto flex items-center justify-between py-4">
          <Logo />
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link to="/explore" className="text-foreground font-medium">Explore</Link>
            <Link to="/about" className="text-muted-foreground hover:text-foreground">About</Link>
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link>
          </nav>
          <Button onClick={() => navigate(user ? "/app" : "/auth")} className="bg-gradient-primary">{user ? "Open app" : "Sign in"}</Button>
        </div>
      </header>

      <section className="hero-bg py-16 relative overflow-hidden">
        <div className="container mx-auto relative">
          <div className="max-w-3xl">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-white text-balance">Discover the next category-defining startup</h1>
            <p className="mt-4 text-white/70 max-w-xl">Browse curated pitches from founders across sectors, stages, and geographies.</p>
          </div>
        </div>
      </section>

      <section className="container mx-auto py-10">
        <div className="glass-card rounded-2xl p-4 flex flex-col md:flex-row gap-3 -mt-16 relative z-10 shadow-elegant">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search ideas, sectors, founders…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-11" />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="md:w-48 h-11"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger className="md:w-44 h-11"><SelectValue placeholder="Stage" /></SelectTrigger>
            <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="mt-8">
          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{Array.from({length: 6}).map((_, i) => (
              <div key={i} className="aspect-[3/4] glass-card rounded-2xl animate-pulse" />
            ))}</div>
          ) : ideas.length === 0 ? (
            <div className="text-center py-24 text-muted-foreground">
              <div className="font-display text-xl mb-2">No ideas found yet</div>
              <p className="text-sm">Try adjusting filters, or be the first to <Link to="/auth?mode=signup&role=entrepreneur" className="text-primary underline">post your pitch</Link>.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ideas.map(i => <IdeaCardItem key={i.id} idea={i} />)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
export default Explore;

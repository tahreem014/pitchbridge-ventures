import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowRight, Sparkles, Shield, TrendingUp, Users, Zap, Globe, CheckCircle2,
  BarChart3, MessageSquare, Search, Rocket,
} from "lucide-react";
import heroImg from "@/assets/hero.jpg";

const features = [
  { icon: Rocket, title: "Pitch in minutes", desc: "Beautiful idea pages with media, traction, and funding goals." },
  { icon: Search, title: "Smart discovery", desc: "Filter by stage, sector, ticket size and traction signals." },
  { icon: MessageSquare, title: "Direct messaging", desc: "Talk to founders and investors without the noise." },
  { icon: Shield, title: "Verified profiles", desc: "Identity-checked investors and curated entrepreneurs." },
  { icon: BarChart3, title: "Pitch analytics", desc: "Know who viewed, saved, and engaged with your deck." },
  { icon: Zap, title: "Proposal workflow", desc: "Send terms, counter, and accept — all in one place." },
];
const stats = [
  { v: "$248M+", l: "Capital tracked" },
  { v: "12,400", l: "Active founders" },
  { v: "3,800", l: "Verified investors" },
  { v: "92%", l: "Match satisfaction" },
];

const Landing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="absolute top-0 inset-x-0 z-30">
        <div className="container mx-auto flex items-center justify-between py-5">
          <Logo variant="light" />
          <nav className="hidden md:flex items-center gap-8 text-sm text-white/80">
            <Link to="/explore" className="hover:text-white transition-colors">Explore</Link>
            <Link to="/about" className="hover:text-white transition-colors">About</Link>
            <Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <Button onClick={() => navigate("/app")} className="bg-white text-primary hover:bg-white/90">Open app</Button>
            ) : (
              <>
                <Link to="/auth" className="text-sm text-white/80 hover:text-white hidden sm:inline">Sign in</Link>
                <Button onClick={() => navigate("/auth?mode=signup")} className="bg-white text-primary hover:bg-white/90">Get started</Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative hero-bg overflow-hidden">
        <img src={heroImg} alt="" width={1920} height={1080} className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-screen" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
        <div className="container mx-auto pt-40 pb-32 relative">
          <div className="max-w-4xl mx-auto text-center animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/90 text-xs mb-8">
              <Sparkles className="h-3.5 w-3.5 text-accent-glow" />
              The premier platform for founders and investors
            </div>
            <h1 className="font-display text-5xl md:text-7xl font-bold text-white text-balance leading-[1.05]">
              Transform Bold Ideas <br className="hidden md:block" />
              Into <span className="gradient-text">Funded Ventures</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-white/70 max-w-2xl mx-auto text-balance">
              PitchBridge connects ambitious entrepreneurs with active investors. Pitch your vision, discover breakthrough startups, and close deals in one elegant workspace.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" onClick={() => navigate("/auth?mode=signup&role=entrepreneur")} className="bg-gradient-accent hover:opacity-90 text-white shadow-glow text-base h-12 px-7">
                Pitch Your Idea <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/explore")} className="bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white text-base h-12 px-7 backdrop-blur-md">
                Discover Opportunities
              </Button>
            </div>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-white/50">
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-accent" /> SOC 2 ready</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-accent" /> Verified investors</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-accent" /> No platform fees on raises</div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 rounded-2xl overflow-hidden border border-white/10 backdrop-blur-md max-w-4xl mx-auto">
            {stats.map(s => (
              <div key={s.l} className="bg-primary/40 backdrop-blur-md p-6 text-center">
                <div className="font-display text-3xl font-bold text-white">{s.v}</div>
                <div className="text-xs text-white/60 mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 mesh-bg">
        <div className="container mx-auto">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <div className="text-sm font-medium text-accent mb-3">Everything you need</div>
            <h2 className="font-display text-4xl md:text-5xl font-bold gradient-text-primary text-balance">
              The modern home for venture deal flow
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">From first pitch to signed term sheet — designed for clarity, speed, and trust.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={f.title} className="glass-card p-6 rounded-2xl hover-lift" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="h-10 w-10 rounded-xl bg-gradient-accent flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-display font-semibold text-lg">{f.title}</h3>
                <p className="text-sm text-muted-foreground mt-2">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container mx-auto">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-12 md:p-16 text-center">
            <div className="absolute inset-0 bg-gradient-mesh opacity-60" />
            <div className="relative">
              <Globe className="h-12 w-12 text-white/80 mx-auto mb-6 animate-float" />
              <h2 className="font-display text-3xl md:text-5xl font-bold text-white text-balance">Your next venture starts here</h2>
              <p className="mt-4 text-white/80 max-w-xl mx-auto">Join thousands of founders and investors moving capital into bold ideas.</p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Button size="lg" onClick={() => navigate("/auth?mode=signup&role=entrepreneur")} className="bg-white text-primary hover:bg-white/90 h-12 px-7">
                  I'm a Founder <Rocket className="ml-1 h-4 w-4" />
                </Button>
                <Button size="lg" onClick={() => navigate("/auth?mode=signup&role=investor")} variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white h-12 px-7">
                  I'm an Investor <TrendingUp className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-10">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Logo />
          <div className="text-sm text-muted-foreground">© {new Date().getFullYear()} PitchBridge. Built for bold ventures.</div>
          <div className="flex items-center gap-5 text-sm text-muted-foreground">
            <Link to="/about" className="hover:text-foreground">About</Link>
            <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link to="/explore" className="hover:text-foreground">Explore</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;

import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const tiers = [
  {
    name: "Founder",
    price: "Free",
    desc: "Everything you need to start raising.",
    features: ["1 active pitch", "Basic analytics", "Direct messaging", "Profile verification"],
    cta: "Start pitching",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$49",
    suffix: "/mo",
    desc: "For active founders running a real raise.",
    features: ["Unlimited pitches", "Advanced analytics", "Investor recommendations", "Priority listing", "Proposal workflow"],
    cta: "Start free trial",
    highlight: true,
  },
  {
    name: "Investor",
    price: "$199",
    suffix: "/mo",
    desc: "For active investors and funds.",
    features: ["Full deal flow access", "Saved searches & alerts", "Portfolio tracking", "Verified network", "Team seats"],
    cta: "Get access",
    highlight: false,
  },
];

const Pricing = () => (
  <div className="min-h-screen bg-background">
    <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
      <div className="container mx-auto flex items-center justify-between py-4">
        <Logo />
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link to="/explore" className="text-muted-foreground hover:text-foreground">Explore</Link>
          <Link to="/about" className="text-muted-foreground hover:text-foreground">About</Link>
          <Link to="/pricing" className="text-foreground font-medium">Pricing</Link>
        </nav>
        <Link to="/auth"><Button className="bg-gradient-primary">Sign in</Button></Link>
      </div>
    </header>

    <section className="container mx-auto py-20 text-center">
      <div className="text-sm font-medium text-accent mb-3">Pricing</div>
      <h1 className="font-display text-5xl font-bold gradient-text-primary text-balance max-w-2xl mx-auto">Simple plans, serious results</h1>
      <p className="mt-4 text-muted-foreground max-w-lg mx-auto">No platform fees on capital raised. Choose the plan that fits your stage.</p>
    </section>

    <section className="container mx-auto pb-24">
      <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {tiers.map(t => (
          <div key={t.name} className={`relative rounded-2xl p-8 ${t.highlight ? "bg-gradient-primary text-white shadow-elegant scale-[1.02]" : "glass-card"}`}>
            {t.highlight && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-accent text-white text-xs font-medium">Most popular</div>}
            <div className={`text-sm font-medium ${t.highlight ? "text-white/70" : "text-muted-foreground"}`}>{t.name}</div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="font-display text-5xl font-bold">{t.price}</span>
              {t.suffix && <span className={t.highlight ? "text-white/70" : "text-muted-foreground"}>{t.suffix}</span>}
            </div>
            <p className={`mt-2 text-sm ${t.highlight ? "text-white/80" : "text-muted-foreground"}`}>{t.desc}</p>
            <ul className="mt-6 space-y-3">
              {t.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className={`h-4 w-4 ${t.highlight ? "text-accent-glow" : "text-accent"}`} />{f}
                </li>
              ))}
            </ul>
            <Link to="/auth?mode=signup"><Button className={`w-full mt-8 h-11 ${t.highlight ? "bg-white text-primary hover:bg-white/90" : "bg-gradient-primary"}`}>{t.cta}</Button></Link>
          </div>
        ))}
      </div>
    </section>
  </div>
);
export default Pricing;

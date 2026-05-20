import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Target, Heart, Shield, Zap } from "lucide-react";

const values = [
  { icon: Target, title: "Clarity over noise", desc: "Tools designed for serious founders and investors — not vanity metrics." },
  { icon: Heart, title: "Founder-first", desc: "We build for the people taking the leap. Always." },
  { icon: Shield, title: "Trust by default", desc: "Verified profiles, transparent terms, and secure communications." },
  { icon: Zap, title: "Speed wins", desc: "From discovery to deal in days, not months." },
];

const About = () => (
  <div className="min-h-screen bg-background">
    <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
      <div className="container mx-auto flex items-center justify-between py-4">
        <Logo />
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link to="/explore" className="text-muted-foreground hover:text-foreground">Explore</Link>
          <Link to="/about" className="text-foreground font-medium">About</Link>
          <Link to="/pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link>
        </nav>
        <Link to="/auth"><Button className="bg-gradient-primary">Sign in</Button></Link>
      </div>
    </header>

    <section className="hero-bg py-24 relative overflow-hidden">
      <div className="container mx-auto relative text-center max-w-3xl">
        <h1 className="font-display text-5xl md:text-6xl font-bold text-white text-balance">Building the bridge between <span className="gradient-text">vision and capital</span></h1>
        <p className="mt-6 text-white/70 text-lg">PitchBridge exists to make venture investing more transparent, more inclusive, and far more efficient — for founders and investors alike.</p>
      </div>
    </section>

    <section className="container mx-auto py-24">
      <div className="grid md:grid-cols-2 gap-6">
        {values.map(v => (
          <div key={v.title} className="glass-card p-8 rounded-2xl hover-lift">
            <div className="h-12 w-12 rounded-xl bg-gradient-accent flex items-center justify-center mb-4"><v.icon className="h-5 w-5 text-white" /></div>
            <h3 className="font-display text-xl font-semibold">{v.title}</h3>
            <p className="text-muted-foreground mt-2">{v.desc}</p>
          </div>
        ))}
      </div>
    </section>

    <section className="py-24 mesh-bg">
      <div className="container mx-auto text-center max-w-2xl">
        <h2 className="font-display text-3xl md:text-4xl font-bold gradient-text-primary">Backed by a global community of operators and angels</h2>
        <p className="mt-4 text-muted-foreground">Hundreds of millions in capital tracked. Thousands of meaningful introductions made.</p>
        <Link to="/auth?mode=signup"><Button size="lg" className="mt-8 bg-gradient-primary h-12 px-7">Join PitchBridge</Button></Link>
      </div>
    </section>
  </div>
);
export default About;

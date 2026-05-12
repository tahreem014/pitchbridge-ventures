import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Rocket, TrendingUp, Loader2 } from "lucide-react";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
  fullName: z.string().trim().min(1).max(100),
});

const Signup = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [role, setRole] = useState<"entrepreneur" | "investor">((params.get("role") as any) ?? "entrepreneur");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) navigate("/app"); }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password, fullName });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: `${window.location.origin}/app`,
          data: { full_name: fullName, role },
        },
      });
      if (error) throw error;
      toast.success("Welcome to PitchBridge!");
      navigate("/app");
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left visual */}
      <div className="hidden lg:flex relative hero-bg p-12 flex-col justify-between overflow-hidden">
        <Logo variant="light" />
        <div className="relative z-10 max-w-md">
          <h1 className="font-display text-4xl font-bold text-white leading-tight text-balance">
            Where bold ideas meet <span className="gradient-text">smart capital.</span>
          </h1>
          <p className="mt-4 text-white/70">Join the platform powering the next generation of venture deals.</p>
          <div className="mt-10 space-y-3">
            {["Verified investor network", "End-to-end deal pipeline", "Insightful pitch analytics"].map(t => (
              <div key={t} className="flex items-center gap-3 text-white/80 text-sm">
                <div className="h-1.5 w-1.5 rounded-full bg-accent" />{t}
              </div>
            ))}
          </div>
        </div>
        <div className="text-xs text-white/40">© PitchBridge</div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 md:p-12 bg-background">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden mb-8"><Logo /></div>
          <h2 className="font-display text-3xl font-bold">Create your account</h2>
          <p className="text-muted-foreground mt-2 text-sm">Start raising or investing in minutes.</p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {[
              { v: "entrepreneur" as const, label: "Entrepreneur", icon: Rocket, desc: "Pitch ideas" },
              { v: "investor" as const, label: "Investor", icon: TrendingUp, desc: "Discover deals" },
            ].map(opt => (
              <button key={opt.v} type="button" onClick={() => setRole(opt.v)}
                className={`p-4 rounded-xl border text-left transition-all ${role === opt.v ? "border-primary bg-primary/5 shadow-soft" : "border-border hover:border-primary/40"}`}>
                <opt.icon className={`h-5 w-5 ${role === opt.v ? "text-primary" : "text-muted-foreground"}`} />
                <div className="font-medium text-sm mt-2">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.desc}</div>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ada Lovelace" required />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-gradient-primary hover:opacity-95 h-11">
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create account
            </Button>
          </form>

          <div className="mt-6 text-sm text-center text-muted-foreground">
            Have an account? <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
          </div>
          <div className="mt-6 text-center">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Back to home</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;

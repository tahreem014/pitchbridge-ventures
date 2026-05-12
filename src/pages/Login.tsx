import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
});

const Login = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) navigate("/app"); }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Welcome back");
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
          <h2 className="font-display text-3xl font-bold">Welcome back</h2>
          <p className="text-muted-foreground mt-2 text-sm">Sign in to your PitchBridge workspace.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
              Sign in
            </Button>
          </form>

          <div className="mt-6 text-sm text-center text-muted-foreground">
            New to PitchBridge? <Link to="/signup" className="text-primary font-medium hover:underline">Create account</Link>
          </div>
          <div className="mt-6 text-center">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Back to home</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

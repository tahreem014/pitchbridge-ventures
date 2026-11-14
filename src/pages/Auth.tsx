import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { forgetSignupRole, rememberSignupRole } from "@/lib/signupRole";
import { toast } from "sonner";
import { Rocket, TrendingUp, Loader2, MailCheck } from "lucide-react";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
  fullName: z.string().trim().min(1).max(100).optional(),
});

const GoogleIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81Z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24Z" />
    <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l3.98-3.1Z" />
    <path fill="#EA4335" d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.44-3.44A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.1C6.22 6.88 8.87 4.77 12 4.77Z" />
  </svg>
);

const Auth = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(params.get("mode") === "signup" ? "signup" : "signin");
  const [role, setRole] = useState<"entrepreneur" | "investor">((params.get("role") as any) ?? "entrepreneur");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => { if (user) navigate("/app"); }, [user, navigate]);
  // Coming back here means a previous Google attempt was abandoned.
  useEffect(() => { forgetSignupRole(); }, []);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    // Only a sign-up carries a role choice; a plain sign-in must not touch roles.
    if (mode === "signup") rememberSignupRole(role); else forgetSignupRole();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/app` },
    });
    if (error) {
      forgetSignupRole();
      setGoogleLoading(false);
      toast.error(error.message);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error("Enter your email address"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Password reset link sent — check your email"); setMode("signin"); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password, fullName: mode === "signup" ? fullName : undefined });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { full_name: fullName, role },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Welcome to PitchBridge!");
          navigate("/app");
        } else {
          setCheckEmail(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
        navigate("/app");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally { setLoading(false); }
  };

  if (checkEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md text-center animate-fade-in">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <MailCheck className="h-8 w-8 text-primary" />
          </div>
          <h2 className="font-display text-3xl font-bold">Check your email</h2>
          <p className="text-muted-foreground mt-3 text-sm">
            We sent a confirmation link to <span className="text-foreground font-medium">{email}</span>. Click it to activate your account, then sign in.
          </p>
          <Button variant="outline" className="mt-8" onClick={() => { setCheckEmail(false); setMode("signin"); }}>
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

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

          {mode === "forgot" ? (
            <>
              <h2 className="font-display text-3xl font-bold">Reset your password</h2>
              <p className="text-muted-foreground mt-2 text-sm">Enter your email and we'll send you a reset link.</p>
              <form onSubmit={handleForgot} className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-gradient-primary hover:opacity-95 h-11">
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Send reset link
                </Button>
              </form>
              <div className="mt-6 text-sm text-center text-muted-foreground">
                Remembered it? <button onClick={() => setMode("signin")} className="text-primary font-medium hover:underline">Sign in</button>
              </div>
            </>
          ) : (
            <>
              <h2 className="font-display text-3xl font-bold">{mode === "signup" ? "Create your account" : "Welcome back"}</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                {mode === "signup" ? "Start raising or investing in minutes." : "Sign in to your PitchBridge workspace."}
              </p>

              {mode === "signup" && (
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
              )}

              <Button type="button" variant="outline" onClick={handleGoogle} disabled={googleLoading || loading} className="w-full mt-6 h-11 gap-2">
                {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />} Continue with Google
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or</span></div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <div>
                    <Label htmlFor="fullName">Full name</Label>
                    <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ada Lovelace" required />
                  </div>
                )}
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === "signin" && (
                      <button type="button" onClick={() => setMode("forgot")} className="text-xs text-primary hover:underline">Forgot password?</button>
                    )}
                  </div>
                  <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-gradient-primary hover:opacity-95 h-11">
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {mode === "signup" ? "Create account" : "Sign in"}
                </Button>
              </form>

              <div className="mt-6 text-sm text-center text-muted-foreground">
                {mode === "signup" ? (
                  <>Have an account? <button onClick={() => setMode("signin")} className="text-primary font-medium hover:underline">Sign in</button></>
                ) : (
                  <>New to PitchBridge? <button onClick={() => setMode("signup")} className="text-primary font-medium hover:underline">Create account</button></>
                )}
              </div>
            </>
          )}
          <div className="mt-6 text-center">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Back to home</Link>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Auth;

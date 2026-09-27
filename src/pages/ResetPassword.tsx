import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";
import { z } from "zod";

const schema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Recovery links arrive with type=recovery in the URL hash; the Supabase
    // client exchanges it for a session and fires PASSWORD_RECOVERY.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    if (window.location.hash.includes("type=recovery")) setReady(true);
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) { toast.error(parsed.error.errors[0]?.message ?? "Invalid input"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated — you're signed in");
    navigate("/app");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8"><Logo /></div>
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <KeyRound className="h-7 w-7 text-primary" />
        </div>
        <h2 className="font-display text-3xl font-bold">Set a new password</h2>
        <p className="text-muted-foreground mt-2 text-sm">Choose a strong password for your PitchBridge account.</p>

        {ready ? (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="password">New password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <div>
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" required />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-gradient-primary hover:opacity-95 h-11">
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Update password
            </Button>
          </form>
        ) : (
          <div className="mt-6 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            This reset link is invalid or has expired. Request a new one from the{" "}
            <Link to="/auth" className="text-primary font-medium hover:underline">sign in page</Link>.
          </div>
        )}
      </div>
    </div>
  );
};
export default ResetPassword;

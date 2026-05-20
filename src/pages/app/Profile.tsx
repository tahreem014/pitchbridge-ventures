import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const Profile = () => {
  const { user, role } = useAuth();
  const [form, setForm] = useState({ full_name: "", headline: "", bio: "", company: "", website: "", location: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (data) setForm({
        full_name: data.full_name ?? "", headline: data.headline ?? "", bio: data.bio ?? "",
        company: data.company ?? "", website: data.website ?? "", location: data.location ?? "",
      });
    })();
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("profiles").update(form).eq("id", user!.id);
    setLoading(false);
    if (error) toast.error(error.message); else toast.success("Profile updated");
  };

  return (
    <AppShell title="Profile">
      <div className="p-6 md:p-8 max-w-3xl mx-auto animate-fade-in">
        <Card className="glass-card p-6 md:p-8">
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="h-16 w-16"><AvatarFallback className="bg-gradient-primary text-white text-xl">{form.full_name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase()}</AvatarFallback></Avatar>
            <div>
              <h2 className="font-display text-2xl font-bold">{form.full_name || "Your profile"}</h2>
              <div className="text-sm text-muted-foreground capitalize">{role}</div>
            </div>
          </div>
          <form onSubmit={save} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div><Label>Full name</Label><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><Label>Headline</Label><Input value={form.headline} onChange={e => setForm({ ...form, headline: e.target.value })} placeholder="Founder & CEO at…" /></div>
              <div><Label>Company</Label><Input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
              <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Website</Label><Input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://…" /></div>
              <div className="md:col-span-2"><Label>Bio</Label><Textarea rows={5} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="Tell investors who you are and what you're building." /></div>
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={loading} className="bg-gradient-primary">
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save changes
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
};
export default Profile;

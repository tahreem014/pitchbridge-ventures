import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";

const Profile = () => {
  const { user, role } = useAuth();
  const [form, setForm] = useState({
    full_name: "Ava Chen",
    headline: "Founder & CEO at NeuroPilot AI",
    bio: "Building autonomous AI workflow agents. Previously led ML platform at Stripe.",
    company: "NeuroPilot AI",
    website: "https://neuropilot.ai",
    location: "San Francisco, CA",
  });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Profile updated");
  };

  return (
    <AppShell title="Profile">
      <div className="p-6 md:p-8 max-w-3xl mx-auto animate-fade-in">
        <Card className="glass-card p-6 md:p-8">
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="h-16 w-16"><AvatarFallback className="bg-gradient-primary text-white text-xl">{form.full_name?.[0]?.toUpperCase()}</AvatarFallback></Avatar>
            <div>
              <h2 className="font-display text-2xl font-bold">{form.full_name}</h2>
              <div className="text-sm text-muted-foreground capitalize">{role ?? "entrepreneur"}{user?.email ? ` · ${user.email}` : ""}</div>
            </div>
          </div>
          <form onSubmit={save} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div><Label>Full name</Label><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><Label>Headline</Label><Input value={form.headline} onChange={e => setForm({ ...form, headline: e.target.value })} /></div>
              <div><Label>Company</Label><Input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
              <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Website</Label><Input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Bio</Label><Textarea rows={5} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} /></div>
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" className="bg-gradient-primary">Save changes</Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
};
export default Profile;

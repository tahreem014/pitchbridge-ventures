import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Camera, Loader2, Trash2 } from "lucide-react";
import {
  AVATAR_ACCEPT, removeAvatarFile, resizeToSquare, uploadAvatar, validateAvatarFile,
} from "@/lib/avatar";
import { emit, PROFILE_CHANGED } from "@/lib/events";

const Profile = () => {
  const { user, role } = useAuth();
  const [form, setForm] = useState({ full_name: "", headline: "", bio: "", company: "", website: "", location: "" });
  const [loading, setLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (data) {
        setForm({
          full_name: data.full_name ?? "", headline: data.headline ?? "", bio: data.bio ?? "",
          company: data.company ?? "", website: data.website ?? "", location: data.location ?? "",
        });
        setAvatarUrl(data.avatar_url);
      }
    })();
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("profiles").update(form).eq("id", user!.id);
    setLoading(false);
    if (error) toast.error(error.message); else toast.success("Profile updated");
  };

  const chooseAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // so choosing the same file again still fires
    if (!file || !user) return;
    const problem = validateAvatarFile(file);
    if (problem) { toast.error(problem); return; }

    setAvatarBusy(true);
    try {
      const previous = avatarUrl;
      const url = await uploadAvatar(user.id, await resizeToSquare(file));
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if (error) { await removeAvatarFile(url); throw error; }
      setAvatarUrl(url);
      await removeAvatarFile(previous);
      emit(PROFILE_CHANGED);
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Could not upload that photo");
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    if (!user || !avatarUrl) return;
    setAvatarBusy(true);
    const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
    if (error) { setAvatarBusy(false); toast.error(error.message); return; }
    await removeAvatarFile(avatarUrl);
    setAvatarUrl(null);
    setAvatarBusy(false);
    emit(PROFILE_CHANGED);
    toast.success("Profile photo removed");
  };

  return (
    <AppShell title="Profile">
      <div className="p-6 md:p-8 max-w-3xl mx-auto animate-fade-in">
        <Card className="glass-card p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 mb-6">
            <div className="relative h-24 w-24 flex-shrink-0">
              <Avatar className="h-24 w-24">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="Your profile photo" />}
                <AvatarFallback className="bg-gradient-primary text-white text-3xl">{form.full_name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              {avatarBusy && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold">{form.full_name || "Your profile"}</h2>
              <div className="text-sm text-muted-foreground capitalize">{role}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  ref={fileInput} type="file" accept={AVATAR_ACCEPT} className="hidden"
                  aria-label="Upload profile photo" onChange={chooseAvatar}
                />
                <Button type="button" variant="outline" size="sm" disabled={avatarBusy} onClick={() => fileInput.current?.click()}>
                  <Camera className="h-3.5 w-3.5 mr-1.5" /> {avatarUrl ? "Change photo" : "Upload photo"}
                </Button>
                {avatarUrl && (
                  <Button type="button" variant="ghost" size="sm" disabled={avatarBusy} onClick={removeAvatar}>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remove
                  </Button>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">PNG, JPG or WebP. Your photo is cropped to a square automatically.</p>
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

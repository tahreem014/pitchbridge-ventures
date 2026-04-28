import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2 } from "lucide-react";

const CATEGORIES = ["AI / ML", "FinTech", "HealthTech", "ClimateTech", "SaaS", "Consumer", "Marketplace", "DeepTech", "Web3"];

const schema = z.object({
  title: z.string().trim().min(3).max(120),
  tagline: z.string().trim().max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  category: z.string().min(1),
  stage: z.enum(["idea","prototype","mvp","early_revenue","scaling"]),
  funding_target: z.coerce.number().min(0).max(1_000_000_000),
  equity_offered: z.coerce.number().min(0).max(100).optional(),
  cover_image_url: z.string().trim().url().optional().or(z.literal("")),
  video_url: z.string().trim().url().optional().or(z.literal("")),
  visibility: z.enum(["public","private","unlisted"]),
});

const IdeaForm = () => {
  const { id } = useParams();
  const editing = !!id;
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "", tagline: "", description: "", category: "SaaS",
    stage: "idea" as const, funding_target: 100000, equity_offered: 10,
    cover_image_url: "", video_url: "", visibility: "public" as const,
  });

  useEffect(() => {
    if (!editing) return;
    (async () => {
      const { data } = await supabase.from("ideas").select("*").eq("id", id!).maybeSingle();
      if (data) setForm({
        title: data.title, tagline: data.tagline ?? "", description: data.description ?? "",
        category: data.category ?? "SaaS", stage: data.stage as any,
        funding_target: Number(data.funding_target), equity_offered: Number(data.equity_offered ?? 0),
        cover_image_url: data.cover_image_url ?? "", video_url: data.video_url ?? "",
        visibility: data.visibility as any,
      });
    })();
  }, [id, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.errors[0]?.message ?? "Invalid"); return; }
    setLoading(true);
    const payload = { ...parsed.data, cover_image_url: parsed.data.cover_image_url || null, video_url: parsed.data.video_url || null };
    const res = editing
      ? await supabase.from("ideas").update(payload).eq("id", id!)
      : await supabase.from("ideas").insert({ ...payload, user_id: user!.id });
    setLoading(false);
    if (res.error) toast.error(res.error.message);
    else { toast.success(editing ? "Updated" : "Pitch published"); navigate("/app/ideas"); }
  };

  return (
    <AppShell title={editing ? "Edit Idea" : "New Idea"}>
      <div className="p-6 md:p-8 max-w-3xl mx-auto animate-fade-in">
        <Card className="glass-card p-6 md:p-8">
          <form onSubmit={submit} className="space-y-5">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input id="title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="The next paradigm in…" required />
            </div>
            <div>
              <Label htmlFor="tagline">Tagline</Label>
              <Input id="tagline" value={form.tagline} onChange={e => setForm({ ...form, tagline: e.target.value })} placeholder="One sentence that makes investors lean in." />
            </div>
            <div>
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={6} placeholder="Problem, solution, market, traction, team…" />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Stage</Label>
                <Select value={form.stage} onValueChange={v => setForm({ ...form, stage: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="idea">Idea</SelectItem>
                    <SelectItem value="prototype">Prototype</SelectItem>
                    <SelectItem value="mvp">MVP</SelectItem>
                    <SelectItem value="early_revenue">Early revenue</SelectItem>
                    <SelectItem value="scaling">Scaling</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="funding">Funding target (USD)</Label>
                <Input id="funding" type="number" min={0} value={form.funding_target} onChange={e => setForm({ ...form, funding_target: Number(e.target.value) })} />
              </div>
              <div>
                <Label htmlFor="equity">Equity offered (%)</Label>
                <Input id="equity" type="number" min={0} max={100} step={0.1} value={form.equity_offered} onChange={e => setForm({ ...form, equity_offered: Number(e.target.value) })} />
              </div>
              <div>
                <Label htmlFor="cover">Cover image URL</Label>
                <Input id="cover" value={form.cover_image_url} onChange={e => setForm({ ...form, cover_image_url: e.target.value })} placeholder="https://…" />
              </div>
              <div>
                <Label htmlFor="video">Pitch video URL</Label>
                <Input id="video" value={form.video_url} onChange={e => setForm({ ...form, video_url: e.target.value })} placeholder="https://youtube.com/…" />
              </div>
            </div>

            <div>
              <Label>Visibility</Label>
              <Select value={form.visibility} onValueChange={v => setForm({ ...form, visibility: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public — discoverable by everyone</SelectItem>
                  <SelectItem value="unlisted">Unlisted — only via direct link</SelectItem>
                  <SelectItem value="private">Private — only you</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
              <Button type="submit" disabled={loading} className="bg-gradient-primary">
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editing ? "Save changes" : "Publish pitch"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
};
export default IdeaForm;

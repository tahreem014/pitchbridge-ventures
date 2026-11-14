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
import { Loader2, LockKeyhole } from "lucide-react";
import { DocumentsEditor } from "@/components/pitch/DocumentsEditor";
import {
  EVIDENCE_NOTICE, MAX_SECTION_LENGTH, PITCH_SECTIONS, PitchDetails, emptyDetails, hasAnyDetails,
} from "@/lib/pitchAccess";

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
  // The private part of the pitch lives in its own table and is only ever readable by the founder.
  const [details, setDetails] = useState<PitchDetails>(emptyDetails());
  const [hadDetails, setHadDetails] = useState(false);

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
      const { data: pitch } = await supabase.from("idea_pitch_details").select("*").eq("idea_id", id!).maybeSingle();
      if (pitch) {
        setHadDetails(true);
        setDetails({
          business_model: pitch.business_model ?? "", target_customers: pitch.target_customers ?? "",
          market_research: pitch.market_research ?? "", financial_estimates: pitch.financial_estimates ?? "",
        });
      }
    })();
  }, [id, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.errors[0]?.message ?? "Invalid"); return; }
    if (PITCH_SECTIONS.some(s => details[s.key].length > MAX_SECTION_LENGTH)) {
      toast.error(`Each detailed pitch section can have at most ${MAX_SECTION_LENGTH.toLocaleString()} characters`);
      return;
    }
    setLoading(true);
    const payload = { ...parsed.data, cover_image_url: parsed.data.cover_image_url || null, video_url: parsed.data.video_url || null };

    let ideaId = id ?? "";
    let failure: { message: string } | null = null;
    if (editing) {
      ({ error: failure } = await supabase.from("ideas").update(payload).eq("id", id!));
    } else {
      const created = await supabase.from("ideas").insert({ ...payload, user_id: user!.id } as any).select("id").single();
      failure = created.error;
      ideaId = created.data?.id ?? "";
    }
    if (failure) { setLoading(false); toast.error(failure.message); return; }

    // Save, replace or remove the private pitch (every real change is versioned by the database).
    let pitchFailure: { message: string } | null = null;
    if (hasAnyDetails(details)) {
      ({ error: pitchFailure } = await supabase.from("idea_pitch_details").upsert({
        idea_id: ideaId,
        business_model: details.business_model.trim() || null,
        target_customers: details.target_customers.trim() || null,
        market_research: details.market_research.trim() || null,
        financial_estimates: details.financial_estimates.trim() || null,
      }));
    } else if (hadDetails) {
      ({ error: pitchFailure } = await supabase.from("idea_pitch_details").delete().eq("idea_id", ideaId));
    }
    setLoading(false);
    if (pitchFailure) { toast.error(`The idea was saved, but the detailed pitch was not: ${pitchFailure.message}`); return; }
    toast.success(editing ? "Updated" : "Pitch published");
    navigate("/app/ideas");
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
              <p className="mt-1.5 text-xs text-muted-foreground">Visible to everyone. Keep sensitive details for the private pitch below.</p>
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

            <div className="space-y-4 rounded-2xl border border-border bg-muted/30 p-5">
              <div className="flex items-start gap-3">
                <LockKeyhole className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                <div>
                  <h3 className="font-display font-semibold">Detailed pitch (private)</h3>
                  <p className="text-sm text-muted-foreground">
                    Investors can read this only after you approve their request and they accept your confidentiality terms. Everything above stays public.
                  </p>
                </div>
              </div>
              {PITCH_SECTIONS.map(section => (
                <div key={section.key}>
                  <Label htmlFor={`pitch-${section.key}`}>{section.label}</Label>
                  <Textarea
                    id={`pitch-${section.key}`} rows={5} maxLength={MAX_SECTION_LENGTH} placeholder={section.placeholder}
                    value={details[section.key]} onChange={e => setDetails({ ...details, [section.key]: e.target.value })}
                  />
                </div>
              ))}
              <DocumentsEditor ideaId={editing ? id! : null} userId={user?.id} />
              <p className="text-xs text-muted-foreground">
                Each change is saved as a timestamped version you can see later. {EVIDENCE_NOTICE}
              </p>
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

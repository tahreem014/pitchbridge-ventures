import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { FounderAccessView, FounderDecision, FounderTab, InvestorAccessView } from "@/components/pitch/AccessView";
import { NdaDialog } from "@/components/pitch/NdaDialog";
import { NdaRecordDialog } from "@/components/pitch/NdaRecordDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { displayName } from "@/lib/messages";
import {
  AccessLogItem, AccessPerson, AccessRequestItem, NdaRecord, VersionItem, logDetail,
} from "@/lib/pitchAccess";

const FOUNDER_ACTIONS = ["access_approved", "access_rejected", "access_revoked"];

const SUCCESS = { approve: "Access approved", reject: "Request declined", revoke: "Access revoked" } as const;

const Access = () => {
  const { user, role } = useAuth();
  const userId = user?.id;
  // Investors see their own requests; founders see requests for their ideas.
  const side = role === "investor" ? "investor" : "founder";

  const [requests, setRequests] = useState<AccessRequestItem[]>([]);
  const [log, setLog] = useState<AccessLogItem[]>([]);
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<FounderTab>("requests");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<AccessRequestItem | null>(null);
  const [ndaFor, setNdaFor] = useState<AccessRequestItem | null>(null);
  const [record, setRecord] = useState<NdaRecord | null>(null);

  const loadPeople = async (ids: string[]) => {
    if (ids.length === 0) return new Map<string, AccessPerson>();
    const { data } = await supabase.from("profiles").select("id, full_name, avatar_url, headline, company").in("id", [...new Set(ids)]);
    return new Map((data ?? []).map(p => [p.id, { id: p.id, name: displayName(p.full_name), avatar: p.avatar_url, headline: p.headline, company: p.company }]));
  };
  const personOf = (people: Map<string, AccessPerson>, id: string): AccessPerson =>
    people.get(id) ?? { id, name: "PitchBridge member", avatar: null, headline: null, company: null };

  const load = useCallback(async (initial: boolean) => {
    if (!userId || !role) return;
    if (initial) { setLoading(true); setError(null); }

    if (side === "investor") {
      const [reqs, ndas] = await Promise.all([
        supabase.from("pitch_access_requests")
          .select("id, idea_id, status, message, created_at, decided_at, ideas(id, title, user_id)")
          .eq("investor_id", userId).order("created_at", { ascending: false }),
        supabase.from("nda_acceptances").select("request_id, accepted_at").eq("investor_id", userId),
      ]);
      if (reqs.error || ndas.error) { setError((reqs.error ?? ndas.error)!.message); setLoading(false); return; }
      const accepted = new Map(ndas.data.map(n => [n.request_id, n.accepted_at]));
      const ideaOf = (r: (typeof reqs.data)[number]) => (Array.isArray(r.ideas) ? r.ideas[0] : r.ideas);
      const people = await loadPeople(reqs.data.map(r => ideaOf(r)?.user_id).filter((x): x is string => !!x));
      setRequests(reqs.data.map(r => {
        const idea = ideaOf(r);
        return {
          id: r.id, ideaId: r.idea_id, ideaTitle: idea?.title ?? "an idea that is no longer available", status: r.status,
          message: r.message, createdAt: r.created_at, decidedAt: r.decided_at, ndaAcceptedAt: accepted.get(r.id) ?? null,
          person: idea?.user_id ? personOf(people, idea.user_id) : personOf(people, ""),
        };
      }));
      setLog([]); setVersions([]);
      setError(null); setLoading(false);
      return;
    }

    const { data: myIdeas, error: ideasError } = await supabase.from("ideas").select("id, title").eq("user_id", userId);
    if (ideasError) { setError(ideasError.message); setLoading(false); return; }
    const ids = myIdeas.map(i => i.id);
    const title = new Map(myIdeas.map(i => [i.id, i.title]));
    if (ids.length === 0) { setRequests([]); setLog([]); setVersions([]); setError(null); setLoading(false); return; }

    const [reqs, ndas, events, vers] = await Promise.all([
      supabase.from("pitch_access_requests").select("id, idea_id, investor_id, status, message, created_at, decided_at").in("idea_id", ids).order("created_at", { ascending: false }),
      supabase.from("nda_acceptances").select("request_id, accepted_at").in("idea_id", ids),
      supabase.from("pitch_access_log").select("id, idea_id, actor_id, event, request_id, created_at, details").in("idea_id", ids).order("created_at", { ascending: false }).limit(100),
      supabase.from("pitch_versions").select("id, idea_id, version, content_hash, changed_fields, created_at").in("idea_id", ids).order("created_at", { ascending: false }).limit(200),
    ]);
    const failed = reqs.error ?? ndas.error ?? events.error ?? vers.error;
    if (failed) { setError(failed.message); setLoading(false); return; }

    const accepted = new Map(ndas.data.map(n => [n.request_id, n.accepted_at]));
    const requestById = new Map(reqs.data.map(r => [r.id, r]));
    // For the founder's own decisions the investor is on the request; for everything else it is the actor.
    const investorOfEvent = (e: (typeof events.data)[number]) =>
      (FOUNDER_ACTIONS.includes(e.event) ? requestById.get(e.request_id ?? "")?.investor_id : e.actor_id) ?? "";
    const people = await loadPeople([...reqs.data.map(r => r.investor_id), ...events.data.map(investorOfEvent).filter(Boolean)]);

    setRequests(reqs.data.map(r => ({
      id: r.id, ideaId: r.idea_id, ideaTitle: title.get(r.idea_id) ?? "Idea", status: r.status, message: r.message,
      createdAt: r.created_at, decidedAt: r.decided_at, ndaAcceptedAt: accepted.get(r.id) ?? null, person: personOf(people, r.investor_id),
    })));
    setLog(events.data.map(e => ({
      id: e.id, event: e.event, createdAt: e.created_at, ideaTitle: title.get(e.idea_id) ?? "Idea",
      investorName: personOf(people, investorOfEvent(e)).name, detail: logDetail(e.details),
    })));
    setVersions(vers.data.map(v => ({
      id: v.id, ideaId: v.idea_id, ideaTitle: title.get(v.idea_id) ?? "Idea", version: v.version,
      hash: v.content_hash, createdAt: v.created_at, changes: v.changed_fields ?? [],
    })));
    setError(null);
    setLoading(false);
  }, [userId, role, side]);

  useEffect(() => { load(true); }, [load]);

  // Live: a new request, or the founder's answer, shows up without a refresh (row-level security limits what arrives).
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`access:${userId}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pitch_access_requests" }, () => { load(false); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, load]);

  const decide = async (request: AccessRequestItem, decision: FounderDecision) => {
    setBusyId(request.id);
    const { error: failed } = await supabase.rpc("decide_pitch_access", { _request_id: request.id, _decision: decision });
    setBusyId(null);
    await load(false);
    if (failed) toast.error(failed.message); else toast.success(SUCCESS[decision]);
  };

  const onDecide = (request: AccessRequestItem, decision: FounderDecision) => {
    if (decision === "revoke") setRevoking(request); else decide(request, decision);
  };

  const viewRecord = async (request: AccessRequestItem) => {
    const { data, error: failed } = await supabase.from("nda_acceptances")
      .select("investor_name, investor_email, accepted_at, nda_version, nda_hash, nda_text, ip_address, user_agent")
      .eq("request_id", request.id).maybeSingle();
    if (failed || !data) { toast.error(failed?.message ?? "The signed record could not be loaded"); return; }
    setRecord({
      investorName: data.investor_name, investorEmail: data.investor_email, ideaTitle: request.ideaTitle, acceptedAt: data.accepted_at,
      version: data.nda_version, hash: data.nda_hash, ip: data.ip_address, userAgent: data.user_agent, text: data.nda_text,
    });
  };

  return (
    <AppShell title="Pitch access">
      <div className="p-6 md:p-8 max-w-4xl mx-auto animate-fade-in space-y-6">
        <div>
          <h2 className="font-display text-2xl font-bold">{side === "founder" ? "Who can read your detailed pitch" : "Pitches you asked to read"}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {side === "founder"
              ? "Approve or decline requests, see who accepted your confidentiality terms, and review the history of every change to your pitch."
              : "Founders keep their detailed pitch private. Once a founder approves you and you accept their confidentiality terms, you can read it."}
          </p>
        </div>

        {side === "founder" ? (
          <FounderAccessView
            requests={requests} log={log} versions={versions} tab={tab} onTab={setTab}
            loading={loading} error={error} onRetry={() => load(true)} busyId={busyId} onDecide={onDecide} onViewRecord={viewRecord}
          />
        ) : (
          <InvestorAccessView requests={requests} loading={loading} error={error} onRetry={() => load(true)} onReviewTerms={setNdaFor} onViewRecord={viewRecord} />
        )}
      </div>

      <NdaDialog requestId={ndaFor?.id ?? null} ideaTitle={ndaFor?.ideaTitle ?? ""} onClose={() => setNdaFor(null)} onAccepted={() => load(false)} />
      <NdaRecordDialog record={record} onClose={() => setRecord(null)} />

      <AlertDialog open={!!revoking} onOpenChange={open => { if (!open) setRevoking(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke access?</AlertDialogTitle>
            <AlertDialogDescription>
              {revoking?.person.name} will no longer be able to open the detailed pitch of {revoking?.ideaTitle}. Their accepted confidentiality terms stay on record, and they can ask again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (revoking) { const r = revoking; setRevoking(null); decide(r, "revoke"); } }}>
              Revoke access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};

export default Access;

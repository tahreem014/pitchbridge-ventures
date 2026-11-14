import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, LockKeyhole, Pencil, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { NdaDialog } from "@/components/pitch/NdaDialog";
import { DocumentViewerDialog, PitchDocuments } from "@/components/pitch/PitchDocuments";
import { ProtectedPitch, ReaderInfo } from "@/components/pitch/ProtectedPitch";
import { RequestAccessDialog } from "@/components/pitch/RequestAccessDialog";
import { supabase } from "@/integrations/supabase/client";
import {
  AccessState, AccessStatus, EVIDENCE_NOTICE, PitchDetails, accessState, canRequestAccess, emptyDetails, formatWhen, hasAnyDetails,
} from "@/lib/pitchAccess";
import { PitchDocument, listOwnDocuments, listSharedDocuments } from "@/lib/pitchDocuments";

interface RequestInfo { id: string; status: AccessStatus; createdAt: string; ndaAcceptedAt: string | null }

const toDetails = (row: Partial<Record<keyof PitchDetails, string | null>>): PitchDetails => ({
  ...emptyDetails(),
  business_model: row.business_model ?? "",
  target_customers: row.target_customers ?? "",
  market_research: row.market_research ?? "",
  financial_estimates: row.financial_estimates ?? "",
});

export const PitchAccessCard = ({ idea, userId, role }: {
  idea: { id: string; user_id: string; title: string; has_detailed_pitch: boolean };
  userId: string | undefined;
  role: string | null;
}) => {
  const isOwner = !!userId && userId === idea.user_id;
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<RequestInfo | null>(null);
  const [details, setDetails] = useState<PitchDetails | null>(null);
  const [reader, setReader] = useState<ReaderInfo | undefined>();
  const [requestOpen, setRequestOpen] = useState(false);
  const [ndaFor, setNdaFor] = useState<string | null>(null);
  const [documents, setDocuments] = useState<PitchDocument[]>([]);
  const [viewing, setViewing] = useState<PitchDocument | null>(null);

  const relevant = isOwner || idea.has_detailed_pitch;

  const load = useCallback(async () => {
    // Nothing to show or protect: do not spend any queries on ideas without a detailed pitch.
    if (!userId || !relevant) { setLoading(false); return; }

    if (isOwner) {
      const [{ data }, docs] = await Promise.all([
        supabase.from("idea_pitch_details").select("*").eq("idea_id", idea.id).maybeSingle(),
        listOwnDocuments(idea.id).catch(() => [] as PitchDocument[]),
      ]);
      setDetails(data ? toDetails(data) : null);
      setDocuments(docs);
      setLoading(false);
      return;
    }

    const { data: latest } = await supabase.from("pitch_access_requests")
      .select("id, status, created_at")
      .eq("idea_id", idea.id).eq("investor_id", userId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!latest) { setRequest(null); setDetails(null); setDocuments([]); setLoading(false); return; }

    let ndaAcceptedAt: string | null = null;
    if (latest.status === "approved") {
      const { data: nda } = await supabase.from("nda_acceptances").select("accepted_at").eq("request_id", latest.id).maybeSingle();
      ndaAcceptedAt = nda?.accepted_at ?? null;
    }
    setRequest({ id: latest.id, status: latest.status, createdAt: latest.created_at, ndaAcceptedAt });

    if (latest.status === "approved" && ndaAcceptedAt) {
      // The only way an investor can read the pitch: the server checks access and logs the view.
      const [{ data: rows }, docs] = await Promise.all([
        supabase.rpc("get_pitch_details", { _idea_id: idea.id }),
        listSharedDocuments(idea.id).catch(() => [] as PitchDocument[]),
      ]);
      const row = rows?.[0];
      setDetails(row ? toDetails(row) : null);
      setReader(row ? { name: row.viewer_name, email: row.viewer_email, ndaAcceptedAt: row.nda_accepted_at } : undefined);
      setDocuments(docs);
    } else {
      setDetails(null);
      setReader(undefined);
      setDocuments([]);
    }
    setLoading(false);
  }, [userId, isOwner, relevant, idea.id]);

  useEffect(() => { load(); }, [load]);

  // If the founder answers while this page is open, update straight away.
  useEffect(() => {
    if (!userId || isOwner || !relevant) return;
    const channel = supabase
      .channel(`pitch-access:${idea.id}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pitch_access_requests", filter: `investor_id=eq.${userId}` }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, isOwner, relevant, idea.id, load]);

  if (!relevant) return null;

  const state: AccessState = accessState(request);
  const isInvestor = role === "investor";

  const header = (
    <div className="mb-4 flex items-center gap-2">
      <LockKeyhole className="h-5 w-5 text-primary" />
      <h3 className="font-display text-lg font-semibold">Detailed pitch</h3>
      <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">Private</span>
    </div>
  );

  if (loading) return <Card className="glass-card p-6">{header}<Skeleton className="h-24 w-full rounded-xl" /></Card>;

  if (isOwner) {
    return (
      <Card className="glass-card p-6">
        {header}
        <p className="mb-4 text-sm text-muted-foreground">Only you, and investors you approve who have accepted your confidentiality terms, can read this.</p>
        {details && hasAnyDetails(details)
          ? <ProtectedPitch details={details} />
          : documents.length === 0 && <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">You have not added a detailed pitch yet.</p>}
        <PitchDocuments documents={documents} onView={setViewing} note="You see the same stamped copy an investor would get, with your own name on it." />
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to={`/app/ideas/${idea.id}/edit`}><Button size="sm" variant="outline"><Pencil className="mr-1.5 h-3.5 w-3.5" /> {details || documents.length > 0 ? "Edit pitch" : "Add detailed pitch"}</Button></Link>
          <Link to="/app/access"><Button size="sm" variant="outline"><Users className="mr-1.5 h-3.5 w-3.5" /> Manage access</Button></Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">{EVIDENCE_NOTICE}</p>
        <DocumentViewerDialog doc={viewing} onClose={() => setViewing(null)} />
      </Card>
    );
  }

  if (state === "granted" && details) {
    return (
      <Card className="glass-card p-6">
        {header}
        <ProtectedPitch details={details} reader={reader} />
        <PitchDocuments documents={documents} onView={setViewing} note="Each copy is stamped with your name and email, and every time you open one is recorded." />
        <DocumentViewerDialog doc={viewing} onClose={() => setViewing(null)} />
      </Card>
    );
  }

  return (
    <Card className="glass-card p-6">
      {header}
      <p className="text-sm text-muted-foreground">
        The founder keeps the business model, target customers, market research and financial estimates private. You can read them once the founder
        approves your request and you accept their confidentiality terms.
      </p>

      <div className="mt-5">
        {!isInvestor ? (
          <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">Switch to Investor mode to request access.</p>
        ) : state === "pending" ? (
          <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-4 py-3 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>Request sent {request ? formatWhen(request.createdAt) : ""}. Waiting for the founder to reply.</span>
          </div>
        ) : state === "needs_nda" ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
            <p className="text-sm"><span className="font-medium">Approved.</span> Review and accept the confidentiality terms to unlock the pitch.</p>
            <Button size="sm" className="bg-gradient-primary" onClick={() => request && setNdaFor(request.id)}>
              <ShieldCheck className="mr-1.5 h-4 w-4" /> Review confidentiality terms
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {state === "rejected" && <p className="text-sm text-muted-foreground">The founder declined your last request.</p>}
            {state === "revoked" && <p className="text-sm text-muted-foreground">The founder withdrew your access.</p>}
            {canRequestAccess(state) && (
              <Button size="sm" className="bg-gradient-primary" onClick={() => setRequestOpen(true)}>
                <LockKeyhole className="mr-1.5 h-4 w-4" /> {state === "none" ? "Request access" : "Request access again"}
              </Button>
            )}
          </div>
        )}
      </div>

      <RequestAccessDialog open={requestOpen} onOpenChange={setRequestOpen} ideaId={idea.id} ideaTitle={idea.title} onSent={load} />
      <NdaDialog requestId={ndaFor} ideaTitle={idea.title} onClose={() => setNdaFor(null)} onAccepted={load} />
    </Card>
  );
};

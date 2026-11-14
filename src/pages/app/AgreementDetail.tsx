import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Download, FilePenLine, Loader2, MessageSquare, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AgreementDocument } from "@/components/agreements/AgreementDocument";
import { StatusBadge, TypeBadge } from "@/components/agreements/AgreementBits";
import { AgreementTermsForm } from "@/components/agreements/AgreementTermsForm";
import { ConfirmAgreementDialog } from "@/components/agreements/ConfirmAgreementDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  AgreementItem, EventItem, TermsForm, cancelAgreement, confirmAgreement, confirmedNow, counterpartOf, describeEvent, fetchAgreement, firstName,
  formFromAgreement, myParty, nextStep, saveTerms, summaryLine, turnOf, validateTerms,
} from "@/lib/agreements";
import { initialsOf } from "@/lib/messages";
import { formatWhen, shortHash } from "@/lib/pitchAccess";
import { formatMoney } from "@/lib/portfolio";

const downloadPdf = async (agreement: AgreementItem) => {
  const { buildAgreementPdf, pdfFileName } = await import("@/lib/agreementPdf");
  const bytes = await buildAgreementPdf(agreement);
  const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = pdfFileName(agreement);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const Fact = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="rounded-xl bg-muted/50 px-4 py-3">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="font-display text-lg font-semibold">{value}</div>
    {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
  </div>
);

const AgreementDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const [agreement, setAgreement] = useState<AgreementItem | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const load = useCallback(async (initial: boolean) => {
    if (!id || !userId) return;
    if (initial) { setLoading(true); setError(null); }
    try {
      const found = await fetchAgreement(id);
      if (!found) { setMissing(true); setAgreement(null); } else { setMissing(false); setAgreement(found.agreement); setEvents(found.events); }
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
    setLoading(false);
  }, [id, userId]);

  useEffect(() => { load(true); }, [load]);

  // Live: the other person confirming or editing shows up straight away.
  useEffect(() => {
    if (!id || !userId) return;
    const channel = supabase
      .channel(`agreement:${id}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "agreements", filter: `id=eq.${id}` }, () => { load(false); })
      .on("postgres_changes", { event: "*", schema: "public", table: "agreement_confirmations", filter: `agreement_id=eq.${id}` }, () => { load(false); })
      .on("postgres_changes", { event: "*", schema: "public", table: "agreement_events", filter: `agreement_id=eq.${id}` }, () => { load(false); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, userId, load]);

  const backLink = (
    <Link to="/app/agreements" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> All agreements
    </Link>
  );

  if (loading) {
    return (
      <AppShell title="Agreement">
        <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-4"><Skeleton className="h-8 w-40" /><Skeleton className="h-40 w-full rounded-2xl" /><Skeleton className="h-72 w-full rounded-2xl" /></div>
      </AppShell>
    );
  }

  if (error || missing || !agreement) {
    return (
      <AppShell title="Agreement">
        <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-4">
          {backLink}
          <Card className="glass-card p-10 text-center">
            <div className="font-display text-lg font-semibold">{error ? "We could not load this agreement" : "Agreement not found"}</div>
            <p className="mt-1 text-sm text-muted-foreground">{error ?? "It may not exist, or it belongs to other people."}</p>
            {error && <Button variant="outline" className="mt-4" onClick={() => load(true)}>Try again</Button>}
          </Card>
        </div>
      </AppShell>
    );
  }

  const a = agreement;
  const me = myParty(a, userId);
  const other = counterpartOf(a, userId);
  const confirmed = confirmedNow(a);
  const turn = turnOf(a, userId);
  const isDraft = a.status === "draft";
  const todo = isDraft ? validateTerms(formFromAgreement(a), a.amount, true) : [];
  const canConfirm = isDraft && turn === "you" && todo.length === 0;
  const myConfirmation = confirmed[me];
  const nameOf = (actorId: string | null) => (actorId === userId ? "You" : actorId === a.investor.id ? a.investor.name : actorId === a.founder.id ? a.founder.name : "Someone");

  const onSave = async (form: TermsForm) => {
    setSaving(true);
    try {
      const before = a.version;
      const version = await saveTerms(a.id, form);
      toast.success(version === before ? "Nothing changed" : `Saved as version ${version}`);
      setEditing(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
    await load(false);
  };

  const onConfirm = async () => {
    setBusy(true);
    try {
      const result = await confirmAgreement(a.id, a.version);
      setConfirming(false);
      toast.success(result === "executed" ? `Agreement signed. ${formatMoney(a.amount)} now counts as raised.` : `Confirmed. Waiting for ${firstName(other.name)}.`);
    } catch (e) {
      setConfirming(false);
      toast.error((e as Error).message);
    }
    setBusy(false);
    await load(false); // always show the true state, for example if the other person changed the terms first
  };

  const onCancel = async () => {
    setCancelling(false);
    setBusy(true);
    try {
      await cancelAgreement(a.id);
      toast.success("Agreement cancelled");
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
    await load(false);
  };

  const onPdf = async () => {
    setPdfBusy(true);
    try { await downloadPdf(a); } catch { toast.error("The PDF could not be created. Please try again."); }
    setPdfBusy(false);
  };

  return (
    <AppShell title="Agreement">
      <div className="p-6 md:p-8 max-w-4xl mx-auto animate-fade-in space-y-6">
        {backLink}

        <Card className="glass-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-display text-2xl font-bold">{a.ideaTitle ?? "An idea that is no longer available"}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <StatusBadge status={a.status} />
                <TypeBadge type={a.type} />
                <span className="text-muted-foreground">Version {a.version}</span>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {other.avatar && <AvatarImage src={other.avatar} alt={other.name} />}
                  <AvatarFallback className="bg-gradient-primary text-sm text-white">{initialsOf(other.name)}</AvatarFallback>
                </Avatar>
                <div className="text-sm">
                  <div className="font-medium">{other.name}</div>
                  <div className="text-xs text-muted-foreground">You are the {me === "investor" ? "investor" : "founder"}; they are the {me === "investor" ? "founder" : "investor"}</div>
                </div>
              </div>
            </div>
            <div className="sm:text-right">
              <div className="font-display text-3xl font-bold">{formatMoney(a.amount)}</div>
              <div className="text-sm text-muted-foreground">{summaryLine(a)}</div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm" data-testid="next-step">{nextStep(a, userId)}</div>

          {isDraft && turn === "you" && todo.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
              <p className="font-medium">Before you can confirm:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">{todo.map(p => <li key={p}>{p}</li>)}</ul>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {isDraft && (
              <>
                <Button className="bg-gradient-primary" disabled={!canConfirm || busy} onClick={() => setConfirming(true)}>
                  <Check className="mr-1.5 h-4 w-4" /> {myConfirmation ? `You confirmed version ${a.version}` : `Confirm version ${a.version}`}
                </Button>
                <Button variant="outline" disabled={editing || busy} onClick={() => setEditing(true)}>
                  <FilePenLine className="mr-1.5 h-4 w-4" /> Edit terms
                </Button>
                <Button variant="ghost" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => setCancelling(true)}>
                  <XCircle className="mr-1.5 h-4 w-4" /> Cancel agreement
                </Button>
              </>
            )}
            <Button variant="outline" disabled={pdfBusy} onClick={onPdf} className="sm:ml-auto">
              {pdfBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />} Download PDF
            </Button>
            <Link to={`/app/messages?with=${other.id}`}>
              <Button variant="outline"><MessageSquare className="mr-1.5 h-4 w-4" /> Message {firstName(other.name)}</Button>
            </Link>
          </div>
        </Card>

        <Tabs defaultValue="agreement">
          <TabsList>
            <TabsTrigger value="agreement">Agreement</TabsTrigger>
            <TabsTrigger value="confirmations">Confirmations</TabsTrigger>
            <TabsTrigger value="history">History <span className="ml-1.5 text-xs text-muted-foreground">{events.length}</span></TabsTrigger>
          </TabsList>

          <TabsContent value="agreement" className="mt-4">
            <Card className="glass-card p-6">
              {editing ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
                    {confirmed.investor || confirmed.entrepreneur
                      ? `${confirmed.investor && confirmed.entrepreneur ? "Both of you have" : `${firstName(confirmed.investor ? a.investor.name : a.founder.name)} has`} confirmed version ${a.version}. Saving a change makes version ${a.version + 1}, and everyone will need to confirm again.`
                      : `Saving a change makes version ${a.version + 1}. ${firstName(other.name)} will be told.`}
                  </div>
                  <AgreementTermsForm agreement={a} saving={saving} onSave={onSave} onCancel={() => setEditing(false)} />
                </div>
              ) : (
                <>
                  <div className="mb-5 grid gap-3 sm:grid-cols-3">
                    <Fact label="Agreed amount" value={formatMoney(a.amount)} hint="Fixed by the accepted proposal" />
                    <Fact label="Version" value={String(a.version)} hint={`Fingerprint ${shortHash(a.hash)}`} />
                    <Fact label="Payments" value={String(a.terms.schedule.length)} hint={a.terms.schedule.length === 1 ? "one payment" : "payments in the schedule"} />
                  </div>
                  <AgreementDocument agreement={a} />
                </>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="confirmations" className="mt-4">
            <Card className="glass-card divide-y divide-border">
              {([["investor", a.investor], ["entrepreneur", a.founder]] as const).map(([key, person]) => {
                const c = confirmed[key];
                return (
                  <div key={key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div>
                      <div className="font-medium">{person.name} <span className="text-xs font-normal text-muted-foreground">({key === "investor" ? "investor" : "founder"})</span></div>
                      <div className="text-xs text-muted-foreground">{person.email ?? "Email appears after they confirm"}</div>
                    </div>
                    <div className="text-sm">
                      {c ? <span className="text-emerald-600 dark:text-emerald-400">Confirmed version {c.version} · {formatWhen(c.confirmedAt)}</span>
                        : <span className="text-muted-foreground">Has not confirmed version {a.version}</span>}
                    </div>
                  </div>
                );
              })}
              {a.confirmations.length > 0 && (
                <div className="px-5 py-4">
                  <div className="mb-2 text-sm font-medium">Record of every confirmation</div>
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    {[...a.confirmations].reverse().map(c => (
                      <li key={c.id}>
                        <span className="text-foreground">{c.name ?? "Unknown"}{c.email ? ` <${c.email}>` : ""}</span> confirmed version {c.version}
                        {c.version !== a.version ? " (an earlier version, no longer counts)" : ""} on {formatWhen(c.confirmedAt)}
                        {c.ip ? ` from ${c.ip}` : ""}. Fingerprint {shortHash(c.hash)}.
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card className="glass-card divide-y divide-border">
              {events.length === 0
                ? <div className="px-5 py-8 text-center text-sm text-muted-foreground">Nothing has happened yet.</div>
                : [...events].reverse().map(e => (
                  <div key={e.id} className="px-5 py-3.5">
                    <div className="text-sm">{describeEvent(e, nameOf(e.actorId))}</div>
                    <div className="text-xs text-muted-foreground">{formatWhen(e.createdAt)}</div>
                  </div>
                ))}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ConfirmAgreementDialog agreement={confirming ? a : null} otherName={other.name} busy={busy} onConfirm={onConfirm} onClose={() => setConfirming(false)} />

      <AlertDialog open={cancelling} onOpenChange={setCancelling}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this agreement?</AlertDialogTitle>
            <AlertDialogDescription>
              {firstName(other.name)} will be told. The proposal will be marked withdrawn and the money will not count as raised. To work together again, a new proposal is needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep the agreement</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onCancel}>Cancel agreement</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};

export default AgreementDetail;

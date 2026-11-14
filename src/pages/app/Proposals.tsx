import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CounterDialog, CounterTerms } from "@/components/proposals/CounterDialog";
import { ProposalsView } from "@/components/proposals/ProposalsView";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { displayName } from "@/lib/messages";
import { AgreementStatus, formatMoney } from "@/lib/portfolio";
import { Filter, ProposalAction, ProposalItem, Side, firstName, formatTerms } from "@/lib/proposals";

const SUCCESS: Record<ProposalAction, string> = {
  accept: "Proposal accepted",
  decline: "Proposal declined",
  counter: "Counter-offer sent",
  accept_counter: "Counter-offer accepted",
  withdraw: "Proposal withdrawn",
};

type Confirm = { item: ProposalItem; action: Exclude<ProposalAction, "counter"> };

const confirmCopy = ({ item, action }: Confirm) => {
  const name = firstName(item.counterpart.name);
  const idea = item.idea?.title ?? "this idea";
  switch (action) {
    case "accept":
      return {
        title: "Accept this proposal?",
        body: `You are accepting ${name}'s offer of ${formatTerms(item.amount, item.equity)} for ${idea}. This starts an investment agreement that you both review and confirm. The ${formatMoney(item.amount)} only counts as raised once you have both confirmed it.`,
        cta: "Accept proposal", destructive: false,
      };
    case "decline":
      return { title: "Decline this proposal?", body: `${name} will be told that you declined their offer of ${formatTerms(item.amount, item.equity)} for ${idea}.`, cta: "Decline proposal", destructive: true };
    case "withdraw":
      return { title: "Withdraw your proposal?", body: `Your offer of ${formatTerms(item.amount, item.equity)} for ${idea} will be withdrawn and ${name} will be told.`, cta: "Withdraw proposal", destructive: true };
    case "accept_counter": {
      const amount = item.counterAmount ?? item.amount;
      return {
        title: "Accept the counter-offer?",
        body: `You will invest ${formatTerms(amount, item.counterEquity ?? item.equity)} in ${idea}. This starts an investment agreement that you both review and confirm. The ${formatMoney(amount)} only counts as raised once you have both confirmed it.`,
        cta: "Accept counter-offer", destructive: false,
      };
    }
  }
};

const Proposals = () => {
  const { user, role } = useAuth();
  const userId = user?.id;
  // Investors see the proposals they sent; founders see the ones they received.
  const side: Side = role === "investor" ? "investor" : "founder";

  const [items, setItems] = useState<ProposalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [counterFor, setCounterFor] = useState<ProposalItem | null>(null);

  const load = useCallback(async (initial: boolean) => {
    if (!userId || !role) return;
    if (initial) { setLoading(true); setError(null); }
    const mine = side === "investor" ? "investor_id" : "entrepreneur_id";
    const { data, error: failed } = await supabase.from("proposals")
      .select("id, investor_id, entrepreneur_id, amount, equity, message, status, counter_amount, counter_equity, counter_message, created_at, ideas(id, title, category), agreements(id, status)")
      .eq(mine, userId)
      .order("created_at", { ascending: false });
    if (failed) { setError(failed.message); setLoading(false); return; }

    const otherId = (row: { investor_id: string; entrepreneur_id: string }) => (side === "investor" ? row.entrepreneur_id : row.investor_id);
    const ids = [...new Set(data.map(otherId))];
    const { data: people } = ids.length
      ? await supabase.from("profiles").select("id, full_name, avatar_url, headline, company").in("id", ids)
      : { data: [] };
    const byId = new Map((people ?? []).map(p => [p.id, p]));

    setItems(data.map(row => {
      const person = byId.get(otherId(row));
      const idea = Array.isArray(row.ideas) ? row.ideas[0] : row.ideas;
      const agreement = Array.isArray(row.agreements) ? row.agreements[0] : row.agreements;
      return {
        id: row.id,
        status: row.status,
        amount: Number(row.amount),
        equity: row.equity == null ? null : Number(row.equity),
        message: row.message,
        counterAmount: row.counter_amount == null ? null : Number(row.counter_amount),
        counterEquity: row.counter_equity == null ? null : Number(row.counter_equity),
        counterMessage: row.counter_message,
        createdAt: row.created_at,
        idea: idea ?? null,
        agreement: agreement ? { id: agreement.id, status: agreement.status as AgreementStatus } : null,
        counterpart: {
          id: otherId(row),
          name: displayName(person?.full_name),
          avatar: person?.avatar_url ?? null,
          headline: person?.headline ?? null,
          company: person?.company ?? null,
        },
      };
    }));
    setError(null);
    setLoading(false);
  }, [userId, role, side]);

  useEffect(() => { load(true); }, [load]);
  useEffect(() => { setFilter("all"); }, [side]);

  // Live: the other person answering (or a new proposal arriving) shows up without a refresh.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`proposals:${userId}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "proposals", filter: `investor_id=eq.${userId}` }, () => { load(false); })
      .on("postgres_changes", { event: "*", schema: "public", table: "proposals", filter: `entrepreneur_id=eq.${userId}` }, () => { load(false); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, load]);

  const respond = async (item: ProposalItem, action: ProposalAction, terms?: CounterTerms) => {
    setBusyId(item.id);
    const { error: failed } = await supabase.rpc("respond_to_proposal", {
      _proposal_id: item.id,
      _action: action,
      ...(terms ? { _amount: terms.amount, _equity: terms.equity ?? undefined, _message: terms.message || undefined } : {}),
    });
    setBusyId(null);
    // Whatever happened, show the true state (for example if the other person answered first).
    await load(false);
    if (failed) { toast.error(failed.message); return false; }
    toast.success(SUCCESS[action]);
    return true;
  };

  const onAction = (item: ProposalItem, action: ProposalAction) => {
    if (action === "counter") setCounterFor(item);
    else setConfirm({ item, action });
  };

  const copy = confirm ? confirmCopy(confirm) : null;

  return (
    <AppShell title="Proposals">
      <div className="p-6 md:p-8 max-w-4xl mx-auto animate-fade-in space-y-6">
        <div>
          <h2 className="font-display text-2xl font-bold">{side === "founder" ? "Proposals you received" : "Proposals you sent"}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {side === "founder"
              ? "Review offers from investors. Accept, counter with your own terms, or decline."
              : "Track your offers and answer any counter-offers from founders."}
          </p>
        </div>

        <ProposalsView
          side={side} items={items} filter={filter} onFilter={setFilter}
          loading={loading} error={error} onRetry={() => load(true)} busyId={busyId} onAction={onAction}
        />
      </div>

      <CounterDialog proposal={counterFor} onClose={() => setCounterFor(null)} onSubmit={(item, terms) => respond(item, "counter", terms)} />

      <AlertDialog open={!!confirm} onOpenChange={open => { if (!open) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy?.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={copy?.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-gradient-primary"}
              onClick={() => { if (confirm) { const c = confirm; setConfirm(null); respond(c.item, c.action); } }}
            >
              {copy?.cta}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};

export default Proposals;

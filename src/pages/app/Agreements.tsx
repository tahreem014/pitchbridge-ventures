import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, FileSignature, Hourglass, Inbox } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge, TypeBadge } from "@/components/agreements/AgreementBits";
import { KpiCard } from "@/components/charts/kit";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  AgreementItem, counterpartOf, fetchAgreements, myParty, nextStep, sortAgreements, summarizeAgreements, summaryLine, turnOf,
} from "@/lib/agreements";
import { initialsOf } from "@/lib/messages";
import { formatMoney } from "@/lib/portfolio";

const AgreementCard = ({ agreement: a, userId }: { agreement: AgreementItem; userId: string }) => {
  const person = counterpartOf(a, userId);
  const yourTurn = turnOf(a, userId) === "you";
  return (
    <Link to={`/app/agreements/${a.id}`} className="block" aria-label={`Open the agreement for ${a.ideaTitle ?? "this idea"}`}>
      <Card className="glass-card hover-lift p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-11 w-11 flex-shrink-0">
              {person.avatar && <AvatarImage src={person.avatar} alt={person.name} />}
              <AvatarFallback className="bg-gradient-primary text-sm text-white">{initialsOf(person.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate font-semibold">{a.ideaTitle ?? "An idea that is no longer available"}</div>
              <div className="truncate text-xs text-muted-foreground">
                With {person.name} · you are the {myParty(a, userId) === "investor" ? "investor" : "founder"}
              </div>
            </div>
          </div>
          <div className="sm:text-right">
            <div className="font-display text-xl font-bold">{formatMoney(a.amount)}</div>
            <div className="text-xs text-muted-foreground">{summaryLine(a)}</div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <StatusBadge status={a.status} />
          <TypeBadge type={a.type} />
          <span className="text-muted-foreground">Version {a.version}</span>
          <span className="text-muted-foreground">Updated {formatDistanceToNow(new Date(a.updatedAt), { addSuffix: true })}</span>
          {yourTurn && <span className="rounded-full bg-primary px-2.5 py-0.5 font-medium text-primary-foreground">Your turn</span>}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{nextStep(a, userId)}</p>
      </Card>
    </Link>
  );
};

const Agreements = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const [items, setItems] = useState<AgreementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (initial: boolean) => {
    if (!userId) return;
    if (initial) { setLoading(true); setError(null); }
    try {
      setItems(await fetchAgreements());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(true); }, [load]);

  // Live: the other person confirming or changing the terms shows up without a refresh.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`agreements:${userId}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "agreements" }, () => { load(false); })
      .on("postgres_changes", { event: "*", schema: "public", table: "agreement_confirmations" }, () => { load(false); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, load]);

  const stats = summarizeAgreements(items, userId ?? "");
  const shown = userId ? sortAgreements(items, userId) : [];

  return (
    <AppShell title="Agreements">
      <div className="p-6 md:p-8 max-w-4xl mx-auto animate-fade-in space-y-6">
        <div>
          <h2 className="font-display text-2xl font-bold">Investment agreements</h2>
          <p className="text-sm text-muted-foreground mt-1">
            When a proposal is accepted, an agreement is drafted here. Read it, adjust the terms together, and confirm. The money counts as raised once you both confirm the same version.
          </p>
        </div>

        {error ? (
          <Card className="glass-card p-10 text-center">
            <div className="font-display text-lg font-semibold">We could not load your agreements</div>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => load(true)}>Try again</Button>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard icon={Inbox} loading={loading} tone="bg-gradient-primary" label="Needs your confirmation" value={String(stats.needsYou)} hint="waiting for you" />
              <KpiCard icon={Hourglass} loading={loading} tone="bg-gradient-accent" label="Waiting for the other side" value={String(stats.waiting)} hint="you have confirmed" />
              <KpiCard icon={CheckCircle2} loading={loading} tone="bg-accent" label="Signed" value={formatMoney(stats.signedAmount)}
                hint={`${stats.signedCount} ${stats.signedCount === 1 ? "agreement" : "agreements"}`} />
            </div>

            {loading ? (
              <div className="space-y-4">{[0, 1, 2].map(i => <Skeleton key={i} className="h-36 w-full rounded-2xl" />)}</div>
            ) : items.length === 0 ? (
              <Card className="glass-card p-12 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-accent"><FileSignature className="h-6 w-6 text-white" /></div>
                <div className="font-display text-xl font-semibold">No agreements yet</div>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  An agreement is created when a founder accepts an investor's proposal, or an investor accepts a founder's counter-offer.
                </p>
                <Link to="/app/proposals"><Button className="mt-5 bg-gradient-primary">Go to proposals</Button></Link>
              </Card>
            ) : (
              <div className="space-y-4">
                {shown.map(a => <AgreementCard key={a.id} agreement={a} userId={userId!} />)}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
};

export default Agreements;

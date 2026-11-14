import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Check, CheckCircle2, FileSignature, Hourglass, Inbox, MessageSquare, Reply, Undo2, X } from "lucide-react";
import { StatusBadge } from "@/components/agreements/AgreementBits";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/charts/kit";
import { STATUS_COLORS } from "@/components/charts/theme";
import { cn } from "@/lib/utils";
import { initialsOf } from "@/lib/messages";
import { STATUS_LABELS, formatMoney } from "@/lib/portfolio";
import {
  FILTERS, FILTER_LABELS, Filter, ProposalAction, ProposalItem, Side,
  actionsFor, countByFilter, filterItems, firstName, formatTerms, sortItems, statusHint, summarize,
} from "@/lib/proposals";

const ACTIONS: Record<ProposalAction, { label: string; icon: typeof Check; className: string; variant: "default" | "outline" | "ghost" }> = {
  accept: { label: "Accept", icon: Check, variant: "default", className: "bg-gradient-primary" },
  accept_counter: { label: "Accept counter-offer", icon: Check, variant: "default", className: "bg-gradient-primary" },
  counter: { label: "Counter", icon: Reply, variant: "outline", className: "" },
  decline: { label: "Decline", icon: X, variant: "ghost", className: "text-destructive hover:text-destructive" },
  withdraw: { label: "Withdraw", icon: Undo2, variant: "ghost", className: "text-muted-foreground" },
};

const ProposalCard = ({ item, side, busy, onAction }: {
  item: ProposalItem; side: Side; busy: boolean; onAction: (item: ProposalItem, action: ProposalAction) => void;
}) => {
  const { counterpart: person } = item;
  const subtitle = [person.headline, person.company].filter(Boolean).join(" · ");
  const hint = statusHint(side, item);
  const showCounter = item.status === "countered" && item.counterAmount != null;

  return (
    <Card className="glass-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-11 w-11 flex-shrink-0">
            {person.avatar && <AvatarImage src={person.avatar} alt={person.name} />}
            <AvatarFallback className="bg-gradient-primary text-sm text-white">{initialsOf(person.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate font-semibold">{person.name}</div>
            {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
          </div>
        </div>
        <div className="sm:text-right">
          <div className="font-display text-xl font-bold">{formatMoney(item.amount)}</div>
          <div className="text-xs text-muted-foreground">{item.equity != null ? `${Number(item.equity)}% equity` : "No equity specified"}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="text-muted-foreground">{side === "founder" ? "For" : "To"}</span>
        {item.idea
          ? <Link to={`/app/ideas/${item.idea.id}`} className="font-medium hover:text-primary">{item.idea.title}</Link>
          : <span className="text-muted-foreground">an idea that is no longer available</span>}
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[item.status] }} />
          {STATUS_LABELS[item.status]}
        </span>
        <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
      </div>

      {item.message && (
        <blockquote className="mt-3 rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">&ldquo;{item.message}&rdquo;</blockquote>
      )}

      {showCounter && (
        <div className="mt-3 rounded-xl border-l-4 px-4 py-3 text-sm" style={{ borderColor: STATUS_COLORS.countered, background: "hsl(var(--muted) / 0.5)" }}>
          <div className="font-medium">{side === "investor" ? "Counter-offer" : "Your counter-offer"}: {formatTerms(Number(item.counterAmount), item.counterEquity)}</div>
          {item.counterMessage && <p className="mt-1 text-muted-foreground">&ldquo;{item.counterMessage}&rdquo;</p>}
        </div>
      )}

      {item.status === "accepted" && item.agreement && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-3 text-sm">
          <span className="flex items-center gap-2"><FileSignature className="h-4 w-4 text-primary" /> Investment agreement <StatusBadge status={item.agreement.status} /></span>
          <Link to={`/app/agreements/${item.agreement.id}`}><Button size="sm" variant="outline">Open agreement</Button></Link>
        </div>
      )}

      {hint && <p className="mt-3 text-xs text-muted-foreground">{hint}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {actionsFor(side, item.status).map(action => {
          const a = ACTIONS[action];
          return (
            <Button key={action} size="sm" variant={a.variant} className={a.className} disabled={busy} onClick={() => onAction(item, action)}>
              <a.icon className="mr-1.5 h-3.5 w-3.5" /> {a.label}
            </Button>
          );
        })}
        <Link to={`/app/messages?with=${person.id}`} className="sm:ml-auto">
          <Button size="sm" variant="outline"><MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Message {firstName(person.name)}</Button>
        </Link>
      </div>
    </Card>
  );
};

export const ProposalsView = ({ side, items, filter, onFilter, loading = false, error = null, onRetry, busyId = null, onAction }: {
  side: Side;
  items: ProposalItem[];
  filter: Filter;
  onFilter: (filter: Filter) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  busyId?: string | null;
  onAction: (item: ProposalItem, action: ProposalAction) => void;
}) => {
  if (error) {
    return (
      <Card className="glass-card p-10 text-center">
        <div className="font-display text-lg font-semibold">We could not load your proposals</div>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        {onRetry && <Button variant="outline" className="mt-4" onClick={onRetry}>Try again</Button>}
      </Card>
    );
  }

  const stats = summarize(items, side);
  const counts = countByFilter(items);
  const shown = sortItems(filterItems(items, filter), side);
  const founder = side === "founder";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard icon={Inbox} loading={loading} tone="bg-gradient-primary"
          label="Needs your reply" value={String(stats.needsReply)}
          hint={`${formatMoney(stats.needsReplyAmount)} in ${founder ? "new offers" : "counter-offers"}`} />
        <KpiCard icon={Hourglass} loading={loading} tone="bg-gradient-accent"
          label="Open offers" value={formatMoney(stats.openAmount)} hint={`${stats.openCount} still in play`} />
        <KpiCard icon={CheckCircle2} loading={loading} tone="bg-accent"
          label="Accepted" value={formatMoney(stats.acceptedAmount)} hint={`${stats.acceptedCount} ${stats.acceptedCount === 1 ? "deal" : "deals"}`} />
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Filter proposals by status">
        {FILTERS.map(f => (
          <button
            key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => onFilter(f)}
            className={cn(
              "flex-shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors",
              filter === f ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
            )}
          >
            {FILTER_LABELS[f]} <span className={cn("ml-1 text-xs", filter === f ? "text-primary-foreground/80" : "text-muted-foreground")}>{counts[f]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">{[0, 1, 2].map(i => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}</div>
      ) : items.length === 0 ? (
        <Card className="glass-card p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-accent"><Inbox className="h-6 w-6 text-white" /></div>
          <div className="font-display text-xl font-semibold">{founder ? "No proposals yet" : "You have not sent any proposals"}</div>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {founder
              ? "When an investor likes one of your published ideas and makes an offer, it will show up here."
              : "Open an idea you like and choose Send proposal. Your offers and any counter-offers will be tracked here."}
          </p>
          {!founder && <Link to="/app/discover"><Button className="mt-5 bg-gradient-primary">Discover ideas</Button></Link>}
        </Card>
      ) : shown.length === 0 ? (
        <Card className="glass-card p-10 text-center text-sm text-muted-foreground">No {FILTER_LABELS[filter].toLowerCase()} proposals.</Card>
      ) : (
        <div className="space-y-4">
          {shown.map(item => <ProposalCard key={item.id} item={item} side={side} busy={busyId === item.id} onAction={onAction} />)}
        </div>
      )}
    </div>
  );
};

import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2, Clock, Eye, FileText, History, Inbox, LockKeyhole, ShieldCheck, Undo2, UserCheck, X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/charts/kit";
import { cn } from "@/lib/utils";
import { initialsOf } from "@/lib/messages";
import {
  AccessLogItem, AccessRequestItem, EVIDENCE_NOTICE, STATUS_LABELS, VersionItem,
  describeChanges, describeEvent, formatWhen, groupVersions, shortHash, sortRequests, summarizeRequests,
} from "@/lib/pitchAccess";

const STATUS_COLORS = {
  pending: "hsl(38 92% 50%)", approved: "hsl(158 75% 36%)", rejected: "hsl(0 72% 51%)", revoked: "hsl(220 9% 60%)",
} as const;

const Person = ({ person }: { person: AccessRequestItem["person"] }) => {
  const subtitle = [person.headline, person.company].filter(Boolean).join(" · ");
  return (
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
  );
};

const StatusChip = ({ status }: { status: AccessRequestItem["status"] }) => (
  <span className="inline-flex flex-shrink-0 items-center gap-1.5 text-xs">
    <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[status] }} />
    {status === "pending" ? "Pending" : STATUS_LABELS[status]}
  </span>
);

const ErrorCard = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <Card className="glass-card p-10 text-center">
    <div className="font-display text-lg font-semibold">We could not load this page</div>
    <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    {onRetry && <Button variant="outline" className="mt-4" onClick={onRetry}>Try again</Button>}
  </Card>
);

const EmptyCard = ({ title, body }: { title: string; body: string }) => (
  <Card className="glass-card p-12 text-center">
    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-accent"><LockKeyhole className="h-6 w-6 text-white" /></div>
    <div className="font-display text-xl font-semibold">{title}</div>
    <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
  </Card>
);

export type FounderTab = "requests" | "activity" | "history";
export type FounderDecision = "approve" | "reject" | "revoke";

export const FounderAccessView = ({
  requests, log, versions, tab, onTab, loading = false, error = null, onRetry, busyId = null, onDecide, onViewRecord,
}: {
  requests: AccessRequestItem[];
  log: AccessLogItem[];
  versions: VersionItem[];
  tab: FounderTab;
  onTab: (tab: FounderTab) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  busyId?: string | null;
  onDecide: (request: AccessRequestItem, decision: FounderDecision) => void;
  onViewRecord: (request: AccessRequestItem) => void;
}) => {
  if (error) return <ErrorCard message={error} onRetry={onRetry} />;

  const stats = summarizeRequests(requests);
  const views = log.filter(l => l.event === "pitch_viewed").length;
  const tabs: { key: FounderTab; label: string; count?: number }[] = [
    { key: "requests", label: "Requests", count: stats.waiting },
    { key: "activity", label: "Activity" },
    { key: "history", label: "Version history" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard icon={Inbox} label="Waiting for your answer" value={String(stats.waiting)} loading={loading} tone="bg-gradient-primary"
          hint={stats.waiting === 1 ? "request" : "requests"} />
        <KpiCard icon={UserCheck} label="Investors with access" value={String(stats.withAccess)} loading={loading} tone="bg-gradient-accent"
          hint={`${stats.awaitingNda} approved, not yet signed`} />
        <KpiCard icon={Eye} label="Times your pitch was opened" value={String(views)} loading={loading} tone="bg-accent" hint="by approved investors" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Pitch access sections">
        {tabs.map(t => (
          <button
            key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => onTab(t.key)}
            className={cn(
              "flex-shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors",
              tab === t.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
            )}
          >
            {t.label}{t.count ? <span className={cn("ml-1.5 text-xs", tab === t.key ? "text-primary-foreground/80" : "text-muted-foreground")}>{t.count}</span> : null}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">{[0, 1].map(i => <Skeleton key={i} className="h-36 w-full rounded-2xl" />)}</div>
      ) : tab === "requests" ? (
        requests.length === 0 ? (
          <EmptyCard title="No access requests yet"
            body="When an investor asks to read the detailed pitch of one of your ideas, you can approve or decline it here. Add a detailed pitch to an idea first so there is something to protect." />
        ) : (
          <div className="space-y-4">
            {sortRequests(requests).map(r => (
              <Card key={r.id} className="glass-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <Person person={r.person} />
                  <StatusChip status={r.status} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="text-muted-foreground">For</span>
                  <Link to={`/app/ideas/${r.ideaId}`} className="font-medium hover:text-primary">{r.ideaTitle}</Link>
                  <span className="text-xs text-muted-foreground">requested {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</span>
                </div>
                {r.message && <blockquote className="mt-3 rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">&ldquo;{r.message}&rdquo;</blockquote>}

                {r.status === "approved" && (
                  <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    {r.ndaAcceptedAt
                      ? <><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Accepted your confidentiality terms on {formatWhen(r.ndaAcceptedAt)}</>
                      : <><Clock className="h-3.5 w-3.5" /> Approved. Waiting for them to accept the confidentiality terms before they can read it.</>}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {r.status === "pending" && <>
                    <Button size="sm" className="bg-gradient-primary" disabled={busyId === r.id} onClick={() => onDecide(r, "approve")}>
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={busyId === r.id} onClick={() => onDecide(r, "reject")}>
                      <X className="mr-1.5 h-3.5 w-3.5" /> Decline
                    </Button>
                  </>}
                  {r.status === "approved" && (
                    <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={busyId === r.id} onClick={() => onDecide(r, "revoke")}>
                      <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Revoke access
                    </Button>
                  )}
                  {r.ndaAcceptedAt && (
                    <Button size="sm" variant="outline" className="sm:ml-auto" onClick={() => onViewRecord(r)}>
                      <FileText className="mr-1.5 h-3.5 w-3.5" /> View signed record
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      ) : tab === "activity" ? (
        log.length === 0 ? (
          <EmptyCard title="No activity yet" body="Requests, your decisions, confidentiality terms accepted and every time an approved investor opens your pitch will be listed here." />
        ) : (
          <Card className="glass-card divide-y divide-border">
            {log.map(l => (
              <div key={l.id} className="flex items-start gap-3 px-5 py-3.5">
                <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                  {l.event === "pitch_viewed" || l.event === "document_viewed" ? <Eye className="h-3.5 w-3.5" /> : l.event === "nda_accepted" ? <ShieldCheck className="h-3.5 w-3.5" /> : <LockKeyhole className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{describeEvent(l.event, l.investorName, l.ideaTitle, l.detail)}</div>
                  <div className="text-xs text-muted-foreground">{formatWhen(l.createdAt)}</div>
                </div>
              </div>
            ))}
          </Card>
        )
      ) : versions.length === 0 ? (
        <EmptyCard title="No versions yet" body="Every real change to an idea or its detailed pitch is saved here with the date and time." />
      ) : (
        <div className="space-y-6">
          <p className="flex items-start gap-2 text-xs text-muted-foreground"><History className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> {EVIDENCE_NOTICE}</p>
          {groupVersions(versions).map(g => (
            <Card key={g.ideaId} className="glass-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <Link to={`/app/ideas/${g.ideaId}`} className="font-display font-semibold hover:text-primary">{g.ideaTitle}</Link>
                <span className="text-xs text-muted-foreground">{g.versions.length} {g.versions.length === 1 ? "version" : "versions"}</span>
              </div>
              <ol className="space-y-3">
                {g.versions.map(v => {
                  const changes = describeChanges(v.changes);
                  return (
                    <li key={v.id} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium">{v.version}</span>
                      <div className="min-w-0 flex-1">
                        <div>{formatWhen(v.createdAt)}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {changes.length === 0
                            ? <span className="text-xs text-muted-foreground">Original submission</span>
                            : changes.map(c => <span key={c} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{c}</span>)}
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-muted-foreground/80" title={v.hash}>fingerprint {shortHash(v.hash)}</div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export const InvestorAccessView = ({ requests, loading = false, error = null, onRetry, onReviewTerms, onViewRecord }: {
  requests: AccessRequestItem[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onReviewTerms: (request: AccessRequestItem) => void;
  onViewRecord: (request: AccessRequestItem) => void;
}) => {
  if (error) return <ErrorCard message={error} onRetry={onRetry} />;
  if (loading) return <div className="space-y-4">{[0, 1].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}</div>;
  if (requests.length === 0) {
    return (
      <Card className="glass-card p-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-accent"><LockKeyhole className="h-6 w-6 text-white" /></div>
        <div className="font-display text-xl font-semibold">You have not requested any pitches</div>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Founders keep their business model and financials private. Open an idea and choose Request access to ask to read the detailed pitch.
        </p>
        <Link to="/app/discover"><Button className="mt-5 bg-gradient-primary">Discover ideas</Button></Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {sortRequests(requests).map(r => (
        <Card key={r.id} className="glass-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Person person={r.person} />
            <StatusChip status={r.status} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-muted-foreground">Pitch of</span>
            <Link to={`/app/ideas/${r.ideaId}`} className="font-medium hover:text-primary">{r.ideaTitle}</Link>
            <span className="text-xs text-muted-foreground">requested {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {r.status === "pending" && <p className="text-sm text-muted-foreground">Waiting for {r.person.name.split(" ")[0]} to reply.</p>}
            {r.status === "approved" && !r.ndaAcceptedAt && (
              <Button size="sm" className="bg-gradient-primary" onClick={() => onReviewTerms(r)}>
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Review confidentiality terms
              </Button>
            )}
            {r.status === "approved" && r.ndaAcceptedAt && <>
              <p className="text-sm text-muted-foreground">You accepted the terms on {formatWhen(r.ndaAcceptedAt)}.</p>
              <Link to={`/app/ideas/${r.ideaId}`} className="sm:ml-auto"><Button size="sm" className="bg-gradient-primary"><LockKeyhole className="mr-1.5 h-3.5 w-3.5" /> Read the pitch</Button></Link>
              <Button size="sm" variant="outline" onClick={() => onViewRecord(r)}><FileText className="mr-1.5 h-3.5 w-3.5" /> View accepted terms</Button>
            </>}
            {(r.status === "rejected" || r.status === "revoked") && (
              <>
                <p className="text-sm text-muted-foreground">{r.status === "rejected" ? "The founder declined this request." : "The founder withdrew your access."}</p>
                <Link to={`/app/ideas/${r.ideaId}`} className="sm:ml-auto"><Button size="sm" variant="outline">Open the idea to ask again</Button></Link>
              </>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
};

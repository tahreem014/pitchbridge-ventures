import { format, startOfMonth, subMonths } from "date-fns";
import { AgreementStatus, ProposalStatus, STATUS_LABELS, STATUS_ORDER, isAwaitingAgreement, isCommitted } from "@/lib/portfolio";

export interface AnalyticsIdea {
  id: string;
  title: string;
  status: string;
  visibility: string;
  category: string | null;
  funding_target: number;
  funding_raised: number;
}

export interface AnalyticsProposal {
  id: string;
  idea_id: string;
  amount: number;
  status: ProposalStatus;
  created_at: string;
  // null when the proposal has no agreement (older deals)
  agreementStatus?: AgreementStatus | null;
}

export interface IdeaStat { idea_id: string; views: number; saves: number }
export interface DayViews { day: string; views: number }

export interface AnalyticsInput {
  ideas: AnalyticsIdea[];
  proposals: AnalyticsProposal[];
  stats: IdeaStat[];
  viewsByDay: DayViews[];
}

export interface AnalyticsStats {
  totalViews: number;
  views7d: number;
  totalSaves: number;
  proposalCount: number;
  openCount: number;      // pending + countered, waiting for the founder's reply
  openAmount: number;
  acceptedCount: number;  // signed deals: both sides confirmed the agreement
  acceptedAmount: number;
  awaitingAgreementCount: number;   // accepted, waiting for both sides to confirm the agreement
  awaitingAgreementAmount: number;
  raised: number;         // across published ideas
  target: number;
  fundingPct: number;
  conversion: number;     // % of views that led to a proposal (0 when there are no views)
  daily: { key: string; label: string; views: number }[];
  monthly: { key: string; label: string; count: number; amount: number }[];
  byStatus: { status: ProposalStatus; label: string; count: number; amount: number }[];
  funnel: { key: string; label: string; value: number }[];
  funding: { id: string; name: string; raised: number; remaining: number; target: number; pct: number }[];
  perIdea: {
    id: string; title: string; status: string; visibility: string;
    views: number; saves: number; proposals: number; raised: number; target: number; pct: number;
  }[];
}

const DAYS_SHOWN = 30;
const MONTHS_SHOWN = 6;
const MAX_FUNDING_BARS = 6;
const DAY_MS = 86_400_000;

const sum = (values: number[]) => values.reduce((total, v) => total + Number(v || 0), 0);
const pct = (part: number, whole: number) => (whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0);

export const shortTitle = (title: string, max = 18) => (title.length > max ? `${title.slice(0, max - 1).trimEnd()}…` : title);

// The last 30 days, ending today. Days come from the database in UTC, so the window is built in UTC too.
const lastDays = (now: Date) => {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: DAYS_SHOWN }, (_, i) => {
    const key = new Date(today - (DAYS_SHOWN - 1 - i) * DAY_MS).toISOString().slice(0, 10);
    const [y, m, d] = key.split("-").map(Number);
    return { key, label: format(new Date(y, m - 1, d), "MMM d") };
  });
};

// Everything has a value even when the founder has no ideas, views or proposals yet: all zeros.
export const computeAnalytics = ({ ideas, proposals, stats, viewsByDay }: AnalyticsInput, now: Date = new Date()): AnalyticsStats => {
  const statById = new Map(stats.map(s => [s.idea_id, s]));
  const viewsByKey = new Map(viewsByDay.map(d => [d.day.slice(0, 10), Number(d.views)]));

  const open = proposals.filter(p => p.status === "pending" || p.status === "countered");
  // A deal only counts once both sides have confirmed its agreement (older deals have none and still count).
  const accepted = proposals.filter(isCommitted);
  const awaiting = proposals.filter(isAwaitingAgreement);
  const published = ideas.filter(i => i.status === "published");

  const totalViews = sum(ideas.map(i => statById.get(i.id)?.views ?? 0));
  const totalSaves = sum(ideas.map(i => statById.get(i.id)?.saves ?? 0));
  const raised = sum(published.map(i => i.funding_raised));
  const target = sum(published.map(i => i.funding_target));

  const daily = lastDays(now).map(d => ({ ...d, views: viewsByKey.get(d.key) ?? 0 }));

  const monthly = Array.from({ length: MONTHS_SHOWN }, (_, i) => {
    const start = startOfMonth(subMonths(now, MONTHS_SHOWN - 1 - i));
    const end = startOfMonth(subMonths(now, MONTHS_SHOWN - 2 - i)); // first moment of the following month
    const inMonth = proposals.filter(p => { const t = new Date(p.created_at); return t >= start && t < end; });
    return { key: format(start, "yyyy-MM"), label: format(start, "MMM"), count: inMonth.length, amount: sum(inMonth.map(p => p.amount)) };
  });

  const proposalsByIdea = new Map<string, number>();
  for (const p of proposals) proposalsByIdea.set(p.idea_id, (proposalsByIdea.get(p.idea_id) ?? 0) + 1);

  const perIdea = ideas
    .map(i => ({
      id: i.id, title: i.title, status: i.status, visibility: i.visibility,
      views: statById.get(i.id)?.views ?? 0,
      saves: statById.get(i.id)?.saves ?? 0,
      proposals: proposalsByIdea.get(i.id) ?? 0,
      raised: Number(i.funding_raised), target: Number(i.funding_target),
      pct: pct(Number(i.funding_raised), Number(i.funding_target)),
    }))
    .sort((a, b) => b.views - a.views || b.proposals - a.proposals || a.title.localeCompare(b.title));

  const funding = published
    .filter(i => Number(i.funding_target) > 0)
    .sort((a, b) => Number(b.funding_target) - Number(a.funding_target))
    .slice(0, MAX_FUNDING_BARS)
    .map(i => ({
      id: i.id, name: shortTitle(i.title), raised: Number(i.funding_raised),
      remaining: Math.max(0, Number(i.funding_target) - Number(i.funding_raised)),
      target: Number(i.funding_target), pct: pct(Number(i.funding_raised), Number(i.funding_target)),
    }));

  const conversion = totalViews > 0 ? Math.min(100, Math.round((proposals.length / totalViews) * 1000) / 10) : 0;

  return {
    totalViews,
    views7d: sum(daily.slice(-7).map(d => d.views)),
    totalSaves,
    proposalCount: proposals.length,
    openCount: open.length,
    openAmount: sum(open.map(p => p.amount)),
    acceptedCount: accepted.length,
    acceptedAmount: sum(accepted.map(p => p.amount)),
    awaitingAgreementCount: awaiting.length,
    awaitingAgreementAmount: sum(awaiting.map(p => p.amount)),
    raised,
    target,
    fundingPct: pct(raised, target),
    conversion,
    daily,
    monthly,
    byStatus: STATUS_ORDER.map(status => {
      const rows = proposals.filter(p => p.status === status);
      return { status, label: STATUS_LABELS[status], count: rows.length, amount: sum(rows.map(p => p.amount)) };
    }),
    funnel: [
      { key: "views", label: "Views", value: totalViews },
      { key: "saves", label: "Saves", value: totalSaves },
      { key: "proposals", label: "Proposals", value: proposals.length },
      { key: "deals", label: "Deals", value: accepted.length },
    ],
    funding,
    perIdea,
  };
};

export const formatPercent = (value: number) => `${Number.isInteger(value) ? value : value.toFixed(1)}%`;

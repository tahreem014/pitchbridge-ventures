import { format, startOfMonth, subMonths } from "date-fns";

export type ProposalStatus = "pending" | "countered" | "accepted" | "rejected" | "withdrawn";

export const STATUS_ORDER: ProposalStatus[] = ["pending", "countered", "accepted", "rejected", "withdrawn"];
export const STATUS_LABELS: Record<ProposalStatus, string> = {
  pending: "Pending", countered: "Countered", accepted: "Accepted", rejected: "Rejected", withdrawn: "Withdrawn",
};

export const STAGE_ORDER = ["idea", "prototype", "mvp", "early_revenue", "scaling"] as const;
export const STAGE_LABELS: Record<(typeof STAGE_ORDER)[number], string> = {
  idea: "Idea", prototype: "Prototype", mvp: "MVP", early_revenue: "Early revenue", scaling: "Scaling",
};

export type AgreementStatus = "draft" | "executed" | "cancelled";

// Accepting a proposal starts an investment agreement. The money only counts once both sides have confirmed it.
// Deals accepted before agreements existed have none, and still count.
export const isCommitted = (p: { status: ProposalStatus; agreementStatus?: AgreementStatus | null }) =>
  p.status === "accepted" && (p.agreementStatus == null || p.agreementStatus === "executed");

// Accepted, but the agreement is not signed by both sides yet.
export const isAwaitingAgreement = (p: { status: ProposalStatus; agreementStatus?: AgreementStatus | null }) =>
  p.status === "accepted" && p.agreementStatus === "draft";

export interface PortfolioProposal {
  id: string;
  amount: number;
  equity: number | null;
  status: ProposalStatus;
  created_at: string;
  updated_at: string;
  // null when the proposal has no agreement (older deals); otherwise where the agreement stands
  agreementStatus?: AgreementStatus | null;
  // when both sides confirmed the agreement; older deals fall back to the proposal's last update
  committedAt?: string | null;
  // null when the idea is no longer visible to this investor (for example it was unpublished)
  idea: { id: string; title: string; category: string | null; stage: string | null } | null;
}

export interface PortfolioStats {
  invested: number;        // money in signed deals
  pendingAmount: number;   // offers still waiting for an answer (pending + countered)
  pendingCount: number;
  awaitingAgreementCount: number;   // accepted, agreement not yet confirmed by both sides
  awaitingAgreementAmount: number;
  dealCount: number;       // signed deals
  proposalCount: number;
  avgTicket: number;
  acceptanceRate: number;  // % of decided proposals (accepted or rejected) that were accepted
  byStatus: { status: ProposalStatus; label: string; count: number; amount: number }[];
  byCategory: { name: string; value: number }[];
  byStage: { stage: string; label: string; value: number }[];
  monthly: { key: string; label: string; committed: number; cumulative: number }[];
}

const MAX_CATEGORIES = 5;
const MONTHS_SHOWN = 6;

const sum = (rows: { amount: number }[]) => rows.reduce((total, r) => total + Number(r.amount || 0), 0);

// Everything is zero when there are no proposals, so the charts always have something to draw.
// "When" money was committed is when the agreement was signed; for older deals, the proposal's last update time.
export const computePortfolio = (proposals: PortfolioProposal[], now: Date = new Date()): PortfolioStats => {
  const accepted = proposals.filter(p => p.status === "accepted");
  const signed = proposals.filter(isCommitted);
  const awaiting = proposals.filter(isAwaitingAgreement);
  const open = proposals.filter(p => p.status === "pending" || p.status === "countered");
  const rejected = proposals.filter(p => p.status === "rejected");
  const decided = accepted.length + rejected.length;
  const committedTime = (p: PortfolioProposal) => new Date(p.committedAt ?? p.updated_at);

  const categoryTotals = new Map<string, number>();
  for (const p of signed) {
    const name = p.idea?.category?.trim() || "Uncategorised";
    categoryTotals.set(name, (categoryTotals.get(name) ?? 0) + Number(p.amount));
  }
  const sorted = [...categoryTotals.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const byCategory = sorted.length > MAX_CATEGORIES
    ? [...sorted.slice(0, MAX_CATEGORIES), { name: "Other", value: sorted.slice(MAX_CATEGORIES).reduce((t, c) => t + c.value, 0) }]
    : sorted;

  const monthly = Array.from({ length: MONTHS_SHOWN }, (_, i) => {
    const start = startOfMonth(subMonths(now, MONTHS_SHOWN - 1 - i));
    const end = startOfMonth(subMonths(now, MONTHS_SHOWN - 2 - i)); // first moment of the following month
    const inMonth = signed.filter(p => { const t = committedTime(p); return t >= start && t < end; });
    const upToMonth = signed.filter(p => committedTime(p) < end);
    return { key: format(start, "yyyy-MM"), label: format(start, "MMM"), committed: sum(inMonth), cumulative: sum(upToMonth) };
  });

  return {
    invested: sum(signed),
    pendingAmount: sum(open),
    pendingCount: open.length,
    awaitingAgreementCount: awaiting.length,
    awaitingAgreementAmount: sum(awaiting),
    dealCount: signed.length,
    proposalCount: proposals.length,
    avgTicket: signed.length ? sum(signed) / signed.length : 0,
    acceptanceRate: decided ? Math.round((accepted.length / decided) * 100) : 0,
    byStatus: STATUS_ORDER.map(status => {
      const rows = proposals.filter(p => p.status === status);
      return { status, label: STATUS_LABELS[status], count: rows.length, amount: sum(rows) };
    }),
    byCategory,
    byStage: STAGE_ORDER.map(stage => ({
      stage,
      label: STAGE_LABELS[stage],
      value: sum(signed.filter(p => p.idea?.stage === stage)),
    })),
    monthly,
  };
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
// minimumFractionDigits is explicit: engines disagree on the default for currencies, which turned 0 into "$0.0".
const compactMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", minimumFractionDigits: 0, maximumFractionDigits: 1 });

export const formatMoney = (value: number) => money.format(value || 0);
export const formatCompactMoney = (value: number) => compactMoney.format(value || 0);

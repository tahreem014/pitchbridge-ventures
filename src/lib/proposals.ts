import { AgreementStatus, ProposalStatus, STATUS_ORDER, formatMoney } from "@/lib/portfolio";

export type Side = "founder" | "investor";
export type ProposalAction = "accept" | "decline" | "counter" | "accept_counter" | "withdraw";

export interface Counterpart {
  id: string;
  name: string;
  avatar: string | null;
  headline: string | null;
  company: string | null;
}

export interface ProposalItem {
  id: string;
  status: ProposalStatus;
  amount: number;
  equity: number | null;
  message: string | null;
  counterAmount: number | null;
  counterEquity: number | null;
  counterMessage: string | null;
  createdAt: string;
  // null when the idea is no longer visible to this person
  idea: { id: string; title: string; category: string | null } | null;
  // the investment agreement started by accepting this proposal; null for older deals that have none
  agreement?: { id: string; status: AgreementStatus } | null;
  // the other person: the investor when you are the founder, the founder when you are the investor
  counterpart: Counterpart;
}

// What each side may do with a proposal in each state. This mirrors respond_to_proposal() in the
// database, which is the real gatekeeper; this only decides which buttons to show.
export const actionsFor = (side: Side, status: ProposalStatus): ProposalAction[] => {
  if (side === "founder") return status === "pending" ? ["accept", "counter", "decline"] : [];
  if (status === "pending") return ["withdraw"];
  if (status === "countered") return ["accept_counter", "withdraw"];
  return [];
};

// The status where this person is the one who has to act.
export const needsReplyStatus = (side: Side): ProposalStatus => (side === "founder" ? "pending" : "countered");

export const FILTERS = ["all", ...STATUS_ORDER] as const;
export type Filter = (typeof FILTERS)[number];

export const FILTER_LABELS: Record<Filter, string> = {
  all: "All", pending: "Pending", countered: "Countered", accepted: "Accepted", rejected: "Rejected", withdrawn: "Withdrawn",
};

export const countByFilter = (items: ProposalItem[]): Record<Filter, number> => {
  const counts = { all: items.length, pending: 0, countered: 0, accepted: 0, rejected: 0, withdrawn: 0 } as Record<Filter, number>;
  for (const item of items) counts[item.status] += 1;
  return counts;
};

export const filterItems = (items: ProposalItem[], filter: Filter) =>
  filter === "all" ? items : items.filter(i => i.status === filter);

// Proposals waiting on this person first, then other open ones, then finished ones; newest first within each.
export const sortItems = (items: ProposalItem[], side: Side) => {
  const reply = needsReplyStatus(side);
  const rank = (i: ProposalItem) => (i.status === reply ? 0 : i.status === "pending" || i.status === "countered" ? 1 : 2);
  return [...items].sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt));
};

export const summarize = (items: ProposalItem[], side: Side) => {
  const reply = needsReplyStatus(side);
  const open = items.filter(i => i.status === "pending" || i.status === "countered");
  const accepted = items.filter(i => i.status === "accepted");
  const waiting = items.filter(i => i.status === reply);
  const sum = (rows: ProposalItem[]) => rows.reduce((t, i) => t + Number(i.amount), 0);
  return {
    needsReply: waiting.length,
    needsReplyAmount: sum(waiting),
    openCount: open.length,
    openAmount: sum(open),
    acceptedCount: accepted.length,
    acceptedAmount: sum(accepted),
  };
};

export const formatTerms = (amount: number, equity: number | null) =>
  `${formatMoney(amount)}${equity != null ? ` for ${Number(equity)}% equity` : ""}`;

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

// Plain-language line under each proposal, from this person's point of view.
export const statusHint = (side: Side, item: ProposalItem): string | null => {
  const name = firstName(item.counterpart.name);
  if (side === "founder") {
    if (item.status === "pending") return "Waiting for your reply";
    if (item.status === "countered") return `Waiting for ${name} to respond to your counter-offer`;
  } else {
    if (item.status === "pending") return `Waiting for ${name} to reply`;
    if (item.status === "countered") return `${name} sent a counter-offer. It is your move`;
  }
  return null;
};

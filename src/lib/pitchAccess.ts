import { format } from "date-fns";

export type AccessStatus = "pending" | "approved" | "rejected" | "revoked";

// Where an investor stands with one founder's detailed pitch.
export type AccessState = "none" | "pending" | "needs_nda" | "granted" | "rejected" | "revoked";

// Access needs BOTH the founder's approval and the investor's acceptance of the confidentiality terms.
export const accessState = (request: { status: AccessStatus; ndaAcceptedAt: string | null } | null): AccessState => {
  if (!request) return "none";
  if (request.status === "approved") return request.ndaAcceptedAt ? "granted" : "needs_nda";
  return request.status;
};

export const canRequestAccess = (state: AccessState) => state === "none" || state === "rejected" || state === "revoked";

export const STATUS_LABELS: Record<AccessStatus, string> = {
  pending: "Waiting for the founder", approved: "Approved", rejected: "Declined", revoked: "Access withdrawn",
};

// The restricted sections of a pitch (the public part is the idea itself: title, category, summary, funding goal).
export const PITCH_SECTIONS = [
  { key: "business_model", label: "Business model", placeholder: "How the idea makes money: pricing, revenue streams, costs." },
  { key: "target_customers", label: "Target customers", placeholder: "Who you are building this for, and why they will pay." },
  { key: "market_research", label: "Market research", placeholder: "Market size, competitors, trends and the evidence behind them." },
  { key: "financial_estimates", label: "Financial estimates", placeholder: "Revenue and cost projections, runway, how the funding will be used." },
] as const;

export type SectionKey = (typeof PITCH_SECTIONS)[number]["key"];
export type PitchDetails = Record<SectionKey, string>;

export const emptyDetails = (): PitchDetails => ({ business_model: "", target_customers: "", market_research: "", financial_estimates: "" });
export const hasAnyDetails = (details: PitchDetails) => PITCH_SECTIONS.some(s => details[s.key].trim() !== "");
export const MAX_SECTION_LENGTH = 20000;

const CHANGE_LABELS: Record<string, string> = {
  "public.title": "Title", "public.tagline": "Tagline", "public.description": "Description", "public.category": "Category",
  "public.stage": "Stage", "public.funding_target": "Funding goal", "public.equity_offered": "Equity offered",
  "details.business_model": "Business model", "details.target_customers": "Target customers",
  "details.market_research": "Market research", "details.financial_estimates": "Financial estimates",
  documents: "Supporting documents",
};

// Readable names for what changed in a version. Empty for the first version, which is the original submission.
export const describeChanges = (fields: string[] | null | undefined) => (fields ?? []).map(f => CHANGE_LABELS[f] ?? f);

export const shortHash = (hash: string) => hash.slice(0, 10);

export interface AccessPerson { id: string; name: string; avatar: string | null; headline: string | null; company: string | null }

// One access request. `person` is the investor when you are the founder, and the founder when you are the investor.
export interface AccessRequestItem {
  id: string;
  ideaId: string;
  ideaTitle: string;
  status: AccessStatus;
  message: string | null;
  createdAt: string;
  decidedAt: string | null;
  ndaAcceptedAt: string | null;
  person: AccessPerson;
}

// `detail` is the extra context an entry carries, such as the title of the document that was opened.
export interface AccessLogItem { id: string; event: string; createdAt: string; ideaTitle: string; investorName: string; detail?: string | null }

// The title stored with a document_viewed entry, if the entry has one.
export const logDetail = (details: unknown): string | null => {
  if (details && typeof details === "object" && "title" in details && typeof (details as { title: unknown }).title === "string") {
    return (details as { title: string }).title;
  }
  return null;
};

export interface VersionItem { id: string; ideaId: string; ideaTitle: string; version: number; hash: string; createdAt: string; changes: string[] }

export interface NdaRecord {
  investorName: string | null;
  investorEmail: string | null;
  ideaTitle: string;
  acceptedAt: string;
  version: string;
  hash: string;
  ip: string | null;
  userAgent: string | null;
  text: string;
}

export const summarizeRequests = (items: AccessRequestItem[]) => ({
  waiting: items.filter(i => i.status === "pending").length,
  withAccess: items.filter(i => i.status === "approved" && i.ndaAcceptedAt).length,
  awaitingNda: items.filter(i => i.status === "approved" && !i.ndaAcceptedAt).length,
});

// Pending first (they need an answer), then approved, then finished ones; newest first within each.
export const sortRequests = (items: AccessRequestItem[]) => {
  const rank = (i: AccessRequestItem) => (i.status === "pending" ? 0 : i.status === "approved" ? 1 : 2);
  return [...items].sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt));
};

export const groupVersions = (versions: VersionItem[]) => {
  const groups = new Map<string, { ideaId: string; ideaTitle: string; versions: VersionItem[] }>();
  for (const v of versions) {
    const group = groups.get(v.ideaId) ?? { ideaId: v.ideaId, ideaTitle: v.ideaTitle, versions: [] };
    group.versions.push(v);
    groups.set(v.ideaId, group);
  }
  return [...groups.values()].map(g => ({ ...g, versions: g.versions.sort((a, b) => b.version - a.version) }));
};

export const formatWhen = (iso: string) => format(new Date(iso), "MMM d, yyyy 'at' p");

// One line per log entry, from the founder's point of view.
export const describeEvent = (event: string, investor: string, idea: string, detail?: string | null): string => {
  switch (event) {
    case "access_requested": return `${investor} asked to read the detailed pitch of ${idea}`;
    case "access_approved": return `You approved ${investor}'s request to read ${idea}`;
    case "access_rejected": return `You declined ${investor}'s request to read ${idea}`;
    case "access_revoked": return `You withdrew ${investor}'s access to ${idea}`;
    case "nda_accepted": return `${investor} accepted the confidentiality terms for ${idea}`;
    case "pitch_viewed": return `${investor} opened the detailed pitch of ${idea}`;
    case "document_viewed": return detail ? `${investor} opened the document "${detail}" of ${idea}` : `${investor} opened a supporting document of ${idea}`;
    default: return `${investor}: ${event} (${idea})`;
  }
};

// Shown wherever these records are mentioned, so nobody mistakes them for a legal guarantee.
export const EVIDENCE_NOTICE =
  "These records show when you shared an idea, with whom, and what they agreed to. They help as evidence and as a deterrent, but they do not by themselves give you legal ownership or intellectual-property protection.";

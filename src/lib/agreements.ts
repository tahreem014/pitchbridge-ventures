import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { displayName } from "@/lib/messages";
import { formatWhen } from "@/lib/pitchAccess";
import { AgreementStatus, formatMoney } from "@/lib/portfolio";

export type { AgreementStatus };
export type AgreementType = "equity" | "loan" | "other";
export type Repayment = "monthly" | "quarterly" | "at_maturity";
export type PartyKey = "investor" | "entrepreneur";

export const AGREEMENT_TYPES: AgreementType[] = ["equity", "loan", "other"];
export const TYPE_LABELS: Record<AgreementType, string> = { equity: "Equity investment", loan: "Loan", other: "Other arrangement" };
export const TYPE_HELP: Record<AgreementType, string> = {
  equity: "The investor receives a share of the company in exchange for the money.",
  loan: "The founder borrows the money and pays it back over time, usually with interest.",
  other: "Anything else, such as a revenue share. Describe it in your own words.",
};
export const REPAYMENT_LABELS: Record<Repayment, string> = { monthly: "Monthly", quarterly: "Quarterly", at_maturity: "All at the end of the loan" };
export const STATUS_LABELS: Record<AgreementStatus, string> = { draft: "Waiting for confirmations", executed: "Signed", cancelled: "Cancelled" };

export const MAX_PAYMENTS = 12;
export const LIMITS = { governingLaw: 120, responsibilities: 2000, additionalTerms: 3000, paymentNote: 120, title: 80, description: 3000 };

export interface ScheduleItem { due_date: string; amount: number; note?: string }

// What the agreement says, as stored in the database (only the fields of its type are present).
export interface AgreementTerms {
  governing_law: string;
  founder_responsibilities: string;
  investor_responsibilities: string;
  additional_terms: string;
  schedule: ScheduleItem[];
  equity_percent?: number;
  interest_rate?: number;
  term_months?: number;
  repayment?: Repayment;
  arrangement_title?: string;
  arrangement_description?: string;
}

export interface Party { id: string; name: string; email: string | null; avatar: string | null }

export interface ConfirmationItem {
  id: string; userId: string; party: PartyKey; version: number; hash: string;
  name: string | null; email: string | null; ip: string | null; userAgent: string | null; confirmedAt: string;
}

export interface EventItem { id: string; actorId: string | null; event: string; version: number | null; details: unknown; createdAt: string }

export interface AgreementItem {
  id: string;
  proposalId: string;
  ideaId: string;
  ideaTitle: string | null;       // null when the idea is no longer visible to this person
  type: AgreementType;
  amount: number;
  terms: AgreementTerms;
  version: number;
  hash: string;
  status: AgreementStatus;
  templateVersion: string;
  executedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  investor: Party;
  founder: Party;
  confirmations: ConfirmationItem[];
}

// ---------- editing form ----------

export interface ScheduleRow { dueDate: string; amount: string; note: string }

// Everything is text while the person is typing; termsFromForm turns it into numbers.
export interface TermsForm {
  type: AgreementType;
  governingLaw: string;
  founderResponsibilities: string;
  investorResponsibilities: string;
  additionalTerms: string;
  equityPercent: string;
  interestRate: string;
  termMonths: string;
  repayment: Repayment | "";
  arrangementTitle: string;
  arrangementDescription: string;
  schedule: ScheduleRow[];
}

const text = (value: number | undefined) => (value == null ? "" : String(value));

export const formFromAgreement = (a: Pick<AgreementItem, "type" | "terms">): TermsForm => ({
  type: a.type,
  governingLaw: a.terms.governing_law ?? "",
  founderResponsibilities: a.terms.founder_responsibilities ?? "",
  investorResponsibilities: a.terms.investor_responsibilities ?? "",
  additionalTerms: a.terms.additional_terms ?? "",
  equityPercent: text(a.terms.equity_percent),
  interestRate: text(a.terms.interest_rate),
  termMonths: text(a.terms.term_months),
  repayment: a.terms.repayment ?? "",
  arrangementTitle: a.terms.arrangement_title ?? "",
  arrangementDescription: a.terms.arrangement_description ?? "",
  schedule: (a.terms.schedule ?? []).map(s => ({ dueDate: s.due_date, amount: String(s.amount), note: s.note ?? "" })),
});

const num = (value: string) => (value.trim() === "" ? NaN : Number(value));

// Only the fields of the chosen type are sent, so switching type never leaves stray terms behind.
export const termsFromForm = (form: TermsForm): { type: AgreementType; terms: AgreementTerms } => {
  const base: AgreementTerms = {
    governing_law: form.governingLaw.trim(),
    founder_responsibilities: form.founderResponsibilities.trim(),
    investor_responsibilities: form.investorResponsibilities.trim(),
    additional_terms: form.additionalTerms.trim(),
    schedule: form.schedule.map(s => ({ due_date: s.dueDate, amount: num(s.amount), ...(s.note.trim() ? { note: s.note.trim() } : {}) })),
  };
  if (form.type === "equity") return { type: "equity", terms: { ...base, equity_percent: num(form.equityPercent) } };
  if (form.type === "loan") {
    return { type: "loan", terms: { ...base, interest_rate: num(form.interestRate), term_months: num(form.termMonths), ...(form.repayment ? { repayment: form.repayment } : {}) } };
  }
  return { type: "other", terms: { ...base, arrangement_title: form.arrangementTitle.trim(), arrangement_description: form.arrangementDescription.trim() } };
};

const isRealDate = (value: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
};

export const scheduleTotal = (rows: ScheduleRow[]) => rows.reduce((total, r) => total + (Number.isFinite(num(r.amount)) ? num(r.amount) : 0), 0);

const exactMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatExactMoney = (value: number) => exactMoney.format(value || 0);

// The same checks the database makes (it is the real gatekeeper), so people see the problem before they press save.
// `complete` is false for saving a draft and true for confirming.
export const validateTerms = (form: TermsForm, amount: number, complete: boolean): string[] => {
  const problems: string[] = [];
  const add = (message: string) => { if (!problems.includes(message)) problems.push(message); };
  const long = (value: string, max: number) => value.trim().length > max;
  const short = (value: string, min: number) => value.trim().length < min;

  if (long(form.governingLaw, LIMITS.governingLaw)) add(`The governing law can have at most ${LIMITS.governingLaw} characters`);
  if (complete && short(form.governingLaw, 3)) add("Say which law governs the agreement");
  if (long(form.founderResponsibilities, LIMITS.responsibilities)) add("The founder's responsibilities are too long");
  if (complete && short(form.founderResponsibilities, 10)) add("Describe the founder's responsibilities");
  if (long(form.investorResponsibilities, LIMITS.responsibilities)) add("The investor's responsibilities are too long");
  if (complete && short(form.investorResponsibilities, 10)) add("Describe the investor's responsibilities");
  if (long(form.additionalTerms, LIMITS.additionalTerms)) add("The additional terms are too long");

  if (form.type === "equity") {
    const equity = num(form.equityPercent);
    if (!Number.isFinite(equity)) add("Enter the equity percentage");
    else if (equity <= 0 || equity > 100) add("Equity must be more than 0 and at most 100 percent");
  } else if (form.type === "loan") {
    const rate = num(form.interestRate);
    if (!Number.isFinite(rate)) add("Enter the yearly interest rate (0 for none)");
    else if (rate < 0 || rate > 100) add("The interest rate must be between 0 and 100 percent");
    const months = num(form.termMonths);
    if (!Number.isFinite(months)) add("Enter the length of the loan in months");
    else if (!Number.isInteger(months) || months < 1 || months > 120) add("The loan must last between 1 and 120 whole months");
    if (!form.repayment) add("Choose how the loan is repaid");
  } else {
    if (long(form.arrangementTitle, LIMITS.title)) add(`The arrangement title can have at most ${LIMITS.title} characters`);
    if (complete && short(form.arrangementTitle, 3)) add("Give the arrangement a title");
    if (long(form.arrangementDescription, LIMITS.description)) add("The arrangement description is too long");
    if (complete && short(form.arrangementDescription, 10)) add("Describe the arrangement");
  }

  if (form.schedule.length < 1 || form.schedule.length > MAX_PAYMENTS) {
    add(`The payment schedule needs between 1 and ${MAX_PAYMENTS} payments`);
  } else {
    for (const row of form.schedule) {
      const value = num(row.amount);
      if (!Number.isFinite(value) || value <= 0) add("Every payment needs an amount above zero");
      if (!row.dueDate) add("Every payment needs a due date");
      else if (!isRealDate(row.dueDate)) add("One of the due dates is not a real date");
      if (long(row.note, LIMITS.paymentNote)) add(`A payment note can have at most ${LIMITS.paymentNote} characters`);
    }
    const total = scheduleTotal(form.schedule);
    if (Math.abs(total - amount) > 0.005) add(`The payments add up to ${formatExactMoney(total)} but the agreed amount is ${formatExactMoney(amount)}`);
  }
  return problems;
};

// ---------- reading an agreement ----------

export const myParty = (a: AgreementItem, userId: string): PartyKey => (a.investor.id === userId ? "investor" : "entrepreneur");
export const counterpartOf = (a: AgreementItem, userId: string): Party => (a.investor.id === userId ? a.founder : a.investor);

// Who has confirmed the version that is currently on the table. Earlier confirmations no longer count.
export const confirmedNow = (a: AgreementItem): Record<PartyKey, ConfirmationItem | null> => ({
  investor: a.confirmations.find(c => c.party === "investor" && c.version === a.version) ?? null,
  entrepreneur: a.confirmations.find(c => c.party === "entrepreneur" && c.version === a.version) ?? null,
});

export type Turn = "you" | "them" | "none";

// Whose move it is: yours while you have not confirmed the current version, then theirs.
export const turnOf = (a: AgreementItem, userId: string): Turn => {
  if (a.status !== "draft") return "none";
  const confirmed = confirmedNow(a);
  const mine = myParty(a, userId);
  if (!confirmed[mine]) return "you";
  return confirmed[mine === "investor" ? "entrepreneur" : "investor"] ? "none" : "them";
};

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

export const nextStep = (a: AgreementItem, userId: string): string => {
  if (a.status === "cancelled") return "This agreement was cancelled, so the money does not count.";
  if (a.status === "executed") return `Signed${a.executedAt ? ` on ${formatWhen(a.executedAt)}` : ""}. ${formatMoney(a.amount)} counts as raised.`;
  const other = firstName(counterpartOf(a, userId).name);
  const confirmed = confirmedNow(a);
  const theirs = confirmed[myParty(a, userId) === "investor" ? "entrepreneur" : "investor"];
  if (turnOf(a, userId) === "you") {
    return theirs
      ? `${other} confirmed version ${a.version}. Read it, and confirm if you agree.`
      : "Read the terms, change anything you need, then confirm.";
  }
  return `You confirmed version ${a.version}. Waiting for ${other} to confirm.`;
};

export const impliedValuation = (amount: number, equityPercent: number) => (equityPercent > 0 ? amount / (equityPercent / 100) : null);

export const summaryLine = (a: Pick<AgreementItem, "type" | "amount" | "terms">): string => {
  const money = formatMoney(a.amount);
  if (a.type === "equity") return a.terms.equity_percent != null ? `${money} for ${Number(a.terms.equity_percent)}% equity` : `${money} equity investment`;
  if (a.type === "loan") {
    const rate = a.terms.interest_rate != null ? `${Number(a.terms.interest_rate)}% interest` : "interest to be set";
    return `${money} loan at ${rate}${a.terms.term_months != null ? ` for ${a.terms.term_months} months` : ""}`;
  }
  return a.terms.arrangement_title ? `${money}: ${a.terms.arrangement_title}` : `${money} other arrangement`;
};

export const formatDay = (value: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), "MMM d, yyyy") : value;
};

const CHANGE_LABELS: Record<string, string> = {
  agreement_type: "Type of agreement", governing_law: "Governing law", founder_responsibilities: "Founder's responsibilities",
  investor_responsibilities: "Investor's responsibilities", additional_terms: "Additional terms", schedule: "Payment schedule",
  equity_percent: "Equity", interest_rate: "Interest rate", term_months: "Loan length", repayment: "Repayment",
  arrangement_title: "Arrangement title", arrangement_description: "Arrangement description",
};

export const describeChanges = (fields: unknown): string[] =>
  Array.isArray(fields) ? fields.filter((f): f is string => typeof f === "string").map(f => CHANGE_LABELS[f] ?? f) : [];

// One line per timeline entry.
export const describeEvent = (e: EventItem, actor: string): string => {
  switch (e.event) {
    case "created": return `${actor} accepted the proposal, which started this agreement`;
    case "terms_updated": {
      const changed = describeChanges((e.details as { changed?: unknown } | null)?.changed);
      return `${actor} changed the terms (now version ${e.version})${changed.length ? `: ${changed.join(", ")}` : ""}`;
    }
    case "confirmed": return `${actor} confirmed version ${e.version}`;
    case "executed": return `Both parties confirmed version ${e.version}. The agreement is signed`;
    case "cancelled": return `${actor} cancelled the agreement`;
    default: return `${actor}: ${e.event}`;
  }
};

// Agreements waiting on you first, then ones waiting on the other person, then signed (newest first), then cancelled.
export const sortAgreements = (items: AgreementItem[], userId: string) => {
  const rank = (a: AgreementItem) => {
    if (a.status === "draft") return turnOf(a, userId) === "you" ? 0 : 1;
    return a.status === "executed" ? 2 : 3;
  };
  return [...items].sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt));
};

export const summarizeAgreements = (items: AgreementItem[], userId: string) => {
  const signed = items.filter(a => a.status === "executed");
  return {
    needsYou: items.filter(a => turnOf(a, userId) === "you").length,
    waiting: items.filter(a => turnOf(a, userId) === "them").length,
    signedCount: signed.length,
    signedAmount: signed.reduce((total, a) => total + Number(a.amount), 0),
  };
};

// ---------- loading and acting ----------

type AgreementRow = {
  id: string; proposal_id: string; idea_id: string; investor_id: string; entrepreneur_id: string; agreement_type: string; amount: number | string;
  terms: Json; version: number; terms_hash: string; status: string; template_version: string; parties: Json | null;
  executed_at: string | null; cancelled_at: string | null; created_at: string; updated_at: string;
};

const COLUMNS = "id, proposal_id, idea_id, investor_id, entrepreneur_id, agreement_type, amount, terms, version, terms_hash, status, template_version, parties, executed_at, cancelled_at, created_at, updated_at";
const CONFIRMATION_COLUMNS = "id, agreement_id, user_id, party, version, terms_hash, name, email, ip_address, user_agent, confirmed_at";

export const toTerms = (value: Json): AgreementTerms => {
  const t = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, unknown>;
  const str = (key: string) => (typeof t[key] === "string" ? (t[key] as string) : "");
  const numeric = (key: string) => (typeof t[key] === "number" ? (t[key] as number) : undefined);
  const schedule = Array.isArray(t.schedule) ? (t.schedule as Record<string, unknown>[]) : [];
  return {
    governing_law: str("governing_law"),
    founder_responsibilities: str("founder_responsibilities"),
    investor_responsibilities: str("investor_responsibilities"),
    additional_terms: str("additional_terms"),
    schedule: schedule.map(s => ({ due_date: String(s.due_date ?? ""), amount: Number(s.amount ?? 0), ...(typeof s.note === "string" && s.note ? { note: s.note } : {}) })),
    equity_percent: numeric("equity_percent"),
    interest_rate: numeric("interest_rate"),
    term_months: numeric("term_months"),
    repayment: typeof t.repayment === "string" ? (t.repayment as Repayment) : undefined,
    arrangement_title: typeof t.arrangement_title === "string" ? t.arrangement_title : undefined,
    arrangement_description: typeof t.arrangement_description === "string" ? t.arrangement_description : undefined,
  };
};

type Snapshot = { name?: string | null; email?: string | null } | undefined;

async function hydrate(rows: AgreementRow[]): Promise<AgreementItem[]> {
  if (rows.length === 0) return [];
  const ideaIds = [...new Set(rows.map(r => r.idea_id))];
  const userIds = [...new Set(rows.flatMap(r => [r.investor_id, r.entrepreneur_id]))];
  const [ideas, profiles, confirmations] = await Promise.all([
    supabase.from("ideas").select("id, title").in("id", ideaIds),
    supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds),
    supabase.from("agreement_confirmations").select(CONFIRMATION_COLUMNS).in("agreement_id", rows.map(r => r.id)).order("confirmed_at", { ascending: true }),
  ]);
  const failed = ideas.error ?? profiles.error ?? confirmations.error;
  if (failed) throw new Error(failed.message);

  const title = new Map((ideas.data ?? []).map(i => [i.id, i.title]));
  const profile = new Map((profiles.data ?? []).map(p => [p.id, p]));

  return rows.map(row => {
    const mine = (confirmations.data ?? []).filter(c => c.agreement_id === row.id);
    const snapshot = (row.parties ?? {}) as { investor?: Snapshot; entrepreneur?: Snapshot };
    // Names and emails come from what the document recorded when it was signed, else from the profile and the confirmations.
    const party = (id: string, key: PartyKey): Party => {
      const confirmed = mine.find(c => c.party === key);
      const snap = snapshot[key];
      return {
        id,
        name: displayName(snap?.name ?? profile.get(id)?.full_name),
        email: snap?.email ?? confirmed?.email ?? null,
        avatar: profile.get(id)?.avatar_url ?? null,
      };
    };
    return {
      id: row.id, proposalId: row.proposal_id, ideaId: row.idea_id, ideaTitle: title.get(row.idea_id) ?? null,
      type: row.agreement_type as AgreementType, amount: Number(row.amount), terms: toTerms(row.terms), version: row.version,
      hash: row.terms_hash, status: row.status as AgreementStatus, templateVersion: row.template_version,
      executedAt: row.executed_at, cancelledAt: row.cancelled_at, createdAt: row.created_at, updatedAt: row.updated_at,
      investor: party(row.investor_id, "investor"), founder: party(row.entrepreneur_id, "entrepreneur"),
      confirmations: mine.map(c => ({
        id: c.id, userId: c.user_id, party: c.party as PartyKey, version: c.version, hash: c.terms_hash, name: c.name, email: c.email,
        ip: c.ip_address, userAgent: c.user_agent, confirmedAt: c.confirmed_at,
      })),
    };
  });
}

// Row-level security means this only ever returns the signed-in person's own agreements.
export async function fetchAgreements(): Promise<AgreementItem[]> {
  const { data, error } = await supabase.from("agreements").select(COLUMNS).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return hydrate((data ?? []) as AgreementRow[]);
}

export async function fetchAgreement(id: string): Promise<{ agreement: AgreementItem; events: EventItem[] } | null> {
  const { data, error } = await supabase.from("agreements").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [items, events] = await Promise.all([
    hydrate([data as AgreementRow]),
    supabase.from("agreement_events").select("id, actor_id, event, version, details, created_at").eq("agreement_id", id).order("created_at", { ascending: true }),
  ]);
  if (events.error) throw new Error(events.error.message);
  return {
    agreement: items[0],
    events: (events.data ?? []).map(e => ({ id: e.id, actorId: e.actor_id, event: e.event, version: e.version, details: e.details, createdAt: e.created_at })),
  };
}

export async function saveTerms(id: string, form: TermsForm): Promise<number> {
  const { type, terms } = termsFromForm(form);
  const { data, error } = await supabase.rpc("save_agreement_terms", { _agreement_id: id, _type: type, _terms: terms as unknown as Json });
  if (error) throw new Error(error.message);
  return data;
}

export async function confirmAgreement(id: string, version: number): Promise<"draft" | "executed"> {
  const { data, error } = await supabase.rpc("confirm_agreement", { _agreement_id: id, _version: version });
  if (error) throw new Error(error.message);
  return data === "executed" ? "executed" : "draft";
}

export async function cancelAgreement(id: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_agreement", { _agreement_id: id });
  if (error) throw new Error(error.message);
}

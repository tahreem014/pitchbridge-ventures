import { AgreementItem, Party, REPAYMENT_LABELS, Repayment, TYPE_LABELS, formatDay, formatExactMoney, impliedValuation } from "@/lib/agreements";

// The wording of the agreement. The on-screen preview and the PDF both read from here, so they always say the same thing.
// It is a template for a student project: it has not been reviewed by a lawyer.
export const TEMPLATE_VERSION = "agreement-template-v1";

export const DISCLAIMER =
  "This document was produced from a template by the PitchBridge platform for a student project. It has not been reviewed by a lawyer and may not be legally enforceable. " +
  "Both parties should get independent legal advice before relying on it.";

export interface ClauseTable { head: string[]; rows: string[][]; foot?: string[] }
export interface Clause { heading: string; paragraphs: string[]; table?: ClauseTable }

const TO_COMPLETE = "[to be completed]";

const who = (p: Party) => (p.email ? `${p.name} (${p.email})` : p.name);

const REPAYMENT_PHRASE: Record<Repayment, string> = {
  monthly: "in monthly instalments",
  quarterly: "in quarterly instalments",
  at_maturity: "in one payment at the end of the loan",
};

const investmentClause = (a: AgreementItem): string[] => {
  const t = a.terms;
  const amount = formatExactMoney(a.amount);
  if (a.type === "equity") {
    const lines = [`The Investor will invest ${amount} in the Project. In return, the Investor will receive ${t.equity_percent != null ? `${t.equity_percent}%` : TO_COMPLETE} of the equity of the Project.`];
    const valuation = t.equity_percent != null ? impliedValuation(a.amount, t.equity_percent) : null;
    if (valuation != null) lines.push(`This values the Project at ${formatExactMoney(valuation)} after the investment.`);
    lines.push("The legal form of the shares, and any share certificate, will be documented separately by the parties.");
    return lines;
  }
  if (a.type === "loan") {
    const rate = t.interest_rate == null ? TO_COMPLETE : t.interest_rate > 0 ? `carries interest at ${t.interest_rate}% per year` : "carries no interest";
    const months = t.term_months != null ? `${t.term_months} month${t.term_months === 1 ? "" : "s"}` : TO_COMPLETE;
    return [
      `The Investor will lend ${amount} to the Founder.`,
      `The loan ${rate} and runs for ${months}. It is repaid ${t.repayment ? REPAYMENT_PHRASE[t.repayment] : TO_COMPLETE}.`,
    ];
  }
  return [t.arrangement_title || TO_COMPLETE, t.arrangement_description || TO_COMPLETE];
};

export const buildClauses = (a: AgreementItem): Clause[] => {
  const t = a.terms;
  const schedule = t.schedule ?? [];
  const total = schedule.reduce((sum, s) => sum + Number(s.amount), 0);

  const clauses: Clause[] = [
    {
      heading: "Parties and project",
      paragraphs: [
        `This agreement is between ${who(a.investor)}, the "Investor", and ${who(a.founder)}, the "Founder", about the project "${a.ideaTitle ?? "to be named"}" (the "Project").`,
        "All amounts are in US dollars.",
      ],
    },
    { heading: `The investment (${TYPE_LABELS[a.type].toLowerCase()})`, paragraphs: investmentClause(a) },
    {
      heading: "Payment schedule",
      paragraphs: ["The Investor will pay the amount in the following payments."],
      table: {
        head: ["No.", "Due date", "Amount", "Note"],
        rows: schedule.map((s, i) => [String(i + 1), formatDay(s.due_date), formatExactMoney(s.amount), s.note ?? ""]),
        foot: ["", "Total", formatExactMoney(total), ""],
      },
    },
    { heading: "Responsibilities of the Founder", paragraphs: [t.founder_responsibilities || TO_COMPLETE] },
    { heading: "Responsibilities of the Investor", paragraphs: [t.investor_responsibilities || TO_COMPLETE] },
    {
      heading: "Confidentiality",
      paragraphs: [
        "Each party will keep private all non-public information it receives from the other because of this agreement, including the detailed pitch and documents the Investor read on PitchBridge under the confidentiality terms the Investor accepted. This duty continues after this agreement ends.",
      ],
    },
    {
      heading: "Term and ending the agreement",
      paragraphs: [
        "This agreement starts when both parties have confirmed it on PitchBridge. It can be changed or ended early only if both parties agree in writing, or if one party seriously breaks it and does not put that right within 30 days of written notice from the other.",
      ],
    },
    {
      heading: "Disputes",
      paragraphs: [
        "The parties will first try to settle any dispute by talking in good faith for 30 days. If that does not work, the dispute will be decided by the courts that have jurisdiction under the governing law below.",
      ],
    },
    { heading: "Governing law", paragraphs: [`This agreement is governed by ${t.governing_law || TO_COMPLETE}.`] },
  ];

  if (t.additional_terms) clauses.push({ heading: "Additional terms", paragraphs: t.additional_terms.split(/\n{2,}/).map(p => p.trim()).filter(Boolean) });

  clauses.push({
    heading: "Confirming this agreement",
    paragraphs: [
      "Each party confirms this agreement by pressing Confirm on PitchBridge after reading it. The parties agree that this has the same effect as signing it.",
      `PitchBridge records each confirmation with the person's name, email and the time, and with the version of the terms they confirmed. This document is version ${a.version} (template ${a.templateVersion}). Changing any term makes a new version, and confirmations of earlier versions do not count for it.`,
      `Fingerprint of this version: ${a.hash}`,
    ],
  });
  return clauses;
};

import type { AgreementItem, ConfirmationItem } from "@/lib/agreements";

export const HASH = "ab".repeat(32);
export const AGREEMENT_ID = "c3f2a1b0-1111-4222-8333-444455556666";
export const INVESTOR_ID = "d0000000-0000-4000-8000-000000000005";
export const FOUNDER_ID = "11111111-1111-4111-8111-111111111111";

export const confirmation = (over: Partial<ConfirmationItem> = {}): ConfirmationItem => ({
  id: "conf-1", userId: INVESTOR_ID, party: "investor", version: 3, hash: HASH, name: "Priya Nair", email: "priya.nair@demo.pitchbridge.test",
  ip: null, userAgent: null, confirmedAt: "2026-10-26T10:00:00Z", ...over,
});

// A signed equity agreement between Priya (investor) and Tahrem (founder). Override what a test cares about.
export const makeAgreement = (over: Partial<AgreementItem> = {}): AgreementItem => ({
  id: AGREEMENT_ID, proposalId: "p1", ideaId: "i1", ideaTitle: "SkillSwap", type: "equity", amount: 40000,
  terms: {
    governing_law: "Laws of Pakistan",
    founder_responsibilities: "Use the funds only for the Project and report to the investor every quarter.",
    investor_responsibilities: "Pay on the schedule and keep all confidential information private.",
    additional_terms: "",
    schedule: [{ due_date: "2026-12-01", amount: 25000, note: "First tranche" }, { due_date: "2027-02-01", amount: 15000 }],
    equity_percent: 9,
  },
  version: 3, hash: HASH, status: "executed", templateVersion: "agreement-template-v1",
  executedAt: "2026-10-26T10:00:00Z", cancelledAt: null, createdAt: "2026-10-20T10:00:00Z", updatedAt: "2026-10-26T10:00:00Z",
  investor: { id: INVESTOR_ID, name: "Priya Nair", email: "priya.nair@demo.pitchbridge.test", avatar: null },
  founder: { id: FOUNDER_ID, name: "Tahrem Khan", email: "tahrem014@gmail.com", avatar: null },
  confirmations: [
    confirmation({ id: "conf-f", userId: FOUNDER_ID, party: "entrepreneur", name: "Tahrem Khan", email: "tahrem014@gmail.com", confirmedAt: "2026-10-26T09:00:00Z" }),
    confirmation(),
  ],
  ...over,
});

export const draftAgreement = (over: Partial<AgreementItem> = {}) =>
  makeAgreement({ status: "draft", executedAt: null, confirmations: [], version: 2, ...over });

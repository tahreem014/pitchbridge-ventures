// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  AgreementTerms, TermsForm, confirmedNow, counterpartOf, describeChanges, describeEvent, firstName, formFromAgreement, formatDay,
  impliedValuation, myParty, nextStep, scheduleTotal, sortAgreements, summarizeAgreements, summaryLine, termsFromForm, toTerms, turnOf, validateTerms,
} from "@/lib/agreements";
import { AGREEMENT_ID, FOUNDER_ID, INVESTOR_ID, confirmation, draftAgreement, makeAgreement } from "./agreementFixtures";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const equityForm = (over: Partial<TermsForm> = {}): TermsForm => ({
  ...formFromAgreement(makeAgreement()), ...over,
});

describe("terms form", () => {
  it("turns an agreement into editable text and back without losing anything", () => {
    const a = makeAgreement();
    const form = formFromAgreement(a);
    expect(form).toMatchObject({ type: "equity", governingLaw: "Laws of Pakistan", equityPercent: "9" });
    expect(form.schedule).toEqual([
      { dueDate: "2026-12-01", amount: "25000", note: "First tranche" },
      { dueDate: "2027-02-01", amount: "15000", note: "" },
    ]);
    expect(termsFromForm(form)).toEqual({ type: "equity", terms: a.terms });
  });

  it("sends only the fields of the chosen type, so switching type leaves nothing behind", () => {
    const form = equityForm({ type: "loan", interestRate: "8", termMonths: "24", repayment: "monthly" });
    const { type, terms } = termsFromForm(form);
    expect(type).toBe("loan");
    expect(terms).toMatchObject({ interest_rate: 8, term_months: 24, repayment: "monthly" });
    expect(terms).not.toHaveProperty("equity_percent");
    expect(terms).not.toHaveProperty("arrangement_title");

    const other = termsFromForm(equityForm({ type: "other", arrangementTitle: "  Revenue share ", arrangementDescription: "5% of revenue" })).terms;
    expect(other).toMatchObject({ arrangement_title: "Revenue share", arrangement_description: "5% of revenue" });
    expect(other).not.toHaveProperty("equity_percent");
  });

  it("trims text and drops empty payment notes", () => {
    const { terms } = termsFromForm(equityForm({ governingLaw: "  Laws of Pakistan  ", schedule: [{ dueDate: "2026-12-01", amount: "40000", note: "   " }] }));
    expect(terms.governing_law).toBe("Laws of Pakistan");
    expect(terms.schedule).toEqual([{ due_date: "2026-12-01", amount: 40000 }]);
  });

  it("adds up the payments, ignoring blanks", () => {
    expect(scheduleTotal([{ dueDate: "", amount: "100.5", note: "" }, { dueDate: "", amount: "", note: "" }, { dueDate: "", amount: "abc", note: "" }, { dueDate: "", amount: "50", note: "" }])).toBe(150.5);
  });
});

describe("validateTerms (the same rules the database applies)", () => {
  const ok = () => equityForm();

  it("accepts a complete agreement", () => {
    expect(validateTerms(ok(), 40000, true)).toEqual([]);
  });

  it("lets a draft be saved without governing law, but not confirmed", () => {
    const form = equityForm({ governingLaw: "" });
    expect(validateTerms(form, 40000, false)).toEqual([]);
    expect(validateTerms(form, 40000, true)).toContain("Say which law governs the agreement");
  });

  it("needs both responsibilities to be described before confirming", () => {
    const problems = validateTerms(equityForm({ founderResponsibilities: "short", investorResponsibilities: "" }), 40000, true);
    expect(problems).toContain("Describe the founder's responsibilities");
    expect(problems).toContain("Describe the investor's responsibilities");
  });

  it("limits the length of long texts", () => {
    const problems = validateTerms(equityForm({ governingLaw: "x".repeat(121), additionalTerms: "x".repeat(3001), founderResponsibilities: "x".repeat(2001) }), 40000, false);
    expect(problems.join("|")).toMatch(/governing law can have at most 120/);
    expect(problems).toContain("The additional terms are too long");
    expect(problems).toContain("The founder's responsibilities are too long");
  });

  it("checks equity", () => {
    expect(validateTerms(equityForm({ equityPercent: "" }), 40000, false)).toContain("Enter the equity percentage");
    expect(validateTerms(equityForm({ equityPercent: "0" }), 40000, false)).toContain("Equity must be more than 0 and at most 100 percent");
    expect(validateTerms(equityForm({ equityPercent: "101" }), 40000, false)).toContain("Equity must be more than 0 and at most 100 percent");
    expect(validateTerms(equityForm({ equityPercent: "100" }), 40000, false)).toEqual([]);
    expect(validateTerms(equityForm({ equityPercent: "abc" }), 40000, false)).toContain("Enter the equity percentage");
  });

  it("checks loans", () => {
    const loan = (over: Partial<TermsForm>) => equityForm({ type: "loan", interestRate: "8", termMonths: "24", repayment: "monthly", ...over });
    expect(validateTerms(loan({}), 40000, true)).toEqual([]);
    expect(validateTerms(loan({ interestRate: "0" }), 40000, true)).toEqual([]); // no interest is allowed
    expect(validateTerms(loan({ interestRate: "" }), 40000, false)).toContain("Enter the yearly interest rate (0 for none)");
    expect(validateTerms(loan({ interestRate: "150" }), 40000, false)).toContain("The interest rate must be between 0 and 100 percent");
    expect(validateTerms(loan({ interestRate: "-1" }), 40000, false)).toContain("The interest rate must be between 0 and 100 percent");
    expect(validateTerms(loan({ termMonths: "" }), 40000, false)).toContain("Enter the length of the loan in months");
    for (const bad of ["0", "1.5", "121"]) expect(validateTerms(loan({ termMonths: bad }), 40000, false)).toContain("The loan must last between 1 and 120 whole months");
    expect(validateTerms(loan({ repayment: "" }), 40000, false)).toContain("Choose how the loan is repaid");
  });

  it("checks the other type, and only insists on the description when confirming", () => {
    const other = (over: Partial<TermsForm>) => equityForm({ type: "other", arrangementTitle: "Revenue share", arrangementDescription: "5% of monthly revenue for 24 months", ...over });
    expect(validateTerms(other({}), 40000, true)).toEqual([]);
    expect(validateTerms(other({ arrangementTitle: "", arrangementDescription: "" }), 40000, false)).toEqual([]);
    const confirming = validateTerms(other({ arrangementTitle: "", arrangementDescription: "short" }), 40000, true);
    expect(confirming).toContain("Give the arrangement a title");
    expect(confirming).toContain("Describe the arrangement");
    expect(validateTerms(other({ arrangementTitle: "x".repeat(81) }), 40000, false)).toContain("The arrangement title can have at most 80 characters");
  });

  it("makes the payments add up to the agreed amount", () => {
    const form = equityForm({ schedule: [{ dueDate: "2026-12-01", amount: "1000", note: "" }] });
    expect(validateTerms(form, 40000, false)).toEqual(["The payments add up to $1,000.00 but the agreed amount is $40,000.00"]);
    const split = equityForm({ schedule: [{ dueDate: "2026-12-01", amount: "20000.004", note: "" }, { dueDate: "2027-01-01", amount: "20000", note: "" }] });
    expect(validateTerms(split, 40000, false)).toEqual([]); // within half a cent
  });

  it("needs real dates and positive amounts", () => {
    const row = (dueDate: string, amount: string) => equityForm({ schedule: [{ dueDate, amount, note: "" }] });
    expect(validateTerms(row("", "40000"), 40000, false)).toContain("Every payment needs a due date");
    expect(validateTerms(row("2026-13-45", "40000"), 40000, false)).toContain("One of the due dates is not a real date");
    expect(validateTerms(row("2026-02-30", "40000"), 40000, false)).toContain("One of the due dates is not a real date");
    expect(validateTerms(row("2024-02-29", "40000"), 40000, false)).toEqual([]); // a leap day is real
    expect(validateTerms(row("2026-12-01", "0"), 40000, false)).toContain("Every payment needs an amount above zero");
    expect(validateTerms(row("2026-12-01", ""), 40000, false)).toContain("Every payment needs an amount above zero");
  });

  it("allows between one and twelve payments", () => {
    expect(validateTerms(equityForm({ schedule: [] }), 40000, false)).toContain("The payment schedule needs between 1 and 12 payments");
    const thirteen = Array.from({ length: 13 }, () => ({ dueDate: "2026-12-01", amount: "1000", note: "" }));
    expect(validateTerms(equityForm({ schedule: thirteen }), 13000, false)).toContain("The payment schedule needs between 1 and 12 payments");
    const twelve = Array.from({ length: 12 }, () => ({ dueDate: "2026-12-01", amount: "1000", note: "" }));
    expect(validateTerms(equityForm({ schedule: twelve }), 12000, false)).toEqual([]);
  });

  it("limits payment notes and does not repeat a message", () => {
    const form = equityForm({ schedule: [{ dueDate: "2026-12-01", amount: "20000", note: "x".repeat(121) }, { dueDate: "", amount: "20000", note: "" }, { dueDate: "", amount: "", note: "" }] });
    const problems = validateTerms(form, 40000, false);
    expect(problems).toContain("A payment note can have at most 120 characters");
    expect(problems.filter(p => p === "Every payment needs a due date")).toHaveLength(1);
  });
});

describe("reading an agreement", () => {
  it("knows which party you are and who the other one is", () => {
    const a = makeAgreement();
    expect(myParty(a, INVESTOR_ID)).toBe("investor");
    expect(myParty(a, FOUNDER_ID)).toBe("entrepreneur");
    expect(counterpartOf(a, INVESTOR_ID).name).toBe("Tahrem Khan");
    expect(counterpartOf(a, FOUNDER_ID).name).toBe("Priya Nair");
  });

  it("only counts confirmations of the current version", () => {
    const a = draftAgreement({ version: 3, confirmations: [confirmation({ version: 2 }), confirmation({ id: "c2", userId: FOUNDER_ID, party: "entrepreneur", version: 3 })] });
    const now = confirmedNow(a);
    expect(now.investor).toBeNull(); // Priya confirmed version 2 only
    expect(now.entrepreneur?.version).toBe(3);
  });

  it("says whose move it is", () => {
    const none = draftAgreement();
    expect(turnOf(none, INVESTOR_ID)).toBe("you");
    expect(turnOf(none, FOUNDER_ID)).toBe("you");

    const investorConfirmed = draftAgreement({ confirmations: [confirmation({ version: 2 })] });
    expect(turnOf(investorConfirmed, INVESTOR_ID)).toBe("them");
    expect(turnOf(investorConfirmed, FOUNDER_ID)).toBe("you");

    expect(turnOf(makeAgreement(), INVESTOR_ID)).toBe("none");
    expect(turnOf(makeAgreement({ status: "cancelled" }), INVESTOR_ID)).toBe("none");
  });

  it("describes the next step in plain words", () => {
    expect(nextStep(draftAgreement(), INVESTOR_ID)).toBe("Read the terms, change anything you need, then confirm.");
    const investorConfirmed = draftAgreement({ confirmations: [confirmation({ version: 2 })] });
    expect(nextStep(investorConfirmed, INVESTOR_ID)).toBe("You confirmed version 2. Waiting for Tahrem to confirm.");
    expect(nextStep(investorConfirmed, FOUNDER_ID)).toBe("Priya confirmed version 2. Read it, and confirm if you agree.");
    expect(nextStep(makeAgreement(), FOUNDER_ID)).toMatch(/^Signed on Oct 26, 2026 at .*\. \$40,000 counts as raised\.$/);
    expect(nextStep(makeAgreement({ status: "cancelled" }), FOUNDER_ID)).toBe("This agreement was cancelled, so the money does not count.");
  });

  it("summarises each type in one line", () => {
    expect(summaryLine(makeAgreement())).toBe("$40,000 for 9% equity");
    expect(summaryLine(makeAgreement({ type: "loan", terms: { ...makeAgreement().terms, interest_rate: 8, term_months: 24 } }))).toBe("$40,000 loan at 8% interest for 24 months");
    expect(summaryLine(makeAgreement({ type: "other", terms: { ...makeAgreement().terms, arrangement_title: "Revenue share" } }))).toBe("$40,000: Revenue share");
    expect(summaryLine(makeAgreement({ type: "other", terms: { ...makeAgreement().terms, arrangement_title: "" } }))).toBe("$40,000 other arrangement");
  });

  it("works out the valuation an equity deal implies", () => {
    expect(impliedValuation(40000, 9)).toBeCloseTo(444444.44, 2);
    expect(impliedValuation(40000, 0)).toBeNull();
  });

  it("formats due dates without shifting the day", () => {
    expect(formatDay("2026-12-01")).toBe("Dec 1, 2026");
    expect(formatDay("not a date")).toBe("not a date");
    expect(firstName("Priya Nair")).toBe("Priya");
  });
});

describe("timeline wording", () => {
  const event = (over: object) => ({ id: "e", actorId: INVESTOR_ID, event: "created", version: 1, details: null, createdAt: "2026-10-26T10:00:00Z", ...over });

  it("describes every kind of event", () => {
    expect(describeEvent(event({}), "Tahrem")).toBe("Tahrem accepted the proposal, which started this agreement");
    expect(describeEvent(event({ event: "terms_updated", version: 2, details: { changed: ["governing_law", "equity_percent"] } }), "Tahrem")).toBe("Tahrem changed the terms (now version 2): Governing law, Equity");
    expect(describeEvent(event({ event: "terms_updated", version: 2 }), "Tahrem")).toBe("Tahrem changed the terms (now version 2)");
    expect(describeEvent(event({ event: "confirmed", version: 2 }), "Priya")).toBe("Priya confirmed version 2");
    expect(describeEvent(event({ event: "executed", version: 3 }), "Priya")).toBe("Both parties confirmed version 3. The agreement is signed");
    expect(describeEvent(event({ event: "cancelled" }), "Priya")).toBe("Priya cancelled the agreement");
    expect(describeEvent(event({ event: "brand_new" }), "Priya")).toContain("brand_new");
  });

  it("names changed fields and keeps unknown ones", () => {
    expect(describeChanges(["agreement_type", "schedule", "something_new"])).toEqual(["Type of agreement", "Payment schedule", "something_new"]);
    expect(describeChanges(null)).toEqual([]);
    expect(describeChanges("nope")).toEqual([]);
  });
});

describe("the agreements list", () => {
  const signed = (id: string, createdAt: string, amount = 1000) => makeAgreement({ id, createdAt, amount });
  const waitingOnMe = draftAgreement({ id: "mine", createdAt: "2026-10-01T00:00:00Z" });
  const waitingOnThem = draftAgreement({ id: "theirs", createdAt: "2026-10-02T00:00:00Z", confirmations: [confirmation({ version: 2 })] });
  const cancelled = makeAgreement({ id: "cancelled", status: "cancelled", createdAt: "2026-10-09T00:00:00Z" });

  it("puts what needs you first, then what waits on the other side, then signed, then cancelled", () => {
    const list = [cancelled, signed("old", "2026-09-01T00:00:00Z"), waitingOnThem, signed("new", "2026-10-05T00:00:00Z"), waitingOnMe];
    // from the founder's point of view: she has not confirmed either draft, so both are hers to answer
    expect(sortAgreements(list, FOUNDER_ID).map(a => a.id)).toEqual(["theirs", "mine", "new", "old", "cancelled"]);
    // from the investor's: "mine" is theirs to answer, "theirs" is waiting on the founder
    expect(sortAgreements(list, INVESTOR_ID).map(a => a.id)).toEqual(["mine", "theirs", "new", "old", "cancelled"]);
  });

  it("counts what needs you, what is waiting, and what is signed", () => {
    const list = [waitingOnMe, waitingOnThem, signed("a", "2026-10-05T00:00:00Z", 40000), signed("b", "2026-10-06T00:00:00Z", 10000), cancelled];
    expect(summarizeAgreements(list, INVESTOR_ID)).toEqual({ needsYou: 1, waiting: 1, signedCount: 2, signedAmount: 50000 });
    expect(summarizeAgreements([], INVESTOR_ID)).toEqual({ needsYou: 0, waiting: 0, signedCount: 0, signedAmount: 0 });
  });
});

describe("reading terms from the database", () => {
  it("fills in what is missing and ignores what does not fit", () => {
    const terms = toTerms({ governing_law: 5, schedule: [{ due_date: "2026-12-01", amount: 10, note: "" }, { amount: "7" }], equity_percent: "9", repayment: "monthly" } as never);
    expect(terms.governing_law).toBe("");
    expect(terms.schedule).toEqual([{ due_date: "2026-12-01", amount: 10 }, { due_date: "", amount: 7 }]);
    expect(terms.equity_percent).toBeUndefined();
    expect(terms.repayment).toBe("monthly");
  });

  it("survives a value that is not an object at all", () => {
    expect(toTerms(null as never)).toMatchObject({ governing_law: "", schedule: [] });
    expect(toTerms([] as never)).toMatchObject({ schedule: [] });
  });

  it("round-trips real terms", () => {
    const a = makeAgreement();
    expect(toTerms(a.terms as unknown as never)).toEqual({ ...a.terms, interest_rate: undefined, term_months: undefined, repayment: undefined, arrangement_title: undefined, arrangement_description: undefined } as AgreementTerms);
    expect(AGREEMENT_ID).toMatch(/^[0-9a-f-]{36}$/);
  });
});

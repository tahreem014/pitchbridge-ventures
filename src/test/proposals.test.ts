import { describe, it, expect } from "vitest";
import {
  Counterpart, ProposalItem, Side, actionsFor, countByFilter, filterItems, firstName, formatTerms,
  needsReplyStatus, sortItems, statusHint, summarize,
} from "@/lib/proposals";
import type { ProposalStatus } from "@/lib/portfolio";

const person: Counterpart = { id: "p", name: "Priya Nair", avatar: null, headline: null, company: null };
let n = 0;
const item = (status: ProposalStatus, amount = 10000, createdAt = "2026-10-01T00:00:00Z"): ProposalItem => ({
  id: `i${++n}`, status, amount, equity: null, message: null, counterAmount: null, counterEquity: null, counterMessage: null,
  createdAt, idea: { id: "a", title: "SkillSwap", category: null }, counterpart: person,
});

describe("who can do what", () => {
  const states: ProposalStatus[] = ["pending", "countered", "accepted", "rejected", "withdrawn"];

  it("lets a founder accept, counter or decline only a pending proposal", () => {
    expect(actionsFor("founder", "pending")).toEqual(["accept", "counter", "decline"]);
    for (const s of states.filter(s => s !== "pending")) expect(actionsFor("founder", s)).toEqual([]);
  });

  it("lets an investor withdraw a pending proposal and answer a counter-offer", () => {
    expect(actionsFor("investor", "pending")).toEqual(["withdraw"]);
    expect(actionsFor("investor", "countered")).toEqual(["accept_counter", "withdraw"]);
  });

  it("allows nothing on a finished proposal, for either side", () => {
    for (const side of ["founder", "investor"] as Side[]) {
      for (const s of ["accepted", "rejected", "withdrawn"] as ProposalStatus[]) expect(actionsFor(side, s)).toEqual([]);
    }
  });

  it("never offers an investor the founder's actions, or the other way round", () => {
    const founderOnly = ["accept", "counter", "decline"];
    for (const s of states) expect(actionsFor("investor", s).some(a => founderOnly.includes(a))).toBe(false);
    for (const s of states) expect(actionsFor("founder", s).some(a => a === "withdraw" || a === "accept_counter")).toBe(false);
  });

  it("knows which state is waiting for each side", () => {
    expect(needsReplyStatus("founder")).toBe("pending");
    expect(needsReplyStatus("investor")).toBe("countered");
  });
});

describe("filters and counts", () => {
  const items = [item("pending"), item("pending"), item("countered"), item("accepted"), item("rejected"), item("withdrawn")];

  it("counts every status, with zero for empty ones", () => {
    expect(countByFilter(items)).toEqual({ all: 6, pending: 2, countered: 1, accepted: 1, rejected: 1, withdrawn: 1 });
    expect(countByFilter([])).toEqual({ all: 0, pending: 0, countered: 0, accepted: 0, rejected: 0, withdrawn: 0 });
  });

  it("filters by status, or shows everything", () => {
    expect(filterItems(items, "all")).toHaveLength(6);
    expect(filterItems(items, "pending")).toHaveLength(2);
    expect(filterItems(items, "accepted").map(i => i.status)).toEqual(["accepted"]);
  });
});

describe("sorting", () => {
  const old = item("pending", 1, "2026-09-01T00:00:00Z");
  const fresh = item("pending", 2, "2026-10-20T00:00:00Z");
  const counter = item("countered", 3, "2026-10-10T00:00:00Z");
  const done = item("accepted", 4, "2026-10-25T00:00:00Z");

  it("puts what a founder must answer first, newest first, finished ones last", () => {
    expect(sortItems([done, old, counter, fresh], "founder").map(i => i.id)).toEqual([fresh.id, old.id, counter.id, done.id]);
  });

  it("puts counter-offers first for an investor", () => {
    expect(sortItems([done, old, counter, fresh], "investor").map(i => i.id)).toEqual([counter.id, fresh.id, old.id, done.id]);
  });

  it("does not change the list it was given", () => {
    const list = [done, old];
    sortItems(list, "founder");
    expect(list.map(i => i.id)).toEqual([done.id, old.id]);
  });
});

describe("summary", () => {
  const items = [
    item("pending", 20000), item("pending", 15000), item("countered", 10000),
    item("accepted", 50000), item("accepted", 25000), item("rejected", 99999), item("withdrawn", 5000),
  ];

  it("reads zero when there is nothing", () => {
    expect(summarize([], "founder")).toEqual({ needsReply: 0, needsReplyAmount: 0, openCount: 0, openAmount: 0, acceptedCount: 0, acceptedAmount: 0 });
  });

  it("counts what needs a founder's reply, what is still open, and what was accepted", () => {
    expect(summarize(items, "founder")).toEqual({
      needsReply: 2, needsReplyAmount: 35000, openCount: 3, openAmount: 45000, acceptedCount: 2, acceptedAmount: 75000,
    });
  });

  it("counts counter-offers as what needs an investor's reply", () => {
    expect(summarize(items, "investor")).toMatchObject({ needsReply: 1, needsReplyAmount: 10000, openCount: 3, openAmount: 45000 });
  });
});

describe("wording", () => {
  it("describes the terms", () => {
    expect(formatTerms(40000, 8)).toBe("$40,000 for 8% equity");
    expect(formatTerms(40000, 2.5)).toBe("$40,000 for 2.5% equity");
    expect(formatTerms(40000, null)).toBe("$40,000");
  });

  it("uses the first name", () => {
    expect(firstName("Priya Nair")).toBe("Priya");
    expect(firstName("  Madonna  ")).toBe("Madonna");
  });

  it("explains whose move it is, from each side", () => {
    expect(statusHint("founder", item("pending"))).toBe("Waiting for your reply");
    expect(statusHint("founder", item("countered"))).toBe("Waiting for Priya to respond to your counter-offer");
    expect(statusHint("investor", item("pending"))).toBe("Waiting for Priya to reply");
    expect(statusHint("investor", item("countered"))).toBe("Priya sent a counter-offer. It is your move");
    expect(statusHint("founder", item("accepted"))).toBeNull();
    expect(statusHint("investor", item("rejected"))).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import {
  PortfolioProposal, ProposalStatus, computePortfolio, formatCompactMoney, formatMoney, isAwaitingAgreement, isCommitted,
} from "@/lib/portfolio";

// 26 Oct 2026, so the six months shown are May .. Oct.
const NOW = new Date(2026, 9, 26, 12, 0, 0);

let counter = 0;
const proposal = (
  status: ProposalStatus,
  amount: number,
  updated: Date,
  idea: PortfolioProposal["idea"] = { id: "i", title: "Idea", category: "SaaS", stage: "mvp" },
): PortfolioProposal => ({
  id: `p${++counter}`, amount, equity: null, status,
  created_at: updated.toISOString(), updated_at: updated.toISOString(), idea,
});

describe("money only counts once the agreement is signed", () => {
  const withAgreement = (p: PortfolioProposal, agreementStatus: PortfolioProposal["agreementStatus"], committedAt: string | null = null): PortfolioProposal =>
    ({ ...p, agreementStatus, committedAt });

  it("knows which accepted proposals count", () => {
    const base = { status: "accepted" as ProposalStatus };
    expect(isCommitted({ ...base, agreementStatus: "executed" })).toBe(true);
    expect(isCommitted({ ...base, agreementStatus: null })).toBe(true);            // older deal with no agreement
    expect(isCommitted(base)).toBe(true);
    expect(isCommitted({ ...base, agreementStatus: "draft" })).toBe(false);
    expect(isCommitted({ ...base, agreementStatus: "cancelled" })).toBe(false);
    expect(isCommitted({ status: "pending", agreementStatus: "executed" })).toBe(false); // never counts unless accepted
    expect(isAwaitingAgreement({ ...base, agreementStatus: "draft" })).toBe(true);
    expect(isAwaitingAgreement({ ...base, agreementStatus: "executed" })).toBe(false);
    expect(isAwaitingAgreement({ ...base, agreementStatus: null })).toBe(false);
    expect(isAwaitingAgreement({ status: "pending", agreementStatus: "draft" })).toBe(false);
  });

  it("keeps accepted-but-unsigned money out of invested, and reports it separately", () => {
    const stats = computePortfolio([
      withAgreement(proposal("accepted", 40000, new Date(2026, 9, 5)), "executed", new Date(2026, 9, 6).toISOString()),
      withAgreement(proposal("accepted", 25000, new Date(2026, 9, 7)), "draft"),
      withAgreement(proposal("accepted", 10000, new Date(2026, 9, 8)), "draft"),
    ], NOW);
    expect(stats.invested).toBe(40000);
    expect(stats.dealCount).toBe(1);
    expect(stats.avgTicket).toBe(40000);
    expect(stats.awaitingAgreementCount).toBe(2);
    expect(stats.awaitingAgreementAmount).toBe(35000);
  });

  it("still counts older accepted deals that have no agreement", () => {
    const stats = computePortfolio([proposal("accepted", 30000, new Date(2026, 9, 5))], NOW);
    expect(stats.invested).toBe(30000);
    expect(stats.dealCount).toBe(1);
    expect(stats.awaitingAgreementCount).toBe(0);
  });

  it("leaves unsigned deals out of the sector, stage and monthly charts", () => {
    const idea = { id: "i", title: "Idea", category: "FinTech", stage: "idea" };
    const stats = computePortfolio([
      withAgreement(proposal("accepted", 40000, new Date(2026, 9, 5), idea), "executed", new Date(2026, 9, 6).toISOString()),
      withAgreement(proposal("accepted", 25000, new Date(2026, 9, 7), idea), "draft"),
    ], NOW);
    expect(stats.byCategory).toEqual([{ name: "FinTech", value: 40000 }]);
    expect(stats.byStage.find(s => s.stage === "idea")?.value).toBe(40000);
    expect(stats.monthly.at(-1)).toMatchObject({ committed: 40000, cumulative: 40000 });
  });

  it("dates the money from when the agreement was signed, not when the proposal changed", () => {
    const stats = computePortfolio([
      withAgreement(proposal("accepted", 40000, new Date(2026, 6, 10)), "executed", new Date(2026, 9, 20).toISOString()),
    ], NOW);
    expect(stats.monthly.find(m => m.label === "Jul")?.committed).toBe(0);
    expect(stats.monthly.find(m => m.label === "Oct")?.committed).toBe(40000);
    expect(stats.monthly.at(-1)?.cumulative).toBe(40000);
  });

  it("still counts every accepted proposal in the acceptance rate and the status breakdown", () => {
    const stats = computePortfolio([
      withAgreement(proposal("accepted", 40000, new Date(2026, 9, 5)), "executed", new Date(2026, 9, 6).toISOString()),
      withAgreement(proposal("accepted", 25000, new Date(2026, 9, 7)), "draft"),
      proposal("rejected", 5000, new Date(2026, 9, 8)),
    ], NOW);
    expect(stats.acceptanceRate).toBe(67); // 2 accepted of 3 decided
    expect(stats.byStatus.find(s => s.status === "accepted")).toMatchObject({ count: 2, amount: 65000 });
  });

  it("reads zero for an empty portfolio", () => {
    expect(computePortfolio([], NOW)).toMatchObject({ awaitingAgreementCount: 0, awaitingAgreementAmount: 0 });
  });
});

describe("computePortfolio with no proposals", () => {
  const stats = computePortfolio([], NOW);

  it("reads zero everywhere", () => {
    expect(stats).toMatchObject({
      invested: 0, pendingAmount: 0, pendingCount: 0, dealCount: 0, proposalCount: 0, avgTicket: 0, acceptanceRate: 0,
    });
    expect(stats.byCategory).toEqual([]);
  });

  it("still gives every chart something to draw", () => {
    expect(stats.monthly.map(m => m.label)).toEqual(["May", "Jun", "Jul", "Aug", "Sep", "Oct"]);
    expect(stats.monthly.every(m => m.committed === 0 && m.cumulative === 0)).toBe(true);
    expect(stats.byStatus.map(s => s.status)).toEqual(["pending", "countered", "accepted", "rejected", "withdrawn"]);
    expect(stats.byStatus.every(s => s.count === 0 && s.amount === 0)).toBe(true);
    expect(stats.byStage.map(s => s.label)).toEqual(["Idea", "Prototype", "MVP", "Early revenue", "Scaling"]);
    expect(stats.byStage.every(s => s.value === 0)).toBe(true);
  });
});

describe("totals", () => {
  const rows = [
    proposal("accepted", 75000, new Date(2026, 9, 5)),
    proposal("accepted", 45000, new Date(2026, 8, 5)),
    proposal("pending", 20000, new Date(2026, 9, 20)),
    proposal("countered", 10000, new Date(2026, 9, 21)),
    proposal("rejected", 90000, new Date(2026, 8, 1)),
    proposal("withdrawn", 5000, new Date(2026, 7, 1)),
  ];
  const stats = computePortfolio(rows, NOW);

  it("only counts accepted proposals as invested", () => {
    expect(stats.invested).toBe(120000);
    expect(stats.dealCount).toBe(2);
    expect(stats.avgTicket).toBe(60000);
  });

  it("treats pending and countered offers as pending money", () => {
    expect(stats.pendingAmount).toBe(30000);
    expect(stats.pendingCount).toBe(2);
  });

  it("counts every proposal sent", () => {
    expect(stats.proposalCount).toBe(6);
  });

  it("works out the acceptance rate from decided proposals only", () => {
    // 2 accepted, 1 rejected; pending, countered and withdrawn are not decisions
    expect(stats.acceptanceRate).toBe(67);
  });

  it("breaks proposals down by status in a fixed order", () => {
    expect(stats.byStatus.map(s => [s.status, s.count, s.amount])).toEqual([
      ["pending", 1, 20000], ["countered", 1, 10000], ["accepted", 2, 120000], ["rejected", 1, 90000], ["withdrawn", 1, 5000],
    ]);
  });

  it("accepts amounts that arrive as strings", () => {
    const s = computePortfolio([proposal("accepted", "1000.50" as unknown as number, new Date(2026, 9, 1))], NOW);
    expect(s.invested).toBe(1000.5);
  });
});

describe("monthly capital", () => {
  it("adds each accepted deal in the month it was accepted and keeps a running total", () => {
    const stats = computePortfolio([
      proposal("accepted", 10000, new Date(2026, 6, 10)),  // Jul
      proposal("accepted", 5000, new Date(2026, 6, 28)),   // Jul
      proposal("accepted", 20000, new Date(2026, 9, 2)),   // Oct
      proposal("pending", 99999, new Date(2026, 8, 2)),    // not accepted: ignored
    ], NOW);
    expect(stats.monthly.map(m => [m.label, m.committed, m.cumulative])).toEqual([
      ["May", 0, 0], ["Jun", 0, 0], ["Jul", 15000, 15000], ["Aug", 0, 15000], ["Sep", 0, 15000], ["Oct", 20000, 35000],
    ]);
  });

  it("includes deals older than the window in the running total from the start", () => {
    const stats = computePortfolio([proposal("accepted", 40000, new Date(2026, 0, 15))], NOW);
    expect(stats.monthly[0]).toMatchObject({ label: "May", committed: 0, cumulative: 40000 });
    expect(stats.monthly[5].cumulative).toBe(40000);
  });

  it("handles a window that spans a year boundary", () => {
    const stats = computePortfolio([proposal("accepted", 1000, new Date(2026, 0, 10))], new Date(2026, 1, 15));
    expect(stats.monthly.map(m => m.label)).toEqual(["Sep", "Oct", "Nov", "Dec", "Jan", "Feb"]);
    expect(stats.monthly.map(m => m.cumulative)).toEqual([0, 0, 0, 0, 1000, 1000]);
  });
});

describe("allocation", () => {
  it("groups accepted money by sector, largest first, ignoring everything else", () => {
    const stats = computePortfolio([
      proposal("accepted", 10000, new Date(2026, 9, 1), { id: "a", title: "A", category: "SaaS", stage: "mvp" }),
      proposal("accepted", 30000, new Date(2026, 9, 2), { id: "b", title: "B", category: "FinTech", stage: "idea" }),
      proposal("accepted", 5000, new Date(2026, 9, 3), { id: "c", title: "C", category: "SaaS", stage: "scaling" }),
      proposal("pending", 99000, new Date(2026, 9, 4), { id: "d", title: "D", category: "Web3", stage: "mvp" }),
    ], NOW);
    expect(stats.byCategory).toEqual([{ name: "FinTech", value: 30000 }, { name: "SaaS", value: 15000 }]);
    expect(stats.byStage.map(s => [s.stage, s.value])).toEqual([
      ["idea", 30000], ["prototype", 0], ["mvp", 10000], ["early_revenue", 0], ["scaling", 5000],
    ]);
  });

  it("files missing categories under Uncategorised, including ideas that are no longer visible", () => {
    const stats = computePortfolio([
      proposal("accepted", 1000, new Date(2026, 9, 1), { id: "a", title: "A", category: null, stage: null }),
      proposal("accepted", 2000, new Date(2026, 9, 2), null),
    ], NOW);
    expect(stats.byCategory).toEqual([{ name: "Uncategorised", value: 3000 }]);
    expect(stats.byStage.every(s => s.value === 0)).toBe(true);
  });

  it("folds the smallest sectors into Other after five", () => {
    const categories = ["A", "B", "C", "D", "E", "F", "G"];
    const stats = computePortfolio(
      categories.map((c, i) => proposal("accepted", (7 - i) * 1000, new Date(2026, 9, 1), { id: c, title: c, category: c, stage: "mvp" })),
      NOW,
    );
    expect(stats.byCategory).toHaveLength(6);
    expect(stats.byCategory[5]).toEqual({ name: "Other", value: 3000 }); // F (2000) + G (1000)
    expect(stats.byCategory.reduce((t, c) => t + c.value, 0)).toBe(stats.invested);
  });
});

describe("money formatting", () => {
  it("formats whole dollars", () => {
    expect(formatMoney(0)).toBe("$0");
    expect(formatMoney(75000)).toBe("$75,000");
    expect(formatMoney(1234567)).toBe("$1,234,567");
    expect(formatMoney(NaN)).toBe("$0");
  });

  it("shortens large amounts for chart axes", () => {
    expect(formatCompactMoney(0)).toBe("$0");
    expect(formatCompactMoney(75000)).toBe("$75K");
    expect(formatCompactMoney(1200000)).toBe("$1.2M");
  });
});

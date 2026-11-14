import { describe, it, expect } from "vitest";
import {
  AnalyticsIdea, AnalyticsInput, AnalyticsProposal, computeAnalytics, formatPercent, shortTitle,
} from "@/lib/analytics";

// Noon UTC on 26 Oct 2026: the 30-day window is 27 Sep .. 26 Oct, the six months are May .. Oct.
const NOW = new Date(Date.UTC(2026, 9, 26, 12, 0, 0));

const idea = (id: string, extra: Partial<AnalyticsIdea> = {}): AnalyticsIdea => ({
  id, title: `Idea ${id}`, status: "published", visibility: "public", category: "SaaS",
  funding_target: 100000, funding_raised: 0, ...extra,
});
const proposal = (id: string, ideaId: string, status: AnalyticsProposal["status"], amount: number, created = new Date(2026, 9, 15)): AnalyticsProposal => ({
  id, idea_id: ideaId, amount, status, created_at: created.toISOString(),
});
const input = (extra: Partial<AnalyticsInput> = {}): AnalyticsInput => ({ ideas: [], proposals: [], stats: [], viewsByDay: [], ...extra });

describe("with nothing yet", () => {
  const s = computeAnalytics(input(), NOW);

  it("reads zero everywhere", () => {
    expect(s).toMatchObject({
      totalViews: 0, views7d: 0, totalSaves: 0, proposalCount: 0, openCount: 0, openAmount: 0,
      acceptedCount: 0, acceptedAmount: 0, raised: 0, target: 0, fundingPct: 0, conversion: 0,
    });
    expect(s.funding).toEqual([]);
    expect(s.perIdea).toEqual([]);
  });

  it("still gives every chart a full set of zero points", () => {
    expect(s.daily).toHaveLength(30);
    expect(s.daily[0].label).toBe("Sep 27");
    expect(s.daily[29].label).toBe("Oct 26");
    expect(s.daily.every(d => d.views === 0)).toBe(true);
    expect(s.monthly.map(m => m.label)).toEqual(["May", "Jun", "Jul", "Aug", "Sep", "Oct"]);
    expect(s.monthly.every(m => m.count === 0 && m.amount === 0)).toBe(true);
    expect(s.byStatus.map(x => x.status)).toEqual(["pending", "countered", "accepted", "rejected", "withdrawn"]);
    expect(s.funnel.map(f => [f.key, f.value])).toEqual([["views", 0], ["saves", 0], ["proposals", 0], ["deals", 0]]);
  });
});

describe("views and saves", () => {
  const s = computeAnalytics(input({
    ideas: [idea("a"), idea("b")],
    stats: [
      { idea_id: "a", views: 100, saves: 7 },
      { idea_id: "b", views: 40, saves: 3 },
      { idea_id: "gone", views: 999, saves: 999 }, // not one of this founder's ideas
    ],
  }), NOW);

  it("adds up views and saves across the founder's ideas only", () => {
    expect(s.totalViews).toBe(140);
    expect(s.totalSaves).toBe(10);
  });

  it("puts each day's views in the right place and ignores days outside the window", () => {
    const withDays = computeAnalytics(input({
      ideas: [idea("a")],
      stats: [{ idea_id: "a", views: 30, saves: 0 }],
      viewsByDay: [
        { day: "2026-10-26", views: 5 },  // today
        { day: "2026-10-20", views: 3 },  // 6 days ago: inside the last 7 days
        { day: "2026-10-19", views: 4 },  // 7 days ago: just outside
        { day: "2026-09-27", views: 2 },  // first day of the window
        { day: "2026-09-26", views: 50 }, // before the window
      ],
    }), NOW);
    expect(withDays.daily[29]).toMatchObject({ key: "2026-10-26", views: 5 });
    expect(withDays.daily[0]).toMatchObject({ key: "2026-09-27", views: 2 });
    expect(withDays.daily.reduce((t, d) => t + d.views, 0)).toBe(14);
    expect(withDays.views7d).toBe(8);
  });
});

describe("deals only count once the agreement is signed", () => {
  const withAgreement = (p: AnalyticsProposal, agreementStatus: AnalyticsProposal["agreementStatus"]): AnalyticsProposal => ({ ...p, agreementStatus });

  it("counts signed and older deals, and reports the rest as awaiting the agreement", () => {
    const s = computeAnalytics(input({
      ideas: [idea("a")],
      proposals: [
        withAgreement(proposal("1", "a", "accepted", 40000), "executed"),
        withAgreement(proposal("2", "a", "accepted", 25000), "draft"),
        withAgreement(proposal("3", "a", "accepted", 10000), "draft"),
        proposal("4", "a", "accepted", 5000),   // accepted before agreements existed
        proposal("5", "a", "pending", 99999),
      ],
    }), NOW);
    expect(s.acceptedCount).toBe(2);
    expect(s.acceptedAmount).toBe(45000);
    expect(s.awaitingAgreementCount).toBe(2);
    expect(s.awaitingAgreementAmount).toBe(35000);
    expect(s.funnel.find(f => f.key === "deals")?.value).toBe(2);
  });

  it("still lists every accepted proposal in the status breakdown", () => {
    const s = computeAnalytics(input({
      ideas: [idea("a")],
      proposals: [withAgreement(proposal("1", "a", "accepted", 40000), "executed"), withAgreement(proposal("2", "a", "accepted", 25000), "draft")],
    }), NOW);
    expect(s.byStatus.find(x => x.status === "accepted")).toMatchObject({ count: 2, amount: 65000 });
  });

  it("ignores a cancelled agreement", () => {
    const s = computeAnalytics(input({ ideas: [idea("a")], proposals: [withAgreement(proposal("1", "a", "accepted", 40000), "cancelled")] }), NOW);
    expect(s.acceptedCount).toBe(0);
    expect(s.awaitingAgreementCount).toBe(0);
  });

  it("reads zero when there are no proposals", () => {
    expect(computeAnalytics(input(), NOW)).toMatchObject({ awaitingAgreementCount: 0, awaitingAgreementAmount: 0 });
  });
});

describe("proposals", () => {
  const ideas = [idea("a"), idea("b")];
  const proposals = [
    proposal("1", "a", "pending", 20000, new Date(2026, 9, 20)),
    proposal("2", "a", "countered", 10000, new Date(2026, 9, 10)),
    proposal("3", "b", "accepted", 50000, new Date(2026, 8, 12)),
    proposal("4", "b", "accepted", 25000, new Date(2026, 6, 12)),
    proposal("5", "b", "rejected", 5000, new Date(2026, 6, 20)),
    proposal("6", "a", "withdrawn", 1000, new Date(2026, 4, 5)),
  ];
  const s = computeAnalytics(input({ ideas, proposals }), NOW);

  it("counts offers waiting for a reply", () => {
    expect(s.proposalCount).toBe(6);
    expect(s.openCount).toBe(2);
    expect(s.openAmount).toBe(30000);
  });

  it("counts accepted deals", () => {
    expect(s.acceptedCount).toBe(2);
    expect(s.acceptedAmount).toBe(75000);
  });

  it("groups proposals by the month they were received", () => {
    expect(s.monthly.map(m => [m.label, m.count, m.amount])).toEqual([
      ["May", 1, 1000], ["Jun", 0, 0], ["Jul", 2, 30000], ["Aug", 0, 0], ["Sep", 1, 50000], ["Oct", 2, 30000],
    ]);
  });

  it("breaks proposals down by status in a fixed order", () => {
    expect(s.byStatus.map(x => [x.status, x.count, x.amount])).toEqual([
      ["pending", 1, 20000], ["countered", 1, 10000], ["accepted", 2, 75000], ["rejected", 1, 5000], ["withdrawn", 1, 1000],
    ]);
  });

  it("builds the funnel from views, saves, proposals and deals", () => {
    const f = computeAnalytics(input({
      ideas, proposals, stats: [{ idea_id: "a", views: 200, saves: 12 }, { idea_id: "b", views: 100, saves: 8 }],
    }), NOW).funnel;
    expect(f.map(x => x.value)).toEqual([300, 20, 6, 2]);
  });
});

describe("conversion", () => {
  const withViews = (views: number, proposalCount: number) => computeAnalytics(input({
    ideas: [idea("a")],
    stats: [{ idea_id: "a", views, saves: 0 }],
    proposals: Array.from({ length: proposalCount }, (_, i) => proposal(`p${i}`, "a", "pending", 1000)),
  }), NOW).conversion;

  it("is the share of views that led to a proposal", () => {
    expect(withViews(40, 1)).toBe(2.5);
    expect(withViews(200, 5)).toBe(2.5);
  });

  it("is zero when there are no views, instead of dividing by zero", () => {
    expect(withViews(0, 3)).toBe(0);
  });

  it("never goes above 100%", () => {
    expect(withViews(1, 5)).toBe(100);
  });
});

describe("funding", () => {
  it("only counts published ideas towards the goal, so drafts do not drag progress down", () => {
    const s = computeAnalytics(input({
      ideas: [
        idea("live", { funding_target: 200000, funding_raised: 50000 }),
        idea("draft", { status: "draft", funding_target: 500000, funding_raised: 0 }),
      ],
    }), NOW);
    expect(s.raised).toBe(50000);
    expect(s.target).toBe(200000);
    expect(s.fundingPct).toBe(25);
    expect(s.funding.map(f => f.id)).toEqual(["live"]);
  });

  it("lists the biggest goals first, at most six, with progress", () => {
    const ideas = Array.from({ length: 8 }, (_, i) => idea(`i${i}`, { funding_target: (i + 1) * 10000, funding_raised: 5000 }));
    const s = computeAnalytics(input({ ideas }), NOW);
    expect(s.funding).toHaveLength(6);
    expect(s.funding[0]).toMatchObject({ id: "i7", target: 80000, remaining: 75000, pct: 6 });
  });

  it("never shows negative remaining or more than 100% when an idea is over-funded", () => {
    const s = computeAnalytics(input({ ideas: [idea("a", { funding_target: 10000, funding_raised: 15000 })] }), NOW);
    expect(s.funding[0]).toMatchObject({ remaining: 0, pct: 100 });
    expect(s.fundingPct).toBe(100);
  });

  it("skips ideas with no funding goal in the chart", () => {
    const s = computeAnalytics(input({ ideas: [idea("a", { funding_target: 0 })] }), NOW);
    expect(s.funding).toEqual([]);
    expect(s.fundingPct).toBe(0);
  });
});

describe("per-idea table", () => {
  it("lists every idea, most viewed first, with its own numbers", () => {
    const s = computeAnalytics(input({
      ideas: [idea("a", { title: "Alpha" }), idea("b", { title: "Beta", status: "draft", visibility: "private" }), idea("c", { title: "Gamma" })],
      stats: [{ idea_id: "a", views: 10, saves: 1 }, { idea_id: "c", views: 90, saves: 9 }],
      proposals: [proposal("1", "c", "pending", 1000), proposal("2", "c", "accepted", 2000), proposal("3", "a", "pending", 500)],
    }), NOW);
    expect(s.perIdea.map(i => [i.title, i.views, i.saves, i.proposals])).toEqual([
      ["Gamma", 90, 9, 2], ["Alpha", 10, 1, 1], ["Beta", 0, 0, 0],
    ]);
    expect(s.perIdea[2]).toMatchObject({ status: "draft", visibility: "private" });
  });
});

describe("helpers", () => {
  it("shortens long titles", () => {
    expect(shortTitle("Short")).toBe("Short");
    expect(shortTitle("GreenRoute Logistics Platform")).toBe("GreenRoute Logist…"); // 17 characters plus the ellipsis
  });

  it("formats percentages without a pointless .0", () => {
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(33)).toBe("33%");
    expect(formatPercent(2.5)).toBe("2.5%");
  });
});

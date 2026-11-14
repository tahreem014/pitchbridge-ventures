/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Analytics from "@/pages/app/Analytics";

const ME = "11111111-1111-4111-8111-111111111111";

const db = vi.hoisted(() => ({
  ideas: [] as any[],
  proposals: [] as any[],
  stats: [] as any[],
  days: [] as any[],
  error: null as any,
  calls: [] as [string, unknown[]][],
  rpcCalls: [] as [string, unknown][],
}));
const auth = vi.hoisted(() => ({ user: { id: "11111111-1111-4111-8111-111111111111" } }));

const chain = (result: unknown, record?: [string, unknown[]][], tag?: string): any =>
  new Proxy({}, {
    get: (_t, prop: string) => {
      if (prop === "then") return (resolve: any) => resolve(result);
      return (...args: unknown[]) => { record?.push([`${tag}.${prop}`, args]); return chain(result, record, tag); };
    },
  });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: (...columns: unknown[]) => {
        db.calls.push([`${table}.select`, columns]);
        return chain({ data: table === "ideas" ? db.ideas : db.proposals, error: db.error }, db.calls, table);
      },
    }),
    rpc: (name: string, args?: unknown) => {
      db.rpcCalls.push([name, args]);
      return chain({ data: name === "my_idea_stats" ? db.stats : db.days, error: null });
    },
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: any) => <div>{children}</div> }));
// jsdom has no layout, so charts get no size; only the surrounding cards and numbers are checked here.
vi.mock("recharts", async importOriginal => ({
  ...(await importOriginal<typeof import("recharts")>()),
  ResponsiveContainer: ({ children }: any) => <div data-testid="chart">{children}</div>,
}));

const renderPage = () => render(<MemoryRouter><Analytics /></MemoryRouter>);

// The summary card with this label ("Proposals received" is also a chart title, so pick the card)
const kpi = (label: string) => {
  const card = screen.getAllByText(label).map(el => el.closest(".hover-lift")).find(Boolean) as HTMLElement;
  return within(card);
};

beforeEach(() => {
  db.ideas = []; db.proposals = []; db.stats = []; db.days = [];
  db.error = null; db.calls = []; db.rpcCalls = [];
});

describe("Analytics page", () => {
  it("shows zero for everything when the founder has nothing yet", async () => {
    renderPage();
    expect(await screen.findByText("No ideas yet")).toBeInTheDocument();
    expect(kpi("Total views").getByText("0")).toBeInTheDocument();
    expect(kpi("Investor saves").getByText("0")).toBeInTheDocument();
    expect(kpi("Proposals received").getByText("0")).toBeInTheDocument();
    expect(kpi("Capital offered").getByText("$0")).toBeInTheDocument();
    expect(kpi("Funds raised").getByText("$0")).toBeInTheDocument();
    expect(kpi("View to proposal rate").getByText("0%")).toBeInTheDocument();
    expect(screen.getByText("No funding goals yet")).toBeInTheDocument();
    expect(screen.getAllByTestId("chart").length).toBeGreaterThanOrEqual(4);
  });

  it("shows loading placeholders before the data arrives", async () => {
    renderPage();
    expect(screen.queryByText("No ideas yet")).not.toBeInTheDocument();
    expect(await screen.findByText("No ideas yet")).toBeInTheDocument();
  });

  it("calculates the headline numbers from the founder's data", async () => {
    db.ideas = [
      { id: "a", title: "SkillSwap", status: "published", visibility: "public", category: "Consumer", funding_target: 60000, funding_raised: 24000 },
      { id: "b", title: "Draft idea", status: "draft", visibility: "private", category: "SaaS", funding_target: 90000, funding_raised: 0 },
    ];
    db.proposals = [
      { id: "1", idea_id: "a", amount: 40000, status: "pending", created_at: new Date().toISOString() },
      { id: "2", idea_id: "a", amount: 25000, status: "countered", created_at: new Date().toISOString() },
      { id: "3", idea_id: "a", amount: 10000, status: "accepted", created_at: new Date().toISOString() },
    ];
    db.stats = [{ idea_id: "a", views: 120, saves: 9 }, { idea_id: "b", views: 0, saves: 0 }];
    db.days = [{ day: new Date().toISOString().slice(0, 10), views: 4 }];
    renderPage();

    expect(await kpi("Total views").findByText("120")).toBeInTheDocument();
    expect(kpi("Total views").getByText("4 in the last 7 days")).toBeInTheDocument();
    expect(kpi("Investor saves").getByText("9")).toBeInTheDocument();
    expect(kpi("Proposals received").getByText("3")).toBeInTheDocument();
    expect(kpi("Proposals received").getByText("2 awaiting your reply")).toBeInTheDocument();
    expect(kpi("Capital offered").getByText("$65,000")).toBeInTheDocument();
    expect(kpi("Funds raised").getByText("$24,000")).toBeInTheDocument();
    expect(kpi("Funds raised").getByText("of $60,000 goal (40%)")).toBeInTheDocument(); // the draft is not part of the goal
    expect(kpi("View to proposal rate").getByText("2.5%")).toBeInTheDocument();
  });

  it("says how much is accepted but still waiting for both sides to sign", async () => {
    db.ideas = [{ id: "a", title: "SkillSwap", status: "published", visibility: "public", category: "Consumer", funding_target: 60000, funding_raised: 24000 }];
    db.proposals = [
      { id: "1", idea_id: "a", amount: 10000, status: "accepted", created_at: new Date().toISOString(), agreements: { status: "executed" } },
      { id: "2", idea_id: "a", amount: 20000, status: "accepted", created_at: new Date().toISOString(), agreements: { status: "draft" } },
      { id: "3", idea_id: "a", amount: 5000, status: "accepted", created_at: new Date().toISOString(), agreements: null },
    ];
    renderPage();

    expect(await kpi("Funds raised").findByText("of $60,000 goal (40%) · $20,000 awaiting signature")).toBeInTheDocument();
    expect(db.calls.find(([name]) => name === "proposals.select")?.[1][0]).toContain("agreements(status)");
  });

  it("does not mention signatures when nothing is waiting", async () => {
    db.ideas = [{ id: "a", title: "SkillSwap", status: "published", visibility: "public", category: "Consumer", funding_target: 60000, funding_raised: 24000 }];
    db.proposals = [{ id: "1", idea_id: "a", amount: 10000, status: "accepted", created_at: new Date().toISOString(), agreements: [{ status: "executed" }] }];
    renderPage();
    expect(await kpi("Funds raised").findByText("of $60,000 goal (40%)")).toBeInTheDocument();
    expect(screen.queryByText(/awaiting signature/)).not.toBeInTheDocument();
  });

  it("lists each idea with its views, saves and proposals", async () => {
    db.ideas = [{ id: "a", title: "SkillSwap", status: "published", visibility: "public", category: "Consumer", funding_target: 60000, funding_raised: 24000 }];
    db.proposals = [{ id: "1", idea_id: "a", amount: 40000, status: "pending", created_at: new Date().toISOString() }];
    db.stats = [{ idea_id: "a", views: 120, saves: 9 }];
    renderPage();

    const link = await screen.findByRole("link", { name: "SkillSwap" });
    expect(link).toHaveAttribute("href", "/app/ideas/a");
    const row = within(link.closest("tr") as HTMLElement);
    expect(row.getByText("Live")).toBeInTheDocument();
    expect(row.getByText("120")).toBeInTheDocument();
    expect(row.getByText("9")).toBeInTheDocument();
    expect(row.getByText("1")).toBeInTheDocument();
    expect(row.getByText("$24,000 of $60,000 · 40%")).toBeInTheDocument();
  });

  it("only asks for the signed-in founder's own data", async () => {
    renderPage();
    await screen.findByText("No ideas yet");
    expect(db.calls).toContainEqual(["ideas.eq", ["user_id", ME]]);
    expect(db.calls).toContainEqual(["proposals.eq", ["entrepreneur_id", ME]]);
    expect(db.rpcCalls).toContainEqual(["my_idea_stats", undefined]);
    expect(db.rpcCalls).toContainEqual(["my_views_by_day", { _days: 30 }]);
  });

  it("shows an error with a retry that reloads the data", async () => {
    db.error = { message: "network down" };
    renderPage();
    expect(await screen.findByText("We could not load your analytics")).toBeInTheDocument();
    expect(screen.getByText("network down")).toBeInTheDocument();

    db.error = null;
    db.stats = [{ idea_id: "a", views: 7, saves: 0 }];
    db.ideas = [{ id: "a", title: "SkillSwap", status: "published", visibility: "public", category: null, funding_target: 1000, funding_raised: 0 }];
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByText("We could not load your analytics")).not.toBeInTheDocument());
    expect(await kpi("Total views").findByText("7")).toBeInTheDocument();
  });
});

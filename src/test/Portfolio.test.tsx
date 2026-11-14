/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Portfolio from "@/pages/app/Portfolio";

const ME = "11111111-1111-4111-8111-111111111111";

const db = vi.hoisted(() => ({
  rows: [] as any[],
  error: null as any,
  saved: 0,
  proposalCalls: [] as [string, unknown[]][],
}));
const auth = vi.hoisted(() => ({ user: { id: "11111111-1111-4111-8111-111111111111" } }));

const chain = (result: unknown, record?: [string, unknown[]][]): any =>
  new Proxy({}, {
    get: (_t, prop: string) => {
      if (prop === "then") return (resolve: any) => resolve(result);
      return (...args: unknown[]) => { record?.push([prop, args]); return chain(result, record); };
    },
  });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: (...args: unknown[]) => {
        if (table === "proposals") {
          db.proposalCalls.push(["select", args]);
          return chain({ data: db.error ? null : db.rows, error: db.error }, db.proposalCalls);
        }
        return chain({ count: db.saved, error: null });
      },
    }),
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: any) => <div>{children}</div> }));
// jsdom has no layout, so charts get no size; only the surrounding cards and numbers are checked here.
vi.mock("recharts", async importOriginal => ({
  ...(await importOriginal<typeof import("recharts")>()),
  ResponsiveContainer: ({ children }: any) => <div data-testid="chart">{children}</div>,
}));

const iso = (d: Date) => d.toISOString();
const row = (id: string, status: string, amount: number, idea: any, created = new Date()) => ({
  id, status, amount, equity: 5, created_at: iso(created), updated_at: iso(created), ideas: idea,
});

const renderPage = () => render(<MemoryRouter><Portfolio /></MemoryRouter>);

// The text of the KPI card with this label
const kpi = (label: string) => {
  const card = screen.getByText(label).closest(".glass-card") as HTMLElement;
  return within(card);
};

beforeEach(() => {
  db.rows = [];
  db.error = null;
  db.saved = 0;
  db.proposalCalls = [];
});

describe("Portfolio page", () => {
  it("shows zero for everything when the investor has no proposals", async () => {
    renderPage();
    expect(await screen.findByText("No proposals yet")).toBeInTheDocument();
    expect(kpi("Total invested").getByText("$0")).toBeInTheDocument();
    expect(kpi("Pending offers").getByText("$0")).toBeInTheDocument();
    expect(kpi("Deals closed").getByText("0")).toBeInTheDocument();
    expect(kpi("Average ticket").getByText("$0")).toBeInTheDocument();
    expect(kpi("Acceptance rate").getByText("0%")).toBeInTheDocument();
    expect(kpi("Saved ideas").getByText("0")).toBeInTheDocument();
    expect(screen.getAllByTestId("chart").length).toBeGreaterThanOrEqual(4);
  });

  it("shows loading placeholders before the data arrives", async () => {
    renderPage();
    expect(screen.queryByText("No proposals yet")).not.toBeInTheDocument();
    expect(screen.queryByText("$0")).not.toBeInTheDocument();
    // let the load finish so the test does not end mid-update
    expect(await screen.findByText("No proposals yet")).toBeInTheDocument();
  });

  it("calculates the headline numbers from the investor's proposals", async () => {
    db.saved = 3;
    db.rows = [
      row("1", "accepted", 75000, { id: "a", title: "Lumora Health", category: "HealthTech", stage: "mvp" }),
      row("2", "accepted", 45000, { id: "b", title: "StackPulse", category: "SaaS", stage: "scaling" }),
      row("3", "pending", 20000, { id: "c", title: "GridSage", category: "ClimateTech", stage: "prototype" }),
      row("4", "rejected", 10000, { id: "d", title: "QuantumLoom", category: "DeepTech", stage: "idea" }),
    ];
    renderPage();

    expect(await kpi("Total invested").findByText("$120,000")).toBeInTheDocument();
    expect(kpi("Total invested").getByText("2 signed deals")).toBeInTheDocument();
    expect(kpi("Pending offers").getByText("$20,000")).toBeInTheDocument();
    expect(kpi("Pending offers").getByText("1 awaiting a reply")).toBeInTheDocument();
    expect(kpi("Deals closed").getByText("2")).toBeInTheDocument();
    expect(kpi("Deals closed").getByText("of 4 proposals sent")).toBeInTheDocument();
    expect(kpi("Average ticket").getByText("$60,000")).toBeInTheDocument();
    expect(kpi("Acceptance rate").getByText("67%")).toBeInTheDocument();
    expect(kpi("Saved ideas").getByText("3")).toBeInTheDocument();
  });

  it("counts only signed deals as invested, and says how much is waiting for a signature", async () => {
    const idea = { id: "a", title: "Lumora Health", category: "HealthTech", stage: "mvp" };
    db.rows = [
      { ...row("1", "accepted", 75000, idea), agreements: { status: "executed", executed_at: new Date().toISOString() } },
      { ...row("2", "accepted", 30000, idea), agreements: { status: "draft", executed_at: null } },      // accepted, not signed yet
      { ...row("3", "accepted", 10000, idea), agreements: null },                                         // an older deal with no agreement
    ];
    renderPage();

    expect(await kpi("Total invested").findByText("$85,000")).toBeInTheDocument();
    expect(kpi("Total invested").getByText("2 signed deals · $30,000 awaiting signature")).toBeInTheDocument();
    expect(kpi("Deals closed").getByText("2")).toBeInTheDocument();
    expect(kpi("Average ticket").getByText("$42,500")).toBeInTheDocument();
    expect(db.proposalCalls.find(([name]) => name === "select")?.[1][0]).toContain("agreements(status, executed_at)");
  });

  it("reads the agreement from a list as well as from a single object", async () => {
    const idea = { id: "a", title: "Lumora Health", category: "HealthTech", stage: "mvp" };
    db.rows = [{ ...row("1", "accepted", 40000, idea), agreements: [{ status: "executed", executed_at: new Date().toISOString() }] }];
    renderPage();
    expect(await kpi("Total invested").findByText("$40,000")).toBeInTheDocument();
  });

  it("lists the proposals with their idea, amount and status", async () => {
    db.rows = [
      row("1", "accepted", 75000, { id: "a", title: "Lumora Health", category: "HealthTech", stage: "mvp" }),
      row("2", "countered", 30000, null),
    ];
    renderPage();

    const link = await screen.findByRole("link", { name: "Lumora Health" });
    expect(link).toHaveAttribute("href", "/app/ideas/a");
    const table = within(screen.getByRole("table"));
    expect(table.getByText("$75,000")).toBeInTheDocument();
    expect(table.getByText("Accepted")).toBeInTheDocument();
    expect(table.getByText("Countered")).toBeInTheDocument();
    expect(table.getByText("Idea no longer available")).toBeInTheDocument();
  });

  it("only asks for the signed-in investor's own proposals", async () => {
    renderPage();
    await screen.findByText("No proposals yet");
    expect(db.proposalCalls).toContainEqual(["eq", ["investor_id", ME]]);
  });

  it("shows an error with a retry that reloads the data", async () => {
    db.error = { message: "network down" };
    renderPage();
    expect(await screen.findByText("We could not load your portfolio")).toBeInTheDocument();
    expect(screen.getByText("network down")).toBeInTheDocument();

    db.error = null;
    db.rows = [row("1", "accepted", 1000, { id: "a", title: "Lumora Health", category: "HealthTech", stage: "mvp" })];
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByText("We could not load your portfolio")).not.toBeInTheDocument());
    expect(await kpi("Total invested").findByText("$1,000")).toBeInTheDocument();
  });
});

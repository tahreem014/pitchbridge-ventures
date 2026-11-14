/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "@/pages/app/Dashboard";

const db = vi.hoisted(() => ({
  proposals: [] as any[],
  ideas: [] as any[],
  calls: [] as [string, unknown[]][],
}));
const auth = vi.hoisted(() => ({ user: { id: "11111111-1111-4111-8111-111111111111", email: "tahrem014@gmail.com" }, role: "investor" as string | null }));

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
        if (table === "proposals") return chain({ data: db.proposals, error: null }, db.calls, table);
        if (table === "ideas") return chain({ data: db.ideas, count: db.ideas.length, error: null }, db.calls, table);
        return chain({ data: [], count: 0, error: null }, db.calls, table);
      },
    }),
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/hooks/useUnreadMessages", () => ({ useUnreadMessages: () => 0 }));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: any) => <div>{children}</div> }));
vi.mock("recharts", async importOriginal => ({
  ...(await importOriginal<typeof import("recharts")>()),
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));

const stat = (label: string) => within(screen.getByText(label).closest(".hover-lift") as HTMLElement);
const renderPage = () => render(<MemoryRouter><Dashboard /></MemoryRouter>);

beforeEach(() => {
  db.proposals = []; db.ideas = []; db.calls = [];
  auth.role = "investor";
});

describe("Dashboard money", () => {
  it("shows an investor only what is in signed deals", async () => {
    db.proposals = [
      { amount: 75000, status: "accepted", agreements: { status: "executed" } },
      { amount: 30000, status: "accepted", agreements: { status: "draft" } },   // accepted, not signed yet
      { amount: 10000, status: "accepted", agreements: null },                   // an older deal with no agreement
      { amount: 5000, status: "accepted", agreements: [{ status: "executed" }] },
    ];
    renderPage();
    expect(await stat("Invested").findByText("$90,000")).toBeInTheDocument();
    expect(db.calls.find(([name]) => name === "proposals.select")?.[1][0]).toContain("agreements(status)");
  });

  it("shows zero when nothing is signed", async () => {
    db.proposals = [{ amount: 30000, status: "accepted", agreements: { status: "draft" } }];
    renderPage();
    expect(await stat("Invested").findByText("$0")).toBeInTheDocument();
  });

  it("shows a founder the funding raised on their ideas, which the database only raises when an agreement is signed", async () => {
    auth.role = "entrepreneur";
    db.ideas = [{ funding_raised: 40000 }, { funding_raised: 5000 }];
    renderPage();
    expect(await stat("Raised").findByText("$45,000")).toBeInTheDocument();
    expect(db.calls.some(([name]) => name === "proposals.select")).toBe(false);
  });
});

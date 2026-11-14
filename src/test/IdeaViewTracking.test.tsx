/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import IdeaDetail from "@/pages/app/IdeaDetail";

const IDEA = "a0000000-0000-4000-8000-000000000012";

const state = vi.hoisted(() => ({
  user: { id: "11111111-1111-4111-8111-111111111111" } as { id: string } | null,
  rpc: [] as [string, unknown][],
}));

const chain = (result: unknown): any =>
  new Proxy({}, { get: (_t, prop) => (prop === "then" ? (resolve: any) => resolve(result) : () => chain(result)) });

vi.mock("@/integrations/supabase/client", () => {
  const channel: any = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      from: (table: string) => ({
        select: () => chain({
          data: table === "ideas"
            ? { id: "a0000000-0000-4000-8000-000000000012", user_id: "founder-1", title: "SkillSwap", funding_target: 60000, funding_raised: 0, status: "published", visibility: "public", has_detailed_pitch: false }
            : table === "profiles" ? { id: "founder-1", full_name: "Founder One" } : null,
        }),
      }),
      rpc: (name: string, args: unknown) => { state.rpc.push([name, args]); return chain({ error: null }); },
      channel: () => channel,
      removeChannel: () => {},
    },
  };
});
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: state.user, role: "investor" }) }));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: any) => <div>{children}</div> }));
vi.mock("@/components/SendProposalDialog", () => ({ SendProposalDialog: () => null }));

const renderPage = () => render(
  <MemoryRouter initialEntries={[`/app/ideas/${IDEA}`]}>
    <Routes><Route path="/app/ideas/:id" element={<IdeaDetail />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  state.user = { id: "11111111-1111-4111-8111-111111111111" };
  state.rpc = [];
});

describe("idea view tracking", () => {
  it("records one view when a signed-in user opens an idea", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "SkillSwap" });
    expect(state.rpc.filter(([name]) => name === "record_idea_view")).toEqual([["record_idea_view", { _idea_id: IDEA }]]);
  });

  it("records nothing when nobody is signed in", async () => {
    state.user = null;
    renderPage();
    await screen.findByRole("heading", { name: "SkillSwap" });
    expect(state.rpc).toEqual([]);
  });
});

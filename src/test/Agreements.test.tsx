/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Agreements from "@/pages/app/Agreements";
import { FOUNDER_ID, INVESTOR_ID, confirmation, draftAgreement, makeAgreement } from "./agreementFixtures";

const api = vi.hoisted(() => ({ fetchAgreements: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: "d0000000-0000-4000-8000-000000000005" } }));
const realtime = vi.hoisted(() => ({ tables: [] as string[], removed: 0 }));

vi.mock("@/integrations/supabase/client", () => {
  const channel: any = {
    on: (_type: string, filter: { table: string }) => { realtime.tables.push(filter.table); return channel; },
    subscribe: () => channel,
  };
  return { supabase: { channel: () => channel, removeChannel: () => { realtime.removed += 1; } } };
});
vi.mock("@/lib/agreements", async importOriginal => ({ ...(await importOriginal<typeof import("@/lib/agreements")>()), fetchAgreements: api.fetchAgreements }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: any) => <div>{children}</div> }));

const renderPage = () => render(<MemoryRouter><Agreements /></MemoryRouter>);
// The summary card with this label. "Signed" is also a status badge inside the list cards, which are links, so skip those.
const card = (label: string) => within(screen.getAllByText(label).find(el => !el.closest("a"))!.closest(".hover-lift") as HTMLElement);

beforeEach(() => {
  api.fetchAgreements.mockReset();
  realtime.tables = []; realtime.removed = 0;
  auth.user.id = INVESTOR_ID; // Priya, the investor
});

describe("Agreements page", () => {
  it("explains that the money counts once both sides confirm", async () => {
    api.fetchAgreements.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("Investment agreements")).toBeInTheDocument();
    expect(screen.getByText(/The money counts as raised once you both confirm the same version/)).toBeInTheDocument();
  });

  it("invites people to the proposals page when there are no agreements", async () => {
    api.fetchAgreements.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("No agreements yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to proposals" })).toHaveAttribute("href", "/app/proposals");
    expect(card("Needs your confirmation").getByText("0")).toBeInTheDocument();
    expect(card("Signed").getByText("$0")).toBeInTheDocument();
  });

  it("lists each agreement with the other person, the terms and what to do next", async () => {
    api.fetchAgreements.mockResolvedValue([draftAgreement()]);
    renderPage();
    const link = await screen.findByRole("link", { name: "Open the agreement for SkillSwap" });
    expect(link).toHaveAttribute("href", "/app/agreements/c3f2a1b0-1111-4222-8333-444455556666");
    expect(within(link).getByText("With Tahrem Khan · you are the investor")).toBeInTheDocument();
    expect(within(link).getByText("$40,000 for 9% equity")).toBeInTheDocument();
    expect(within(link).getByText("Waiting for confirmations")).toBeInTheDocument();
    expect(within(link).getByText("Equity investment")).toBeInTheDocument();
    expect(within(link).getByText("Version 2")).toBeInTheDocument();
    expect(within(link).getByText("Read the terms, change anything you need, then confirm.")).toBeInTheDocument();
    expect(within(link).getByText("Your turn")).toBeInTheDocument();
  });

  it("puts what needs you first, and counts each kind", async () => {
    api.fetchAgreements.mockResolvedValue([
      makeAgreement({ id: "signed", ideaTitle: "Lumora Health", amount: 75000, terms: { ...makeAgreement().terms, schedule: [{ due_date: "2026-12-01", amount: 75000 }] } }),
      draftAgreement({ id: "waiting", ideaTitle: "GridSage", confirmations: [confirmation({ version: 2 })] }),   // Priya already confirmed
      draftAgreement({ id: "mine", ideaTitle: "SkillSwap" }),                                                    // Priya still has to
      makeAgreement({ id: "cancelled", ideaTitle: "ChainNotary", status: "cancelled" }),
    ]);
    renderPage();
    await screen.findByText("SkillSwap");

    const order = screen.getAllByRole("link", { name: /^Open the agreement for/ }).map(l => l.getAttribute("aria-label"));
    expect(order).toEqual([
      "Open the agreement for SkillSwap", "Open the agreement for GridSage", "Open the agreement for Lumora Health", "Open the agreement for ChainNotary",
    ]);
    expect(card("Needs your confirmation").getByText("1")).toBeInTheDocument();
    expect(card("Waiting for the other side").getByText("1")).toBeInTheDocument();
    expect(card("Signed").getByText("$75,000")).toBeInTheDocument();
    expect(card("Signed").getByText("1 agreement")).toBeInTheDocument();
    expect(screen.getAllByText("Your turn")).toHaveLength(1);
    expect(screen.getByText("You confirmed version 2. Waiting for Tahrem to confirm.")).toBeInTheDocument();
  });

  it("tells the founder it is their turn when the investor already confirmed", async () => {
    auth.user.id = FOUNDER_ID;
    api.fetchAgreements.mockResolvedValue([draftAgreement({ confirmations: [confirmation({ version: 2 })] })]);
    renderPage();
    const link = await screen.findByRole("link", { name: /Open the agreement for SkillSwap/ });
    expect(within(link).getByText("With Priya Nair · you are the founder")).toBeInTheDocument();
    expect(within(link).getByText("Priya confirmed version 2. Read it, and confirm if you agree.")).toBeInTheDocument();
    expect(within(link).getByText("Your turn")).toBeInTheDocument();
  });

  it("shows a signed agreement as signed", async () => {
    api.fetchAgreements.mockResolvedValue([makeAgreement()]);
    renderPage();
    const link = await screen.findByRole("link", { name: /Open the agreement for SkillSwap/ });
    expect(within(link).getByText("Signed")).toBeInTheDocument();
    expect(within(link).queryByText("Your turn")).not.toBeInTheDocument();
    expect(within(link).getByText(/counts as raised/)).toBeInTheDocument();
  });

  it("copes with an idea that is no longer visible", async () => {
    api.fetchAgreements.mockResolvedValue([draftAgreement({ ideaTitle: null })]);
    renderPage();
    expect(await screen.findByText("An idea that is no longer available")).toBeInTheDocument();
  });

  it("shows the reason when loading fails, and tries again", async () => {
    api.fetchAgreements.mockRejectedValueOnce(new Error("network down"));
    api.fetchAgreements.mockResolvedValueOnce([draftAgreement()]);
    renderPage();
    expect(await screen.findByText("We could not load your agreements")).toBeInTheDocument();
    expect(screen.getByText("network down")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("SkillSwap")).toBeInTheDocument();
  });

  it("updates live when agreements or confirmations change, and stops listening when it goes away", async () => {
    api.fetchAgreements.mockResolvedValue([]);
    const { unmount } = renderPage();
    await screen.findByText("No agreements yet");
    expect(realtime.tables).toEqual(["agreements", "agreement_confirmations"]);
    unmount();
    await waitFor(() => expect(realtime.removed).toBe(1));
  });
});

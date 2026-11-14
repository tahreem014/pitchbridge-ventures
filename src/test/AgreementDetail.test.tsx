/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AgreementDetail from "@/pages/app/AgreementDetail";
import type { AgreementItem, EventItem } from "@/lib/agreements";
import { AGREEMENT_ID, FOUNDER_ID, INVESTOR_ID, confirmation, draftAgreement, makeAgreement } from "./agreementFixtures";

const api = vi.hoisted(() => ({
  fetchAgreement: vi.fn(), saveTerms: vi.fn(), confirmAgreement: vi.fn(), cancelAgreement: vi.fn(), buildAgreementPdf: vi.fn(),
}));
const auth = vi.hoisted(() => ({ user: { id: "d0000000-0000-4000-8000-000000000005" } }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const realtime = vi.hoisted(() => ({ tables: [] as string[] }));

vi.mock("@/integrations/supabase/client", () => {
  const channel: any = {
    on: (_type: string, filter: { table: string }) => { realtime.tables.push(filter.table); return channel; },
    subscribe: () => channel,
  };
  return { supabase: { channel: () => channel, removeChannel: () => {} } };
});
vi.mock("@/lib/agreements", async importOriginal => ({
  ...(await importOriginal<typeof import("@/lib/agreements")>()),
  fetchAgreement: api.fetchAgreement, saveTerms: api.saveTerms, confirmAgreement: api.confirmAgreement, cancelAgreement: api.cancelAgreement,
}));
vi.mock("@/lib/agreementPdf", async importOriginal => ({ ...(await importOriginal<typeof import("@/lib/agreementPdf")>()), buildAgreementPdf: api.buildAgreementPdf }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: any) => <div>{children}</div> }));
vi.mock("sonner", () => ({ toast }));

const renderPage = () => render(
  <MemoryRouter initialEntries={[`/app/agreements/${AGREEMENT_ID}`]}>
    <Routes>
      <Route path="/app/agreements/:id" element={<AgreementDetail />} />
      <Route path="/app/agreements" element={<div>LIST PAGE</div>} />
    </Routes>
  </MemoryRouter>,
);

const found = (agreement: AgreementItem, events: EventItem[] = []) => api.fetchAgreement.mockResolvedValue({ agreement, events });
const event = (over: Partial<EventItem>): EventItem => ({ id: "e", actorId: FOUNDER_ID, event: "created", version: 1, details: null, createdAt: "2026-10-20T10:00:00Z", ...over });
const confirmButton = () => screen.getByRole("button", { name: /^(Confirm version|You confirmed version)/ });
const openTab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole("tab", { name }));

beforeEach(() => {
  Object.values(api).forEach(fn => fn.mockReset());
  toast.success.mockReset(); toast.error.mockReset();
  realtime.tables = [];
  auth.user.id = INVESTOR_ID; // Priya, the investor
  Object.assign(URL, { createObjectURL: vi.fn(() => "blob:agreement"), revokeObjectURL: vi.fn() });
});

afterEach(() => { vi.restoreAllMocks(); });

describe("agreement page: reading", () => {
  it("shows the deal, who it is with, what happens next, and the agreement itself", async () => {
    found(draftAgreement());
    renderPage();
    expect(await screen.findByRole("heading", { name: "SkillSwap" })).toBeInTheDocument();
    expect(api.fetchAgreement).toHaveBeenCalledWith(AGREEMENT_ID);
    expect(screen.getByText("Waiting for confirmations")).toBeInTheDocument();
    expect(screen.getByText("Equity investment")).toBeInTheDocument();
    expect(screen.getByText("Version 2")).toBeInTheDocument();
    expect(screen.getByText("$40,000 for 9% equity")).toBeInTheDocument();
    expect(screen.getByText("Tahrem Khan")).toBeInTheDocument();
    expect(screen.getByText("You are the investor; they are the founder")).toBeInTheDocument();
    expect(screen.getByTestId("next-step")).toHaveTextContent("Read the terms, change anything you need, then confirm.");
    // the document, with its clauses and the standard disclaimer
    expect(screen.getByText("1. Parties and project")).toBeInTheDocument();
    expect(screen.getByText("3. Payment schedule")).toBeInTheDocument();
    expect(screen.getByText(/has not been reviewed by a lawyer/)).toBeInTheDocument();
    expect(screen.getByText("Fixed by the accepted proposal")).toBeInTheDocument();
  });

  it("links back to the list, and to a message to the other person", async () => {
    found(draftAgreement());
    renderPage();
    expect(await screen.findByRole("link", { name: /All agreements/ })).toHaveAttribute("href", "/app/agreements");
    expect(screen.getByRole("link", { name: /Message Tahrem/ })).toHaveAttribute("href", `/app/messages?with=${FOUNDER_ID}`);
  });

  it("listens for live changes to the agreement, its confirmations and its timeline", async () => {
    found(draftAgreement());
    renderPage();
    await screen.findByRole("heading", { name: "SkillSwap" });
    expect(realtime.tables).toEqual(["agreements", "agreement_confirmations", "agreement_events"]);
  });

  it("says when the agreement does not exist, or belongs to other people", async () => {
    api.fetchAgreement.mockResolvedValue(null);
    renderPage();
    expect(await screen.findByText("Agreement not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /All agreements/ })).toBeInTheDocument();
  });

  it("shows the reason when loading fails, and tries again", async () => {
    api.fetchAgreement.mockRejectedValueOnce(new Error("network down"));
    api.fetchAgreement.mockResolvedValueOnce({ agreement: draftAgreement(), events: [] });
    renderPage();
    expect(await screen.findByText("We could not load this agreement")).toBeInTheDocument();
    expect(screen.getByText("network down")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "SkillSwap" })).toBeInTheDocument();
  });
});

describe("agreement page: confirming", () => {
  it("confirms the version after the person says they read it, then waits for the other side", async () => {
    found(draftAgreement());
    api.confirmAgreement.mockResolvedValue("draft");
    renderPage();
    await screen.findByRole("heading", { name: "SkillSwap" });

    expect(confirmButton()).toHaveTextContent("Confirm version 2");
    expect(confirmButton()).toBeEnabled();
    fireEvent.click(confirmButton());
    const dialog = await screen.findByRole("dialog");
    expect(api.confirmAgreement).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm version 2" }));

    await waitFor(() => expect(api.confirmAgreement).toHaveBeenCalledWith(AGREEMENT_ID, 2));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Confirmed. Waiting for Tahrem."));
    await waitFor(() => expect(api.fetchAgreement).toHaveBeenCalledTimes(2)); // shows the true state afterwards
  });

  it("tells both people it is signed when the second confirmation arrives", async () => {
    found(draftAgreement({ confirmations: [{ ...confirmation({ userId: FOUNDER_ID, party: "entrepreneur", version: 2 }) }] }));
    api.confirmAgreement.mockResolvedValue("executed");
    renderPage();
    await screen.findByRole("heading", { name: "SkillSwap" });
    expect(screen.getByTestId("next-step")).toHaveTextContent("Tahrem confirmed version 2. Read it, and confirm if you agree.");

    fireEvent.click(confirmButton());
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm version 2" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Agreement signed. $40,000 now counts as raised."));
  });

  it("shows the server's reason, and the latest terms, if the other person changed them first", async () => {
    found(draftAgreement());
    api.confirmAgreement.mockRejectedValue(new Error("The terms changed. Please review the latest version before confirming"));
    renderPage();
    await screen.findByRole("heading", { name: "SkillSwap" });
    fireEvent.click(confirmButton());
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm version 2" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("The terms changed. Please review the latest version before confirming"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(api.fetchAgreement).toHaveBeenCalledTimes(2));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("will not let anyone confirm until the document is complete, and lists what is missing", async () => {
    found(draftAgreement({ terms: { ...draftAgreement().terms, governing_law: "", investor_responsibilities: "" } }));
    renderPage();
    await screen.findByRole("heading", { name: "SkillSwap" });
    expect(confirmButton()).toBeDisabled();
    expect(screen.getByText("Before you can confirm:")).toBeInTheDocument();
    expect(screen.getByText("Say which law governs the agreement")).toBeInTheDocument();
    expect(screen.getByText("Describe the investor's responsibilities")).toBeInTheDocument();
  });

  it("shows that you have confirmed and are waiting for the other side", async () => {
    found(draftAgreement({ confirmations: [confirmation({ version: 2 })] }));
    renderPage();
    await screen.findByRole("heading", { name: "SkillSwap" });
    expect(confirmButton()).toHaveTextContent("You confirmed version 2");
    expect(confirmButton()).toBeDisabled();
    expect(screen.getByTestId("next-step")).toHaveTextContent("You confirmed version 2. Waiting for Tahrem to confirm.");
  });

  it("asks again when a change made your earlier confirmation stale", async () => {
    // Priya confirmed version 2, then the terms moved to version 3
    found(draftAgreement({ version: 3, confirmations: [confirmation({ version: 2 })] }));
    renderPage();
    await screen.findByRole("heading", { name: "SkillSwap" });
    expect(confirmButton()).toHaveTextContent("Confirm version 3");
    expect(confirmButton()).toBeEnabled();
  });
});

describe("agreement page: editing the terms", () => {
  it("opens the editor with a warning, and saves a new version", async () => {
    found(draftAgreement());
    api.saveTerms.mockResolvedValue(3);
    renderPage();
    await screen.findByRole("heading", { name: "SkillSwap" });

    fireEvent.click(screen.getByRole("button", { name: /Edit terms/ }));
    expect(await screen.findByText("Saving a change makes version 3. Tahrem will be told.")).toBeInTheDocument();
    expect(screen.queryByText("1. Parties and project")).not.toBeInTheDocument(); // the editor replaces the preview

    fireEvent.change(screen.getByLabelText("Governing law"), { target: { value: "Laws of England" } });
    fireEvent.click(screen.getByRole("button", { name: "Save as a new version" }));

    await waitFor(() => expect(api.saveTerms).toHaveBeenCalledTimes(1));
    expect(api.saveTerms.mock.calls[0][0]).toBe(AGREEMENT_ID);
    expect(api.saveTerms.mock.calls[0][1]).toMatchObject({ type: "equity", governingLaw: "Laws of England", equityPercent: "9" });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Saved as version 3"));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Save as a new version" })).not.toBeInTheDocument());
    await waitFor(() => expect(api.fetchAgreement).toHaveBeenCalledTimes(2));
  });

  it("warns that a change makes everyone confirm again when someone already has", async () => {
    found(draftAgreement({ confirmations: [confirmation({ userId: FOUNDER_ID, party: "entrepreneur", version: 2 })] }));
    renderPage();
    await screen.findByRole("heading", { name: "SkillSwap" });
    fireEvent.click(screen.getByRole("button", { name: /Edit terms/ }));
    expect(await screen.findByText("Tahrem has confirmed version 2. Saving a change makes version 3, and everyone will need to confirm again.")).toBeInTheDocument();
  });

  it("names both people when both have confirmed (which cannot happen to a draft, but the wording must hold)", async () => {
    found(draftAgreement({ confirmations: [confirmation({ version: 2 }), confirmation({ id: "c2", userId: FOUNDER_ID, party: "entrepreneur", version: 2 })] }));
    renderPage();
    await screen.findByRole("heading", { name: "SkillSwap" });
    fireEvent.click(screen.getByRole("button", { name: /Edit terms/ }));
    expect(await screen.findByText(/Both of you have confirmed version 2/)).toBeInTheDocument();
  });

  it("says when nothing actually changed", async () => {
    found(draftAgreement());
    api.saveTerms.mockResolvedValue(2);
    renderPage();
    await screen.findByRole("heading", { name: "SkillSwap" });
    fireEvent.click(screen.getByRole("button", { name: /Edit terms/ }));
    fireEvent.change(await screen.findByLabelText("Governing law"), { target: { value: "Laws of England" } });
    fireEvent.click(screen.getByRole("button", { name: "Save as a new version" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Nothing changed"));
  });

  it("keeps the editor open and shows the reason when saving fails", async () => {
    found(draftAgreement());
    api.saveTerms.mockRejectedValue(new Error("This agreement can no longer be changed"));
    renderPage();
    await screen.findByRole("heading", { name: "SkillSwap" });
    fireEvent.click(screen.getByRole("button", { name: /Edit terms/ }));
    fireEvent.change(await screen.findByLabelText("Governing law"), { target: { value: "Laws of England" } });
    fireEvent.click(screen.getByRole("button", { name: "Save as a new version" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("This agreement can no longer be changed"));
    expect(screen.getByRole("button", { name: "Save as a new version" })).toBeInTheDocument();
  });

  it("leaves the editor without saving when cancelled", async () => {
    found(draftAgreement());
    renderPage();
    await screen.findByRole("heading", { name: "SkillSwap" });
    fireEvent.click(screen.getByRole("button", { name: /Edit terms/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("1. Parties and project")).toBeInTheDocument();
    expect(api.saveTerms).not.toHaveBeenCalled();
  });
});

describe("agreement page: cancelling", () => {
  it("cancels only after the person confirms, and explains the effect", async () => {
    found(draftAgreement());
    api.cancelAgreement.mockResolvedValue(undefined);
    renderPage();
    await screen.findByRole("heading", { name: "SkillSwap" });

    fireEvent.click(screen.getByRole("button", { name: /Cancel agreement/ }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/The proposal will be marked withdrawn and the money will not count as raised/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Keep the agreement" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(api.cancelAgreement).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Cancel agreement/ }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel agreement" }));
    await waitFor(() => expect(api.cancelAgreement).toHaveBeenCalledWith(AGREEMENT_ID));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Agreement cancelled"));
  });

  it("shows the reason when cancelling is refused", async () => {
    found(draftAgreement());
    api.cancelAgreement.mockRejectedValue(new Error("Only a draft agreement can be cancelled"));
    renderPage();
    await screen.findByRole("heading", { name: "SkillSwap" });
    fireEvent.click(screen.getByRole("button", { name: /Cancel agreement/ }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel agreement" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Only a draft agreement can be cancelled"));
  });
});

describe("agreement page: signed and cancelled", () => {
  it("offers nothing to change once it is signed, but still the PDF", async () => {
    found(makeAgreement());
    renderPage();
    await screen.findByRole("heading", { name: "SkillSwap" });
    expect(screen.getByText("Signed")).toBeInTheDocument();
    expect(screen.getByTestId("next-step")).toHaveTextContent(/^Signed on Oct 26, 2026 at .*\. \$40,000 counts as raised\.$/);
    expect(screen.queryByRole("button", { name: /^(Confirm version|You confirmed)/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit terms/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cancel agreement/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download PDF/ })).toBeEnabled();
    expect(screen.getByText("1. Parties and project")).toBeInTheDocument(); // the document is still there to read
  });

  it("offers nothing to change once it is cancelled", async () => {
    found(makeAgreement({ status: "cancelled", executedAt: null, cancelledAt: "2026-10-27T00:00:00Z" }));
    renderPage();
    await screen.findByRole("heading", { name: "SkillSwap" });
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(screen.getByTestId("next-step")).toHaveTextContent("This agreement was cancelled, so the money does not count.");
    expect(screen.queryByRole("button", { name: /Edit terms/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirm version/ })).not.toBeInTheDocument();
  });
});

describe("agreement page: the PDF", () => {
  it("builds the PDF from this agreement and downloads it under a clear name", async () => {
    const draft = draftAgreement();
    found(draft);
    api.buildAgreementPdf.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
    const downloads: [string, string][] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { downloads.push([this.download, this.href]); });

    renderPage();
    await screen.findByRole("heading", { name: "SkillSwap" });
    fireEvent.click(screen.getByRole("button", { name: /Download PDF/ }));

    await waitFor(() => expect(downloads).toEqual([["investment-agreement-skillswap-v2-draft.pdf", "blob:agreement"]]));
    expect(api.buildAgreementPdf).toHaveBeenCalledWith(draft);
    expect((URL.createObjectURL as any).mock.calls[0][0]).toBeInstanceOf(Blob);
    expect((URL.createObjectURL as any).mock.calls[0][0].type).toBe("application/pdf");
  });

  it("says so when the PDF cannot be made, and lets the person try again", async () => {
    found(draftAgreement());
    api.buildAgreementPdf.mockRejectedValue(new Error("boom"));
    renderPage();
    await screen.findByRole("heading", { name: "SkillSwap" });
    fireEvent.click(screen.getByRole("button", { name: /Download PDF/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("The PDF could not be created. Please try again."));
    await waitFor(() => expect(screen.getByRole("button", { name: /Download PDF/ })).toBeEnabled());
  });
});

describe("agreement page: confirmations and history", () => {
  it("shows who confirmed which version, with the record of each confirmation", async () => {
    found(makeAgreement({
      version: 3,
      confirmations: [
        confirmation({ id: "old", version: 2, confirmedAt: "2026-10-24T10:00:00Z", ip: "203.0.113.7" }),
        confirmation({ id: "f3", userId: FOUNDER_ID, party: "entrepreneur", version: 3, name: "Tahrem Khan", email: "tahrem014@gmail.com" }),
        confirmation({ id: "i3", version: 3 }),
      ],
    }));
    renderPage();
    await screen.findByRole("heading", { name: "SkillSwap" });
    openTab(/Confirmations/);

    expect(await screen.findAllByText(/Confirmed version 3/)).toHaveLength(2);
    expect(screen.getByText("Record of every confirmation")).toBeInTheDocument();
    expect(screen.getByText(/\(an earlier version, no longer counts\)/)).toBeInTheDocument();
    expect(screen.getByText(/from 203\.0\.113\.7/)).toBeInTheDocument();
    expect(screen.getAllByText(/Priya Nair <priya\.nair@demo\.pitchbridge\.test>/).length).toBeGreaterThanOrEqual(1);
  });

  it("says who has not confirmed yet", async () => {
    found(draftAgreement({ confirmations: [confirmation({ version: 2 })], founder: { ...makeAgreement().founder, email: null } }));
    renderPage();
    await screen.findByRole("heading", { name: "SkillSwap" });
    openTab(/Confirmations/);
    expect(await screen.findByText("Has not confirmed version 2")).toBeInTheDocument();
    expect(screen.getByText("Email appears after they confirm")).toBeInTheDocument();
  });

  it("lists what happened, newest first, saying 'You' for your own actions", async () => {
    found(draftAgreement(), [
      event({ id: "e1", event: "created", version: 1, actorId: FOUNDER_ID, createdAt: "2026-10-20T10:00:00Z" }),
      event({ id: "e2", event: "terms_updated", version: 2, actorId: INVESTOR_ID, details: { changed: ["governing_law"] }, createdAt: "2026-10-21T10:00:00Z" }),
      event({ id: "e3", event: "confirmed", version: 2, actorId: FOUNDER_ID, createdAt: "2026-10-22T10:00:00Z" }),
    ]);
    renderPage();
    await screen.findByRole("heading", { name: "SkillSwap" });
    openTab(/History/);

    const lines = await screen.findAllByText(/accepted the proposal|changed the terms|confirmed version/);
    expect(lines.map(l => l.textContent)).toEqual([
      "Tahrem Khan confirmed version 2",
      "You changed the terms (now version 2): Governing law",
      "Tahrem Khan accepted the proposal, which started this agreement",
    ]);
  });

  it("says so when nothing has happened", async () => {
    found(draftAgreement(), []);
    renderPage();
    await screen.findByRole("heading", { name: "SkillSwap" });
    openTab(/History/);
    expect(await screen.findByText("Nothing has happened yet.")).toBeInTheDocument();
  });
});

describe("agreement page: as the founder", () => {
  it("sees the investor as the other party", async () => {
    auth.user.id = FOUNDER_ID;
    found(draftAgreement({ confirmations: [confirmation({ version: 2 })] }));
    renderPage();
    await screen.findByRole("heading", { name: "SkillSwap" });
    expect(screen.getByText("You are the founder; they are the investor")).toBeInTheDocument();
    expect(screen.getByTestId("next-step")).toHaveTextContent("Priya confirmed version 2. Read it, and confirm if you agree.");
    expect(confirmButton()).toHaveTextContent("Confirm version 2");
    expect(screen.getByRole("link", { name: /Message Priya/ })).toHaveAttribute("href", `/app/messages?with=${INVESTOR_ID}`);
  });
});

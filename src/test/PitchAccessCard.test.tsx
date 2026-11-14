/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PitchAccessCard } from "@/components/pitch/PitchAccessCard";

const ME = "11111111-1111-4111-8111-111111111111";
const FOUNDER = "22222222-2222-4222-8222-222222222222";
const IDEA = "a0000000-0000-4000-8000-000000000012";

const db = vi.hoisted(() => ({
  request: null as any,          // the investor's latest request, or null
  nda: null as any,              // their NDA acceptance for it, or null
  ownerDetails: null as any,     // what the founder reads directly
  template: { version: "nda-v1", title: "Confidentiality Agreement", body: "This agreement is between the founder and the investor." } as any,
  pitchRows: [] as any[],        // what get_pitch_details returns
  docRows: [] as any[],          // what list_pitch_documents returns to an investor
  docError: null as any,         // set to make list_pitch_documents fail
  ownDocs: [] as any[],          // the founder's own documents, read directly
  invoke: vi.fn(),               // the stamping server function
  rpc: [] as [string, any][],
  rpcError: null as any,
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

const chain = (result: unknown): any =>
  new Proxy({}, { get: (_t, prop) => (prop === "then" ? (resolve: any) => resolve(result) : () => chain(result)) });

vi.mock("@/integrations/supabase/client", () => {
  const channel: any = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      from: (table: string) => ({
        select: () => chain({
          data: table === "pitch_access_requests" ? db.request
            : table === "nda_acceptances" ? db.nda
            : table === "idea_pitch_details" ? db.ownerDetails
            : table === "pitch_documents" ? db.ownDocs
            : table === "nda_templates" ? db.template : null,
          error: null,
        }),
      }),
      rpc: (name: string, args: any) => {
        db.rpc.push([name, args]);
        if (name === "get_pitch_details") return chain({ data: db.pitchRows, error: null });
        if (name === "list_pitch_documents") return chain({ data: db.docError ? null : db.docRows, error: db.docError });
        return chain({ data: null, error: db.rpcError });
      },
      functions: { invoke: (...a: unknown[]) => db.invoke(...a) },
      channel: () => channel,
      removeChannel: () => {},
    },
  };
});
vi.mock("sonner", () => ({ toast }));

const idea = (extra: Record<string, unknown> = {}) => ({ id: IDEA, user_id: FOUNDER, title: "SkillSwap", has_detailed_pitch: true, ...extra });
const renderCard = (props: { idea?: any; userId?: string; role?: string | null } = {}) =>
  render(<MemoryRouter><PitchAccessCard idea={props.idea ?? idea()} userId={props.userId ?? ME} role={props.role === undefined ? "investor" : props.role} /></MemoryRouter>);

const pitchRow = {
  business_model: "Freemium with campus licences", target_customers: "University students", market_research: "", financial_estimates: "Break-even in month 17",
  updated_at: "2026-10-20T10:00:00Z", viewer_name: "Priya Nair", viewer_email: "priya.nair@demo.pitchbridge.test", nda_accepted_at: "2026-10-23T09:30:00Z", is_owner: false,
};

beforeEach(() => {
  db.request = null; db.nda = null; db.ownerDetails = null; db.pitchRows = []; db.rpc = []; db.rpcError = null;
  db.docRows = []; db.docError = null; db.ownDocs = []; db.invoke.mockReset();
  Object.assign(URL, { createObjectURL: vi.fn(() => "blob:stamped-copy"), revokeObjectURL: vi.fn() }); // jsdom has no object URLs
  toast.success.mockReset(); toast.error.mockReset();
});

describe("PitchAccessCard for an investor", () => {
  it("shows nothing, and asks the server for nothing, when the idea has no detailed pitch", () => {
    const { container } = renderCard({ idea: idea({ has_detailed_pitch: false }) });
    expect(container).toBeEmptyDOMElement();
    expect(db.rpc).toEqual([]);
  });

  it("locks the pitch and offers to request access", async () => {
    renderCard();
    expect(await screen.findByRole("button", { name: /^Request access$/ })).toBeInTheDocument();
    expect(screen.getByText(/keeps the business model/i)).toBeInTheDocument();
    expect(screen.queryByText("Business model")).not.toBeInTheDocument();
  });

  it("sends a request with the message, through the server function", async () => {
    renderCard();
    fireEvent.click(await screen.findByRole("button", { name: /^Request access$/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/message to the founder/i), { target: { value: "  Keen to read the financials  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send request" }));

    await waitFor(() => expect(db.rpc).toContainEqual(["request_pitch_access", { _idea_id: IDEA, _message: "Keen to read the financials" }]));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Request sent"));
  });

  it("shows the server's reason when a request is refused", async () => {
    db.rpcError = { message: "You already have an open request for this pitch" };
    renderCard();
    fireEvent.click(await screen.findByRole("button", { name: /^Request access$/ }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("You already have an open request for this pitch"));
  });

  it("tells an investor in Founder mode to switch", async () => {
    renderCard({ role: "entrepreneur" });
    expect(await screen.findByText("Switch to Investor mode to request access.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /request access/i })).not.toBeInTheDocument();
  });

  it("shows a pending request without offering another", async () => {
    db.request = { id: "req-1", status: "pending", created_at: "2026-10-25T10:00:00Z" };
    renderCard();
    expect(await screen.findByText(/Waiting for the founder to reply/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /request access/i })).not.toBeInTheDocument();
  });

  it("offers to ask again after a decline or a withdrawal", async () => {
    db.request = { id: "req-1", status: "rejected", created_at: "2026-10-25T10:00:00Z" };
    const { unmount } = renderCard();
    expect(await screen.findByText("The founder declined your last request.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request access again" })).toBeInTheDocument();
    unmount();

    db.request = { id: "req-1", status: "revoked", created_at: "2026-10-25T10:00:00Z" };
    renderCard();
    expect(await screen.findByText("The founder withdrew your access.")).toBeInTheDocument();
  });

  it("keeps the pitch locked after approval until the terms are accepted", async () => {
    db.request = { id: "req-1", status: "approved", created_at: "2026-10-25T10:00:00Z" };
    db.nda = null;
    renderCard();
    expect(await screen.findByRole("button", { name: /review confidentiality terms/i })).toBeInTheDocument();
    expect(db.rpc.filter(([name]) => name === "get_pitch_details")).toHaveLength(0);
    expect(screen.queryByText("Business model")).not.toBeInTheDocument();
  });

  it("makes the investor read and tick the terms before accepting them", async () => {
    db.request = { id: "req-1", status: "approved", created_at: "2026-10-25T10:00:00Z" };
    renderCard();
    fireEvent.click(await screen.findByRole("button", { name: /review confidentiality terms/i }));

    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("This agreement is between the founder and the investor.")).toBeInTheDocument();
    const accept = within(dialog).getByRole("button", { name: /accept and unlock the pitch/i });
    expect(accept).toBeDisabled();

    fireEvent.click(within(dialog).getByRole("checkbox"));
    expect(accept).toBeEnabled();
    fireEvent.click(accept);

    await waitFor(() => expect(db.rpc).toContainEqual(["accept_nda", { _request_id: "req-1", _nda_version: "nda-v1" }]));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Confidentiality terms accepted"));
  });

  it("unlocks the pitch once approved and accepted, marked with the reader's name and email", async () => {
    db.request = { id: "req-1", status: "approved", created_at: "2026-10-25T10:00:00Z" };
    db.nda = { accepted_at: "2026-10-23T09:30:00Z" };
    db.pitchRows = [pitchRow];
    renderCard();

    expect(await screen.findByText("Freemium with campus licences")).toBeInTheDocument();
    expect(db.rpc).toContainEqual(["get_pitch_details", { _idea_id: IDEA }]);
    expect(screen.getByText("Business model")).toBeInTheDocument();
    expect(screen.getByText("Not provided.")).toBeInTheDocument(); // the empty market research section
    expect(screen.getByText(/Shared with Priya Nair <priya\.nair@demo\.pitchbridge\.test>/)).toBeInTheDocument();
    expect(screen.getByTestId("watermark").getAttribute("data-watermark")).toBe("Confidential - Priya Nair <priya.nair@demo.pitchbridge.test>");
  });

  it("stays locked if the server returns no pitch, even with an approved request", async () => {
    db.request = { id: "req-1", status: "approved", created_at: "2026-10-25T10:00:00Z" };
    db.nda = { accepted_at: "2026-10-23T09:30:00Z" };
    db.pitchRows = [];
    renderCard();
    await waitFor(() => expect(db.rpc.some(([name]) => name === "get_pitch_details")).toBe(true));
    expect(screen.queryByTestId("watermark")).not.toBeInTheDocument();
  });

  describe("supporting documents", () => {
    const approved = () => {
      db.request = { id: "req-1", status: "approved", created_at: "2026-10-25T10:00:00Z" };
      db.nda = { accepted_at: "2026-10-23T09:30:00Z" };
    };
    const deck = { id: "doc-1", title: "Pitch deck", mime_type: "application/pdf", size_bytes: 256000, created_at: "2026-10-20T10:00:00Z" };

    it("lists the documents after access is granted, and opens a stamped copy through the server function", async () => {
      approved();
      db.pitchRows = [pitchRow];
      db.docRows = [deck];
      db.invoke.mockResolvedValue({ data: new Blob(["%PDF"], { type: "application/pdf" }), error: null });
      renderCard();

      expect(await screen.findByRole("heading", { name: "Supporting documents" })).toBeInTheDocument();
      expect(db.rpc).toContainEqual(["list_pitch_documents", { _idea_id: IDEA }]);
      expect(screen.getByText("PDF · 250 KB")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "View Pitch deck" }));
      expect(await screen.findByTitle("Pitch deck (confidential copy)")).toHaveAttribute("src", "blob:stamped-copy");
      expect(db.invoke).toHaveBeenCalledWith("pitch-document", { body: { document_id: "doc-1" } });
    });

    it("works for a pitch made of documents only, instead of looking locked", async () => {
      approved();
      db.pitchRows = [{ ...pitchRow, business_model: null, target_customers: null, market_research: null, financial_estimates: null }];
      db.docRows = [deck];
      renderCard();

      expect(await screen.findByText(/has not written any text sections/)).toBeInTheDocument();
      expect(screen.getByText("Pitch deck")).toBeInTheDocument();
      expect(screen.getByText(/Shared with Priya Nair/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /request access/i })).not.toBeInTheDocument();
      expect(screen.queryByText("Not provided.")).not.toBeInTheDocument();
    });

    it("still shows the written pitch if the document list cannot be loaded", async () => {
      approved();
      db.pitchRows = [pitchRow];
      db.docError = { message: "boom" };
      renderCard();
      expect(await screen.findByText("Freemium with campus licences")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Supporting documents" })).not.toBeInTheDocument();
    });

    it("never asks for documents before access is granted", async () => {
      db.request = { id: "req-1", status: "pending", created_at: "2026-10-25T10:00:00Z" };
      db.docRows = [deck];
      renderCard();
      expect(await screen.findByText(/Waiting for the founder to reply/)).toBeInTheDocument();
      expect(db.rpc.some(([name]) => name === "list_pitch_documents")).toBe(false);
      expect(screen.queryByText("Pitch deck")).not.toBeInTheDocument();
    });

    it("shows a refused document's reason in the viewer", async () => {
      approved();
      db.pitchRows = [pitchRow];
      db.docRows = [deck];
      db.invoke.mockResolvedValue({
        data: null,
        error: Object.assign(new Error("non-2xx"), { context: new Response(JSON.stringify({ error: "You do not have access to this document" }), { status: 403 }) }),
      });
      renderCard();
      fireEvent.click(await screen.findByRole("button", { name: "View Pitch deck" }));
      expect(await screen.findByText("You do not have access to this document")).toBeInTheDocument();
    });
  });
});

describe("PitchAccessCard for the founder", () => {
  it("shows their own detailed pitch with links to edit it and manage access", async () => {
    db.ownerDetails = { business_model: "Freemium", target_customers: "Students", market_research: "TAM 12M", financial_estimates: "Break-even month 17" };
    renderCard({ userId: FOUNDER, role: "entrepreneur" });

    expect(await screen.findByText("Freemium")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /edit pitch/i })).toHaveAttribute("href", `/app/ideas/${IDEA}/edit`);
    expect(screen.getByRole("link", { name: /manage access/i })).toHaveAttribute("href", "/app/access");
    expect(screen.queryByTestId("watermark")).not.toBeInTheDocument();
    expect(db.rpc).toEqual([]); // the founder reads directly and is not logged as a viewer
  });

  it("invites the founder to add a detailed pitch when there is none", async () => {
    db.ownerDetails = null;
    renderCard({ userId: FOUNDER, role: "entrepreneur", idea: idea({ has_detailed_pitch: false }) });
    expect(await screen.findByText("You have not added a detailed pitch yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /add detailed pitch/i })).toBeInTheDocument();
  });

  it("lists the founder's own documents, even when there is no written pitch", async () => {
    db.ownerDetails = null;
    db.ownDocs = [{ id: "doc-1", title: "Pitch deck", file_path: `${IDEA}/x.pdf`, mime_type: "application/pdf", size_bytes: 256000, created_at: "2026-10-20T10:00:00Z" }];
    renderCard({ userId: FOUNDER, role: "entrepreneur" });

    expect(await screen.findByText("Pitch deck")).toBeInTheDocument();
    expect(screen.queryByText("You have not added a detailed pitch yet.")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /edit pitch/i })).toBeInTheDocument();
    expect(db.rpc).toEqual([]); // the founder's list is read directly, not logged as a viewing
  });

  it("reminds the founder these records are evidence, not a legal guarantee", async () => {
    db.ownerDetails = { business_model: "Freemium", target_customers: "", market_research: "", financial_estimates: "" };
    renderCard({ userId: FOUNDER, role: "entrepreneur" });
    expect(await screen.findByText(/do not by themselves give you legal ownership/i)).toBeInTheDocument();
  });
});

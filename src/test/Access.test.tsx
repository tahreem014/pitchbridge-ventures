/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Access from "@/pages/app/Access";

const ME = "11111111-1111-4111-8111-111111111111";
const PRIYA = "d0000000-0000-4000-8000-000000000005";
const ELENA = "d0000000-0000-4000-8000-000000000007";
const SANA = "d0000000-0000-4000-8000-000000000003";

const db = vi.hoisted(() => ({
  myIdeas: [] as any[], requests: [] as any[], ndas: [] as any[], log: [] as any[], versions: [] as any[],
  people: [] as any[], ndaRecord: null as any, template: null as any, error: null as any,
  calls: [] as [string, unknown[]][], rpc: [] as [string, any][], rpcError: null as any,
}));
const auth = vi.hoisted(() => ({ user: { id: "11111111-1111-4111-8111-111111111111" }, role: "entrepreneur" as string | null }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

const chain = (result: unknown, tag: string): any =>
  new Proxy({}, {
    get: (_t, prop: string) => {
      if (prop === "then") return (resolve: any) => resolve(result);
      return (...args: unknown[]) => { db.calls.push([`${tag}.${prop}`, args]); return chain(result, tag); };
    },
  });

vi.mock("@/integrations/supabase/client", () => {
  const channel: any = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      from: (table: string) => ({
        select: (cols: string) => {
          const err = db.error;
          if (table === "ideas") return chain({ data: db.myIdeas, error: err }, table);
          if (table === "pitch_access_requests") return chain({ data: db.requests, error: err }, table);
          if (table === "nda_acceptances") return chain(cols.includes("nda_text") ? { data: db.ndaRecord, error: null } : { data: db.ndas, error: null }, table);
          if (table === "pitch_access_log") return chain({ data: db.log, error: null }, table);
          if (table === "pitch_versions") return chain({ data: db.versions, error: null }, table);
          if (table === "profiles") return chain({ data: db.people, error: null }, table);
          if (table === "nda_templates") return chain({ data: db.template, error: null }, table);
          return chain({ data: null, error: null }, table);
        },
      }),
      rpc: (name: string, args: any) => { db.rpc.push([name, args]); return chain({ data: null, error: db.rpcError }, "rpc"); },
      channel: () => channel,
      removeChannel: () => {},
    },
  };
});
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: any) => <div>{children}</div> }));
vi.mock("sonner", () => ({ toast }));

const person = (id: string, name: string) => ({ id, full_name: name, avatar_url: null, headline: "Angel investor", company: "Petrova Angels" });
const renderPage = () => render(<MemoryRouter><Access /></MemoryRouter>);
const kpi = (label: string) => within(screen.getByText(label).closest(".hover-lift") as HTMLElement);

beforeEach(() => {
  db.myIdeas = []; db.requests = []; db.ndas = []; db.log = []; db.versions = []; db.people = [];
  db.ndaRecord = null; db.template = null; db.error = null; db.calls = []; db.rpc = []; db.rpcError = null;
  auth.role = "entrepreneur";
  toast.success.mockReset(); toast.error.mockReset();
});

describe("Pitch access page: founder", () => {
  beforeEach(() => {
    db.myIdeas = [{ id: "idea-1", title: "SkillSwap" }];
    db.requests = [
      { id: "r1", idea_id: "idea-1", investor_id: PRIYA, status: "approved", message: "Before our committee", created_at: "2026-10-23T09:00:00Z", decided_at: "2026-10-23T13:00:00Z" },
      { id: "r2", idea_id: "idea-1", investor_id: ELENA, status: "pending", message: "Keen to read the market research", created_at: "2026-10-26T08:00:00Z", decided_at: null },
      { id: "r3", idea_id: "idea-1", investor_id: "someone-else", status: "rejected", message: null, created_at: "2026-10-18T08:00:00Z", decided_at: "2026-10-19T08:00:00Z" },
    ];
    db.ndas = [{ request_id: "r1", accepted_at: "2026-10-23T15:00:00Z" }];
    db.people = [person(PRIYA, "Priya Nair"), person(ELENA, "Elena Petrova")];
  });

  it("lists requests for the founder's ideas, with the ones needing an answer first", async () => {
    renderPage();
    const names = await screen.findAllByText(/^(Priya Nair|Elena Petrova|PitchBridge member)$/);
    expect(names.map(n => n.textContent)).toEqual(["Elena Petrova", "Priya Nair", "PitchBridge member"]);
    expect(screen.getByText(/Keen to read the market research/)).toBeInTheDocument();
    expect(kpi("Waiting for your answer").getByText("1")).toBeInTheDocument();
    expect(kpi("Investors with access").getByText("1")).toBeInTheDocument();
  });

  it("only asks for requests on the signed-in founder's own ideas", async () => {
    renderPage();
    await screen.findByText("Elena Petrova");
    expect(db.calls).toContainEqual(["ideas.eq", ["user_id", ME]]);
    expect(db.calls).toContainEqual(["pitch_access_requests.in", ["idea_id", ["idea-1"]]]);
  });

  it("shows when an approved investor accepted the confidentiality terms", async () => {
    renderPage();
    await screen.findByText("Priya Nair");
    expect(screen.getByText(/Accepted your confidentiality terms on/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view signed record/i })).toBeInTheDocument();
  });

  it("approves a request through the server function", async () => {
    renderPage();
    await screen.findByText("Elena Petrova");
    fireEvent.click(screen.getByRole("button", { name: /^Approve$/ }));
    await waitFor(() => expect(db.rpc).toContainEqual(["decide_pitch_access", { _request_id: "r2", _decision: "approve" }]));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Access approved"));
  });

  it("declines a request", async () => {
    renderPage();
    await screen.findByText("Elena Petrova");
    fireEvent.click(screen.getByRole("button", { name: /^Decline$/ }));
    await waitFor(() => expect(db.rpc).toContainEqual(["decide_pitch_access", { _request_id: "r2", _decision: "reject" }]));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Request declined"));
  });

  it("asks before revoking, and does nothing if cancelled", async () => {
    renderPage();
    await screen.findByText("Priya Nair");
    fireEvent.click(screen.getByRole("button", { name: /revoke access/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Their accepted confidentiality terms stay on record/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(db.rpc).toHaveLength(0);
  });

  it("revokes after confirmation", async () => {
    renderPage();
    await screen.findByText("Priya Nair");
    fireEvent.click(screen.getByRole("button", { name: /revoke access/i }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Revoke access" }));
    await waitFor(() => expect(db.rpc).toContainEqual(["decide_pitch_access", { _request_id: "r1", _decision: "revoke" }]));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Access revoked"));
  });

  it("shows the server's reason if a decision is refused", async () => {
    db.rpcError = { message: "This request has already been answered" };
    renderPage();
    await screen.findByText("Elena Petrova");
    fireEvent.click(screen.getByRole("button", { name: /^Approve$/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("This request has already been answered"));
  });

  it("opens the signed record with who, when, from where and the exact text", async () => {
    db.ndaRecord = {
      investor_name: "Priya Nair", investor_email: "priya.nair@demo.pitchbridge.test", accepted_at: "2026-10-23T15:00:00Z", nda_version: "nda-v1",
      nda_hash: "abc123def4567890", nda_text: "This agreement is between the founder and the investor.", ip_address: "203.0.113.24", user_agent: "Chrome/130",
    };
    renderPage();
    await screen.findByText("Priya Nair");
    fireEvent.click(screen.getByRole("button", { name: /view signed record/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("priya.nair@demo.pitchbridge.test")).toBeInTheDocument();
    expect(within(dialog).getByText("203.0.113.24")).toBeInTheDocument();
    expect(within(dialog).getByText("abc123def4567890")).toBeInTheDocument();
    expect(within(dialog).getByText("This agreement is between the founder and the investor.")).toBeInTheDocument();
    expect(within(dialog).getByText(/do not by themselves give you legal ownership/i)).toBeInTheDocument();
  });

  it("shows the activity log, naming the investor for each event", async () => {
    db.log = [
      { id: "l1", idea_id: "idea-1", actor_id: PRIYA, event: "pitch_viewed", request_id: null, created_at: "2026-10-25T10:00:00Z" },
      { id: "l2", idea_id: "idea-1", actor_id: ME, event: "access_approved", request_id: "r1", created_at: "2026-10-23T13:00:00Z" },
    ];
    renderPage();
    await screen.findByText("Priya Nair");
    fireEvent.click(screen.getByRole("tab", { name: /^Activity/ }));
    expect(await screen.findByText("Priya Nair opened the detailed pitch of SkillSwap")).toBeInTheDocument();
    expect(screen.getByText("You approved Priya Nair's request to read SkillSwap")).toBeInTheDocument();
  });

  it("names the document an investor opened", async () => {
    db.log = [
      { id: "l1", idea_id: "idea-1", actor_id: PRIYA, event: "document_viewed", request_id: null, created_at: "2026-10-25T10:05:00Z", details: { document_id: "d1", title: "Pitch deck" } },
      { id: "l2", idea_id: "idea-1", actor_id: PRIYA, event: "document_viewed", request_id: null, created_at: "2026-10-25T10:00:00Z", details: null },
    ];
    renderPage();
    await screen.findByText("Priya Nair");
    fireEvent.click(screen.getByRole("tab", { name: /^Activity/ }));
    expect(await screen.findByText('Priya Nair opened the document "Pitch deck" of SkillSwap')).toBeInTheDocument();
    expect(screen.getByText("Priya Nair opened a supporting document of SkillSwap")).toBeInTheDocument();
  });

  it("shows a change to the supporting documents in the version history", async () => {
    db.versions = [
      { id: "v2", idea_id: "idea-1", version: 2, content_hash: "ffeeddccbbaa99887766", changed_fields: ["documents"], created_at: "2026-10-20T10:00:00Z" },
    ];
    renderPage();
    await screen.findByText("Priya Nair");
    fireEvent.click(screen.getByRole("tab", { name: /^Version history/ }));
    expect(await screen.findByText("Supporting documents")).toBeInTheDocument();
  });

  it("shows the version history with what changed and a fingerprint", async () => {
    db.versions = [
      { id: "v2", idea_id: "idea-1", version: 2, content_hash: "ffeeddccbbaa99887766", changed_fields: ["details.business_model"], created_at: "2026-10-20T10:00:00Z" },
      { id: "v1", idea_id: "idea-1", version: 1, content_hash: "0011223344556677", changed_fields: null, created_at: "2026-10-01T10:00:00Z" },
    ];
    renderPage();
    await screen.findByText("Priya Nair");
    fireEvent.click(screen.getByRole("tab", { name: /^Version history/ }));
    expect(await screen.findByText("Business model")).toBeInTheDocument();
    expect(screen.getByText("Original submission")).toBeInTheDocument();
    expect(screen.getByText(/fingerprint ffeeddccbb/)).toBeInTheDocument();
    expect(screen.getByText(/do not by themselves give you legal ownership/i)).toBeInTheDocument();
  });

  it("shows a friendly empty state when the founder has no ideas", async () => {
    db.myIdeas = [];
    renderPage();
    expect(await screen.findByText("No access requests yet")).toBeInTheDocument();
  });

  it("offers a retry when loading fails", async () => {
    db.error = { message: "network down" };
    renderPage();
    expect(await screen.findByText("We could not load this page")).toBeInTheDocument();
    db.error = null;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Elena Petrova")).toBeInTheDocument();
  });
});

describe("Pitch access page: investor", () => {
  const idea = { id: "idea-9", title: "GridSage", user_id: SANA };
  beforeEach(() => {
    auth.role = "investor";
    db.requests = [
      { id: "q1", idea_id: "idea-9", status: "approved", message: null, created_at: "2026-10-25T09:00:00Z", decided_at: "2026-10-25T12:00:00Z", ideas: idea },
      { id: "q2", idea_id: "idea-1", status: "approved", message: null, created_at: "2026-10-20T09:00:00Z", decided_at: "2026-10-20T12:00:00Z", ideas: { id: "idea-1", title: "Lumora Health", user_id: SANA } },
      { id: "q3", idea_id: "idea-3", status: "pending", message: null, created_at: "2026-10-24T09:00:00Z", decided_at: null, ideas: { id: "idea-3", title: "StackPulse", user_id: SANA } },
      { id: "q4", idea_id: "idea-4", status: "rejected", message: null, created_at: "2026-10-10T09:00:00Z", decided_at: "2026-10-11T09:00:00Z", ideas: { id: "idea-4", title: "QuantumLoom", user_id: SANA } },
    ];
    db.ndas = [{ request_id: "q2", accepted_at: "2026-10-21T09:00:00Z" }];
    db.people = [person(SANA, "Sana Malik")];
    db.template = { version: "nda-v1", title: "Confidentiality Agreement", body: "This agreement is between the founder and the investor." };
  });

  it("lists the requests the investor sent, in plain language", async () => {
    renderPage();
    expect(await screen.findByText("Pitches you asked to read")).toBeInTheDocument();
    expect(screen.getAllByText("Sana Malik")).toHaveLength(4);
    expect(screen.getByText("Waiting for Sana to reply.")).toBeInTheDocument();
    expect(screen.getByText("The founder declined this request.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /review confidentiality terms/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /read the pitch/i })).toHaveAttribute("href", "/app/ideas/idea-1");
  });

  it("only asks for requests the signed-in investor sent", async () => {
    renderPage();
    await screen.findAllByText("Sana Malik");
    expect(db.calls).toContainEqual(["pitch_access_requests.eq", ["investor_id", ME]]);
    expect(db.calls).toContainEqual(["nda_acceptances.eq", ["investor_id", ME]]);
  });

  it("accepts the confidentiality terms from this page", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /review confidentiality terms/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Read these terms before opening the detailed pitch of/)).toBeInTheDocument();
    fireEvent.click(await within(dialog).findByRole("checkbox"));
    fireEvent.click(within(dialog).getByRole("button", { name: /accept and unlock the pitch/i }));
    await waitFor(() => expect(db.rpc).toContainEqual(["accept_nda", { _request_id: "q1", _nda_version: "nda-v1" }]));
  });

  it("shows a friendly empty state when nothing has been requested", async () => {
    db.requests = [];
    renderPage();
    expect(await screen.findByText("You have not requested any pitches")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Discover ideas" })).toHaveAttribute("href", "/app/discover");
  });
});

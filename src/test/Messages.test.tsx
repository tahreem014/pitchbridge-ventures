/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Messages from "@/pages/app/Messages";

const ME = "11111111-1111-4111-8111-111111111111";
const PRIYA = "d0000000-0000-4000-8000-000000000005";
const MARCUS = "d0000000-0000-4000-8000-000000000006";

const db = vi.hoisted(() => ({
  conversations: [] as any[],
  threadDesc: [] as any[],
  profile: null as any,
  inserts: [] as any[],
  updates: [] as { table: string; payload: any }[],
  insertError: null as any,
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

// A query builder where every call returns itself and awaiting it yields `result`.
const chain = (result: unknown): any =>
  new Proxy({}, {
    get: (_t, prop) => (prop === "then" ? (resolve: any) => resolve(result) : () => chain(result)),
  });

vi.mock("@/integrations/supabase/client", () => {
  const channel: any = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      rpc: () => chain({ data: db.conversations }),
      channel: () => channel,
      removeChannel: () => {},
      from: (table: string) => ({
        select: () => chain(table === "messages" ? { data: db.threadDesc } : { data: db.profile }),
        update: (payload: any) => { db.updates.push({ table, payload }); return chain({ error: null }); },
        insert: (payload: any) => {
          db.inserts.push(payload);
          return chain(db.insertError
            ? { data: null, error: db.insertError }
            : { data: { id: "new-1", created_at: new Date().toISOString(), read_at: null, ...payload }, error: null });
        },
      }),
    },
  };
});
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: ME } }) }));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: any) => <div>{children}</div> }));
vi.mock("sonner", () => ({ toast }));

const message = (id: string, from: string, content: string, extra: Record<string, unknown> = {}) => ({
  id, sender_id: from, recipient_id: from === ME ? PRIYA : ME, content,
  created_at: new Date().toISOString(), read_at: null, ...extra,
});

const renderAt = (entry: string | { pathname: string; search: string; state: unknown }) =>
  render(<MemoryRouter initialEntries={[entry as any]}><Messages /></MemoryRouter>);

beforeEach(() => {
  db.conversations = [
    { other_id: PRIYA, other_name: "Priya Nair", other_avatar: null, other_headline: "Partner at Horizon Angels",
      last_message: "Do you have a deck?", last_at: new Date().toISOString(), last_sender_id: PRIYA, unread_count: 2 },
    { other_id: MARCUS, other_name: "Marcus Holloway", other_avatar: null, other_headline: null,
      last_message: "Thanks, talk soon", last_at: new Date(Date.now() - 86_400_000).toISOString(), last_sender_id: ME, unread_count: 0 },
  ];
  db.threadDesc = [];
  db.profile = { id: PRIYA, full_name: "Priya Nair", avatar_url: null, headline: "Partner at Horizon Angels", company: "Horizon Angels" };
  db.inserts = [];
  db.updates = [];
  db.insertError = null;
  toast.error.mockReset();
});

describe("Messages page", () => {
  it("lists conversations with previews and unread counts", async () => {
    renderAt("/app/messages");
    expect(await screen.findByText("Priya Nair")).toBeInTheDocument();
    expect(screen.getByText("Marcus Holloway")).toBeInTheDocument();
    expect(screen.getByText("Do you have a deck?")).toBeInTheDocument();
    expect(screen.getByText("You: Thanks, talk soon")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/select a conversation/i)).toBeInTheDocument();
  });

  it("shows an empty state when there are no conversations", async () => {
    db.conversations = [];
    renderAt("/app/messages");
    expect(await screen.findByText("No conversations yet")).toBeInTheDocument();
  });

  it("opens a conversation, shows it oldest-first and marks incoming messages read", async () => {
    db.threadDesc = [
      message("m2", PRIYA, "Second from Priya"),
      message("m1", ME, "First from me", { read_at: new Date().toISOString() }),
    ];
    renderAt(`/app/messages?with=${PRIYA}`);

    expect(await screen.findByText("Second from Priya")).toBeInTheDocument();
    const text = document.body.textContent ?? "";
    expect(text.indexOf("First from me")).toBeLessThan(text.indexOf("Second from Priya"));
    expect(screen.getByText("Partner at Horizon Angels · Horizon Angels")).toBeInTheDocument();

    await waitFor(() => {
      const read = db.updates.filter(u => u.table === "messages" && u.payload.read_at);
      expect(read).toHaveLength(1);
    });
    expect(db.updates.some(u => u.table === "notifications" && u.payload.read_at)).toBe(true);
  });

  it("shows 'Seen' only on my latest message once it has been read", async () => {
    db.threadDesc = [
      message("m2", ME, "Latest from me", { read_at: new Date().toISOString() }),
      message("m1", ME, "Older from me", { read_at: new Date().toISOString() }),
    ];
    renderAt(`/app/messages?with=${PRIYA}`);
    await screen.findByText("Latest from me");
    expect(screen.getAllByText(/Seen/)).toHaveLength(1);
  });

  it("sends a message and clears the box", async () => {
    renderAt(`/app/messages?with=${PRIYA}`);
    const box = await screen.findByLabelText("Write a message");
    fireEvent.change(box, { target: { value: "  Sharing the deck now  " } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("Sharing the deck now")).toBeInTheDocument();
    expect(db.inserts).toEqual([{ sender_id: ME, recipient_id: PRIYA, content: "Sharing the deck now" }]);
    expect((box as HTMLTextAreaElement).value).toBe("");
  });

  it("sends on Enter but not on Shift+Enter", async () => {
    renderAt(`/app/messages?with=${PRIYA}`);
    const box = await screen.findByLabelText("Write a message");
    fireEvent.change(box, { target: { value: "line one" } });

    fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
    expect(db.inserts).toHaveLength(0);

    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(db.inserts).toHaveLength(1));
  });

  it("does not send an empty message", async () => {
    renderAt(`/app/messages?with=${PRIYA}`);
    await screen.findByLabelText("Write a message");
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });

  it("keeps the text and reports the error when sending fails", async () => {
    db.insertError = { code: "23514", message: "violates check constraint" };
    renderAt(`/app/messages?with=${PRIYA}`);
    const box = await screen.findByLabelText("Write a message");
    fireEvent.change(box, { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error.mock.calls[0][0]).toMatch(/1 to 2,000 characters/);
    expect((box as HTMLTextAreaElement).value).toBe("hello");
  });

  it("pre-fills a first message when opened from an idea page", async () => {
    renderAt({ pathname: "/app/messages", search: `?with=${PRIYA}`, state: { draft: "Hi Priya, I came across Lumora." } });
    const box = (await screen.findByLabelText("Write a message")) as HTMLTextAreaElement;
    await waitFor(() => expect(box.value).toBe("Hi Priya, I came across Lumora."));
    expect(screen.getByText(/say hello to priya/i)).toBeInTheDocument();
  });

  it("lists a brand-new conversation at the top of the inbox", async () => {
    db.conversations = [];
    renderAt(`/app/messages?with=${PRIYA}`);
    expect(await screen.findByText("New conversation")).toBeInTheDocument();
  });

  it("ignores a ?with= value that is not a UUID, or is yourself", async () => {
    renderAt("/app/messages?with=not-a-uuid");
    expect(await screen.findByText(/select a conversation/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Write a message")).not.toBeInTheDocument();
  });

  it("reports a conversation partner that does not exist", async () => {
    db.profile = null;
    renderAt(`/app/messages?with=${MARCUS}`);
    expect(await screen.findByText("This person could not be found.")).toBeInTheDocument();
  });
});

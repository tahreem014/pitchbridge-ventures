/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Proposals from "@/pages/app/Proposals";

const ME = "11111111-1111-4111-8111-111111111111";
const ELENA = "d0000000-0000-4000-8000-000000000007";
const KWAME = "d0000000-0000-4000-8000-000000000008";
const SANA = "d0000000-0000-4000-8000-000000000003";

const db = vi.hoisted(() => ({
  rows: [] as any[],
  people: [] as any[],
  loadError: null as any,
  rpcError: null as any,
  rpc: [] as [string, any][],
  calls: [] as [string, unknown[]][],
}));
const auth = vi.hoisted(() => ({ user: { id: "11111111-1111-4111-8111-111111111111" }, role: "entrepreneur" as string | null }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

const chain = (result: unknown, record?: [string, unknown[]][], tag?: string): any =>
  new Proxy({}, {
    get: (_t, prop: string) => {
      if (prop === "then") return (resolve: any) => resolve(result);
      return (...args: unknown[]) => { record?.push([`${tag}.${prop}`, args]); return chain(result, record, tag); };
    },
  });

vi.mock("@/integrations/supabase/client", () => {
  const channel: any = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      from: (table: string) => ({
        select: (...columns: unknown[]) => {
          db.calls.push([`${table}.select`, columns]);
          return table === "proposals"
            ? chain({ data: db.loadError ? null : db.rows, error: db.loadError }, db.calls, "proposals")
            : chain({ data: db.people, error: null }, db.calls, "profiles");
        },
      }),
      rpc: (name: string, args: any) => { db.rpc.push([name, args]); return chain({ error: db.rpcError }); },
      channel: () => channel,
      removeChannel: () => {},
    },
  };
});
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: any) => <div>{children}</div> }));
vi.mock("sonner", () => ({ toast }));

const idea = { id: "idea-1", title: "SkillSwap", category: "Consumer" };
const row = (id: string, status: string, over: Record<string, unknown> = {}) => ({
  id, investor_id: ELENA, entrepreneur_id: ME, amount: 35000, equity: 7, message: "Love the idea", status,
  // A fixed time, so rows sort in the order they are listed (newest first would otherwise depend on the millisecond they were made).
  counter_amount: null, counter_equity: null, counter_message: null, created_at: "2026-10-20T10:00:00.000Z", ideas: idea, ...over,
});
const profile = (id: string, name: string) => ({ id, full_name: name, avatar_url: null, headline: "Angel investor", company: "Petrova Angels" });

const renderPage = () => render(<MemoryRouter><Proposals /></MemoryRouter>);

beforeEach(() => {
  db.rows = []; db.people = []; db.loadError = null; db.rpcError = null; db.rpc = []; db.calls = [];
  auth.role = "entrepreneur";
  toast.success.mockReset(); toast.error.mockReset();
});

describe("Proposals page: founder", () => {
  beforeEach(() => {
    db.rows = [
      row("p1", "pending", { investor_id: ELENA }),
      row("p2", "pending", { investor_id: KWAME, amount: 50000, equity: 12, message: "Let us talk" }),
      row("p3", "accepted", { investor_id: ELENA, amount: 20000, equity: 4 }),
    ];
    db.people = [profile(ELENA, "Elena Petrova"), profile(KWAME, "Kwame Mensah")];
  });

  it("lists the proposals received, with the investor and the terms", async () => {
    renderPage();
    expect(await screen.findByText("Kwame Mensah")).toBeInTheDocument();
    expect(screen.getAllByText("Elena Petrova")).toHaveLength(2);
    expect(screen.getByText("Proposals you received")).toBeInTheDocument();
    expect(screen.getByText("$50,000")).toBeInTheDocument();
    expect(screen.getByText("12% equity")).toBeInTheDocument();
  });

  it("only asks for proposals addressed to the signed-in founder", async () => {
    renderPage();
    await screen.findByText("Kwame Mensah");
    expect(db.calls).toContainEqual(["proposals.eq", ["entrepreneur_id", ME]]);
  });

  it("summarises what needs a reply", async () => {
    renderPage();
    await screen.findByText("Kwame Mensah");
    const card = screen.getByText("Needs your reply").closest(".hover-lift") as HTMLElement;
    expect(within(card).getByText("2")).toBeInTheDocument();
    expect(within(card).getByText("$85,000 in new offers")).toBeInTheDocument();
  });

  it("offers accept, counter and decline only on pending proposals", async () => {
    renderPage();
    await screen.findByText("Kwame Mensah");
    expect(screen.getAllByRole("button", { name: /^Accept$/ })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /^Counter$/ })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /^Decline$/ })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /withdraw/i })).not.toBeInTheDocument();
  });

  it("asks for confirmation, then accepts", async () => {
    renderPage();
    await screen.findByText("Kwame Mensah");
    fireEvent.click(screen.getAllByRole("button", { name: /^Accept$/ })[0]);

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Accept this proposal?")).toBeInTheDocument();
    // accepting starts an agreement; the money is not counted until both sides confirm it
    expect(within(dialog).getByText(/This starts an investment agreement that you both review and confirm/)).toBeInTheDocument();
    expect(within(dialog).getByText(/The \$35,000 only counts as raised once you have both confirmed it/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/will be added to its funding raised/)).not.toBeInTheDocument();
    expect(db.rpc).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole("button", { name: "Accept proposal" }));
    await waitFor(() => expect(db.rpc).toHaveLength(1));
    expect(db.rpc[0]).toEqual(["respond_to_proposal", { _proposal_id: "p1", _action: "accept" }]);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Proposal accepted"));
  });

  it("shows the agreement an accepted proposal started, and links to it", async () => {
    db.rows = [
      row("p3", "accepted", { investor_id: ELENA, amount: 20000, equity: 4, agreements: { id: "ag-1", status: "draft" } }),
      row("p4", "accepted", { investor_id: KWAME, amount: 10000, equity: 2, agreements: { id: "ag-2", status: "executed" } }),
    ];
    renderPage();
    await screen.findByText("Kwame Mensah");
    const links = screen.getAllByRole("link", { name: "Open agreement" });
    expect(links.map(l => l.getAttribute("href")).sort()).toEqual(["/app/agreements/ag-1", "/app/agreements/ag-2"]);
    expect(screen.getByText("Waiting for confirmations")).toBeInTheDocument();
    expect(screen.getByText("Signed")).toBeInTheDocument();
  });

  it("shows no agreement for older deals that have none, or for proposals that were not accepted", async () => {
    db.rows = [
      row("p3", "accepted", { investor_id: ELENA, agreements: null }),
      row("p1", "pending", { investor_id: KWAME, agreements: null }),
    ];
    renderPage();
    await screen.findByText("Kwame Mensah");
    expect(screen.queryByRole("link", { name: "Open agreement" })).not.toBeInTheDocument();
    expect(screen.queryByText("Investment agreement")).not.toBeInTheDocument();
  });

  it("asks only for the agreement's id and status alongside each proposal", async () => {
    renderPage();
    await screen.findByText("Kwame Mensah");
    expect(db.calls.some(([name, args]) => name === "proposals.select" && String((args as unknown[])[0]).includes("agreements(id, status)"))).toBe(true);
  });

  it("does nothing when the confirmation is cancelled", async () => {
    renderPage();
    await screen.findByText("Kwame Mensah");
    fireEvent.click(screen.getAllByRole("button", { name: /^Decline$/ })[0]);
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(db.rpc).toHaveLength(0);
  });

  it("declines after confirmation", async () => {
    renderPage();
    await screen.findByText("Kwame Mensah");
    fireEvent.click(screen.getAllByRole("button", { name: /^Decline$/ })[1]);
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Decline proposal" }));
    await waitFor(() => expect(db.rpc[0]).toEqual(["respond_to_proposal", { _proposal_id: "p2", _action: "decline" }]));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Proposal declined"));
  });

  it("sends a counter-offer starting from the investor's own terms", async () => {
    renderPage();
    await screen.findByText("Kwame Mensah");
    fireEvent.click(screen.getAllByRole("button", { name: /^Counter$/ })[0]);

    const amount = (await screen.findByLabelText(/amount you would accept/i)) as HTMLInputElement;
    // the dialog fills in the investor's own terms just after it opens
    await waitFor(() => expect(amount.value).toBe("35000"));
    expect((screen.getByLabelText(/equity you would give/i) as HTMLInputElement).value).toBe("7");

    fireEvent.change(amount, { target: { value: "45000" } });
    fireEvent.change(screen.getByLabelText(/equity you would give/i), { target: { value: "9" } });
    fireEvent.change(screen.getByLabelText(/note/i), { target: { value: "  Covers the extra launch.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Send counter-offer" }));

    await waitFor(() => expect(db.rpc).toHaveLength(1));
    expect(db.rpc[0]).toEqual(["respond_to_proposal", {
      _proposal_id: "p1", _action: "counter", _amount: 45000, _equity: 9, _message: "Covers the extra launch.",
    }]);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Counter-offer sent"));
    await waitFor(() => expect(screen.queryByText("Send a counter-offer")).not.toBeInTheDocument());
  });

  it("rejects an empty or invalid counter-offer without calling the server", async () => {
    renderPage();
    await screen.findByText("Kwame Mensah");
    fireEvent.click(screen.getAllByRole("button", { name: /^Counter$/ })[0]);
    const amount = await screen.findByLabelText(/amount you would accept/i);

    fireEvent.change(amount, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Send counter-offer" }));
    expect(await screen.findByText("Enter an amount")).toBeInTheDocument();

    fireEvent.change(amount, { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText(/equity you would give/i), { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: "Send counter-offer" }));
    expect(await screen.findByText("Equity cannot be more than 100%")).toBeInTheDocument();
    expect(db.rpc).toHaveLength(0);
  });

  it("shows the server's reason when an action is refused", async () => {
    db.rpcError = { message: "This proposal can no longer be changed" };
    renderPage();
    await screen.findByText("Kwame Mensah");
    fireEvent.click(screen.getAllByRole("button", { name: /^Accept$/ })[0]);
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Accept proposal" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("This proposal can no longer be changed"));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("filters by status", async () => {
    renderPage();
    await screen.findByText("Kwame Mensah");
    fireEvent.click(screen.getByRole("tab", { name: /^Accepted/ }));
    expect(screen.queryByText("Kwame Mensah")).not.toBeInTheDocument();
    expect(screen.getAllByText("$20,000")).toHaveLength(2); // the Accepted summary card, and the proposal itself
    fireEvent.click(screen.getByRole("tab", { name: /^Countered/ }));
    expect(screen.getByText("No countered proposals.")).toBeInTheDocument();
  });

  it("shows a friendly empty state", async () => {
    db.rows = [];
    renderPage();
    expect(await screen.findByText("No proposals yet")).toBeInTheDocument();
  });

  it("offers a retry when loading fails", async () => {
    db.loadError = { message: "network down" };
    renderPage();
    expect(await screen.findByText("We could not load your proposals")).toBeInTheDocument();
    db.loadError = null;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Kwame Mensah")).toBeInTheDocument();
  });
});

describe("Proposals page: investor", () => {
  beforeEach(() => {
    auth.role = "investor";
    db.rows = [
      row("a", "countered", { investor_id: ME, entrepreneur_id: SANA, amount: 40000, equity: 8, counter_amount: 45000, counter_equity: 9, counter_message: "Covers the extra site" }),
      row("b", "pending", { investor_id: ME, entrepreneur_id: SANA, amount: 60000, equity: 2.5 }),
      row("c", "accepted", { investor_id: ME, entrepreneur_id: SANA, amount: 30000, equity: 3 }),
    ];
    db.people = [profile(SANA, "Sana Malik")];
  });

  it("lists the proposals the investor sent, with the founder's counter-offer", async () => {
    renderPage();
    expect(await screen.findByText("Proposals you sent")).toBeInTheDocument();
    expect((await screen.findAllByText("Sana Malik")).length).toBe(3);
    expect(screen.getByText("Counter-offer: $45,000 for 9% equity")).toBeInTheDocument();
    expect(screen.getByText("Sana sent a counter-offer. It is your move")).toBeInTheDocument();
  });

  it("only asks for proposals the signed-in investor sent", async () => {
    renderPage();
    await screen.findAllByText("Sana Malik");
    expect(db.calls).toContainEqual(["proposals.eq", ["investor_id", ME]]);
  });

  it("offers withdraw, and accepting a counter-offer only when there is one", async () => {
    renderPage();
    await screen.findAllByText("Sana Malik");
    expect(screen.getAllByRole("button", { name: /^Withdraw$/ })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /^Accept counter-offer$/ })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /^Accept$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Decline$/ })).not.toBeInTheDocument();
  });

  it("accepts the counter-offer after confirmation", async () => {
    renderPage();
    await screen.findAllByText("Sana Malik");
    fireEvent.click(screen.getByRole("button", { name: /^Accept counter-offer$/ }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/You will invest \$45,000 for 9% equity/)).toBeInTheDocument();
    expect(within(dialog).getByText(/The \$45,000 only counts as raised once you have both confirmed it/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Accept counter-offer" }));

    await waitFor(() => expect(db.rpc[0]).toEqual(["respond_to_proposal", { _proposal_id: "a", _action: "accept_counter" }]));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Counter-offer accepted"));
  });

  it("withdraws after confirmation", async () => {
    renderPage();
    await screen.findAllByText("Sana Malik");
    fireEvent.click(screen.getAllByRole("button", { name: /^Withdraw$/ })[1]);
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Withdraw proposal" }));
    await waitFor(() => expect(db.rpc[0][1]).toMatchObject({ _action: "withdraw" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Proposal withdrawn"));
  });

  it("sends the investor to Discover when nothing has been sent", async () => {
    db.rows = [];
    renderPage();
    expect(await screen.findByText("You have not sent any proposals")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Discover ideas" })).toHaveAttribute("href", "/app/discover");
  });
});

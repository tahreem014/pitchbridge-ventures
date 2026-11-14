import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SendProposalDialog } from "@/components/SendProposalDialog";

const insert = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ insert }) },
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const idea = { id: "idea-1", user_id: "founder-1", title: "Lumora Health", funding_target: 250000, equity_offered: 8 };

const setup = () => {
  const onOpenChange = vi.fn();
  render(<SendProposalDialog open onOpenChange={onOpenChange} idea={idea} investorId="investor-1" />);
  return { onOpenChange };
};

const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: /send proposal/i }));

describe("SendProposalDialog", () => {
  beforeEach(() => {
    insert.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
    insert.mockResolvedValue({ error: null });
  });

  it("shows the idea it is about", () => {
    setup();
    expect(screen.getByText("Lumora Health")).toBeInTheDocument();
    expect(screen.getByText("$250,000")).toBeInTheDocument();
    expect(screen.getByText("8%")).toBeInTheDocument();
  });

  it("requires an amount and does not call the database", async () => {
    setup();
    submit();
    expect(await screen.findByText("Enter an amount")).toBeInTheDocument();
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects zero or negative amounts", async () => {
    setup();
    type(/investment amount/i, "-5");
    submit();
    expect(await screen.findByText("Amount must be greater than zero")).toBeInTheDocument();
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects equity above 100%", async () => {
    setup();
    type(/investment amount/i, "1000");
    type(/equity requested/i, "150");
    submit();
    expect(await screen.findByText("Equity cannot be more than 100%")).toBeInTheDocument();
    expect(insert).not.toHaveBeenCalled();
  });

  it("sends the full proposal and closes the dialog", async () => {
    const { onOpenChange } = setup();
    type(/investment amount/i, "50000");
    type(/equity requested/i, "8");
    type(/message/i, "  Great traction, let us talk.  ");
    submit();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(insert).toHaveBeenCalledWith({
      idea_id: "idea-1",
      investor_id: "investor-1",
      entrepreneur_id: "founder-1",
      amount: 50000,
      equity: 8,
      message: "Great traction, let us talk.",
    });
    expect(toast.success).toHaveBeenCalledWith("Proposal sent");
  });

  it("stores empty optional fields as null", async () => {
    setup();
    type(/investment amount/i, "25000");
    submit();
    await waitFor(() => expect(insert).toHaveBeenCalled());
    expect(insert.mock.calls[0][0]).toMatchObject({ amount: 25000, equity: null, message: null });
  });

  it("keeps the dialog open and shows the error when saving fails", async () => {
    insert.mockResolvedValue({ error: { message: "new row violates row-level security policy" } });
    const { onOpenChange } = setup();
    type(/investment amount/i, "25000");
    submit();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("new row violates row-level security policy"));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(toast.success).not.toHaveBeenCalled();
  });
});

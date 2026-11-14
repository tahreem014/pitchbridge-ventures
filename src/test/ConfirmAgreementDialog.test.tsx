import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ConfirmAgreementDialog } from "@/components/agreements/ConfirmAgreementDialog";
import { draftAgreement } from "./agreementFixtures";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const renderDialog = (over: Partial<Parameters<typeof ConfirmAgreementDialog>[0]> = {}) => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  const view = render(<ConfirmAgreementDialog agreement={draftAgreement()} otherName="Tahrem Khan" onConfirm={onConfirm} onClose={onClose} {...over} />);
  return { onConfirm, onClose, ...view };
};

const confirmButton = () => screen.getByRole("button", { name: /^Confirm version/ });

describe("confirm agreement dialog", () => {
  it("shows what is being confirmed, and which version", () => {
    renderDialog();
    expect(screen.getByRole("heading", { name: /Confirm this agreement/ })).toBeInTheDocument();
    expect(screen.getByText("$40,000 for 9% equity for SkillSwap. Version 2.")).toBeInTheDocument();
    expect(screen.getByText(/recorded with your name, email and the time/)).toBeInTheDocument();
    expect(screen.getByText(/When you and Tahrem have both confirmed the same version/)).toBeInTheDocument();
    expect(screen.getByText(/\$40,000 counts as raised/)).toBeInTheDocument();
    expect(confirmButton()).toHaveTextContent("Confirm version 2");
  });

  it("makes the person say they read this exact version before they can confirm", () => {
    const { onConfirm } = renderDialog();
    expect(confirmButton()).toBeDisabled();
    fireEvent.click(confirmButton());
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByLabelText(/I have read version 2 of this agreement/)).toBeChecked();
    expect(confirmButton()).toBeEnabled();
    fireEvent.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("can be cancelled", () => {
    const { onClose, onConfirm } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("asks again for a new version, instead of carrying the tick over", () => {
    const { rerender } = renderDialog();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(confirmButton()).toBeEnabled();

    rerender(<ConfirmAgreementDialog agreement={draftAgreement({ version: 3 })} otherName="Tahrem Khan" onConfirm={() => {}} onClose={() => {}} />);
    expect(screen.getByLabelText(/I have read version 3 of this agreement/)).not.toBeChecked();
    expect(confirmButton()).toBeDisabled();
    expect(confirmButton()).toHaveTextContent("Confirm version 3");
  });

  it("cannot be dismissed or repeated while it is working", () => {
    const { onClose, onConfirm } = renderDialog({ busy: true });
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(confirmButton()).toBeDisabled();
    fireEvent.click(confirmButton());
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows nothing when there is no agreement", () => {
    renderDialog({ agreement: null });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

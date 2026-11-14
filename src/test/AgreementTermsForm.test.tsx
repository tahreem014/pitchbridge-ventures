import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { AgreementTermsForm } from "@/components/agreements/AgreementTermsForm";
import type { AgreementItem } from "@/lib/agreements";
import { draftAgreement } from "./agreementFixtures";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const renderForm = (agreement: AgreementItem = draftAgreement(), over: { saving?: boolean } = {}) => {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  render(<AgreementTermsForm agreement={agreement} onSave={onSave} onCancel={onCancel} {...over} />);
  return { onSave, onCancel };
};

const save = () => screen.getByRole("button", { name: "Save as a new version" });
const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement;

describe("agreement terms form", () => {
  it("starts from the agreement's current terms", () => {
    renderForm();
    expect(screen.getByRole("radio", { name: /Equity investment/ })).toBeChecked();
    expect(field("Equity the investor receives (%)").value).toBe("9");
    expect(field("Governing law").value).toBe("Laws of Pakistan");
    expect(field("Payment 1 due date").value).toBe("2026-12-01");
    expect(field("Payment 1 amount").value).toBe("25000");
    expect(field("Payment 1 note").value).toBe("First tranche");
    expect(field("Payment 2 amount").value).toBe("15000");
    expect(field(/Founder's responsibilities/).value).toMatch(/Use the funds only for the Project/);
  });

  it("shows the running total of the payments against the agreed amount", () => {
    renderForm();
    const total = screen.getByTestId("payments-total");
    expect(total).toHaveTextContent("Payments total $40,000.00 of $40,000.00");
    expect(total.className).toMatch(/emerald/);

    fireEvent.change(field("Payment 2 amount"), { target: { value: "10000" } });
    expect(total).toHaveTextContent("Payments total $35,000.00 of $40,000.00");
    expect(total.className).toMatch(/amber/);
  });

  it("will not save until something changes", () => {
    renderForm();
    expect(save()).toBeDisabled();
    fireEvent.change(field("Governing law"), { target: { value: "Laws of England" } });
    expect(save()).toBeEnabled();
    fireEvent.change(field("Governing law"), { target: { value: "Laws of Pakistan" } }); // changed back
    expect(save()).toBeDisabled();
  });

  it("saves the edited terms", () => {
    const { onSave } = renderForm();
    fireEvent.change(field("Equity the investor receives (%)"), { target: { value: "10" } });
    fireEvent.click(save());
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ type: "equity", equityPercent: "10", governingLaw: "Laws of Pakistan" });
  });

  it("says what is wrong and refuses to save while it is", () => {
    const { onSave } = renderForm();
    fireEvent.change(field("Equity the investor receives (%)"), { target: { value: "0" } });
    expect(within(screen.getByRole("alert")).getByText("Equity must be more than 0 and at most 100 percent")).toBeInTheDocument();
    expect(save()).toBeDisabled();
    fireEvent.submit(save().closest("form") as HTMLFormElement);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("flags payments that do not add up", () => {
    renderForm();
    fireEvent.change(field("Payment 1 amount"), { target: { value: "1000" } });
    expect(within(screen.getByRole("alert")).getByText("The payments add up to $16,000.00 but the agreed amount is $40,000.00")).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it("lets a draft be saved without governing law, but lists what is still needed to confirm", () => {
    const { onSave } = renderForm(draftAgreement({ terms: { ...draftAgreement().terms, governing_law: "", founder_responsibilities: "Use the funds well and report every quarter." } }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Still to fill in before anyone can confirm:")).toBeInTheDocument();
    expect(screen.getByText("Say which law governs the agreement")).toBeInTheDocument();
    fireEvent.change(field("Additional terms (optional)"), { target: { value: "One board seat." } });
    expect(save()).toBeEnabled();
    fireEvent.click(save());
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("shows the fields of whichever type is chosen, and keeps what was typed when switching back", () => {
    renderForm();
    fireEvent.change(field("Equity the investor receives (%)"), { target: { value: "12" } });

    fireEvent.click(screen.getByRole("radio", { name: /Loan/ }));
    expect(screen.queryByLabelText("Equity the investor receives (%)")).not.toBeInTheDocument();
    expect(field("Yearly interest rate (%)")).toBeInTheDocument();
    expect(field("Length of the loan (months)")).toBeInTheDocument();
    expect(screen.getByText("How the loan is repaid")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /Other arrangement/ }));
    expect(screen.queryByLabelText("Yearly interest rate (%)")).not.toBeInTheDocument();
    expect(field("Arrangement title")).toBeInTheDocument();
    expect(field("Describe the arrangement")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /Equity investment/ }));
    expect(field("Equity the investor receives (%)").value).toBe("12");
  });

  it("asks for the loan terms a loan needs", () => {
    renderForm();
    fireEvent.click(screen.getByRole("radio", { name: /Loan/ }));
    const problems = within(screen.getByRole("alert"));
    expect(problems.getByText("Enter the yearly interest rate (0 for none)")).toBeInTheDocument();
    expect(problems.getByText("Enter the length of the loan in months")).toBeInTheDocument();
    expect(problems.getByText("Choose how the loan is repaid")).toBeInTheDocument();
    fireEvent.change(field("Yearly interest rate (%)"), { target: { value: "8" } });
    fireEvent.change(field("Length of the loan (months)"), { target: { value: "24" } });
    expect(within(screen.getByRole("alert")).queryByText("Enter the yearly interest rate (0 for none)")).not.toBeInTheDocument();
  });

  it("starts a loan agreement with its own values", () => {
    renderForm(draftAgreement({ type: "loan", terms: { ...draftAgreement().terms, equity_percent: undefined, interest_rate: 8, term_months: 24, repayment: "monthly" } }));
    expect(screen.getByRole("radio", { name: /Loan/ })).toBeChecked();
    expect(field("Yearly interest rate (%)").value).toBe("8");
    expect(field("Length of the loan (months)").value).toBe("24");
    expect(screen.getByRole("combobox")).toHaveTextContent("Monthly");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("adds a payment for what is left, and removes one", () => {
    renderForm();
    fireEvent.change(field("Payment 2 amount"), { target: { value: "5000" } });
    fireEvent.click(screen.getByRole("button", { name: "Add payment" }));
    expect(field("Payment 3 amount").value).toBe("10000"); // the remaining 40,000 - 30,000
    fireEvent.click(screen.getByRole("button", { name: "Remove payment 3" }));
    expect(screen.queryByLabelText("Payment 3 amount")).not.toBeInTheDocument();
  });

  it("never lets the last payment be removed, nor more than twelve be added", () => {
    renderForm(draftAgreement({ terms: { ...draftAgreement().terms, schedule: [{ due_date: "2026-12-01", amount: 40000 }] } }));
    expect(screen.getByRole("button", { name: "Remove payment 1" })).toBeDisabled();
    for (let i = 0; i < 11; i++) fireEvent.click(screen.getByRole("button", { name: "Add payment" }));
    expect(screen.getByLabelText("Payment 12 amount")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add payment" })).toBeDisabled();
  });

  it("cancels without saving", () => {
    const { onSave, onCancel } = renderForm();
    fireEvent.change(field("Governing law"), { target: { value: "Laws of England" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("disables everything while saving", () => {
    renderForm(draftAgreement(), { saving: true });
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(save()).toBeDisabled();
  });
});

import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AGREEMENT_TYPES, AgreementItem, AgreementType, LIMITS, MAX_PAYMENTS, REPAYMENT_LABELS, Repayment, TYPE_HELP, TYPE_LABELS, TermsForm,
  formFromAgreement, formatExactMoney, scheduleTotal, termsFromForm, validateTerms,
} from "@/lib/agreements";
import { cn } from "@/lib/utils";

// Either party can edit a draft. The database checks everything again, so this only helps people fix problems early.
export const AgreementTermsForm = ({ agreement, saving = false, onSave, onCancel }: {
  agreement: AgreementItem;
  saving?: boolean;
  onSave: (form: TermsForm) => void;
  onCancel: () => void;
}) => {
  const initial = useMemo(() => formFromAgreement(agreement), [agreement]);
  const [form, setForm] = useState<TermsForm>(initial);

  const set = <K extends keyof TermsForm>(key: K, value: TermsForm[K]) => setForm(f => ({ ...f, [key]: value }));
  const setRow = (index: number, patch: Partial<TermsForm["schedule"][number]>) =>
    setForm(f => ({ ...f, schedule: f.schedule.map((row, i) => (i === index ? { ...row, ...patch } : row)) }));
  const removeRow = (index: number) => setForm(f => ({ ...f, schedule: f.schedule.filter((_, i) => i !== index) }));
  const addRow = () => setForm(f => {
    const remaining = Math.max(0, agreement.amount - scheduleTotal(f.schedule));
    return { ...f, schedule: [...f.schedule, { dueDate: "", amount: remaining > 0 ? String(Math.round(remaining * 100) / 100) : "", note: "" }] };
  });

  const total = scheduleTotal(form.schedule);
  const balanced = Math.abs(total - agreement.amount) <= 0.005;
  const problems = validateTerms(form, agreement.amount, false);
  // Things that are fine in a draft but must be filled in before anyone can confirm.
  const toFill = validateTerms(form, agreement.amount, true).filter(p => !problems.includes(p));
  const changed = JSON.stringify(termsFromForm(form)) !== JSON.stringify(termsFromForm(initial));

  return (
    <form
      className="space-y-6"
      onSubmit={e => { e.preventDefault(); if (problems.length === 0 && changed && !saving) onSave(form); }}
    >
      <fieldset className="space-y-3">
        <legend className="mb-1 font-display font-semibold">Type of agreement</legend>
        <RadioGroup value={form.type} onValueChange={v => set("type", v as AgreementType)} className="grid gap-3 md:grid-cols-3">
          {AGREEMENT_TYPES.map(type => (
            <Label
              key={type} htmlFor={`type-${type}`}
              className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4 font-normal", form.type === type ? "border-primary bg-primary/5" : "border-border")}
            >
              <RadioGroupItem id={`type-${type}`} value={type} className="mt-0.5" />
              <span>
                <span className="block font-medium">{TYPE_LABELS[type]}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{TYPE_HELP[type]}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        {form.type === "equity" && (
          <div>
            <Label htmlFor="equity-percent">Equity the investor receives (%)</Label>
            <Input id="equity-percent" type="number" inputMode="decimal" min={0} max={100} step="0.01" value={form.equityPercent} onChange={e => set("equityPercent", e.target.value)} />
          </div>
        )}

        {form.type === "loan" && (
          <>
            <div>
              <Label htmlFor="interest-rate">Yearly interest rate (%)</Label>
              <Input id="interest-rate" type="number" inputMode="decimal" min={0} max={100} step="0.01" value={form.interestRate} onChange={e => set("interestRate", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="term-months">Length of the loan (months)</Label>
              <Input id="term-months" type="number" inputMode="numeric" min={1} max={120} step={1} value={form.termMonths} onChange={e => set("termMonths", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="repayment">How the loan is repaid</Label>
              <Select value={form.repayment || undefined} onValueChange={v => set("repayment", v as Repayment)}>
                <SelectTrigger id="repayment"><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(REPAYMENT_LABELS) as Repayment[]).map(r => <SelectItem key={r} value={r}>{REPAYMENT_LABELS[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {form.type === "other" && (
          <>
            <div className="md:col-span-2">
              <Label htmlFor="arrangement-title">Arrangement title</Label>
              <Input id="arrangement-title" value={form.arrangementTitle} maxLength={LIMITS.title} placeholder="Revenue share" onChange={e => set("arrangementTitle", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="arrangement-description">Describe the arrangement</Label>
              <Textarea id="arrangement-description" rows={4} value={form.arrangementDescription} maxLength={LIMITS.description} placeholder="5% of monthly revenue for 24 months, paid on the 5th of each month." onChange={e => set("arrangementDescription", e.target.value)} />
            </div>
          </>
        )}
      </div>

      <fieldset className="space-y-3">
        <legend className="font-display font-semibold">Payment schedule</legend>
        <p className="text-xs text-muted-foreground">The agreed amount is {formatExactMoney(agreement.amount)}. The payments must add up to exactly that.</p>
        {form.schedule.map((row, i) => (
          <div key={i} className="grid grid-cols-2 items-end gap-2 rounded-xl border border-border p-3 md:grid-cols-[150px_150px_1fr]">
            <div>
              <Label htmlFor={`due-${i}`} className="text-xs">Due date</Label>
              <Input id={`due-${i}`} aria-label={`Payment ${i + 1} due date`} type="date" value={row.dueDate} onChange={e => setRow(i, { dueDate: e.target.value })} />
            </div>
            <div>
              <Label htmlFor={`amount-${i}`} className="text-xs">Amount (USD)</Label>
              <Input id={`amount-${i}`} aria-label={`Payment ${i + 1} amount`} type="number" inputMode="decimal" min={0} step="0.01" value={row.amount} onChange={e => setRow(i, { amount: e.target.value })} />
            </div>
            {/* The note and the remove button share a row, so the button never sits alone on a narrow screen. */}
            <div className="col-span-2 flex items-end gap-2 md:col-span-1">
              <div className="min-w-0 flex-1">
                <Label htmlFor={`note-${i}`} className="text-xs">Note (optional)</Label>
                <Input id={`note-${i}`} aria-label={`Payment ${i + 1} note`} value={row.note} maxLength={LIMITS.paymentNote} placeholder="First tranche" onChange={e => setRow(i, { note: e.target.value })} />
              </div>
              <Button type="button" size="icon" variant="ghost" className="flex-shrink-0" aria-label={`Remove payment ${i + 1}`} disabled={form.schedule.length <= 1} onClick={() => removeRow(i)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" size="sm" variant="outline" disabled={form.schedule.length >= MAX_PAYMENTS} onClick={addRow}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add payment
          </Button>
          <p data-testid="payments-total" className={cn("text-sm font-medium", balanced ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
            Payments total {formatExactMoney(total)} of {formatExactMoney(agreement.amount)}
          </p>
        </div>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="founder-responsibilities">Founder's responsibilities</Label>
          <Textarea id="founder-responsibilities" rows={5} value={form.founderResponsibilities} maxLength={LIMITS.responsibilities} onChange={e => set("founderResponsibilities", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="investor-responsibilities">Investor's responsibilities</Label>
          <Textarea id="investor-responsibilities" rows={5} value={form.investorResponsibilities} maxLength={LIMITS.responsibilities} onChange={e => set("investorResponsibilities", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="governing-law">Governing law</Label>
          <Input id="governing-law" value={form.governingLaw} maxLength={LIMITS.governingLaw} placeholder="The laws of Pakistan" onChange={e => set("governingLaw", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="additional-terms">Additional terms (optional)</Label>
          <Textarea id="additional-terms" rows={4} value={form.additionalTerms} maxLength={LIMITS.additionalTerms} onChange={e => set("additionalTerms", e.target.value)} />
        </div>
      </div>

      {problems.length > 0 && (
        <ul role="alert" className="list-disc space-y-1 rounded-xl border border-destructive/40 bg-destructive/5 py-3 pl-8 pr-4 text-sm text-destructive">
          {problems.map(p => <li key={p}>{p}</li>)}
        </ul>
      )}
      {problems.length === 0 && toFill.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Still to fill in before anyone can confirm:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">{toFill.map(p => <li key={p}>{p}</li>)}</ul>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="submit" className="bg-gradient-primary" disabled={saving || problems.length > 0 || !changed}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save as a new version
        </Button>
      </div>
    </form>
  );
};

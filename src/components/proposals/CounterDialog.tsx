import { useEffect, useState } from "react";
import { Loader2, Reply } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ProposalItem, firstName } from "@/lib/proposals";
import { formatMoney } from "@/lib/portfolio";

const schema = z.object({
  amount: z.number({ invalid_type_error: "Enter an amount" })
    .positive("Amount must be greater than zero")
    .max(999_999_999_999, "Amount is too large"),
  equity: z.number({ invalid_type_error: "Enter a valid percentage" })
    .gt(0, "Equity must be greater than zero")
    .max(100, "Equity cannot be more than 100%")
    .optional(),
  message: z.string().trim().max(1000, "Keep the note under 1,000 characters"),
});

type Errors = Partial<Record<"amount" | "equity" | "message", string>>;

export interface CounterTerms { amount: number; equity: number | null; message: string }

export const CounterDialog = ({ proposal, onClose, onSubmit }: {
  proposal: ProposalItem | null;
  onClose: () => void;
  // resolves true when the counter-offer was sent, so the dialog can close
  onSubmit: (proposal: ProposalItem, terms: CounterTerms) => Promise<boolean>;
}) => {
  const [amount, setAmount] = useState("");
  const [equity, setEquity] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  // Start from the investor's own offer, so the founder only changes what they want to change.
  useEffect(() => {
    if (!proposal) return;
    setAmount(String(proposal.amount));
    setEquity(proposal.equity != null ? String(proposal.equity) : "");
    setMessage("");
    setErrors({});
  }, [proposal]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposal) return;
    const parsed = schema.safeParse({
      amount: amount.trim() === "" ? undefined : Number(amount),
      equity: equity.trim() === "" ? undefined : Number(equity),
      message,
    });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof Errors;
        next[field] ??= amount.trim() === "" && field === "amount" ? "Enter an amount" : issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    const sent = await onSubmit(proposal, { amount: parsed.data.amount, equity: parsed.data.equity ?? null, message: parsed.data.message });
    setSubmitting(false);
    if (sent) onClose();
  };

  return (
    <Dialog open={!!proposal} onOpenChange={open => { if (!open && !submitting) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Send a counter-offer</DialogTitle>
          <DialogDescription>
            {proposal && <>
              {firstName(proposal.counterpart.name)} offered <span className="font-medium text-foreground">{formatMoney(proposal.amount)}</span>
              {proposal.equity != null && <> for {Number(proposal.equity)}%</>}. Suggest the terms you would accept instead.
            </>}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="counter-amount">Amount you would accept (USD)</Label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input id="counter-amount" type="number" inputMode="decimal" min="0" step="any" autoFocus
                value={amount} onChange={e => setAmount(e.target.value)} className="pl-7" aria-invalid={!!errors.amount} />
            </div>
            {errors.amount && <p className="mt-1 text-xs text-destructive">{errors.amount}</p>}
          </div>

          <div>
            <Label htmlFor="counter-equity">Equity you would give <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <div className="relative mt-1.5">
              <Input id="counter-equity" type="number" inputMode="decimal" min="0" max="100" step="any"
                value={equity} onChange={e => setEquity(e.target.value)} className="pr-8" aria-invalid={!!errors.equity} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
            {errors.equity && <p className="mt-1 text-xs text-destructive">{errors.equity}</p>}
          </div>

          <div>
            <Label htmlFor="counter-message">Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea id="counter-message" rows={3} maxLength={1000} className="mt-1.5" value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Explain the change, for example what the extra money will be used for." />
            {errors.message && <p className="mt-1 text-xs text-destructive">{errors.message}</p>}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="bg-gradient-primary">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Reply className="h-4 w-4 mr-2" />}
              Send counter-offer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

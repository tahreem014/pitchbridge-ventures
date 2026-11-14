import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export interface ProposalIdea {
  id: string;
  user_id: string;
  title: string;
  funding_target: number;
  equity_offered?: number | null;
}

const schema = z.object({
  amount: z.number({ invalid_type_error: "Enter an amount" })
    .positive("Amount must be greater than zero")
    .max(999_999_999_999, "Amount is too large"),
  equity: z.number({ invalid_type_error: "Enter a valid percentage" })
    .gt(0, "Equity must be greater than zero")
    .max(100, "Equity cannot be more than 100%")
    .optional(),
  message: z.string().trim().max(1000, "Keep the message under 1,000 characters"),
});

type Errors = Partial<Record<"amount" | "equity" | "message", string>>;

export const SendProposalDialog = ({
  open, onOpenChange, idea, investorId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idea: ProposalIdea;
  investorId: string;
}) => {
  const [amount, setAmount] = useState("");
  const [equity, setEquity] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (submitting) return;
    if (!next) { setAmount(""); setEquity(""); setMessage(""); setErrors({}); }
    onOpenChange(next);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    const { error } = await supabase.from("proposals").insert({
      idea_id: idea.id,
      investor_id: investorId,
      entrepreneur_id: idea.user_id,
      amount: parsed.data.amount,
      equity: parsed.data.equity ?? null,
      message: parsed.data.message || null,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Proposal sent");
    setAmount(""); setEquity(""); setMessage("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Send a proposal</DialogTitle>
          <DialogDescription>
            Make an offer to the founder of <span className="font-medium text-foreground">{idea.title}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
            Funding goal <span className="font-semibold text-foreground">${Number(idea.funding_target).toLocaleString()}</span>
          </span>
          {idea.equity_offered != null && (
            <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
              Equity offered <span className="font-semibold text-foreground">{idea.equity_offered}%</span>
            </span>
          )}
        </div>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="proposal-amount">Investment amount (USD)</Label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                id="proposal-amount" type="number" inputMode="decimal" min="0" step="any" autoFocus
                value={amount} onChange={e => setAmount(e.target.value)} placeholder="50,000"
                className="pl-7" aria-invalid={!!errors.amount}
              />
            </div>
            {errors.amount && <p className="mt-1 text-xs text-destructive">{errors.amount}</p>}
          </div>

          <div>
            <Label htmlFor="proposal-equity">Equity requested <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <div className="relative mt-1.5">
              <Input
                id="proposal-equity" type="number" inputMode="decimal" min="0" max="100" step="any"
                value={equity} onChange={e => setEquity(e.target.value)} placeholder="8"
                className="pr-8" aria-invalid={!!errors.equity}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
            {errors.equity && <p className="mt-1 text-xs text-destructive">{errors.equity}</p>}
          </div>

          <div>
            <Label htmlFor="proposal-message">Message <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              id="proposal-message" rows={4} maxLength={1000} className="mt-1.5"
              value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Introduce yourself and say why this venture interests you."
            />
            {errors.message && <p className="mt-1 text-xs text-destructive">{errors.message}</p>}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="bg-gradient-primary">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send proposal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

import { useState } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export const RequestAccessDialog = ({ open, onOpenChange, ideaId, ideaTitle, onSent }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ideaId: string;
  ideaTitle: string;
  onSent: () => void;
}) => {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const close = (next: boolean) => {
    if (submitting) return;
    if (!next) setMessage("");
    onOpenChange(next);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.rpc("request_pitch_access", { _idea_id: ideaId, _message: message.trim() || undefined });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Request sent");
    setMessage("");
    onOpenChange(false);
    onSent();
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Request access to the detailed pitch</DialogTitle>
          <DialogDescription>
            The founder of <span className="font-medium text-foreground">{ideaTitle}</span> keeps the business model, customers, market research and
            financials private. If they approve your request, you will be asked to accept confidentiality terms before you can read them.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="access-message">Message to the founder <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea id="access-message" rows={4} maxLength={1000} className="mt-1.5" value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Introduce yourself and say why you would like to read the full pitch." />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="bg-gradient-primary">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
              Send request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Template { version: string; title: string; body: string }

// The investor reads the confidentiality terms and accepts them. The server stores the exact text,
// the person, the time and where it came from.
export const NdaDialog = ({ requestId, ideaTitle, onClose, onAccepted }: {
  requestId: string | null;
  ideaTitle: string;
  onClose: () => void;
  onAccepted: () => void;
}) => {
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!requestId) return;
    setAgreed(false);
    setLoading(true);
    (async () => {
      const { data } = await supabase.from("nda_templates").select("version, title, body").order("created_at", { ascending: false }).limit(1).maybeSingle();
      setTemplate(data);
      setLoading(false);
    })();
  }, [requestId]);

  const accept = async () => {
    if (!requestId || !template) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("accept_nda", { _request_id: requestId, _nda_version: template.version });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Confidentiality terms accepted");
    onClose();
    onAccepted();
  };

  return (
    <Dialog open={!!requestId} onOpenChange={open => { if (!open && !submitting) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{template?.title ?? "Confidentiality Agreement"}</DialogTitle>
          <DialogDescription>
            Read these terms before opening the detailed pitch of <span className="font-medium text-foreground">{ideaTitle}</span>.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : !template ? (
          <p className="text-sm text-muted-foreground">The confidentiality terms could not be loaded. Please try again.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto whitespace-pre-line rounded-xl border border-border bg-muted/40 p-4 text-sm leading-relaxed" tabIndex={0} aria-label="Confidentiality terms">
            {template.body}
          </div>
        )}

        <div className="flex items-start gap-3">
          <Checkbox id="nda-agree" checked={agreed} onCheckedChange={v => setAgreed(v === true)} className="mt-0.5" />
          <Label htmlFor="nda-agree" className="text-sm font-normal leading-snug">
            I have read and agree to these confidentiality terms. I understand that PitchBridge records my name, email, the time and my IP address.
          </Label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Not now</Button>
          <Button type="button" onClick={accept} disabled={!agreed || !template || submitting} className="bg-gradient-primary">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            Accept and unlock the pitch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

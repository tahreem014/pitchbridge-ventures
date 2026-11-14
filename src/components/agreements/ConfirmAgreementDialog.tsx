import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AgreementItem, firstName, summaryLine } from "@/lib/agreements";
import { formatMoney } from "@/lib/portfolio";

// The last step before a person is bound to a version: they must tick that they read this exact version.
export const ConfirmAgreementDialog = ({ agreement, otherName, busy = false, onConfirm, onClose }: {
  agreement: AgreementItem | null;
  otherName: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) => {
  const [read, setRead] = useState(false);
  const agreementId = agreement?.id;
  const version = agreement?.version;
  // The tick belongs to one version: a new version (or another agreement) has to be read again.
  useEffect(() => { if (agreementId) setRead(false); }, [agreementId, version]);

  return (
    <Dialog open={!!agreement} onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Confirm this agreement</DialogTitle>
          <DialogDescription>
            {agreement ? `${summaryLine(agreement)} for ${agreement.ideaTitle ?? "this idea"}. Version ${agreement.version}.` : ""}
          </DialogDescription>
        </DialogHeader>

        {agreement && (
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Your confirmation is recorded with your name, email and the time. When you and {firstName(otherName)} have both confirmed the same version,
              the agreement is signed and {formatMoney(agreement.amount)} counts as raised. If anyone changes a term, a new version is made and confirmations start again.
            </p>
            <div className="flex items-start gap-3 rounded-xl border border-border p-4">
              <Checkbox id="read-agreement" checked={read} onCheckedChange={v => setRead(v === true)} className="mt-0.5" />
              <Label htmlFor="read-agreement" className="font-normal leading-snug">
                I have read version {agreement.version} of this agreement, including the payment schedule and responsibilities, and I agree to it.
              </Label>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button className="bg-gradient-primary" disabled={!read || busy} onClick={onConfirm}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm version {agreement?.version}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { EVIDENCE_NOTICE, NdaRecord, formatWhen } from "@/lib/pitchAccess";

const Row = ({ label, value, mono = false }: { label: string; value: string | null; mono?: boolean }) => (
  <div className="grid grid-cols-[8rem_1fr] gap-3 py-1.5 text-sm">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className={mono ? "break-all font-mono text-xs" : "break-words"}>{value || "Not recorded"}</dd>
  </div>
);

// The stored acceptance: who agreed, to which exact text, for which idea, when, and from where.
export const NdaRecordDialog = ({ record, onClose }: { record: NdaRecord | null; onClose: () => void }) => (
  <Dialog open={!!record} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 font-display text-xl"><ShieldCheck className="h-5 w-5 text-primary" /> Signed confidentiality record</DialogTitle>
        <DialogDescription>{record ? `For the detailed pitch of ${record.ideaTitle}` : ""}</DialogDescription>
      </DialogHeader>

      {record && (
        <>
          <dl className="divide-y divide-border rounded-xl border border-border px-4">
            <Row label="Accepted by" value={record.investorName} />
            <Row label="Email" value={record.investorEmail} />
            <Row label="Accepted on" value={formatWhen(record.acceptedAt)} />
            <Row label="IP address" value={record.ip} />
            <Row label="Device" value={record.userAgent} />
            <Row label="Terms version" value={record.version} />
            <Row label="Fingerprint" value={record.hash} mono />
          </dl>
          <div>
            <div className="mb-1.5 text-sm font-medium">The exact text that was accepted</div>
            <div className="max-h-56 overflow-y-auto whitespace-pre-line rounded-xl border border-border bg-muted/40 p-4 text-xs leading-relaxed" tabIndex={0} aria-label="Accepted confidentiality terms">
              {record.text}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{EVIDENCE_NOTICE}</p>
        </>
      )}

      <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
    </DialogContent>
  </Dialog>
);

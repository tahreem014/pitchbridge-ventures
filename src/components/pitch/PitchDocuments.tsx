import { useEffect, useState } from "react";
import { Download, Eye, FileText, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PitchDocument, downloadName, fetchStampedCopy, formatBytes, kindLabel } from "@/lib/pitchDocuments";

export const PitchDocuments = ({ documents, onView, note }: { documents: PitchDocument[]; onView: (doc: PitchDocument) => void; note?: string }) => {
  if (documents.length === 0) return null;
  return (
    <section className="mt-6">
      <h4 className="font-display font-semibold">Supporting documents</h4>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      <ul className="mt-3 space-y-2">
        {documents.map(doc => (
          <li key={doc.id} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
            <FileText className="h-5 w-5 flex-shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{doc.title}</p>
              <p className="text-xs text-muted-foreground">{kindLabel(doc.mimeType)} · {formatBytes(doc.sizeBytes)}</p>
            </div>
            <Button size="sm" variant="outline" aria-label={`View ${doc.title}`} onClick={() => onView(doc)}>
              <Eye className="mr-1.5 h-3.5 w-3.5" /> View
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
};

type ViewerState = { status: "loading" } | { status: "ready"; url: string } | { status: "error"; message: string };

// Shows the stamped copy the server returns. The original file is never sent to the browser.
export const DocumentViewerDialog = ({ doc, onClose }: { doc: PitchDocument | null; onClose: () => void }) => {
  const [state, setState] = useState<ViewerState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const docId = doc?.id;

  useEffect(() => {
    if (!docId) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setState({ status: "loading" });
    fetchStampedCopy(docId)
      .then(blob => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ status: "ready", url: objectUrl });
      })
      .catch((e: Error) => { if (!cancelled) setState({ status: "error", message: e.message }); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [docId, attempt]);

  return (
    <Dialog open={!!doc} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{doc?.title}</DialogTitle>
          <DialogDescription>
            Confidential. This copy has your name and email stamped on every page, and each time you open a document it is recorded.
          </DialogDescription>
        </DialogHeader>

        {state.status === "loading" && (
          <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            Preparing your copy...
          </div>
        )}

        {state.status === "error" && (
          <div className="flex h-[40vh] flex-col items-center justify-center gap-3 text-center">
            <ShieldAlert className="h-7 w-7 text-destructive" />
            <p className="max-w-md text-sm">{state.message}</p>
            <Button size="sm" variant="outline" onClick={() => setAttempt(a => a + 1)}>Try again</Button>
          </div>
        )}

        {state.status === "ready" && doc && (
          <div className="space-y-3">
            <iframe title={`${doc.title} (confidential copy)`} src={state.url} className="h-[65vh] w-full rounded-lg border border-border bg-muted" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Please do not copy or share it. Anything you share can be traced back to you.</p>
              <Button asChild size="sm" variant="outline">
                <a href={state.url} download={downloadName(doc.title)}><Download className="mr-1.5 h-3.5 w-3.5" /> Download this copy</a>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

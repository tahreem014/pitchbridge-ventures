import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ACCEPT_ATTRIBUTE, MAX_DOCUMENTS, MAX_FILE_BYTES, OwnDocument, formatBytes, kindLabel, listOwnDocuments, removeDocument,
  titleFromFileName, uploadDocument, validateFile,
} from "@/lib/pitchDocuments";

// The founder's side of supporting documents. Files go into a private bucket the moment they are added
// (each one becomes a new timestamped version of the pitch), separately from the Save button.
export const DocumentsEditor = ({ ideaId, userId }: { ideaId: string | null; userId: string | undefined }) => {
  const [docs, setDocs] = useState<OwnDocument[]>([]);
  const [loading, setLoading] = useState(!!ideaId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [inputKey, setInputKey] = useState(0); // changing the key empties the file input
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<OwnDocument | null>(null);

  const load = useCallback(async () => {
    if (!ideaId) return;
    setLoading(true);
    try {
      setDocs(await listOwnDocuments(ideaId));
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
    setLoading(false);
  }, [ideaId]);

  useEffect(() => { load(); }, [load]);

  const reset = () => { setFile(null); setTitle(""); setInputKey(k => k + 1); };

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0] ?? null;
    if (!chosen) { reset(); return; }
    const problem = validateFile(chosen);
    if (problem) { toast.error(problem); reset(); return; }
    setFile(chosen);
    if (!title.trim()) setTitle(titleFromFileName(chosen.name));
  };

  const upload = async () => {
    if (!file || !ideaId || !userId || busy) return;
    if (docs.length >= MAX_DOCUMENTS) { toast.error(`An idea can have at most ${MAX_DOCUMENTS} documents.`); return; }
    setBusy(true);
    try {
      const added = await uploadDocument({ ideaId, userId, file, title });
      setDocs(current => [...current, added]);
      reset();
      toast.success("Document added");
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  };

  const confirmRemove = async () => {
    const doc = removing;
    setRemoving(null);
    if (!doc) return;
    try {
      await removeDocument(doc);
      setDocs(current => current.filter(d => d.id !== doc.id));
      toast.success("Document removed");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div>
        <h4 className="font-display font-semibold">Supporting documents</h4>
        <p className="text-sm text-muted-foreground">
          Pitch deck, financial model, prototype screenshots. PDF, PNG or JPEG, up to {formatBytes(MAX_FILE_BYTES)} each, at most {MAX_DOCUMENTS} files.
          Investors never receive your original: they see a copy with their own name and email stamped on every page.
        </p>
      </div>

      {!ideaId ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Publish the idea first, then edit it to add documents.
        </p>
      ) : (
        <>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading documents...</p>
          ) : loadError ? (
            <p className="text-sm text-destructive">Could not load your documents: {loadError} <button type="button" className="underline" onClick={load}>Retry</button></p>
          ) : docs.length === 0 ? (
            <p className="text-sm italic text-muted-foreground/80">No documents yet.</p>
          ) : (
            <ul className="space-y-2">
              {docs.map(doc => (
                <li key={doc.id} className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-2.5">
                  <FileText className="h-5 w-5 flex-shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">{kindLabel(doc.mimeType)} · {formatBytes(doc.sizeBytes)} · added {format(new Date(doc.createdAt), "MMM d, yyyy")}</p>
                  </div>
                  <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${doc.title}`} onClick={() => setRemoving(doc)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-3 rounded-xl border border-dashed border-border p-4 md:grid-cols-2">
            <div>
              <Label htmlFor="doc-file">Document file</Label>
              <Input key={inputKey} id="doc-file" type="file" accept={ACCEPT_ATTRIBUTE} onChange={pick} disabled={busy} />
            </div>
            <div>
              <Label htmlFor="doc-title">Document title</Label>
              <Input
                id="doc-title" value={title} maxLength={120} placeholder="Pitch deck" disabled={busy}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); upload(); } }} // Enter here must not save the whole idea
              />
            </div>
            <div className="md:col-span-2">
              <Button type="button" size="sm" variant="outline" disabled={!file || busy || docs.length >= MAX_DOCUMENTS} onClick={upload}>
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
                {busy ? "Uploading..." : "Add document"}
              </Button>
              {docs.length >= MAX_DOCUMENTS && <span className="ml-3 text-xs text-muted-foreground">You have reached the limit of {MAX_DOCUMENTS} documents.</span>}
            </div>
          </div>
        </>
      )}

      <AlertDialog open={!!removing} onOpenChange={open => { if (!open) setRemoving(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this document?</AlertDialogTitle>
            <AlertDialogDescription>
              "{removing?.title}" will no longer be available to investors. The removal is recorded as a new version of your pitch, and the earlier versions keep its fingerprint.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmRemove}>
              Remove document
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
